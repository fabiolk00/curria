# 25-02 Summary

## Outcome

Phase 25-02 removed avoidable ATS rewrite work from the ordinary resume-only chat path while keeping inline ATS execution for confirmation and generation-sensitive turns where correctness still depends on it.

## What changed

- updated `src/app/api/agent/route.ts` so ATS enhancement inline work now runs only when the current turn is generation-sensitive, such as confirmation or explicit approval
- ordinary ATS resume-only chat turns now defer that rewrite work instead of blocking the visible response path
- added structured `agent.ats_enhancement.deferred` logging so the request path can distinguish inline ATS work from intentionally deferred ATS work
- kept heavy job-targeting setup inline, because target-specific generation still depends on that deterministic preparation
- added route coverage proving:
  - resume-only ATS chat no longer blocks on inline ATS enhancement
  - confirmation/generation-sensitive turns still run ATS enhancement inline when needed
- added pipeline coverage proving successful ATS enhancement keeps `cvState` canonical while storing optimized output in `agentState.optimizedCvState`

## Verification

- `npm test -- src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts src/lib/agent/tools/pipeline.test.ts`
- `npm run typecheck`
- `npx eslint src/app/api/agent/route.ts src/app/api/agent/route.test.ts src/app/api/agent/route.sse.test.ts src/lib/agent/tools/pipeline.test.ts`

## Notes

This slice narrows inline ATS work to the turns where it materially affects correctness. Phase 26 can now focus on runtime simplification and prompt/tool budget reduction without redoing request-path triage.
