import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-llm'
import { resolveConfig, type Config } from './config.js'
import { WorkOrchestratorService } from './work-orchestrator-service.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    workOrchestrator: WorkOrchestratorService
  }
}

export const name = 'dsh-work-orchestrator'
export const provide = 'workOrchestrator'
export const inject = ['agents', 'llm']

export function apply(ctx: Context, config: Config = {}): void {
  const service = new WorkOrchestratorService(ctx, resolveConfig(config))
  ctx.effect(() => async () => service.close())
}

export type { Config, ResolvedConfig } from './config.js'
export { resolveConfig } from './config.js'
export {
  LEGACY_WORK_RELAY_PREFIX,
  WORK_RELAY_PREFIX,
  WorkOrchestratorService,
  parseWorkIntent,
} from './work-orchestrator-service.js'
export type {
  CompletedCompanionTurn,
  WorkCompanionProfile,
  WorkIntent,
  WorkNotification,
} from './work-orchestrator-service.js'
