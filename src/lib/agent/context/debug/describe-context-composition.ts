import type { AgentContextDebug } from '@/lib/agent/context/types'

export function describeContextComposition(debug: AgentContextDebug): string {
  return [
    `workflow=${debug.workflowMode}`,
    `action=${debug.actionType}`,
    `phase=${debug.sessionPhase}`,
    `snapshot=${debug.selectedSnapshotSource}`,
    `blocks=${debug.includedBlocks.join(',')}`,
    `schema=${debug.includesOutputSchema ? 'yes' : 'no'}`,
  ].join(' | ')
}
