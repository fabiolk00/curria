# Phase 95: Replace deterministic preview highlights with persisted single-call LLM highlight artifacts - Research

**Researched:** 2026-04-22
**Domain:** persisted highlight artifacts for optimized resume comparison previews
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

No explicit `## Decisions`, `## Claude's Discretion`, or `## Deferred Ideas` sections exist in `95-CONTEXT.md`; the phase context below is the effective locked scope copied verbatim from that file. [VERIFIED: local code]

### Effective Locked Scope

> ### Goal
>
> Replace the current deterministic optimized-preview highlight engine with a post-rewrite, single-call LLM highlight artifact that is persisted separately from `cvState` and rendered against the unchanged rewritten resume tree.
>
> ### Why This Phase Exists
>
> The current preview highlight stack is spread across two architectures:
>
> 1. `src/lib/resume/optimized-preview-highlights.ts` computes highlight spans deterministically at render time from `originalCvState` and `optimizedCvState`.
> 2. `src/lib/agent/tools/metric-impact-guard.ts` plus dependent ATS pipeline logic still carries older "premium bullet" / "metric preservation" heuristics, counters, regressions, and terminology.
>
> This creates three problems:
>
> - highlight behavior is still primarily hardcoded around deterministic metric/scope/technology heuristics
> - highlights are recomputed in the client instead of being generated once from the final rewritten resume artifact
> - legacy "premium metric" state and UI semantics keep old architecture concerns alive even when the preview should only consume resolved highlight ranges
>
> ### Current Code Seams
>
> - Client preview rendering currently calls `buildOptimizedPreviewHighlights(originalCvState, optimizedCvState)` from `src/components/resume/resume-comparison-view.tsx`
> - ATS enhancement persists `optimizedCvState` through `src/lib/agent/ats-enhancement-pipeline.ts`
> - Job targeting persists `optimizedCvState` through `src/lib/agent/job-targeting-pipeline.ts`
> - Agent/session state currently exposes `optimizedCvState`, `optimizationSummary`, and `rewriteValidation`, but no persisted highlight artifact
> - Legacy metric-preservation heuristics currently live in:
>   - `src/lib/agent/tools/metric-impact-guard.ts`
>   - `src/lib/agent/tools/metric-impact-observability.ts`
>   - dependent usages in ATS pipeline, validation, retry shaping, and tests
>
> ### Target Architecture
>
> The new flow must be:
>
> `cvState original`
> `-> cvRewrite`
> `-> rewrittenCvState final`
> `-> flattenCvStateForHighlight(rewrittenCvState final)`
> `-> detectCvHighlights(flattenedItems)` exactly once
> `-> validateAndResolveHighlights(...)`
> `-> persist highlightState`
> `-> render unchanged rewrittenCvState + separate highlight artifact`
>
> ### Required Contracts
>
> - Add `CvHighlightInputItem`, `CvHighlightReason`, `CvHighlightRange`, and `CvResolvedHighlight`
> - Add `highlightState?: { source: 'rewritten_cv_state'; version: 1; resolvedHighlights: CvResolvedHighlight[]; generatedAt: string }` to the relevant persisted agent/session state
> - Keep highlight data separate from `cvState`
> - Do not embed markup into summary or bullet strings
> - Use item-local offsets only; no document-global offsets
>
> ### Functional Guardrails
>
> - Flatten only `summary` and `experience[].bullets[]`
> - Use exact rewritten text with no normalization before model input
> - Ignore empty summary/bullets
> - Exclude `skills`, `education`, and `certifications` from inline underline highlighting
> - Validation must discard invalid ranges silently and never break rendering
> - UI must render the same `optimizedCvState` tree as before, looking up ranges by stable `itemId`
> - If no highlight exists for an item, UI must paint nothing
>
> ### Scope Expectations
>
> In scope:
>
> - remove legacy deterministic highlight/scoring code tied to metric-preservation architecture
> - add persisted highlight contracts and state plumbing
> - add one-shot LLM highlight detection + local validation
> - integrate the highlight artifact into ATS enhancement and job targeting post-rewrite flows
> - replace preview rendering to consume persisted resolved highlights instead of recomputing heuristic spans in the client
> - update tests for flattening, single-call behavior, validation, rendering, and anti-N+1 guarantees
>
> Out of scope:
>
> - changing final rewritten `cvState` structure
> - mutating resume text with markup
> - introducing multi-call item fan-out
> - adding highlights for skills, education, or certifications
> - natural-language runtime parsing in the renderer
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless the user explicitly changes scope. [VERIFIED: local code]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: local code]
- Follow surrounding file style; newer frontend files often use double quotes while backend and service modules often use single quotes. [VERIFIED: local code]
- Use `@/*` imports, kebab-case filenames, camelCase functions, and named exports except where Next.js expects default exports. [VERIFIED: local code]
- Keep route handlers thin, validate external input with `zod`, and prefer structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: local code]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: local code]
- Preserve dispatcher and `ToolPatch` patterns when changing agent flows. [VERIFIED: local code]
- Session state is persisted server-side; the client should stay relatively shallow. [VERIFIED: local code]
- Prefer small, test-backed changes over broad rewrites. [VERIFIED: local code]
- Increment `stateVersion` only when the top-level session bundle shape or interpretation changes. [VERIFIED: local code]

