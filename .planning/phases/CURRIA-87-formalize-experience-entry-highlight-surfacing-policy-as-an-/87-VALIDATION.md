# Phase 87 Validation

## Architecture Note

The previous implicit same-entry surfacing lived inside `buildOptimizedPreviewHighlights(...)`, where same-entry bullet visibility was decided by `score -> sort -> slice` over bullet improvement scores only.

Phase 87 introduces `selectVisibleExperienceHighlightsForEntry(...)` as the explicit Layer 3 selector. It now consumes finalized per-bullet metadata only:

- rendered `line`
- `eligible`
- `renderable`
- `improvementScore`
- `winnerScore`
- `highlightTier`
- `highlightCategory`
- stable `bulletIndex`

This keeps responsibilities separated:

1. Layer 1 decides whether a bullet improved enough to participate.
2. Layer 2 decides the winning span and its category/tier inside that bullet.
3. Layer 3 decides which bullets inside the same experience entry actually consume the visible slots.

## Before / After

Realistic same-entry example under the existing cap of 2 bullets:

1. `Estruturei ETL, SQL e Power BI para governanca analitica.` -> `contextual_stack` / `secondary`
2. `Reduzi o tempo de processamento em 32%.` -> `metric` / `strong`
3. `Gerenciei carteira regional com mais de 120 contas ativas.` -> `scope_scale` / `strong`

Before:

- the implicit same-entry surfacing could let the contextual stack bullet occupy a visible slot because allocation depended on generic score sorting

After:

- `metric` surfaces before `contextual_stack`
- `scope_scale` also surfaces before `contextual_stack`
- the contextual bullet remains unsurfaced once two Tier 1 bullets already consume the entry cap

In short: `metric surfaces before contextual_stack`, and the same editorial rule now applies deterministically for all same-entry highlight allocation without changing parsing, completion, tier rendering, summary behavior, or export behavior.
