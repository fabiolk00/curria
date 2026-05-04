# Quick Task 260504-1tr Summary

## Result

Added the user-friendly "Revisão antes de gerar" experience for Job Targeting evidence review.

## Changes

- Added `buildUserFriendlyJobReviewFromAssessment` in `src/lib/agent/job-targeting/user-friendly-review.ts`.
- Added `JobTargetingReviewPanel` with friendly statuses: `Comprovado`, `Experiência relacionada`, and `Precisa de evidência`.
- Added `AddEvidenceModal` with structured fields for real evidence.
- Added `userFriendlyReview` to `JobTargetingExplanation`.
- Populated the review from compatibility assessments in the pipeline, assessment adapter, and comparison decision path.
- Populated the same review on recoverable Job Targeting validation blocks from targeting-plan evidence.
- Rendered the review in `ResumeComparisonView` when available, while preserving the old score-only layout when not available.
- Rendered the review inside the profile generation validation modal when available, hiding the old primary "generate anyway" action in that path.
- "Adicionar evidência" now guides the user back to the experience editor instead of bypassing the validation policy.

## Safety

- The UI does not display internal terms such as forbidden term, claim policy, unsupported claim, validation block, hard issue, or override.
- Unsupported requirements are shown as "Precisa de evidência".
- The panel offers conservative wording, not a claim bypass.
- The validation/matcher layer remains the final authority.
- Friendly review blocks do not expose the override CTA.

## Verification

- `npm run typecheck`
- `npm test`
- Focused tests:
  - `src/lib/agent/job-targeting/user-friendly-review.test.ts`
  - `src/components/resume/job-targeting-review-panel.test.tsx`
  - `src/components/resume/add-evidence-modal.test.tsx`
  - `src/components/resume/resume-comparison-view.test.tsx`
  - `src/lib/agent/job-targeting/__tests__/legacy-adapters.test.ts`
  - `src/lib/routes/session-comparison/decision.test.ts`
  - `src/lib/agent/tools/pipeline.test.ts`