## Summary

CurrIA currently computes optimized preview highlights entirely in the client through `buildOptimizedPreviewHighlights(originalCvState, optimizedCvState)` in `src/components/resume/resume-comparison-view.tsx`, while ATS enhancement and job-targeting pipelines persist only `optimizedCvState`, `optimizationSummary`, and `rewriteValidation`. [VERIFIED: local code]

That split is the core architectural problem for Phase 95: the rendered preview is driven by a large deterministic helper in `src/lib/resume/optimized-preview-highlights.ts`, but the actual optimized artifact lifecycle lives in `src/lib/agent/ats-enhancement-pipeline.ts` and `src/lib/agent/job-targeting-pipeline.ts`. [VERIFIED: local code] The safest replacement is to generate highlight ranges once from the final rewritten `optimizedCvState`, validate them locally against exact item text, persist them as `agentState.highlightState`, and make the compare UI resolve highlights by shared `itemId` helpers rather than recomputing heuristics at render time. [VERIFIED: local code][CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting][ASSUMED]

The highest-risk edge cases are not in the model call itself. They are stale artifact drift after rollback or manual edit, preview-lock leakage when optimized content is sanitized for unpaid users, and summary-text normalization in the renderer breaking item-local offsets. [VERIFIED: local code] Phase 95 should therefore be planned as a state-lifecycle refactor with a thin renderer migration, not as a styling tweak. [ASSUMED]

**Primary recommendation:** Add a shared pure highlight-artifact module plus a single detector tool, run it exactly once after final rewrite validation succeeds, persist `agentState.highlightState`, clear/restore it anywhere `optimizedCvState` is cleared/restored, and delete the deterministic highlight and metric-preservation subsystems in the same phase. [VERIFIED: local code][ASSUMED]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | repo `^6.33.0`; latest `6.34.0` (2026-04-08) [VERIFIED: package.json][VERIFIED: npm registry] | Single-call highlight detection | The repo already uses `openai.chat.completions.create(...)` via `callOpenAIWithRetry(...)` in `rewrite-section.ts`; reusing that path is the smallest brownfield change. [VERIFIED: local code] |
| `zod` | repo `^3.23.8`; latest `4.3.6` (2026-01-25) [VERIFIED: package.json][VERIFIED: npm registry] | Parse and validate detector output before local range resolution | Project conventions require external input validation with `zod`, and the existing rewrite tooling already follows that model. [VERIFIED: local code] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | repo `^1.6.0`; latest `4.1.5` (2026-04-21) [VERIFIED: package.json][VERIFIED: npm registry] | Detector, pipeline, and route regression coverage | Use for all new unit and integration regressions in this phase. [VERIFIED: local code] |
| `@testing-library/react` | repo `^16.3.2`; latest `16.3.2` (2026-01-19) [VERIFIED: package.json][VERIFIED: npm registry] | Compare-view renderer assertions | Use for the itemId-to-range rendering contract in `resume-comparison-view.test.tsx`. [VERIFIED: local code] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chat.completions.create` with structured output | Responses API | OpenAI recommends Responses for new projects, but this repo already standardizes on Chat Completions for structured tool work, so changing transport in this phase adds churn without solving the main lifecycle problem. [VERIFIED: local code][CITED: https://platform.openai.com/docs/guides/responses-vs-chat-completions] |
| Strict JSON schema response | `json_object` plus manual parsing | Official docs prefer `json_schema` when supported; if a deployed env overrides `MODEL_CONFIG.structuredModel` to a model that cannot honor strict schema, fall back to `json_object` without changing the persisted contract. [VERIFIED: local code][CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting][ASSUMED] |

**Installation:** No new packages are required for this phase because the repo already includes `openai`, `zod`, `vitest`, and React Testing Library. [VERIFIED: package.json]

**Version verification:** `openai`, `zod`, `vitest`, and `@testing-library/react` were checked against the npm registry on 2026-04-22; no dependency upgrade is necessary to plan this phase. [VERIFIED: npm registry][ASSUMED]

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── lib/
│   ├── resume/
│   │   └── cv-highlight-artifact.ts      # Pure types, item-id helpers, flattening, validation, segmentation
│   └── agent/
│       └── tools/
│           └── detect-cv-highlights.ts   # Single-call OpenAI detector + output parsing
├── components/
│   └── resume/
│       └── resume-comparison-view.tsx    # Render by itemId + persisted ranges, no heuristic builder
└── types/
    ├── agent.ts                          # Persisted highlightState contract
    └── dashboard.ts                      # Serialized workspace/comparison response contract
```

This split keeps model I/O out of the renderer, keeps pure range logic reusable on server and client, and fits the repo rule that `src/lib/**` holds domain logic while the client stays shallow. [VERIFIED: local code][ASSUMED]

### Pattern 1: Shared Item-Id And Artifact Contract

**What:** Put all highlight types plus flattening, `itemId` generation, local validation, and text segmentation into one pure module, for example `src/lib/resume/cv-highlight-artifact.ts`. [ASSUMED]

