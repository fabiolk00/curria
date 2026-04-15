---
phase: 29-agent-recovery-streaming-and-persistence-decomposition
plan: "01"
type: summary
status: completed
---

# Plan 29-01 Summary

## What changed

- Extracted recovery-policy helpers into `src/lib/agent/agent-recovery.ts` so `agent-loop.ts` no longer owns the inline implementations for truncated, zero-text, concise, and degraded fallback recovery.
- Updated `runAgentLoop(...)` to delegate recovery behavior through explicit helper contracts while preserving prompt selection, retry counts, exponential backoff, usage tracking, and transcript persistence.
- Reused the existing streamed turn contract by exporting `StreamTurnResult` from the new recovery module and wiring the loop to consume it directly.

## Verification

- `npm run typecheck`
- `npm test -- src/lib/agent/streaming-loop.test.ts`

## Outcome

- Phase 29 wave 1 now has an explicit recovery seam that narrows the branch-heavy back half of `agent-loop.ts` without changing the current brownfield fallback behavior.
