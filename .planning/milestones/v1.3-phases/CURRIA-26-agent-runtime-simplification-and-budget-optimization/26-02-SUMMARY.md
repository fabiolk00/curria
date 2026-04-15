# 26-02 Summary

## Outcome

Phase 26-02 tightened runtime budgets by phase so the agent now uses smaller history windows, lower tool-loop ceilings, and narrower output budgets for shorter chat and confirmation turns.

## What changed

- added phase-specific runtime budget helpers in `src/lib/agent/config.ts` for:
  - history window
  - tool-loop limit
  - conversation output tokens
  - concise fallback output tokens
- updated `src/lib/agent/agent-loop.ts` to use those phase-specific budgets in:
  - history loading and message trimming
  - per-turn observability
  - tool-loop enforcement
  - recovery and concise fallback calls
- updated `src/lib/agent/context-builder.ts` so message trimming accepts dynamic phase-specific history limits cleanly
- expanded config and prompt regression coverage to prove the tighter budgets still preserve required chat context

## Verification

- `npm test -- src/lib/agent/config.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts`
- `npm test -- src/lib/agent/streaming-loop.test.ts src/app/api/agent/route.sse.test.ts`
- `npm run typecheck`
- `npx eslint src/lib/agent/config.ts src/lib/agent/context-builder.ts src/lib/agent/agent-loop.ts src/lib/agent/config.test.ts src/lib/agent/__tests__/streaming-prompt-regression.test.ts`

## Notes

This slice does not try to prove end-to-end latency numbers yet. It establishes the runtime budget controls Phase 27 can use when publishing before/after performance proof.
