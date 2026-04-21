# Phase 87 Research

## Current Seam

- `src/components/resume/resume-comparison-view.tsx` consumes the `HighlightedLine` output from `buildOptimizedPreviewHighlights(...)`.
- `buildOptimizedPreviewHighlights(...)` in `src/lib/resume/optimized-preview-highlights.ts` already separates:
  - bullet-level improvement gating via `evaluateExperienceBulletImprovement(...)`
  - bullet-level winner selection via `collectRankedExperienceHighlightCandidates(...)` + `buildExperienceHighlightLine(...)`
- The missing explicit layer is the final entry-level surfacing decision. Today the code builds `scoredBullets`, then chooses visible bullets with:
  - `map(({ index, score }))`
  - `filter(score > 0)`
  - `sort((left, right) => right.score - left.score)`
  - `slice(0, MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY)`
- That means visible slots are still allocated primarily by bullet improvement score, not by explicit editorial priority across already-finalized highlight results.

## Recommended Architecture

- Introduce an explicit pure selector for a single experience entry, e.g. `selectVisibleExperienceHighlightsForEntry(...)`.
- Make that selector consume finalized bullet-level results only. Each result should already carry:
  - bullet text
  - rendered line
  - improvement score
  - eligibility
  - renderability
  - winner category
  - winner tier
  - stable bullet index
- Refactor `buildBulletHighlight(...)` so it returns a richer bullet result object instead of only `{ line, score }`.
- Keep `buildOptimizedPreviewHighlights(...)` responsible only for:
  - building bullet results
  - delegating entry-level visible-slot selection to the new selector
  - mapping surfaced vs non-surfaced bullets back into the existing `HighlightedExperienceEntry` contract

## Reuse Existing Metadata

The code already exposes enough finalized metadata to avoid redoing upstream logic:

- `evaluateExperienceBulletImprovement(...)` provides the bullet-level improvement gate and score.
- `collectRankedExperienceHighlightCandidates(...)` already yields the winning candidate and category semantics.
- `tierForExperienceCategory(...)` already defines the current Tier 1 vs Tier 2 split.
- `buildExperienceHighlightLine(...)` already preserves `highlightTier` and `highlightCategory` for the renderer.

The new selector should therefore rank and filter using existing finalized metadata rather than re-running parsing, completion, or candidate collection.

## Risks To Avoid

- Do not let the new selector reopen candidate extraction or span completion. Layer 3 must stay entry-aware, not span-aware.
- Do not let raw improvement score become the only visible-slot ordering signal again.
- Do not force secondary bullets into unused capacity when they are non-renderable or editorially weak.
- Do not drop stable deterministic tie-breaking; use bullet order only after editorial rank and existing score metadata are exhausted.
- Do not change public preview contracts outside the surfaced subset and metadata already expected by the renderer.

## Test Strategy

Add direct unit coverage for the pure entry-level selector rather than relying only on UI assertions.

Required cases:

1. `metric` beats `contextual_stack` inside the same entry even when its raw bullet score is lower.
2. Two valid Tier 1 bullets suppress a valid Tier 2 bullet under cap `2`.
3. Tier 2 still surfaces when Tier 1 is absent.
4. Weak or non-renderable secondary bullets are not forced just because capacity remains.
5. Same-tier and same-category ties remain deterministic.
6. Existing caps remain unchanged.
7. Surfaced bullets still preserve `highlightTier` and `highlightCategory` into the final renderer contract.

## Validation Notes

The smallest reversible change is to keep:

- diff-aware improvement gating as the source of bullet eligibility
- optimized-text winner selection as the source of bullet render metadata
- existing renderer contracts unchanged

and only replace the current `sort(score) -> slice(cap)` entry-level step with an explicit editorial selector.

That directly addresses the reported failure mode:

- before: a same-entry `contextual_stack` bullet could surface ahead of a stronger `metric` or `scope_scale` bullet because visible slots were allocated by improvement score only
- after: Tier 1 evidence dominates the visible slots first, while Tier 2 remains available only when Tier 1 opportunities are absent or below cap
