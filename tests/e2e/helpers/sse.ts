import type { AgentStreamChunk } from '../../../src/types/agent'

export function buildSsePayload(chunks: AgentStreamChunk[]): string {
  return chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join('')
}
