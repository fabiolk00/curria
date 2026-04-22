## Phase 95 Context

### Goal

Replace the current deterministic optimized-preview highlight engine with a post-rewrite, single-call LLM highlight artifact that is persisted separately from `cvState` and rendered against the unchanged rewritten resume tree.

### Why This Phase Exists

The current preview highlight stack is spread across two architectures:

1. `src/lib/resume/optimized-preview-highlights.ts` computes highlight spans deterministically at render time from `originalCvState` and `optimizedCvState`.
2. `src/lib/agent/tools/metric-impact-guard.ts` plus dependent ATS pipeline logic still carries older "premium bullet" / "metric preservation" heuristics, counters, regressions, and terminology.

This creates three problems:

- highlight behavior is still primarily hardcoded around deterministic metric/scope/technology heuristics
- highlights are recomputed in the client instead of being generated once from the final rewritten resume artifact
- legacy "premium metric" state and UI semantics keep old architecture concerns alive even when the preview should only consume resolved highlight ranges

### Current Code Seams

- Client preview rendering currently calls `buildOptimizedPreviewHighlights(originalCvState, optimizedCvState)` from `src/components/resume/resume-comparison-view.tsx`
- ATS enhancement persists `optimizedCvState` through `src/lib/agent/ats-enhancement-pipeline.ts`
- Job targeting persists `optimizedCvState` through `src/lib/agent/job-targeting-pipeline.ts`
- Agent/session state currently exposes `optimizedCvState`, `optimizationSummary`, and `rewriteValidation`, but no persisted highlight artifact
- Legacy metric-preservation heuristics currently live in:
  - `src/lib/agent/tools/metric-impact-guard.ts`
  - `src/lib/agent/tools/metric-impact-observability.ts`
  - dependent usages in ATS pipeline, validation, retry shaping, and tests

### Target Architecture

The new flow must be:

`cvState original`
`-> cvRewrite`
`-> rewrittenCvState final`
`-> flattenCvStateForHighlight(rewrittenCvState final)`
`-> detectCvHighlights(flattenedItems)` exactly once
`-> validateAndResolveHighlights(...)`
`-> persist highlightState`
`-> render unchanged rewrittenCvState + separate highlight artifact`

### Required Contracts

- Add `CvHighlightInputItem`, `CvHighlightReason`, `CvHighlightRange`, and `CvResolvedHighlight`
- Add `highlightState?: { source: 'rewritten_cv_state'; version: 1; resolvedHighlights: CvResolvedHighlight[]; generatedAt: string }` to the relevant persisted agent/session state
- Keep highlight data separate from `cvState`
- Do not embed markup into summary or bullet strings
- Use item-local offsets only; no document-global offsets

### Functional Guardrails

- Flatten only `summary` and `experience[].bullets[]`
- Use exact rewritten text with no normalization before model input
- Ignore empty summary/bullets
- Exclude `skills`, `education`, and `certifications` from inline underline highlighting
- Validation must discard invalid ranges silently and never break rendering
- UI must render the same `optimizedCvState` tree as before, looking up ranges by stable `itemId`
- If no highlight exists for an item, UI must paint nothing

### Scope Expectations

In scope:

- remove legacy deterministic highlight/scoring code tied to metric-preservation architecture
- add persisted highlight contracts and state plumbing
- add one-shot LLM highlight detection + local validation
- integrate the highlight artifact into ATS enhancement and job targeting post-rewrite flows
- replace preview rendering to consume persisted resolved highlights instead of recomputing heuristic spans in the client
- update tests for flattening, single-call behavior, validation, rendering, and anti-N+1 guarantees

Out of scope:

- changing final rewritten `cvState` structure
- mutating resume text with markup
- introducing multi-call item fan-out
- adding highlights for skills, education, or certifications
- natural-language runtime parsing in the renderer
