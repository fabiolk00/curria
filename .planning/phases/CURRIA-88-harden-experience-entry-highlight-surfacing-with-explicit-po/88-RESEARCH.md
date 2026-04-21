# Phase 88 Research

## Current Seam

- `src/lib/resume/optimized-preview-highlights.ts` already contains the Layer 3 selector `selectVisibleExperienceHighlightsForEntry(...)`.
- The selector already accepts `maxVisibleHighlights` as an explicit parameter, but the ownership intent is still only implicit because the default comes from `MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY` with no dedicated contract comment.
- The editorial category ordering already exists as `EXPERIENCE_HIGHLIGHT_CATEGORY_PRIORITY`, but it is still a local `const` with no exported status and no warning comment explaining that changing it alters visible editorial behavior.
- Current unit coverage is strong on happy-path editorial ordering, Tier 1 dominance, Tier 2 fallback, and deterministic ties after score parity.

## Hardening Targets

1. Make the editorial ordering a protected product-policy artifact:
   - export `EXPERIENCE_HIGHLIGHT_CATEGORY_PRIORITY`
   - add a comment warning that changes affect visible same-entry behavior under cap pressure
2. Make the cap contract self-explanatory:
   - keep explicit `maxVisibleHighlights` parameter
   - add a clear comment/docstring that the default is the current product cap and that tests may override it deliberately
3. Add a lightweight, debug-only observability helper near the selector:
   - no analytics
   - no permanent logs
   - no behavioral branching

## Preferred Cap Contract

The preferred option is already available in the current selector shape:

- `selectVisibleExperienceHighlightsForEntry(bulletResults, maxVisibleHighlights = MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY)`

Recommended hardening is to preserve this explicit parameter and document it rather than re-own the cap internally. That gives:

- isolated reasoning for the pure selector
- easier unit tests with different cap values
- less hidden coupling to caller state

No blocking reason exists to avoid the preferred option.

## Safe Debug Observability

Use a tiny local helper inside `optimized-preview-highlights.ts` that only emits `console.debug` when both are true:

- `process.env.NODE_ENV !== "production"`
- a dev-only global debug flag is enabled on `globalThis`, for example `__CURRIA_DEBUG_EXPERIENCE_HIGHLIGHT_SURFACING__ === true`

Recommended payload:

- `bulletIndex`
- `eligible`
- `renderable`
- `highlightTier`
- `highlightCategory`
- `winnerScore`
- `improvementScore`
- `selected`

Avoid dumping full bullet text unless shortened or omitted. The goal is “why did this bullet lose?” not raw content analytics.

## Test Gaps

The remaining high-value direct tests are:

1. No eligible visible highlight in entry:
   - multiple bullets present
   - none eligible/renderable
   - selector returns empty
2. Deterministic same-category/same-score tie:
   - same tier
   - same category
   - same `winnerScore`
   - same `improvementScore`
   - different `bulletIndex`
   - output order follows `bulletIndex`
3. Explicit cap enforcement at pure Layer 3 seam:
   - more eligible bullets than cap
   - selector returns no more than cap
   - lower-priority bullet is excluded after editorial ordering fills the cap

Current coverage already partially overlaps with items 2 and 3, but the hardening pass should make those tests more explicit and named around the policy contract rather than incidental behavior.

## Risks To Avoid

- Do not use the hardening pass to silently change editorial ordering.
- Do not move Layer 3 responsibilities back into candidate extraction or winner selection.
- Do not let debug observability branch product behavior or leak into production UX.
- Do not widen the change into UI or styling just to expose debug state.
