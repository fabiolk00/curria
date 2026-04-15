## Phase 36 Plan 01 Summary

Phase 36 re-anchored job targeting on vacancy semantics so freeform pasted vacancy text no longer depends on a brittle `targetRole` guess to stay useful.

Delivered:
- hardened `buildTargetingPlan(...)` to reject heading-like and recruiter-prose role candidates, assign `targetRoleConfidence`, and extract semantic focus signals from arbitrary vacancy text
- reduced rewrite dependence on `targetRole` when confidence is low and preserved a grounded fallback role label instead of promoting noisy vacancy text
- sanitized job-targeted skills back to original supported resume skills, ordered by vacancy relevance, before final validation
- expanded workspace failure handling so low-confidence target-role fallback also surfaces as a likely vacancy-parsing issue
- added regression coverage for English headings, recruiter prose, low-confidence fallback, skills sanitization, and workspace failure messaging

Validation run:
- `npm run typecheck`
- `npm test -- src/lib/agent/tools/build-targeting-plan.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/agent/tools/validate-rewrite.test.ts src/components/dashboard/resume-workspace.test.tsx src/app/api/session/[id]/route.test.ts`
- `npm run audit:copy-regression`
