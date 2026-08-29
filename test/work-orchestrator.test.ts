import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { describe, expect, it } from 'vitest'
import {
  WORK_RELAY_PREFIX,
  WorkOrchestratorService,
  parseWorkIntent,
  resolveConfig,
  type WorkNotification,
} from '../src/index.js'

function assistantEvent(seq: number, text: string) {
  return {
    seq,
    time: Date.now(),
    type: 'assistant/message',
    data: { turn: seq, step: 0, message: { content: [{ type: 'text', text }] } },
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
    session: { id, get seq() { return events.length }, events },
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

function createContext(
  modelReplies: string[],
  agents: Record<string, unknown>,
): { ctx: Context; release: () => Promise<void> } {
  const ctx = new Context()
  const releaseLlm = ctx.provide('llm', {
    stream: async function* () {
      yield { type: 'text-delta', index: 0, text: modelReplies.shift() ?? '{"kind":"none"}' }
    },
  } as never)
  const releaseAgents = ctx.provide('agents', agents as never)
  return {
    ctx,
    release: async () => {
      await releaseAgents()
      await releaseLlm()
    },
  }
}

function config(directory: string) {
  return {
    enabled: true,
    selection: { provider: 'zai', model: 'glm-5.2', reasoningEffort: 'off' as never },
    directory,
    legacyDirectories: [],
  }
}

describe('DSH Work Orchestrator', () => {
  it('validates independent plugin configuration and parses bounded intents', () => {
    expect(resolveConfig({ provider: 'zai', model: 'glm-5.2' }).selection).toMatchObject({ provider: 'zai', model: 'glm-5.2' })
    expect(() => resolveConfig({ provider: 'zai' })).toThrow('provider and model')
    expect(parseWorkIntent('{"kind":"start","title":"汇报","instruction":"生成一个 HTML"}')).toEqual({
      kind: 'start', title: '汇报', instruction: '生成一个 HTML',
    })
    expect(parseWorkIntent('not json')).toEqual({ kind: 'none' })
  })

  it('answers first, then creates and reuses one native Worker DSH Session', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-work-'))
    const modelReplies = [
      '{"kind":"start","title":"AI 游戏行业汇报","instruction":"生成明天汇报用的 HTML"}',
      '{"kind":"continue","instruction":"第二部分思路不对，重新整理"}',
    ]
    let createCalls = 0
    const notifications: WorkNotification[] = []
    const source = fakeHandle('companion-session', prompt => {
      expect(prompt).toContain(WORK_RELAY_PREFIX)
      expect(prompt).toContain('小汤圆')
      return '我收到后台工作的更新了，你可以继续告诉我怎么调整。'
    })
    const workers: AgentHandle[] = []
    const runtime = createContext(modelReplies, {
      get: (id: string) => id === 'companion-session' ? source.agent : undefined,
      create: async (options: { sessionId: string }) => {
        createCalls += 1
        const worker = fakeHandle(options.sessionId, prompt => {
          expect(prompt).toContain('DSH_WORKER_SESSION_V1')
          return prompt.includes('继续处理') ? '已按反馈重排第二部分。' : '建议先确认三段式汇报思路。'
        })
        workers.push(worker)
        return worker
      },
    })
    const service = new WorkOrchestratorService(runtime.ctx, config(directory))
    const base = {
      companionSessionId: 'companion-session',
      companionReply: '好，我先接下来。',
      selection: { provider: 'test', model: 'test-model' },
      source: 'voice',
      companion: { id: 'xiaotangyuan', name: '小汤圆' },
      notify: (notification: WorkNotification) => { notifications.push(notification) },
    }
    try {
      service.scheduleTurn({ ...base, playerText: '帮我生成明天汇报用的 HTML' })
      expect(createCalls).toBe(0)
      await service.flush()
      expect(createCalls).toBe(1)
      expect(workers[0]?.agent.id).toMatch(/^dsh-work-/)
      expect(workers[0]?.agent.id).not.toBe(source.agent.id)

      service.scheduleTurn({ ...base, playerText: '第二部分思路不对，请重新整理' })
      await service.flush()
      expect(createCalls).toBe(1)
      expect(notifications).toHaveLength(2)
    } finally {
      await service.close()
      await runtime.release()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('resumes the same Worker after restart without persisting task content', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-work-links-'))
    let workerSessionId = ''
    const source = fakeHandle('companion-session', () => '后台更新已经收到。')
    const firstRuntime = createContext(
      ['{"kind":"start","title":"行业汇报","instruction":"先给出汇报思路"}'],
      {
        get: () => source.agent,
        create: async (options: { sessionId: string }) => {
          workerSessionId = options.sessionId
          return fakeHandle(options.sessionId, () => '建议使用三段式汇报。')
        },
      },
    )
    const base = {
      companionSessionId: 'companion-session',
      companionReply: '好。',
      selection: { provider: 'game', model: 'vision' },
      source: 'voice',
    }
    try {
      const first = new WorkOrchestratorService(firstRuntime.ctx, config(directory))
      first.scheduleTurn({ ...base, playerText: '帮我准备一份行业汇报' })
      await first.flush()
      await first.close()
      await firstRuntime.release()

      expect(workerSessionId).toMatch(/^dsh-work-/)
      const stored = readFileSync(join(directory, 'work-session-links-v1.json'), 'utf8')
      expect(stored).toContain(workerSessionId)
      expect(stored).not.toContain('先给出汇报思路')

      let resumeCalls = 0
      let createCalls = 0
      const secondRuntime = createContext(
        ['{"kind":"continue","instruction":"把第二部分改短一点"}'],
        {
          get: () => source.agent,
          create: async () => { createCalls += 1; throw new Error('must resume') },
          resume: async (options: { resumeSessionId: string }) => {
            resumeCalls += 1
            expect(options.resumeSessionId).toBe(workerSessionId)
            return fakeHandle(options.resumeSessionId, prompt => {
              expect(prompt).toContain('把第二部分改短一点')
              return '第二部分已经缩短。'
            })
          },
        },
      )
      const second = new WorkOrchestratorService(secondRuntime.ctx, config(directory))
      second.scheduleTurn({ ...base, playerText: '刚才那个第二部分改短一点' })
      await second.flush()
      expect(resumeCalls).toBe(1)
      expect(createCalls).toBe(0)
      await second.close()
      await secondRuntime.release()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('migrates an existing XiaoTangYuan link index and accepts its Worker prefix', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-work-new-'))
    const legacy = mkdtempSync(join(tmpdir(), 'dsh-work-legacy-'))
    const selection = { provider: 'zai', model: 'glm-5.2' }
    writeFileSync(join(legacy, 'work-session-links-v1.json'), JSON.stringify({
      schemaVersion: 1,
      links: {
        companion: {
          companionSessionId: 'companion',
          workerSessionId: 'xiaotangyuan-work-existing',
          title: '旧任务',
          selection,
          status: 'waiting',
          updatedAt: Date.now(),
        },
      },
    }))
    const runtime = createContext([], {})
    try {
      const service = new WorkOrchestratorService(runtime.ctx, {
        enabled: false, directory, legacyDirectories: [legacy], selection,
      })
      expect(readFileSync(join(directory, 'work-session-links-v1.json'), 'utf8')).toContain('xiaotangyuan-work-existing')
      await service.close()
    } finally {
      await runtime.release()
      rmSync(directory, { recursive: true, force: true })
      rmSync(legacy, { recursive: true, force: true })
    }
  })
})
