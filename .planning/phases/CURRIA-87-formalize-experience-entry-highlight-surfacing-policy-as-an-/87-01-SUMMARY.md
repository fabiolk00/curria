# Phase 87 Summary

## Delivered

- `src/lib/resume/optimized-preview-highlights.ts`
  - introduced `ExperienceBulletHighlightResult` and the explicit Layer 3 selector `selectVisibleExperienceHighlightsForEntry(...)`
  - replaced the previous same-entry `score -> sort -> slice` allocation with explicit editorial ordering based on tier, category, score metadata, and stable bullet order
- `src/lib/resume/optimized-preview-highlights.test.ts`
  - added direct unit coverage for Tier 1 dominance, Tier 2 fallback, deterministic ties, no-forced-secondary behavior, and real pipeline wiring under the entry cap
- phase artifacts
  - added `87-VALIDATION.md` with the architecture note plus before/after editorial example
  - added `87-REVIEW.md` and `87-REVIEW-FIX.md` documenting a clean code review and no-op fix step

## Outcome

Visible highlight slots inside one experience entry now follow an explicit editorial policy: `metric` and `scope_scale` evidence surfaces before contextual Tier 2 bullets, while existing caps, zero-highlight safety, and renderer metadata contracts remain unchanged.
