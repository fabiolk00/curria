# Quick Summary: Low-fit evidence copy and modal scroll

## Completed

- Filtered weak version-control signals (`Git`, GitHub/GitLab/Bitbucket/SVN/versioning labels) out of low-fit user-facing career evidence.
- Kept meaningful adjacent evidence in the same warning, so a Java-adjacent case can still mention `APIs REST e SQL` without leading with `Git`.
- Replaced the no-anchor safe role fallback with a neutral profile statement based on the original resume instead of claiming technical alignment.
- Made the rewrite validation dialog use a max-height flex layout so the content scrolls while helper text and CTA buttons remain reachable.
- Updated tests for backend modal copy, pipeline recoverable block copy, smart-generation mocked payload consistency, and frontend scroll container behavior.
- Removed the 20 new mojibake regressions and the following PT-BR copy review issues caught by `audit:copy-regression`.

## Verification

- Passed: `npm test -- src/lib/agent/job-targeting/recoverable-validation.test.ts src/lib/agent/tools/pipeline.test.ts src/components/resume/user-data-page.test.tsx src/lib/routes/smart-generation/decision.test.ts`
- Passed: `npm run audit:copy-regression`
- Passed: `npm test -- src/components/resume/review-warning-panel.test.tsx`
- Passed: `npm test -- src/lib/agent/job-targeting/low-fit-warning-gate.test.ts src/lib/agent/job-targeting/core-requirement-coverage.test.ts src/lib/agent/job-targeting/recoverable-validation.test.ts src/lib/agent/highlight/override-review-highlights.test.ts src/app/api/profile/smart-generation/route.test.ts src/lib/routes/smart-generation/decision.test.ts src/lib/agent/request-orchestrator.test.ts`
- Passed: `npm run typecheck`
- Passed: `npm run lint`

## Follow-ups

- None required for this bug. Broader semantic matching can still be improved later, but this removes the misleading user-facing `Git` framing and fixes the modal usability issue.
