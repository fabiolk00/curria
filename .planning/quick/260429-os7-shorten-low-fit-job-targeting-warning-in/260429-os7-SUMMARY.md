# Quick Task 260429-os7: Shorten Low-Fit Job Targeting Warning Into Concise Bullet List

**Date:** 2026-04-29
**Status:** Completed

## Changed

- Replaced the long low-fit `primaryProblem` requirement sentence with a short explanation.
- Rendered unsupported vacancy requirements as capped bullets such as `Sem evidência direta de X.`
- Limited low-fit requirement bullets to the top five items to keep the modal readable.
- Kept adjacent-profile context as a short optional bullet after the missing-requirement list.
- Updated focused tests for the new copy shape.

## Verification

- `npm test -- src/lib/agent/job-targeting/recoverable-validation.test.ts src/components/resume/user-data-page.test.tsx src/lib/routes/smart-generation/decision.test.ts src/lib/agent/tools/pipeline.test.ts` - passed
- `npm run audit:copy-regression` - passed
- `npm run typecheck` - passed
- `npm run lint` - passed
