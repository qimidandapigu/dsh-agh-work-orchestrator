import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { parseWorkIntent, WorkSessionService, type WorkNotification } from '../src/work-session-service.js'

function assistantEvent(seq: number, text: string) {
  return {
    seq,
    time: Date.now(),
    type: 'assistant/message',
    data: {
      turn: seq,
      step: 0,
      message: { content: [{ type: 'text', text }] },
    },
  }
}

function fakeHandle(id: string, reply: (prompt: string) => string): AgentHandle {
  const events: ReturnType<typeof assistantEvent>[] = []
  const agent = {
    id,
    status: 'idle',
    options: {},
    inbox: {},
    ctx: {},
    session: {
      id,
      get seq() { return events.length },
      events,
    },
    followup(message: { content: Array<{ type: string; text?: string }> }) {
      const prompt = message.content.map(block => block.text ?? '').join('')
      events.push(assistantEvent(events.length, reply(prompt)))
    },
    whenIdle: async () => undefined,
    cancel: () => undefined,
    send: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
    runMaintenance: async <T>(task: (signal: AbortSignal) => Promise<T>) => await task(new AbortController().signal),
  }
  return { agent, dispose: async () => undefined } as unknown as AgentHandle
}

describe('post-turn work skill', () => {
  it('parses only bounded work intent objects', () => {
    expect(parseWorkIntent('{"kind":"start","title":"汇报","instruction":"生成一个 HTML"}')).toEqual({
      kind: 'start', title: '汇报', instruction: '生成一个 HTML',
    })
    expect(parseWorkIntent('```json\n{"kind":"continue","instruction":"第二部分重写"}\n```')).toEqual({
      kind: 'continue', instruction: '第二部分重写',
    })
    expect(parseWorkIntent('{"kind":"start","title":"","instruction":"缺少标题"}')).toEqual({ kind: 'none' })
    expect(parseWorkIntent('not json')).toEqual({ kind: 'none' })
  })

  it('answers first, then recognizes and reuses a separate Worker DSH Session', async () => {
    const modelReplies = [
      '{"kind":"start","title":"AI 游戏行业汇报","instruction":"生成明天汇报用的 HTML"}',
      '{"kind":"continue","instruction":"第二部分思路不对，重新整理"}',
    ]
    let recognitionCalls = 0
    let createCalls = 0
    const notifications: WorkNotification[] = []
    const source = fakeHandle('companion-session', prompt => {
      expect(prompt).toContain('XIAOTANGYUAN_WORK_RELAY_V1')
      return '我收到后台工作的更新了，你可以继续告诉我怎么调整。'
    })
    const workers: AgentHandle[] = []
    const ctx = {
      logger: { warn: () => undefined },
      llm: {
        stream: async function* () {
          recognitionCalls += 1
          yield { type: 'text-delta', index: 0, text: modelReplies.shift() ?? '{"kind":"none"}' }
        },
      },
      agents: {
        get: (id: string) => id === 'companion-session' ? source.agent : undefined,
        create: async (options: { sessionId: string }) => {
          createCalls += 1
          const worker = fakeHandle(options.sessionId, prompt => {
            expect(prompt).toContain('XIAOTANGYUAN_WORK_SESSION_V1')
            return prompt.includes('继续处理') ? '已按反馈重排第二部分。' : '建议先确认三段式汇报思路。'
          })
          workers.push(worker)
          return worker
        },
      },
    } as unknown as Context
    const service = new WorkSessionService(ctx, true, {
      provider: 'zai', model: 'glm-5.2', reasoningEffort: 'off' as never,
    })
    const base = {
      companionSessionId: 'companion-session',
      companionReply: '好，我先接下来。',
      selection: { provider: 'test', model: 'test-model' },
      source: 'voice' as const,
      notify: (notification: WorkNotification) => { notifications.push(notification) },
    }

    service.scheduleTurn({ ...base, playerText: '帮我生成明天汇报用的 HTML' })
    expect(recognitionCalls).toBe(0)
    expect(createCalls).toBe(0)
    await service.flush()

    expect(recognitionCalls).toBe(1)
    expect(createCalls).toBe(1)
    expect(workers[0]?.agent.id).not.toBe(source.agent.id)
    expect(notifications).toEqual([expect.objectContaining({
      title: 'AI 游戏行业汇报', kind: 'update', text: '我收到后台工作的更新了，你可以继续告诉我怎么调整。',
    })])

    service.scheduleTurn({ ...base, playerText: '第二部分思路不对，请重新整理' })
    await service.flush()
    expect(recognitionCalls).toBe(2)
    expect(createCalls).toBe(1)
    expect(notifications).toHaveLength(2)
    await service.close()
  })
})
