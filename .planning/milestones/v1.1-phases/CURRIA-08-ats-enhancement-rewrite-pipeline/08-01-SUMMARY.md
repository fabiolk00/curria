# 08-01 Summary

## Outcome

Wave 1 formalized ATS enhancement as an explicit workflow mode instead of an incidental behavior hidden inside the agent loop.

## What changed

- added first-class ATS workflow and rewrite contracts to `src/types/agent.ts`
- expanded session snapshot payloads so workspace consumers can read `workflowMode`, `atsAnalysis`, `rewriteStatus`, `optimizedCvState`, and related metadata
- introduced deterministic workflow resolution in `src/app/api/agent/route.ts` so:
  - resume + no vacancy becomes `ats_enhancement`
  - resume + vacancy becomes `job_targeting`
  - no resume stays `resume_review`
- persisted the resolved workflow mode before `runAgentLoop(...)`
- added route and session snapshot regression coverage for the new ATS-enhancement state

## Verification

- `pnpm vitest run src/app/api/agent/route.sse.test.ts src/app/api/session/[id]/route.test.ts`
- `pnpm tsc --noEmit`

## Notes

This wave kept `cvState` as canonical resume truth and used `agentState` only for operational ATS-enhancement context, matching the repo contract.
