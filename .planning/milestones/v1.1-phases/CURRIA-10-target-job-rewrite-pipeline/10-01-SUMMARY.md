## Summary

Wave 10-01 formalized `job_targeting` as an explicit backend workflow instead of a conversational side effect.

Implemented:
- deterministic `workflowMode = job_targeting` execution before `runAgentLoop(...)`
- target-job state reset when a new vacancy is detected so stale targeted rewrites do not survive a target change
- explicit `targetingPlan` and target-job rewrite metadata on `agentState`
- session workspace exposure for target-job rewrite state, including `targetFitAssessment`
- SSE regression proving resume-plus-vacancy sessions trigger the deterministic job-targeting pipeline before streaming

Validation:
- `pnpm tsc --noEmit`
- `pnpm vitest run src/app/api/agent/route.sse.test.ts src/app/api/session/[id]/route.test.ts`
