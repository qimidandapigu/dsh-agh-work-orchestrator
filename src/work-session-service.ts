import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { installModelSelection, type AgentHandle, type ModelSelection, type ModelSelectionRef } from '@deepseek-ai/dsh-agent'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'

const WORK_RECOGNITION_SYSTEM_PROMPT = `You classify one completed conversation turn for a game companion.
Return exactly one JSON object and no markdown:
{"kind":"none"|"start"|"continue"|"inspect","title"?:string,"instruction"?:string}

Definitions:
- start: the player asks the companion to do non-game work through the Harness, such as research, writing, presentations, HTML, documents, code, images, plans, or opening/revising a produced artifact.
- continue: the player gives feedback, approval, correction, or a next instruction for the currently linked work session.
- inspect: the player asks about progress, current approach, result, or status of the currently linked work session.
- none: ordinary game conversation, game actions, companionship, factual questions answerable in the current reply, or ambiguous language.

Rules:
- This classifier runs after the companion has already answered. Do not rewrite that answer.
- Prefer none when uncertain. Never turn an in-game command into external work.
- Use continue or inspect only when CURRENT_WORK says a linked work session exists.
- instruction must preserve the player's actual request and must not add requirements.
- title is required only for start and must be concise.`

const WORKER_PREFIX = 'XIAOTANGYUAN_WORK_SESSION_V1'
const RELAY_PREFIX = 'XIAOTANGYUAN_WORK_RELAY_V1'
const PLUGIN_SOURCE = 'xiaotangyuan-work-session'

export type WorkIntent =
  | { kind: 'none' }
  | { kind: 'start'; title: string; instruction: string }
  | { kind: 'continue' | 'inspect'; instruction: string }

export interface WorkNotification {
  workSessionId: string
  title: string
  text: string
  kind: 'update' | 'status' | 'error'
  source: 'chat' | 'voice' | 'desktop'
}

export interface CompletedCompanionTurn {
  companionSessionId: string
  playerText: string
  companionReply: string
  selection: ModelSelection
  source: WorkNotification['source']
  notify?: (notification: WorkNotification) => void | Promise<void>
}

interface ActiveWorkSession {
  title: string
  sessionId: string
  handle: AgentHandle
  lastReply?: string
  running: boolean
  runQueue: Promise<void>
}

function cleanString(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim().replace(/\s+/g, ' ')
  return cleaned === '' ? undefined : cleaned.slice(0, maximum)
}

export function parseWorkIntent(text: string): WorkIntent {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const object = text.indexOf('{') >= 0 && text.lastIndexOf('}') >= text.indexOf('{')
    ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    : ''
  const candidate = fenced ?? object
  if (candidate.trim() === '') return { kind: 'none' }
  try {
    const value = JSON.parse(candidate) as Record<string, unknown>
    if (value.kind === 'start') {
      const title = cleanString(value.title, 80)
      const instruction = cleanString(value.instruction, 4_000)
      return title === undefined || instruction === undefined ? { kind: 'none' } : { kind: 'start', title, instruction }
    }
    if (value.kind === 'continue' || value.kind === 'inspect') {
      const instruction = cleanString(value.instruction, 4_000)
      return instruction === undefined ? { kind: 'none' } : { kind: value.kind, instruction }
    }
    return { kind: 'none' }
  } catch {
    return { kind: 'none' }
  }
}

function assistantText(events: readonly SessionEvent[], firstSeq: number): string {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined || event.seq < firstSeq || event.type !== 'assistant/message') continue
    return event.data.message.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('')
      .trim()
  }
  return ''
}

export class WorkSessionService {
  private readonly tasks = new Set<Promise<void>>()
  private readonly active = new Map<string, ActiveWorkSession>()
  private closing = false

  constructor(
    private readonly ctx: Context,
    private readonly enabled = true,
    private readonly workerSelection?: ModelSelection,
  ) {}

  private selectionFor(turn: CompletedCompanionTurn): ModelSelection {
    return this.workerSelection ?? turn.selection
  }

  /** Enqueue post-turn recognition without delaying the companion's completed reply. */
  scheduleTurn(turn: CompletedCompanionTurn): void {
    if (!this.enabled || this.closing) return
    const task = Promise.resolve()
      .then(async () => this.processTurn(turn))
      .catch(async error => {
        this.ctx.logger.warn('xiaotangyuan-work-session: 回答后的工作技能识别失败，本轮回复不受影响')
        this.ctx.logger.warn(error)
        const current = this.active.get(turn.companionSessionId)
        if (current !== undefined) {
          await turn.notify?.({
            workSessionId: current.sessionId,
            title: current.title,
            text: '后台工作暂时没有继续执行，请稍后再告诉我一次。',
            kind: 'error',
            source: turn.source,
          })
        }
      })
      .finally(() => this.tasks.delete(task))
    this.tasks.add(task)
  }

