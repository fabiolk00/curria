import { AGENT_CONFIG } from '@/lib/agent/config'
import {
  buildAgentContext,
  buildPreloadedResumeContext,
  describeContextComposition,
  type BuildAgentContextInput,
} from '@/lib/agent/context'
import type { Session } from '@/types/agent'

export { buildPreloadedResumeContext, describeContextComposition }

export function buildSystemPrompt(
  session: Session,
  userMessage?: string,
): string {
  return buildAgentContext({
    session,
    userMessage,
  }).systemPrompt
}

export function buildSystemPromptContext(
  input: BuildAgentContextInput,
) {
  return buildAgentContext(input)
}

export function trimMessages<T extends { role: string; content: string }>(
  messages: T[],
  maxTurns: number = AGENT_CONFIG.maxHistoryMessages,
): T[] {
  if (messages.length <= maxTurns) return messages
  return [messages[0], ...messages.slice(-(maxTurns - 1))]
}
