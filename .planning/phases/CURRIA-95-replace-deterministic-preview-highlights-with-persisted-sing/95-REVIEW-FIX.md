## Review Fix

Resolved the three warnings from `95-REVIEW.md`:

- Merged duplicate detector entries by `itemId` during highlight validation, with regression coverage for duplicate model items.
- Suppressed ATS highlight generation when recovery falls back to the unchanged original `cvState`, clearing `highlightState` in that path.
- Added explicit regression tests for locked previews omitting `highlightState` and optimized manual saves persisting `highlightState: undefined`.

## Post-fix Verification

- `npm run typecheck`
- `npx vitest run src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/validate-rewrite.test.ts src/lib/agent/tools/pipeline.test.ts src/components/resume/resume-comparison-view.test.tsx src/app/api/session/[id]/route.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/manual-edit/route.test.ts`