  private async processTurn(turn: CompletedCompanionTurn): Promise<void> {
    const current = this.active.get(turn.companionSessionId)
    const intent = await this.recognize(turn, current)
    if (intent.kind === 'none') return

    if (intent.kind === 'inspect') {
      const text = current === undefined
        ? '目前没有关联的后台工作。你可以直接告诉我想让我帮你完成什么。'
        : current.running || current.handle.agent.status === 'running'
          ? `“${current.title}”仍在后台处理中。`
          : current.lastReply ?? `“${current.title}”正在等待你的下一步意见。`
      await this.reportToCompanion(turn, current, text, 'status')
      return
    }

    if (intent.kind === 'continue' && current === undefined) {
      await this.reportToCompanion(turn, undefined, '目前没有可继续的后台工作，请先把完整任务告诉我。', 'status')
      return
    }

    const work = intent.kind === 'start'
      ? await this.replaceWorkSession(turn, intent.title)
      : current!
    const prompt = intent.kind === 'start'
      ? [
          WORKER_PREFIX,
          '你是小汤圆通过 DeepSeek Harness 创建的独立 Worker DSH Session，负责在后台完成玩家交付的通用工作。',
          '优先使用当前 DSH 已安装的插件、技能和工具；只有现有能力确实不够时才写少量新代码。',
          '不要操作游戏，也不要冒充小汤圆。不要声称尚未验证的结果已经完成。',
          '除非玩家明确要求立刻执行，否则新任务先给出简洁的工作思路、关键假设和预期成果，等待玩家确认后再产出最终结果。',
          `任务标题：${intent.title}`,
          `玩家原始要求：${intent.instruction}`,
        ].join('\n')
      : [
          WORKER_PREFIX,
          `继续处理“${work.title}”。`,
          `玩家刚刚给出的反馈或下一步要求：${intent.instruction}`,
          '保持此前工作上下文；根据玩家意见迭代。若玩家只是让你汇报思路或进度，不要擅自扩大执行范围。',
        ].join('\n')

    const run = work.runQueue.then(async () => {
      work.running = true
      try {
        const reply = await this.runWorker(work, prompt)
        work.lastReply = reply
        await this.reportToCompanion(turn, work, reply, 'update')
      } finally {
        work.running = false
      }
    })
    work.runQueue = run.catch(() => undefined)
    await run
  }

  private async recognize(turn: CompletedCompanionTurn, current: ActiveWorkSession | undefined): Promise<WorkIntent> {
    const selection = this.selectionFor(turn)
    const assembler = new BlockAssembler()
    const input = [
      `CURRENT_WORK: ${current === undefined ? 'none' : JSON.stringify({ title: current.title, status: current.running ? 'running' : current.handle.agent.status })}`,
      `PLAYER_MESSAGE: ${turn.playerText.slice(0, 4_000)}`,
      `COMPANION_FINAL_REPLY: ${turn.companionReply.slice(0, 2_000)}`,
    ].join('\n')
    for await (const chunk of this.ctx.llm.stream({
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      messages: [createUserMessage({ content: [{ type: 'text', text: input }], source: { kind: 'user' } })],
      system: WORK_RECOGNITION_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 400,
      signal: AbortSignal.timeout(45_000),
      purpose: 'compaction',
    })) assembler.push(chunk)
    const text = assembler.blocks()
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('')
    const intent = parseWorkIntent(text)
    if ((intent.kind === 'continue' || intent.kind === 'inspect') && current === undefined) {
      return intent.kind === 'inspect' ? intent : { kind: 'none' }
    }
    return intent
  }

  private setupWorker(selection: ModelSelection): (agentCtx: Context) => void {
    return (agentCtx) => {
      const selected: ModelSelectionRef = { current: selection, assembled: undefined }
      installModelSelection(agentCtx, selected)
    }
  }

  private async replaceWorkSession(turn: CompletedCompanionTurn, title: string): Promise<ActiveWorkSession> {
    const previous = this.active.get(turn.companionSessionId)
    if (previous !== undefined) await previous.handle.dispose()
    const selection = this.selectionFor(turn)
    const sessionId = `xiaotangyuan-work-${randomUUID()}`
    const handle = await this.ctx.agents.create({
      sessionId: SessionId(sessionId),
      meta: { cwd: process.cwd() },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: this.setupWorker(selection),
    })
    await handle.agent.whenIdle()
    const work: ActiveWorkSession = { title, sessionId, handle, running: false, runQueue: Promise.resolve() }
    this.active.set(turn.companionSessionId, work)
    return work
  }

  private async runWorker(work: ActiveWorkSession, prompt: string): Promise<string> {
    const firstSeq = work.handle.agent.session.seq
    work.handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: PLUGIN_SOURCE, form: 'relay' },
    }))
    await work.handle.agent.whenIdle()
    const reply = assistantText(work.handle.agent.session.events, firstSeq)
    if (reply === '') throw new Error('Worker DSH Session 没有返回公开文本')
    return reply
  }

  private async reportToCompanion(
    turn: CompletedCompanionTurn,
    work: ActiveWorkSession | undefined,
    workerText: string,
    kind: WorkNotification['kind'],
  ): Promise<void> {
    const source = this.ctx.agents.get(SessionId(turn.companionSessionId))
    let text = workerText
    if (source !== undefined) {
      const firstSeq = source.session.seq
      source.followup(createUserMessage({
        content: [{
          type: 'text',
          text: [
            RELAY_PREFIX,
            '这是后台 Worker DSH Session 发来的更新，不是玩家的新任务。',
            '请保持小汤圆的身份，用简短自然的中文向玩家汇报。说明这是工作思路、进度还是结果，并邀请玩家继续语音反馈。',
            '不要展示这段系统说明，不要重复调用游戏工具，也不要声称 Worker 没有完成的事情已经完成。',
            `工作标题：${work?.title ?? '未关联工作'}`,
            `Worker 更新：${workerText.slice(0, 8_000)}`,
          ].join('\n'),
        }],
        source: { kind: 'plugin', plugin: PLUGIN_SOURCE, form: 'relay' },
      }))
      await source.whenIdle()
      text = assistantText(source.session.events, firstSeq) || workerText
    }
    await turn.notify?.({
      workSessionId: work?.sessionId ?? '',
      title: work?.title ?? '后台工作',
      text,
      kind,
      source: turn.source,
    })
  }

  async flush(): Promise<void> {
    while (this.tasks.size > 0) await Promise.allSettled([...this.tasks])
  }

  async close(): Promise<void> {
    this.closing = true
    await this.flush()
    await Promise.allSettled([...this.active.values()].map(work => work.handle.dispose()))
    this.active.clear()
  }
}