**When to use:** Use this module everywhere highlight ranges are created, restored, serialized, or rendered. Do not duplicate `itemId` derivation in pipelines and UI. [ASSUMED]

**Recommended contract:**

```ts
// Source pattern: repo state/type conventions in src/types/agent.ts and src/types/dashboard.ts.
export type CvHighlightReason =
  | 'keyword_alignment'
  | 'quantified_impact'
  | 'scope_scale'
  | 'tool_specificity'
  | 'seniority_positioning'
  | 'domain_alignment'

export type CvHighlightInputItem = {
  itemId: string
  itemType: 'summary' | 'experience_bullet'
  text: string
}

export type CvHighlightRange = {
  start: number
  end: number
  reason: CvHighlightReason
}

export type CvResolvedHighlight = {
  itemId: string
  ranges: CvHighlightRange[]
}

export type CvHighlightState = {
  source: 'rewritten_cv_state'
  version: 1
  generatedAt: string
  resolvedHighlights: CvResolvedHighlight[]
}
```

**Exact item-id recommendation:** Use positional IDs derived from the optimized tree, such as `summary` and `experience:${experienceIndex}:bullet:${bulletIndex}`. This is safe because the artifact is rendered against the same persisted `optimizedCvState` snapshot, and the repo does not currently store stable bullet IDs inside `CVState`. [VERIFIED: local code][ASSUMED]

### Pattern 2: Finalized-Rewrite Single Detector Call

**What:** Add `src/lib/agent/tools/detect-cv-highlights.ts` that takes a finalized optimized `CVState`, flattens only summary plus experience bullets, sends one structured request, parses the response with `zod`, validates ranges locally, and returns `CvHighlightState | undefined`. [VERIFIED: local code][CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting][ASSUMED]

**When to use:** Call this only after the pipeline has finalized the resume that will actually be persisted as `optimizedCvState`. In ATS enhancement that means after smart-repair/conservative-fallback/original-fallback logic has settled and `finalValidation.valid` is known. In job targeting that means after `validation.valid` is known. [VERIFIED: local code][ASSUMED]

**Example:**

```ts
// Source pattern: src/lib/agent/tools/rewrite-section.ts + OpenAI chat response_format docs.
const response = await callOpenAIWithRetry(
  (signal) => openai.chat.completions.create({
    model: MODEL_CONFIG.structuredModel,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cv_highlight_ranges',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  itemId: { type: 'string' },
                  ranges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        start: { type: 'integer' },
                        end: { type: 'integer' },
                        reason: { type: 'string' },
                        text: { type: 'string' }
                      },
                      required: ['start', 'end', 'reason', 'text']
                    }
                  }
                },
                required: ['itemId', 'ranges']
              }
            }
          },
          required: ['items']
        }
      }
    },
    messages: [
      { role: 'system', content: HIGHLIGHT_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ items: flattenedItems }) }
    ],
  }, { signal }),
  3,
  AGENT_CONFIG.timeout,
)
```

Persist only `itemId`, `start`, `end`, and `reason`. Keep model-echoed `text` only for local validation and drop it before storing state. [ASSUMED]

### Pattern 3: Fail-Closed Local Range Validation

**What:** Validate every returned span against the exact item text from `flattenCvStateForHighlights(...)`, then silently drop bad items or bad ranges. [VERIFIED: local code][ASSUMED]

**When to use:** Always. The renderer must never trust model offsets, and the pipeline must not fail just because the highlight artifact is partially bad. [ASSUMED]

**Validation rules:**

- Reject unknown `itemId`s. [ASSUMED]
- Reject non-integer or out-of-bounds ranges. [ASSUMED]
- Reject `start >= end`. [ASSUMED]
- Reject ranges whose echoed `text` does not equal `item.text.slice(start, end)`. [ASSUMED]
- Sort by `start`, dedupe exact duplicates, and drop later overlaps instead of merging them. [ASSUMED]
- Drop items whose validated range list becomes empty. [ASSUMED]

**Why:** The phase explicitly requires silent invalid-range handling, and CurrIA prioritizes reliability over preview decoration. [VERIFIED: local code][ASSUMED]

### Pattern 4: Renderer Uses Raw Optimized Text Only

**What:** The compare UI should keep rendering the same `optimizedCvState` tree but split text by validated ranges looked up via `itemId`. [VERIFIED: local code][ASSUMED]

**When to use:** Replace both summary and experience highlight rendering inside `src/components/resume/resume-comparison-view.tsx`. [VERIFIED: local code]

**Critical seam:** Delete `normalizePreviewSummaryText(...)` from the optimized summary display path. The phase requires exact rewritten text with no normalization before model input, and the current renderer normalization would desynchronize persisted offsets from displayed text. [VERIFIED: local code][ASSUMED]

### Exact File Seams To Change

