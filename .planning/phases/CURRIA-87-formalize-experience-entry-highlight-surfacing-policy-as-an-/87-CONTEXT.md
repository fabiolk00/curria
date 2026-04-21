# Phase 87 Context

## Title

Formalize experience-entry highlight surfacing policy as an explicit code layer

## Goal

Introduce a dedicated, pure, and testable experience-entry surfacing layer so optimized-preview highlights choose which bullets inside the same experience entry consume the limited visible slots through an explicit editorial policy instead of incidental ordering.

## Problem

The current experience highlight stack already appears strong at the bullet level:

- diff-aware improvement gating can decide whether a bullet is eligible
- optimized-text-first winner selection can choose a bullet's best span
- category and tier semantics already distinguish stronger evidence from secondary context

The remaining inconsistency is the missing architectural layer after those steps. A stronger `metric` or `scope_scale` bullet inside one experience entry can still remain invisible while a weaker `contextual_stack` bullet surfaces first, which suggests the final entry-level visible-slot decision is still implicit in list order, slice/filter behavior, or generic scores instead of an explicit editorial policy.

## In Scope

- formalize a pure entry-level selector for visible experience highlights
- isolate the current entry-level surfacing step into one named function
- apply explicit editorial ordering across finalized bullet results from the same experience entry
- keep the selector domain-agnostic and deterministic
- add direct unit coverage for the entry-level surfacing policy

## Out of Scope

- span parsing
- span completion
- winner span selection inside each bullet
- evidence-tier rendering and CSS treatment
- ATS readiness gates or enhancement scoring
- rewrite logic
- summary behavior
- PDF or export behavior
- billing, generation, or onboarding flows

## Locked Decisions

- Preserve the three-layer architecture:
  - bullet improvement gate
  - bullet winner span
  - experience-entry surfacing policy
- Add a dedicated pure function named `selectVisibleExperienceHighlightsForEntry(...)` or a clearly equivalent explicit name.
- This layer must consume already-finalized bullet highlight results for a single experience entry. It must not re-parse bullets, rebuild candidates, or rerun completion rules.
- Preserve existing hard caps:
  - max one highlight span per bullet
  - max visible highlighted bullets per experience entry
- Tier priority inside one experience entry is explicit:
  - `strong`
  - `secondary`
- Category priority within the surfaced set is explicit:
  - Tier 1: `metric`, then `scope_scale`
  - Tier 2: `contextual_stack`, then `anchored_leadership`, then `anchored_outcome`
- Strong evidence dominance rule:
  - Tier 1 bullets must consume visible slots before Tier 2 bullets from the same entry can do so
  - Tier 2 may surface only when Tier 1 is absent, below cap, or already filtered out by existing finalized quality metadata
- No-forced-secondary rule:
  - if an entry has no editorially strong surfaced bullets and only weak or non-renderable secondary candidates, allow fewer highlights or zero highlights
- Tie-breaking must be deterministic:
  - editorial rank first
  - existing score metadata next
  - stable bullet order only as the final tiebreak
- No domain-specific vocabulary or sample-specific hardcoding is allowed in this layer.
- Keep the change local and reversible so bypassing the selector does not break the wider preview pipeline.

## Deliverables

- a short architecture note describing where the previous implicit surfacing lived, where the new explicit selector lives, what metadata it consumes, and what policy it enforces
- code changes limited to the entry-level surfacing layer and its wiring
- direct unit tests for the editorial policy
- a before/after validation note showing a Tier 1 bullet surfacing ahead of a same-entry Tier 2 bullet

## Required Test Scenarios

1. Tier 1 dominates Tier 2 within the same entry.
2. Two Tier 1 bullets suppress Tier 2 under the entry cap.
3. Tier 2 surfaces when Tier 1 is absent.
4. Weak or non-renderable secondary candidates are not forced.
5. Same-tier and same-category ties stay deterministic.
6. Existing caps remain unchanged.
7. `highlightTier` and `highlightCategory` continue reaching the renderer correctly.

## Canonical References

Downstream agents should read these before planning or implementation:

- `src/lib/resume/optimized-preview-highlights.ts` - primary experience highlight pipeline and the expected wiring point
- `src/lib/resume/optimized-preview-highlights.test.ts` - focused logic regressions for experience highlights
- `src/lib/resume/optimized-preview-contracts.test.ts` - contract expectations for preview output
- `src/components/resume/resume-comparison-view.test.tsx` - renderer expectations for surfaced highlight metadata
- `.planning/phases/CURRIA-79-decouple-experience-rendered-highlight-from-diff-and-make-di/79-CONTEXT.md` - prior split between diff-aware gating and optimized-text winner selection
- `.planning/phases/CURRIA-79-decouple-experience-rendered-highlight-from-diff-and-make-di/79-RESEARCH.md` - earlier architecture reasoning for the separated highlight pipeline
- `.planning/phases/CURRIA-81-calibrate-experience-span-candidate-taxonomy-and-ranking-aft/81-CONTEXT.md` - structural category and ranking boundaries
- `.planning/phases/CURRIA-82-small-tuning-for-contextual-stack-recovery-and-span-complete/82-CONTEXT.md` - preserved caps and zero-highlight rules
- `.planning/phases/CURRIA-83-small-phase-83-improve-completeness-of-metric-and-scope-scal/83-VERIFICATION.md` - previously validated cap and zero-highlight expectations
- `.planning/phases/CURRIA-86-introduce-evidence-tiered-presentation-for-experience-highl/86-CONTEXT.md` - existing tier semantics that this phase must preserve

## Acceptance Criteria

- The codebase has an explicit, named, unit-testable entry-level surfacing function for experience highlights.
- Editorial selection policy is no longer implicit in list order or generic slice/filter behavior.
- Tier 1 bullets dominate visible highlight slots when present.
- Tier 2 bullets still surface when Tier 1 evidence is absent or below cap.
- No domain-specific hardcoding is introduced.
- Existing selector, completion, tier rendering, ATS gates, summary, and export behavior remain unchanged.
- Existing caps remain unchanged.
- Preview behavior better matches editorial expectation when the same experience entry contains both strong evidence bullets and contextual stack bullets.

## Verification

- `npm run typecheck`
- `npx vitest run "src/lib/resume/optimized-preview-highlights.test.ts" "src/lib/resume/optimized-preview-contracts.test.ts" "src/components/resume/resume-comparison-view.test.tsx"`
