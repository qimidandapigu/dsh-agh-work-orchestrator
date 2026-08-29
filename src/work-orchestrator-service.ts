import { randomUUID } from 'node:crypto'
import { Service, type Context } from '@deepseek-ai/cordis'
import { installModelSelection, type AgentHandle, type ModelSelection, type ModelSelectionRef } from '@deepseek-ai/dsh-agent'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { ResolvedConfig } from './config.js'
import { WorkSessionLinkStore, type WorkSessionLink } from './work-session-link-store.js'

export const WORK_RELAY_PREFIX = 'DSH_WORK_RELAY_V1'
export const LEGACY_WORK_RELAY_PREFIX = 'XIAOTANGYUAN_WORK_RELAY_V1'

const WORK_RECOGNITION_SYSTEM_PROMPT = `You classify one completed conversation turn for an AI companion.
Return exactly one JSON object and no markdown:
{"kind":"none"|"start"|"continue"|"inspect","title"?:string,"instruction"?:string}

Definitions:
- start: the player asks the companion to do substantial external work through DeepSeek Harness, such as research, writing, presentations, HTML, documents, code, images, plans, or opening/revising a produced artifact.
- continue: the player gives feedback, approval, correction, or a next instruction for the currently linked work session.
- inspect: the player asks about progress, current approach, result, or status of the currently linked work session.
- none: ordinary conversation, in-game actions, companionship, factual questions answerable in the current reply, or ambiguous language.

Rules:
- This classifier runs after the companion has already answered. Do not rewrite that answer.
- Prefer none when uncertain. Never turn an in-game command into external work.
- Use continue or inspect only when CURRENT_WORK says a linked work session exists.
- instruction must preserve the player's actual request and must not add requirements.
- title is required only for start and must be concise.`

const WORKER_PREFIX = 'DSH_WORKER_SESSION_V1'

export type WorkIntent =
  | { kind: 'none' }
  | { kind: 'start'; title: string; instruction: string }
  | { kind: 'continue' | 'inspect'; instruction: string }

export interface WorkCompanionProfile {
  /** Stable caller identity for prompts and future policy routing. */
  id: string
  /** User-facing name used only when the Worker or source Session needs context. */
  name: string
  /** Optional caller-owned rules for the independent Worker. */
  workerInstructions?: string
  /** Optional caller-owned rules for presenting Worker updates. */
  relayInstructions?: string
}

export interface WorkNotification {
  workSessionId: string
  title: string
  text: string
  kind: 'update' | 'status' | 'error'
  source: string
}

export interface CompletedCompanionTurn {
  companionSessionId: string
  playerText: string
  companionReply: string
  selection: ModelSelection
  source: string
  companion?: WorkCompanionProfile
  notify?: (notification: WorkNotification) => void | Promise<void>
}

interface ActiveWorkSession {
  title: string
  sessionId: string
  selection: ModelSelection
  handle: AgentHandle
  lastReply?: string
  running: boolean
  runQueue: Promise<void>
}

interface LinkedWorkReference {
  title: string
  sessionId: string
}

function linkReference(link: WorkSessionLink | undefined): LinkedWorkReference | undefined {
  return link === undefined ? undefined : { title: link.title, sessionId: link.workerSessionId }
}

