# Phase 87 Verification

## Result

Passed locally.

## Checks

- `npx vitest run "src/lib/resume/optimized-preview-highlights.test.ts"`
- `npx vitest run "src/lib/resume/optimized-preview-highlights.test.ts" "src/lib/resume/optimized-preview-contracts.test.ts" "src/components/resume/resume-comparison-view.test.tsx"`
- `npm run typecheck`

## Acceptance

- The codebase now has an explicit same-entry selector named `selectVisibleExperienceHighlightsForEntry(...)`.
- Tier/category editorial policy is no longer implicit in the old score-only `sort(...).slice(...)` entry allocation.
- Tier 1 bullets dominate visible highlight slots when present, while Tier 2 still surfaces when Tier 1 is absent or below cap.
- Existing caps remain unchanged: max one highlighted span per bullet and max two highlighted bullets per experience entry.
- `highlightTier` and `highlightCategory` still propagate through the preview contract to the renderer.
- Parsing, completion, evidence-tier rendering, summary behavior, rewrite logic, ATS readiness gates, and export behavior remained unchanged in this phase.