- Create `src/lib/resume/cv-highlight-artifact.ts` for pure contracts and helpers. [ASSUMED]
- Create `src/lib/agent/tools/detect-cv-highlights.ts` for the model call, response parsing, validation, and `CvHighlightState` assembly. [ASSUMED]
- Update `src/types/agent.ts` to add `CvHighlight*` types, `AgentState.highlightState`, and remove stale metric-preservation validation types. [VERIFIED: local code][ASSUMED]
- Update `src/types/dashboard.ts` to expose `highlightState` on both `SessionWorkspace.session.agentState` and `ResumeComparisonResponse`. [VERIFIED: local code][ASSUMED]
- Update `src/lib/agent/ats-enhancement-pipeline.ts` to compute, persist, restore, and roll back `highlightState` together with `optimizedCvState`. [VERIFIED: local code][ASSUMED]
- Update `src/lib/agent/job-targeting-pipeline.ts` with the same persistence and rollback behavior. [VERIFIED: local code][ASSUMED]
- Update `src/lib/routes/session-comparison/decision.ts` to serialize `highlightState` only when the optimized preview is not sanitized/locked. [VERIFIED: local code][ASSUMED]
- Update `src/app/api/session/[id]/route.ts` to serialize `highlightState` in `session.agentState` and omit it when preview content is sanitized/locked. [VERIFIED: local code][ASSUMED]
- Update `src/components/resume/resume-comparison-view.tsx` to remove the deterministic builder and render by `itemId`. [VERIFIED: local code][ASSUMED]
- Update `src/app/api/session/[id]/manual-edit/route.ts` so optimized manual saves clear `highlightState`. [VERIFIED: local code][ASSUMED]
- Update `src/lib/agent/request-orchestrator.ts` so target-job reset also clears `highlightState`. [VERIFIED: local code][ASSUMED]
- Update `src/lib/db/session-normalization.ts` to normalize the new `AgentState` shape and bump `CURRENT_SESSION_STATE_VERSION` from `1` to `2`. [VERIFIED: local code][ASSUMED]

### Anti-Patterns To Avoid