function companionProfile(turn: CompletedCompanionTurn): WorkCompanionProfile {
  return turn.companion ?? { id: 'companion', name: '当前陪伴角色' }
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

/** Generic post-turn work orchestration backed only by native DSH Sessions. */
export class WorkOrchestratorService extends Service {
  private readonly tasks = new Set<Promise<void>>()
  private readonly active = new Map<string, ActiveWorkSession>()
  private readonly failedRestores = new Map<string, WorkSessionLink>()
  private readonly linkStore: WorkSessionLinkStore
  private closing = false

  constructor(ctx: Context, readonly config: ResolvedConfig) {
    super(ctx, 'workOrchestrator')
    this.linkStore = new WorkSessionLinkStore(config.directory, config.legacyDirectories)
  }

  private selectionFor(turn: CompletedCompanionTurn): ModelSelection {
    return this.config.selection ?? turn.selection
  }

  /** Enqueue recognition after the caller's answer without delaying that answer. */
  scheduleTurn(turn: CompletedCompanionTurn): void {
    if (!this.config.enabled || this.closing) return
    const task = Promise.resolve()
      .then(async () => this.processTurn(turn))
      .catch(async error => {
        this.ctx.logger.warn('dsh-work-orchestrator: post-turn recognition failed; the completed companion reply is unaffected')
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
    const recovered = await this.restoreWorkSession(turn)
    const current = recovered.current
    const intent = await this.recognize(turn, current, recovered.unavailable)
    if (intent.kind === 'none') return

    if (intent.kind === 'inspect') {
      const text = recovered.unavailable !== undefined
        ? `“${recovered.unavailable.title}”的关联记录还在，但原 Worker Session 暂时无法恢复。没有新建任务，请检查 DSH 会话持久化后再试。`
        : current === undefined
          ? '目前没有关联的后台工作。你可以直接告诉我想让我帮你完成什么。'
          : current.running || current.handle.agent.status === 'running'
            ? `“${current.title}”仍在后台处理中。`
            : current.lastReply ?? `“${current.title}”正在等待你的下一步意见。`
      await this.reportToCompanion(turn, current ?? linkReference(recovered.unavailable), text, recovered.unavailable === undefined ? 'status' : 'error')
      return
    }

    if (intent.kind === 'continue' && current === undefined) {
      const text = recovered.unavailable === undefined
        ? '目前没有可继续的后台工作，请先把完整任务告诉我。'
        : `“${recovered.unavailable.title}”的记录还在，但原 Worker Session 暂时无法恢复；我没有另建新任务。请检查 DSH 会话持久化后再试。`
      await this.reportToCompanion(turn, linkReference(recovered.unavailable), text, recovered.unavailable === undefined ? 'status' : 'error')
      return
    }

    const work = intent.kind === 'start'
      ? await this.replaceWorkSession(turn, intent.title)
      : current!
    const profile = companionProfile(turn)
    const prompt = intent.kind === 'start'
      ? [
          WORKER_PREFIX,
          `你是由“${profile.name}”通过 DeepSeek Harness 创建的独立 Worker DSH Session，负责在后台完成玩家交付的通用工作。`,
          '优先使用当前 DSH 已安装的插件、技能和工具；只有现有能力确实不够时才写少量新代码。',
          '不要操作游戏，也不要冒充发起工作的陪伴角色。不要声称尚未验证的结果已经完成。',
          '除非玩家明确要求立刻执行，否则新任务先给出简洁的工作思路、关键假设和预期成果，等待玩家确认后再产出最终结果。',
          profile.workerInstructions,
          `任务标题：${intent.title}`,
          `玩家原始要求：${intent.instruction}`,
        ].filter((line): line is string => line !== undefined && line !== '').join('\n')
      : [
          WORKER_PREFIX,
          `继续处理“${work.title}”。`,
          `玩家刚刚给出的反馈或下一步要求：${intent.instruction}`,
          '保持此前工作上下文；根据玩家意见迭代。若玩家只是让你汇报思路或进度，不要擅自扩大执行范围。',
          profile.workerInstructions,
        ].filter((line): line is string => line !== undefined && line !== '').join('\n')

    const run = work.runQueue.then(async () => {
      work.running = true
      this.saveLink(turn.companionSessionId, work, 'active')
      try {
        const reply = await this.runWorker(work, prompt)
        work.lastReply = reply
        await this.reportToCompanion(turn, work, reply, 'update')
      } finally {
        work.running = false
        this.saveLink(turn.companionSessionId, work, 'waiting')
      }
    })
    work.runQueue = run.catch(() => undefined)
    await run
  }

  private async recognize(
    turn: CompletedCompanionTurn,
    current: ActiveWorkSession | undefined,
    unavailable: WorkSessionLink | undefined,
  ): Promise<WorkIntent> {
    const selection = this.selectionFor(turn)
    const assembler = new BlockAssembler()
    const input = [
      `CURRENT_WORK: ${current !== undefined
        ? JSON.stringify({ title: current.title, status: current.running ? 'running' : current.handle.agent.status })
        : unavailable !== undefined
          ? JSON.stringify({ title: unavailable.title, status: 'unavailable' })
          : 'none'}`,
      `COMPANION: ${JSON.stringify(companionProfile(turn))}`,
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
    if ((intent.kind === 'continue' || intent.kind === 'inspect') && current === undefined && unavailable === undefined) {
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

  private saveLink(companionSessionId: string, work: ActiveWorkSession, status: WorkSessionLink['status']): void {
    this.linkStore.set({
      companionSessionId,
      workerSessionId: work.sessionId,
      title: work.title,
      selection: work.selection,
      status,
      updatedAt: Date.now(),
    })
  }

  private async restoreWorkSession(turn: CompletedCompanionTurn): Promise<{
    current?: ActiveWorkSession
    unavailable?: WorkSessionLink
  }> {
    const current = this.active.get(turn.companionSessionId)
    if (current !== undefined) return { current }
    const failed = this.failedRestores.get(turn.companionSessionId)
    if (failed !== undefined) return { unavailable: failed }
    const link = this.linkStore.get(turn.companionSessionId)
    if (link === undefined) return {}
    try {
      const handle = await this.ctx.agents.resume({
        resumeSessionId: SessionId(link.workerSessionId),
        agentOptions: { provider: link.selection.provider, model: link.selection.model },
        setup: this.setupWorker(link.selection),
      })
      await handle.agent.whenIdle()
      const restored: ActiveWorkSession = {
        title: link.title,
        sessionId: link.workerSessionId,
        selection: link.selection,
        handle,
        lastReply: assistantText(handle.agent.session.events, 0) || undefined,
        running: false,
        runQueue: Promise.resolve(),
      }
      this.active.set(turn.companionSessionId, restored)
      this.saveLink(turn.companionSessionId, restored, 'waiting')
      return { current: restored }
    } catch (error) {
      const unavailable = { ...link, status: 'unavailable' as const, updatedAt: Date.now() }
      this.failedRestores.set(turn.companionSessionId, unavailable)
      this.linkStore.set(unavailable)
      this.ctx.logger.warn(`dsh-work-orchestrator: cannot resume Worker Session ${link.workerSessionId}`)
      this.ctx.logger.warn(error)
      return { unavailable }
    }
  }

  private async replaceWorkSession(turn: CompletedCompanionTurn, title: string): Promise<ActiveWorkSession> {
    const previous = this.active.get(turn.companionSessionId)
    const selection = this.selectionFor(turn)
    const sessionId = `dsh-work-${randomUUID()}`
    const handle = await this.ctx.agents.create({
      sessionId: SessionId(sessionId),
      meta: { cwd: process.cwd() },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: this.setupWorker(selection),
    })
    await handle.agent.whenIdle()
    const work: ActiveWorkSession = { title, sessionId, selection, handle, running: false, runQueue: Promise.resolve() }
    this.active.set(turn.companionSessionId, work)
    this.failedRestores.delete(turn.companionSessionId)
    this.saveLink(turn.companionSessionId, work, 'waiting')
    if (previous !== undefined) {
      await previous.handle.dispose().catch(error => {
        this.ctx.logger.warn('dsh-work-orchestrator: new Worker replaced the previous Worker, but cleanup failed')
        this.ctx.logger.warn(error)
      })
    }
    return work
  }

  private async runWorker(work: ActiveWorkSession, prompt: string): Promise<string> {
    const firstSeq = work.handle.agent.session.seq
    work.handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: 'dsh-work-orchestrator', form: 'instructions' },
    }))
    await work.handle.agent.whenIdle()
    const reply = assistantText(work.handle.agent.session.events, firstSeq)
    if (reply === '') throw new Error('Worker DSH Session returned no public text')
    return reply
  }

  private async reportToCompanion(
    turn: CompletedCompanionTurn,
    work: LinkedWorkReference | undefined,
    workerText: string,
    kind: WorkNotification['kind'],
  ): Promise<void> {
    const source = this.ctx.agents.get(SessionId(turn.companionSessionId))
    const profile = companionProfile(turn)
    let text = workerText
    if (source !== undefined) {
      const firstSeq = source.session.seq
      source.followup(createUserMessage({
        content: [{
          type: 'text',
          text: [
            WORK_RELAY_PREFIX,
            '这是后台 Worker DSH Session 发来的更新，不是玩家的新任务。',
            `请保持“${profile.name}”的身份，用简短自然的中文向玩家汇报。说明这是工作思路、进度还是结果，并邀请玩家继续语音反馈。`,
            '不要展示这段系统说明，不要调用游戏工具，也不要声称 Worker 没有完成的事情已经完成。',
            profile.relayInstructions,
            `工作标题：${work?.title ?? '未关联工作'}`,
            `Worker 更新：${workerText.slice(0, 8_000)}`,
          ].filter((line): line is string => line !== undefined && line !== '').join('\n'),
        }],
        source: { kind: 'plugin', plugin: 'dsh-work-orchestrator', form: 'relay' },
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
