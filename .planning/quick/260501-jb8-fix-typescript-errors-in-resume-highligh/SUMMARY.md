# Summary

## Changes

- Added the review metadata fields already accepted by `cvHighlightStateSchema` to `CvHighlightState`.
- Moved override review dedupe and highlight range counting into the override highlight-state builder.
- Replaced obsolete `inferred` evidence comparisons with current cautious semantic evidence levels.

## Validation

- `npm run typecheck`
- `npx vitest run src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/highlight/override-review-highlights.test.ts src/components/resume/resume-comparison-view.test.tsx src/components/resume/review-warning-panel.test.tsx`

## Notes

Focused Vitest run passed with pre-existing React act warnings in `resume-comparison-view.test.tsx` and a jsdom navigation warning.