- **Do not embed markup into `cvState.summary` or bullets:** The phase forbids markup mutation, and `cvState` is canonical resume truth. [VERIFIED: local code]
- **Do not recompute highlights in the client:** that preserves the existing drift problem and defeats the persisted-artifact goal. [VERIFIED: local code][ASSUMED]
- **Do not use document-global offsets:** the required contract is item-local only. [VERIFIED: local code]
- **Do not normalize summary text before detection or rendering:** normalized display text breaks local offsets. [VERIFIED: local code][ASSUMED]
- **Do not fan out one model call per bullet:** the phase explicitly requires exactly one model call per resume payload. [VERIFIED: local code]
- **Do not fail the rewrite pipeline if highlight detection fails:** log and persist `optimizedCvState` without highlights instead. Reliability takes precedence over decoration. [VERIFIED: local code][ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimized preview diffing | Another deterministic heuristic engine in `optimized-preview-highlights.ts` | One LLM artifact plus strict local validation | The repo already accumulated many phases of heuristic exceptions, and the user is explicitly replacing that architecture. [VERIFIED: local code] |
| Stable highlight identity | Ad-hoc IDs in renderer and pipelines | Shared pure `itemId` helpers in one module | Duplicated ID logic will drift and silently break range lookups. [ASSUMED] |
| Renderer parsing | Natural-language parsing or text cleanup in React | `splitTextByRanges(text, ranges)` over exact raw text | The phase forbids runtime NL parsing in the renderer and requires item-local offsets only. [VERIFIED: local code] |
| Pipeline orchestration | Per-item model fan-out | One `detectCvHighlights(...)` invocation per finalized optimized resume | Anti-N+1 behavior is a core phase requirement and cheaper to test deterministically. [VERIFIED: local code][ASSUMED] |
| Metric-preservation diagnostics | Premium-bullet counters and regression heuristics | Delete the subsystem; let `rewriteValidation` keep only factual-safety checks | Those diagnostics exist only to support the outgoing architecture and are no longer needed once highlighting is a separate artifact. [VERIFIED: local code][ASSUMED] |

**Key insight:** The difficult part of this phase is lifecycle consistency, not span selection sophistication. A minimal persisted artifact that is validated, rollback-safe, and preview-lock-safe is better than a richer highlight schema that can drift from `optimizedCvState`. [VERIFIED: local code][ASSUMED]

## Migration Steps

1. Add the pure highlight-artifact module and the persisted `AgentState.highlightState` contract first, including `dashboard` response types and a `stateVersion` bump to `2`. [VERIFIED: local code][ASSUMED]
2. Implement `detect-cv-highlights.ts` with one structured OpenAI call, local validation, and a fail-closed `undefined` return on detector failure. [VERIFIED: local code][CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting][ASSUMED]
3. Wire ATS enhancement and job-targeting pipelines so they compute highlights only after final validation succeeds and restore `previousHighlightState` on persistence rollback. [VERIFIED: local code][ASSUMED]
4. Update `/api/session/[id]` and `/api/session/[id]/comparison` serialization to include `highlightState` only when optimized preview content is real, not sanitized. [VERIFIED: local code][ASSUMED]
5. Replace `resume-comparison-view.tsx` highlight rendering with shared `itemId` lookup plus local text segmentation, and remove all deterministic builder imports. [VERIFIED: local code][ASSUMED]
6. Clear `highlightState` when optimized manual edits overwrite `optimizedCvState`, and clear it when target-job detection resets optimized rewrite state. [VERIFIED: local code][ASSUMED]
7. Delete the deterministic highlight engine and the metric-preservation subsystem in the same phase so stale types, tests, and notes do not survive behind dead branches. [VERIFIED: local code][ASSUMED]

## Explicit Deletion Targets

### Deterministic Preview Engine

- Delete `src/lib/resume/optimized-preview-highlights.ts`. [VERIFIED: local code][ASSUMED]
- Delete `src/lib/resume/optimized-preview-highlights.test.ts`. [VERIFIED: local code][ASSUMED]
- Delete `src/lib/resume/optimized-preview-contracts.test.ts`. [VERIFIED: local code][ASSUMED]
- Delete `buildOptimizedPreviewHighlights(...)`, `normalizePreviewSummaryText(...)`, `HighlightedLine`, and the tier/category-specific renderer contract in `src/components/resume/resume-comparison-view.tsx`. [VERIFIED: local code][ASSUMED]

### Legacy Metric-Preservation Subsystem

- Delete `src/lib/agent/tools/metric-impact-guard.ts`. [VERIFIED: local code][ASSUMED]
- Delete `src/lib/agent/tools/metric-impact-observability.ts`. [VERIFIED: local code][ASSUMED]
- Remove metric-preservation imports and telemetry from `src/lib/agent/ats-enhancement-pipeline.ts`. [VERIFIED: local code][ASSUMED]
- Remove `countPreservedMetricImpactBullets(...)` and the `"Preservei métricas reais..."` note injection from `src/lib/agent/tools/rewrite-resume-full.ts`. [VERIFIED: local code][ASSUMED]
- Remove `compareMetricImpactPreservation(...)` and `findMetricImpactRegressions(...)` from `src/lib/agent/tools/validate-rewrite.ts`. [VERIFIED: local code][ASSUMED]
- Remove `editorialMetrics` from `RewriteValidationResult` in `src/types/agent.ts`. [VERIFIED: local code][ASSUMED]
- Remove premium-bullet retry shaping in `src/lib/agent/ats-enhancement-retry.ts` if it exists only for this subsystem. [VERIFIED: local code][ASSUMED]
- Delete or rewrite metric-preservation expectations in `src/lib/agent/tools/pipeline.test.ts` and `src/lib/agent/tools/validate-rewrite.test.ts`. [VERIFIED: local code][ASSUMED]

### Stale UI / Serialized State

- Remove any compare-view rendering that depends on `data-highlight-tier`, `data-highlight-category`, `highlightWholeLine`, or `HighlightedLine.segments`. [VERIFIED: local code][ASSUMED]
- Add `highlightState` to `ResumeComparisonResponse` and `SessionWorkspace`, then update route tests to assert omit-on-lock behavior. [VERIFIED: local code][ASSUMED]
- Clear `highlightState` in optimized manual-edit saves and in target-job-reset agent-state rebuilds. [VERIFIED: local code][ASSUMED]

## Common Pitfalls

### Pitfall 1: Preview-Lock Leakage

**What goes wrong:** The compare/session routes sanitize `optimizedCvState` when preview access is locked, but an unsanitized `highlightState` could still reveal where meaningful content lives. [VERIFIED: local code]
**Why it happens:** `sanitizeGeneratedCvStateForClient(...)` currently gates only the resume tree; there is no companion highlight-artifact sanitizer because the artifact does not exist yet. [VERIFIED: local code]
**How to avoid:** Omit `highlightState` whenever `sanitizeGeneratedCvStateForClient(...)` returns locked placeholder content, or add a shared `sanitizeHighlightStateForClient(...)` helper that returns `undefined` under the same condition. [VERIFIED: local code][ASSUMED]
**Warning signs:** Locked comparison responses still include `highlightState`, or locked UI shows highlight wrappers despite blurred content. [ASSUMED]

### Pitfall 2: Stale Highlight Artifact After Rollback

**What goes wrong:** ATS/job-targeting pipelines restore `previousOptimizedCvState` after validation or persistence failure but leave the new highlight artifact behind. [VERIFIED: local code][ASSUMED]
**Why it happens:** Both pipelines already snapshot `previousOptimizedCvState`, `previousOptimizationSummary`, and `previousLastRewriteMode`, but there is no parallel `previousHighlightState` today. [VERIFIED: local code]
**How to avoid:** Snapshot and restore `previousHighlightState` everywhere `previousOptimizedCvState` is snapshot/restored. [ASSUMED]
**Warning signs:** `optimizedCvState.updatedAt` moves backward while highlights still match the failed rewrite. [ASSUMED]

### Pitfall 3: Offset Drift From Summary Normalization

**What goes wrong:** The model returns valid ranges for raw summary text, but the UI renders `normalizePreviewSummaryText(cvState.summary)`, so offsets point to the wrong characters. [VERIFIED: local code]
**Why it happens:** The current summary display path mutates text before rendering. [VERIFIED: local code]
**How to avoid:** Remove renderer normalization and feed the detector the exact persisted text that the UI will render. [ASSUMED]
**Warning signs:** Summary highlights shift or disappear only in the optimized column while bullet highlights remain correct. [ASSUMED]

### Pitfall 4: Hidden N+1 Detector Calls

**What goes wrong:** The detector is called once per bullet or once per section instead of once per resume payload. [ASSUMED]
**Why it happens:** The current deterministic code works per-section/per-bullet, so a naive migration often preserves that granularity. [VERIFIED: local code][ASSUMED]
**How to avoid:** Flatten all eligible items into one array and assert `openai.chat.completions.create` was invoked exactly once per successful finalized rewrite in tests. [VERIFIED: local code][ASSUMED]
**Warning signs:** Detector mocks are called more than once in a single pipeline run, or request logs show one model call per entry. [ASSUMED]

### Pitfall 5: Turning Highlight Failure Into Rewrite Failure

**What goes wrong:** A transient model/schema/range-validation issue blocks ATS enhancement or job targeting even though the optimized resume itself is valid. [ASSUMED]
**Why it happens:** It is tempting to make highlight generation part of the critical success path because it follows rewrite validation. [ASSUMED]
**How to avoid:** Treat highlight generation as best-effort artifact generation: log failure, persist `optimizedCvState`, and store `highlightState: undefined`. [ASSUMED]
**Warning signs:** The pipeline reports failure with a valid `optimizedCvState` but missing only highlight data. [ASSUMED]

## Code Examples

Verified or repo-aligned patterns:

### Pure Flattening And Validation

```ts
// Source pattern: exact CVState shape from src/types/cv.ts and phase requirements from 95-CONTEXT.md.
export function flattenCvStateForHighlights(cvState: CVState): CvHighlightInputItem[] {
  const items: CvHighlightInputItem[] = []

  if (cvState.summary.trim()) {
    items.push({
      itemId: 'summary',
      itemType: 'summary',
      text: cvState.summary,
    })
  }

  cvState.experience.forEach((entry, experienceIndex) => {
    entry.bullets.forEach((bullet, bulletIndex) => {
      if (!bullet.trim()) return
      items.push({
        itemId: `experience:${experienceIndex}:bullet:${bulletIndex}`,
        itemType: 'experience_bullet',
        text: bullet,
      })
    })
  })

  return items
}

export function validateAndResolveHighlights(
  items: CvHighlightInputItem[],
  modelItems: Array<{ itemId: string; ranges: Array<{ start: number; end: number; reason: CvHighlightReason; text: string }> }>,
): CvResolvedHighlight[] {
  const byId = new Map(items.map((item) => [item.itemId, item]))

  return modelItems.flatMap((item) => {
    const source = byId.get(item.itemId)
    if (!source) return []

    const validRanges = item.ranges
      .filter((range) => Number.isInteger(range.start) && Number.isInteger(range.end))
      .filter((range) => range.start >= 0 && range.end > range.start && range.end <= source.text.length)
      .filter((range) => source.text.slice(range.start, range.end) === range.text)
      .sort((left, right) => left.start - right.start)
      .filter((range, index, all) => index === 0 || range.start >= all[index - 1]!.end)
      .map(({ start, end, reason }) => ({ start, end, reason }))

    return validRanges.length > 0 ? [{ itemId: item.itemId, ranges: validRanges }] : []
  })
}
```

### Renderer Contract

```tsx
// Source pattern: replace summary/bullet rendering in src/components/resume/resume-comparison-view.tsx.
function renderHighlightedText(text: string, ranges: CvHighlightRange[] | undefined) {
  if (!ranges || ranges.length === 0) return text

  const segments: Array<{ text: string; highlighted: boolean }> = []
  let cursor = 0

  ranges.forEach((range) => {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), highlighted: false })
    }

    segments.push({ text: text.slice(range.start, range.end), highlighted: true })
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false })
  }

  return segments.map((segment, index) =>
    segment.highlighted
      ? <span key={index} className="rounded-md bg-emerald-100/65 px-0.5 py-px">{segment.text}</span>
      : <span key={index}>{segment.text}</span>,
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side deterministic heuristic highlight builder | Persisted, server-generated, locally validated highlight artifact | Phase 95 target state [VERIFIED: local code][ASSUMED] | Eliminates heuristic drift and lets renderer stay dumb. [ASSUMED] |
| `response_format: { type: 'json_object' }` for structured rewrite work | `json_schema` is the preferred structured output mode when supported | Documented in current OpenAI chat docs [CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting] | Makes schema drift easier to detect before local range validation. [ASSUMED] |
| Premium-bullet / metric-preservation telemetry shaping preview semantics | Separate factual rewrite validation plus independent highlight artifact | Phase 95 target state [VERIFIED: local code][ASSUMED] | Keeps rewrite safety and preview decoration decoupled. [ASSUMED] |

**Deprecated/outdated:**

- `src/lib/resume/optimized-preview-highlights.ts`: outdated for this phase because it re-derives highlight spans in the client from heuristics the user explicitly wants removed. [VERIFIED: local code]
- `metric-impact-guard` / `metric-impact-observability`: outdated for this phase because they encode the outgoing premium-bullet architecture and leak it into pipelines, validation, retry logic, and notes. [VERIFIED: local code]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Positional item IDs (`summary`, `experience:${i}:bullet:${j}`) are sufficient because the highlight artifact is always rendered against the same persisted optimized snapshot. | Architecture Patterns | If future UI renders a different tree, persisted lookups will drift and a stronger stable-ID scheme will be needed. |
| A2 | `CURRENT_SESSION_STATE_VERSION` should bump from `1` to `2` because adding `agentState.highlightState` changes persisted session-bundle interpretation. | Exact File Seams To Change | If the team treats nested optional `agentState` additions as versionless, a bump may be unnecessary. |
| A3 | All deployed environments will keep `MODEL_CONFIG.structuredModel` on a model that supports strict `json_schema`, or the implementation will need a `json_object` fallback. | Standard Stack / Pattern 2 | If false, the detector transport choice needs one compatibility branch. |
| A4 | Highlight detector failures should not fail ATS/job-targeting pipelines. | Common Pitfalls | If product wants hard failure, planner must add explicit UX and retry behavior for missing highlights. |

## Open Questions

1. **Should locked-preview responses omit `highlightState` or return an empty artifact?**  
   What we know: locked routes already sanitize optimized content, and leaking resolved highlight ranges is unnecessary. [VERIFIED: local code]  
   What's unclear: whether consumer code prefers `undefined` or a stable empty object. [ASSUMED]  
   Recommendation: omit `highlightState` entirely on locked responses so client code cannot accidentally treat placeholder content as highlightable. [ASSUMED]

2. **Should the detector persist `reason` strings if the current UI does not render them?**  
   What we know: the phase requires `CvHighlightReason`, but the current compare UI styling can be implemented without tier/category-specific rendering. [VERIFIED: local code][ASSUMED]  
   What's unclear: whether product wants future analytics or differentiated highlight visuals. [ASSUMED]  
   Recommendation: persist `reason` because it is cheap and stable, but keep the renderer reason-agnostic in this phase. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | Tests, scripts, app runtime | yes [VERIFIED: local shell] | `v24.14.0` [VERIFIED: local shell] | none [VERIFIED: local shell] |
| `npm` | Package scripts, registry verification | yes [VERIFIED: local shell] | `11.9.0` [VERIFIED: local shell] | none [VERIFIED: local shell] |
| `vitest` CLI | Local test execution | yes [VERIFIED: local shell] | `11.9.0` [VERIFIED: local shell] | `npm test` [VERIFIED: package.json] |
| `OPENAI_API_KEY` | Live detector smoke test | no [VERIFIED: local shell] | none [VERIFIED: local shell] | Unit tests only; no live smoke call in this environment. [ASSUMED] |

**Missing dependencies with no fallback:**

- None for planning or unit-test implementation. [VERIFIED: local shell][ASSUMED]

**Missing dependencies with fallback:**

- `OPENAI_API_KEY` is missing, so planner should treat live end-to-end detector verification as optional/manual and rely on mocked unit/integration coverage by default. [VERIFIED: local shell][ASSUMED]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` plus React Testing Library in repo dependencies. [VERIFIED: package.json] |
| Config file | none detected; repo uses package scripts and file-level Vitest tests. [VERIFIED: local code] |
| Quick run command | `npx vitest run "src/lib/agent/tools/detect-cv-highlights.test.ts" "src/lib/resume/cv-highlight-artifact.test.ts" "src/components/resume/resume-comparison-view.test.tsx"` [ASSUMED] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P95-01 | Flatten only summary + experience bullets, skipping empties | unit | `npx vitest run "src/lib/resume/cv-highlight-artifact.test.ts"` | no - Wave 0 [ASSUMED] |
| P95-02 | Detector performs exactly one OpenAI call per finalized resume payload | unit | `npx vitest run "src/lib/agent/tools/detect-cv-highlights.test.ts"` | no - Wave 0 [ASSUMED] |
| P95-03 | Invalid item IDs and invalid ranges are dropped silently | unit | `npx vitest run "src/lib/agent/tools/detect-cv-highlights.test.ts"` | no - Wave 0 [ASSUMED] |
| P95-04 | ATS enhancement persists and rolls back `highlightState` with `optimizedCvState` | integration | `npx vitest run "src/lib/agent/tools/pipeline.test.ts"` | yes [VERIFIED: local code] |
| P95-05 | Job targeting persists and rolls back `highlightState` with `optimizedCvState` | integration | `npx vitest run "src/lib/agent/tools/pipeline.test.ts"` or a new focused pipeline test file | partial - depends on chosen coverage split [ASSUMED] |
| P95-06 | `/comparison` and `/api/session/[id]` omit highlight artifacts for locked previews | route | `npx vitest run "src/lib/routes/session-comparison/decision.test.ts" "src/app/api/session/[id]/route.test.ts"` | yes [VERIFIED: local code] |
| P95-07 | Optimized manual edit clears stale `highlightState` | route | `npx vitest run "src/app/api/session/[id]/manual-edit/route.test.ts"` | yes [VERIFIED: local code] |
| P95-08 | Compare UI renders unchanged optimized text and looks up ranges by `itemId` | component | `npx vitest run "src/components/resume/resume-comparison-view.test.tsx"` | yes [VERIFIED: local code] |

### Sampling Rate

- **Per task commit:** `npx vitest run "src/lib/resume/cv-highlight-artifact.test.ts" "src/lib/agent/tools/detect-cv-highlights.test.ts" "src/components/resume/resume-comparison-view.test.tsx"` [ASSUMED]
- **Per wave merge:** `npx vitest run "src/lib/agent/tools/pipeline.test.ts" "src/lib/routes/session-comparison/decision.test.ts" "src/app/api/session/[id]/route.test.ts" "src/app/api/session/[id]/manual-edit/route.test.ts"` [ASSUMED]
- **Phase gate:** `npm test` plus `npm run typecheck` before `/gsd-verify-work`. [VERIFIED: package.json][ASSUMED]

### Wave 0 Gaps

- [ ] `src/lib/resume/cv-highlight-artifact.test.ts` — flattening, itemId stability, segmentation, and validation. [ASSUMED]
- [ ] `src/lib/agent/tools/detect-cv-highlights.test.ts` — single-call behavior, schema parsing, invalid-range dropping, overlap dropping, empty artifact path. [ASSUMED]
- [ ] Update `src/components/resume/resume-comparison-view.test.tsx` — summary/bullet rendering now uses `itemId` ranges and raw optimized text. [VERIFIED: local code][ASSUMED]
- [ ] Update `src/lib/routes/session-comparison/decision.test.ts` and `src/app/api/session/[id]/route.test.ts` — serialized `highlightState` and omit-on-lock behavior. [VERIFIED: local code][ASSUMED]
- [ ] Update `src/app/api/session/[id]/manual-edit/route.test.ts` — optimized save clears highlights, base save with existing optimized snapshot does not. [VERIFIED: local code][ASSUMED]
- [ ] Update `src/lib/agent/tools/pipeline.test.ts` and `src/lib/agent/tools/validate-rewrite.test.ts` — remove metric-preservation assertions and add highlight lifecycle coverage. [VERIFIED: local code][ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; existing session routes already rely on `getCurrentAppUser()`. [VERIFIED: local code] |
| V3 Session Management | no | No new session-auth mechanism is introduced in this phase. [VERIFIED: local code] |
| V4 Access Control | yes | Respect existing preview-lock access control by omitting `highlightState` whenever optimized content is sanitized. [VERIFIED: local code][ASSUMED] |
| V5 Input Validation | yes | Validate model output with `zod`, then run exact local range checks before persistence/rendering. [VERIFIED: local code][ASSUMED] |
| V6 Cryptography | no | This phase introduces no new cryptographic requirement. [VERIFIED: local code] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed model output producing out-of-bounds slices | Tampering | `zod` parse plus local `itemId` and offset validation; silently drop invalid spans. [VERIFIED: local code][ASSUMED] |
| Locked-preview data leakage through highlight metadata | Information Disclosure | Omit/sanitize `highlightState` on locked responses together with `optimizedCvState`. [VERIFIED: local code][ASSUMED] |
| Stale artifact mismatch between `optimizedCvState` and `highlightState` | Tampering | Persist, clear, and roll back both artifacts together. [VERIFIED: local code][ASSUMED] |

## Sources

### Primary (HIGH confidence)

- Local code inspection:  
  `src/lib/resume/optimized-preview-highlights.ts`, `src/components/resume/resume-comparison-view.tsx`, `src/lib/agent/ats-enhancement-pipeline.ts`, `src/lib/agent/job-targeting-pipeline.ts`, `src/lib/agent/tools/rewrite-resume-full.ts`, `src/lib/agent/tools/rewrite-section.ts`, `src/lib/agent/tools/validate-rewrite.ts`, `src/types/agent.ts`, `src/types/dashboard.ts`, `src/app/api/session/[id]/route.ts`, `src/app/api/session/[id]/manual-edit/route.ts`, `src/lib/routes/session-comparison/decision.ts`, `src/lib/db/session-normalization.ts`, `src/lib/agent/request-orchestrator.ts`. [VERIFIED: local code]
- `CLAUDE.md` project constraints and `95-CONTEXT.md` phase scope. [VERIFIED: local code]
- OpenAI Chat Completions response formatting docs. [CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting]
- npm registry version checks for `openai`, `zod`, `vitest`, and `@testing-library/react`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- OpenAI Responses-vs-Chat-Completions migration guide for current API positioning. [CITED: https://platform.openai.com/docs/guides/responses-vs-chat-completions]

### Tertiary (LOW confidence)

- None. [VERIFIED: local code]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all recommended libraries already exist in repo and were version-checked against npm. [VERIFIED: package.json][VERIFIED: npm registry]
- Architecture: MEDIUM - repo seams are clear, but the final detector contract and failure policy still involve implementation choices. [VERIFIED: local code][ASSUMED]
- Pitfalls: HIGH - the stale-state, preview-lock, normalization, and rollback risks are directly visible in current code structure. [VERIFIED: local code]

**Research date:** 2026-04-22  
**Valid until:** 2026-05-22 for repo seams; re-check OpenAI docs and npm versions if execution starts later. [VERIFIED: npm registry][CITED: https://platform.openai.com/docs/api-reference/chat/response-formatting][ASSUMED]
