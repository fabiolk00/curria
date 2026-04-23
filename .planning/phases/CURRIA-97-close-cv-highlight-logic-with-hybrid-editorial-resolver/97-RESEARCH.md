# Phase 97: Close CV highlight logic with hybrid editorial resolver - Research

**Researched:** 2026-04-23
**Domain:** Persisted CV highlight artifact quality for ATS/job-targeting preview spans [VERIFIED: codebase grep]
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Phase 97 Context

### Goal

Close the remaining CV highlight span gap with a hybrid editorial resolver that first improves detector prompt quality and only then adds minimal local artifact-side arbitration when strictly necessary.

### Why This Phase Exists

The persisted highlight architecture is now correct end-to-end, but some rendered spans still:

- start on weak generic verbs
- stop before the natural semantic closure of a metric/result phrase
- depend too much on the detector's initial start offset

The product need is to make highlight behavior feel editorially final without reintroducing the aggressive candidate-scoring instability that was previously rolled back.

### Real Flow Seams

- ATS pipeline: `src/lib/agent/ats-enhancement-pipeline.ts`
- ATS job processor: `src/lib/jobs/processors/ats-enhancement.ts`
- Detector prompt + response parsing: `src/lib/agent/tools/detect-cv-highlights.ts`
- Highlight artifact + normalization: `src/lib/resume/cv-highlight-artifact.ts`
- Highlight observability: `src/lib/agent/highlight-observability.ts`
- Session comparison decision: `src/lib/routes/session-comparison/decision.ts`
- Preview renderer: `src/components/resume/resume-comparison-view.tsx`

### Current Architecture

After a final rewritten `optimizedCvState` exists, the system:

1. computes `shouldGenerateHighlights`
2. calls `generateCvHighlightState(cvState)`
3. flattens summary + experience bullets into stable highlight items
4. sends one detector request for all items
5. validates and resolves returned ranges locally
6. persists `highlightState`
7. renders the unchanged `optimizedCvState` plus the separate visual highlight layer

### Honest Gap Diagnosis

The architecture is solid. The remaining gap is local to span quality and comes from three places:

1. The detector prompt still allows semantically weak starts and incomplete closures.
2. `normalizeHighlightSpanBoundaries(...)` improves a span linearly but does not re-decide the best local nucleus.
3. The artifact has no conservative arbitration between a base span and a clearly stronger local alternative.

### Required Strategy Order

#### Front 1 - Detector prompt hardening first

Strengthen `buildHighlightSystemPrompt(...)` so the detector prefers semantically closed ranges and stops proposing machine-cut fragments.

Add explicit rules that:

- ranges must start and end on complete semantic units
- isolated metrics without their immediate measured context are invalid when the context exists in the same bullet
- generic lead verbs are invalid starts when a stronger later nucleus exists
- slightly longer natural spans are better than ultra-short machine-looking fragments

Add positive and negative examples for:

- metric + context closure
- complete migration/scale phrases
- avoiding starts like `Otimizei`, `Liderei`, `Desenvolvi` when a denser nucleus appears later

#### Front 2 - Minimal artifact-side resolver only if still needed

Only after validating Front 1 should the artifact gain conservative local arbitration.

Priority order:

1. Add left-trim editorial logic inside `normalizeHighlightSpanBoundaries(...)` to drop weak generic starts when a stronger local entry point exists.
2. Make the full-bullet-vs-nucleus decision rules more explicit around short measurable bullets and long bullets with premium nuclei.
3. If needed, add at most 3 local candidates:
   - `base_range`
   - `trim_left_range`
   - `metric_closure_range`

Promote an alternative only when it is clearly better on at least two of:

- metric with context
- technical specificity
- no generic lead
- no weak trailing tail

In doubt, keep `base_range`.

### Editorial Rule Hierarchy

All decisions must follow this order:

1. Complete and natural semantic unit
2. Dense signal: metric, scale, stack, business outcome
3. Proper closure
4. Brevity last

### Guardrails

- Do not start with artifact-side arbitration before validating prompt improvements.
- Do not reintroduce aggressive candidate scoring.
- Do not add more than 3 local candidates.
- Do not relax `isEditoriallyAcceptableHighlightRange(...)`.
- Do not change renderer logic; rendering is not the problem.

### Acceptance Criteria

- Metric bullets include the metric and its natural immediate complement, not just the number.
- Short complete semantic bullets can be highlighted whole.
- Highlights do not start on generic verbs when a better nucleus exists locally.
- Behavior stays deterministic and predictable for the same bullet conditions.
- `isEditoriallyAcceptableHighlightRange(...)` remains the last defense, not a compensation mechanism.

### Claude's Discretion
No explicit `## Claude's Discretion` section exists in `97-CONTEXT.md`. [VERIFIED: 97-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)
No explicit `## Deferred Ideas` section exists in `97-CONTEXT.md`. [VERIFIED: 97-CONTEXT.md]
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless the user explicitly changes scope. [VERIFIED: CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: CLAUDE.md]
- Follow surrounding file style, use `@/*` imports, keep route handlers thin, validate external input with `zod`, and prefer `logInfo`/`logWarn`/`logError`. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: CLAUDE.md]
- Preserve dispatcher and `ToolPatch` patterns when changing agent flows. [VERIFIED: CLAUDE.md]
- The app is a monolith with sensitive paths in the agent loop and resume flows; prefer small, test-backed changes over broad rewrites. [VERIFIED: CLAUDE.md]

## Summary

Phase 97 should stay inside the existing persisted-highlight architecture: the detector still runs once over flattened items, the artifact remains separate from `optimizedCvState`, and the renderer continues to consume persisted ranges without recomputing anything client-side. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] [VERIFIED: src/lib/agent/ats-enhancement-pipeline.ts] [VERIFIED: src/lib/routes/session-comparison/decision.ts] [VERIFIED: src/components/resume/resume-comparison-view.tsx]

The safest implementation order is exactly what the context demands: harden `buildHighlightSystemPrompt()` first, measure the delta with focused detector and artifact tests, and only then add a conservative artifact-side resolver inside `normalizeHighlightSpanBoundaries()` if prompt-only results still leave weak generic starts or under-closed metric phrases. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts]

The key seam is that prompt changes affect candidate generation, while artifact changes affect deterministic local acceptance. That split is already clean in the codebase: model output is parsed and validated in `detectCvHighlights()`, then normalized and filtered in `validateAndResolveHighlights()`, then persisted and surfaced through unchanged response/render paths. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts] [VERIFIED: src/lib/agent/highlight-observability.ts]

**Primary recommendation:** Ship Phase 97 as two commits or two plan waves: `prompt hardening + tests` first, then `minimal artifact arbitration + regression proof` only if prompt hardening still misses acceptance cases. [VERIFIED: 97-CONTEXT.md] [VERIFIED: codebase grep]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | `^6.33.0` [VERIFIED: package.json] | Existing single-call detector client in `detect-cv-highlights.ts`. [VERIFIED: package.json] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] | Already wired to the structured model path with `response_format: { type: 'json_object' }`; no new client or API layer is needed. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] |
| `zod` | `^3.23.8` [VERIFIED: package.json] | Existing payload shape validation for detector output and artifact state. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts] | Matches the repo convention to validate external input and model payloads rather than trusting strings. [VERIFIED: CLAUDE.md] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] |
| `vitest` | `1.6.1` local CLI, `^1.6.0` in manifest [VERIFIED: local runtime] [VERIFIED: package.json] | Existing unit/regression harness for detector, artifact, route, and renderer seams. [VERIFIED: codebase grep] | Coverage already exists around the exact files this phase should touch. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.test.ts] [VERIFIED: src/lib/resume/cv-highlight-artifact.test.ts] [VERIFIED: src/lib/routes/session-comparison/decision.test.ts] [VERIFIED: src/components/resume/resume-comparison-view.test.tsx] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new dependency | n/a | This phase can be implemented entirely inside existing detector/artifact/test seams. [VERIFIED: codebase grep] | Keep this phase dependency-free unless a later prompt-evaluation tool becomes necessary. [VERIFIED: 97-CONTEXT.md] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing single-call detector plus local resolver | Multi-pass per-bullet LLM arbitration | Reject this for Phase 97 because the current architecture intentionally makes one detector request for all items and persists deterministic local resolution after that call. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] |
| Artifact-local normalization | Renderer-side span selection | Reject this because the renderer already consumes persisted ranges and the context explicitly says rendering is not the problem. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/components/resume/resume-comparison-view.tsx] |

**Installation:** No new packages. [VERIFIED: codebase grep]

```bash
# no install step for Phase 97
```

**Version verification:** Reuse the existing repo dependencies; no new package recommendation requires `npm view` for this phase. [VERIFIED: package.json]

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── lib/agent/tools/detect-cv-highlights.ts      # prompt rules, parsing, single-call detection
├── lib/resume/cv-highlight-artifact.ts          # deterministic span normalization and arbitration
├── lib/agent/ats-enhancement-pipeline.ts        # ATS highlight generation + persistence contract
├── lib/agent/job-targeting-pipeline.ts          # shared highlight generation for job targeting
├── lib/routes/session-comparison/decision.ts    # response gating and observability
└── components/resume/resume-comparison-view.tsx # render-only consumer of persisted ranges
```

### Pattern 1: Prompt-First Highlight Quality
**What:** Strengthen `buildHighlightSystemPrompt()` before changing any artifact heuristic so the model stops returning weak starts and under-closed fragments at the source. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts]
**When to use:** First wave of Phase 97, before any resolver logic lands. [VERIFIED: 97-CONTEXT.md]
**Implementation notes:** Add explicit negative rules for generic lead verbs, add positive/negative examples for metric closure and migration/scale phrases, and keep the response contract unchanged so parser logic and tests stay stable. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts]
**Example:**
```typescript
// Source: src/lib/agent/tools/detect-cv-highlights.ts
function buildHighlightSystemPrompt(): string {
  return [
    // keep the JSON contract and allowed reasons unchanged
    // add stronger editorial rules:
    // - complete semantic units only
    // - reject generic lead verbs when a later nucleus exists
    // - prefer metric plus immediate context over isolated numbers
  ].join('\n')
}
```

### Pattern 2: Conservative Local Arbitration Inside Normalization
**What:** If prompt hardening is insufficient, keep artifact logic inside `normalizeHighlightSpanBoundaries()` and make it choose between at most three local candidates: base, left-trimmed, and metric-closure. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts]
**When to use:** Second wave only, after prompt-only validation still fails specific acceptance fixtures. [VERIFIED: 97-CONTEXT.md]
**Implementation notes:** Generate alternatives from the same original range, score them with a tiny rule set, and promote only when an alternative is clearly better on at least two prescribed dimensions. [VERIFIED: 97-CONTEXT.md]
**Example:**
```typescript
// Source: src/lib/resume/cv-highlight-artifact.ts
function normalizeHighlightSpanBoundaries(text: string, range: CvHighlightRange) {
  const baseRange = normalizeExistingRange(text, range)
  const trimLeftRange = maybeTrimWeakLead(text, baseRange)
  const metricClosureRange = maybeExtendMetricClosure(text, baseRange)
  return pickClearlyBetterRange([baseRange, trimLeftRange, metricClosureRange])
}
```

### Pattern 3: Preserve Persistence and Response Contracts
**What:** Keep `shouldGenerateHighlights`, `generateCvHighlightState()`, highlight persistence logging, response omission for locked previews, and renderer consumption unchanged while span quality improves underneath. [VERIFIED: src/lib/agent/ats-enhancement-pipeline.ts] [VERIFIED: src/lib/agent/highlight-observability.ts] [VERIFIED: src/lib/routes/session-comparison/decision.ts] [VERIFIED: src/components/resume/resume-comparison-view.tsx]
**When to use:** Entire phase. [VERIFIED: codebase grep]
**Example:**
```typescript
// Source: src/lib/agent/ats-enhancement-pipeline.ts
const shouldGenerateHighlights =
  finalValidation.valid && !cvStatesMatch(finalOptimizedCvState, session.cvState)

// keep this lifecycle unchanged; Phase 97 improves span quality, not pipeline shape
nextHighlightState = await generateCvHighlightState(finalOptimizedCvState, context)
```

### Safe Sequencing
1. Add detector prompt examples and rules in `detect-cv-highlights.ts`. [VERIFIED: 97-CONTEXT.md]
2. Expand `detect-cv-highlights.test.ts` with prompt-driven fixtures that assert the returned resolved span shape after validation. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.test.ts]
3. Run focused tests on detector, artifact, route decision, renderer, and pipeline logging before any artifact arbitration lands. [VERIFIED: codebase grep]
4. Only if failures remain, add left-trim and minimal candidate arbitration in `cv-highlight-artifact.ts`. [VERIFIED: 97-CONTEXT.md]
5. Add direct normalization tests for weak-lead trimming, full-bullet acceptance on short measurable bullets, and no-regression cases that must keep `base_range`. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/resume/cv-highlight-artifact.test.ts]
6. Re-run the same focused suite, then `npm test` if time allows. [VERIFIED: package.json]

### Anti-Patterns to Avoid
- **Prompt and resolver shipped together without isolated proof:** This hides whether the prompt actually improved anything and violates the required order in `97-CONTEXT.md`. [VERIFIED: 97-CONTEXT.md]
- **Aggressive candidate scoring:** The context explicitly forbids reopening the old instability pattern. Use a tiny rule gate, not weighted ranking across many candidates. [VERIFIED: 97-CONTEXT.md]
- **Renderer-side cleanup:** The renderer already segments text from persisted ranges; changing it would mask upstream span quality issues. [VERIFIED: src/components/resume/resume-comparison-view.tsx]
- **Relaxing `isEditoriallyAcceptableHighlightRange()`:** Phase 97 should improve candidate quality before acceptance, not make the last defense weaker. [VERIFIED: 97-CONTEXT.md] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weak-start correction | A broad scoring engine over many span permutations | A 3-candidate max local arbitration inside `normalizeHighlightSpanBoundaries()` if prompt hardening is insufficient. [VERIFIED: 97-CONTEXT.md] | The context explicitly caps candidates at 3 and warns against aggressive scoring instability. [VERIFIED: 97-CONTEXT.md] |
| Preview cleanup | Client-side re-highlighting or diff heuristics | Existing persisted `highlightState` plus `segmentTextByHighlightRanges()`. [VERIFIED: src/components/resume/resume-comparison-view.tsx] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts] | Keeps rendering deterministic and consistent with server-persisted artifacts. [VERIFIED: src/lib/routes/session-comparison/decision.ts] |
| Prompt-result validation | Ad hoc string parsing | Existing `zod` envelope validation, alias normalization, range filtering, and fail-closed behavior in `detectCvHighlights()`. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] | This is already observable and tested for invalid JSON, wrappers, prose, and unknown reasons. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.test.ts] |

**Key insight:** Phase 97 should refine candidate generation and deterministic boundary resolution, not replace the persisted-highlight architecture that Phases 95-96 established. [VERIFIED: ROADMAP.md] [VERIFIED: STATE.md]

## Common Pitfalls

### Pitfall 1: Improving closure while keeping a bad left edge
**What goes wrong:** A span grows rightward to include `%`, `zero downtime`, or a compact complement, but still starts on `Otimizei`, `Liderei`, or `Desenvolvi`. [VERIFIED: 97-CONTEXT.md]
**Why it happens:** Current normalization has rightward closure helpers but no explicit local nucleus re-selection step. [VERIFIED: src/lib/resume/cv-highlight-artifact.ts]
**How to avoid:** Add prompt rules first, then add a tiny left-trim candidate only for weak generic starts with a stronger later nucleus. [VERIFIED: 97-CONTEXT.md]
**Warning signs:** The resolved text becomes editorially longer but still reads like a machine-selected action verb plus fragment. [ASSUMED]

### Pitfall 2: Treating the artifact as a compensation layer for poor prompt output
**What goes wrong:** Resolver logic grows until it is effectively a second selector. [VERIFIED: 97-CONTEXT.md]
**Why it happens:** It is tempting because normalization is deterministic and local. [ASSUMED]
**How to avoid:** Keep prompt hardening in its own wave and require a failing fixture before adding each artifact rule. [VERIFIED: 97-CONTEXT.md]
**Warning signs:** New helper functions start inventing many candidate classes or weighting systems. [VERIFIED: 97-CONTEXT.md]

### Pitfall 3: Regressing locked-preview or no-artifact behavior while chasing span quality
**What goes wrong:** Response surfaces start leaking or mutating `highlightState` semantics unrelated to span selection. [VERIFIED: src/lib/routes/session-comparison/decision.ts]
**Why it happens:** Cross-file edits spill from detector/artifact code into route or renderer code. [ASSUMED]
**How to avoid:** Keep Phase 97 changes scoped to detector prompt text, artifact normalization, and focused tests; leave response/render files unchanged unless a test proves they are incorrect. [VERIFIED: 97-CONTEXT.md] [VERIFIED: codebase grep]
**Warning signs:** `highlight_state.response_evaluated` expectations or locked-preview tests begin failing after a normalization-only change. [VERIFIED: src/lib/routes/session-comparison/decision.test.ts]

### Pitfall 4: Breaking determinism across ATS and job-targeting flows
**What goes wrong:** ATS spans improve, but job-targeting spans diverge because the shared generator seam was overlooked. [VERIFIED: codebase grep]
**Why it happens:** Both pipelines call `generateCvHighlightState()`, but the phase context names ATS seams most prominently. [VERIFIED: src/lib/agent/ats-enhancement-pipeline.ts] [VERIFIED: src/lib/agent/job-targeting-pipeline.ts]
**How to avoid:** Treat `detect-cv-highlights.ts` and `cv-highlight-artifact.ts` as shared infrastructure and run at least one job-targeting pipeline regression after span changes. [VERIFIED: codebase grep]
**Warning signs:** ATS tests pass while `job_targeting` pipeline tests around highlight persistence start failing or changing persisted reason fields. [VERIFIED: src/lib/agent/tools/pipeline.test.ts]

## Code Examples

Verified patterns from current code:

### Single detector call over flattened items
```typescript
// Source: src/lib/agent/tools/detect-cv-highlights.ts
const response = await openai.chat.completions.create({
  model: MODEL_CONFIG.structuredModel,
  temperature: 0,
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: buildHighlightSystemPrompt() },
    { role: 'user', content: JSON.stringify({ items }) },
  ],
})
```
[VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts]

### Local validation and fail-closed resolution
```typescript
// Source: src/lib/agent/tools/detect-cv-highlights.ts
const parsedPayload = parseHighlightPayload(text)
if (parsedPayload.kind === 'invalid_payload') {
  return []
}

const resolvedHighlights = validateAndResolveHighlights(items, parsedPayload.value)
```
[VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts]

### Deterministic renderer consumption
```typescript
// Source: src/components/resume/resume-comparison-view.tsx
const bulletSegments = segmentTextByHighlightRanges(
  bullet,
  getHighlightRangesForItem(resolvedHighlights, itemId),
)
```
[VERIFIED: src/components/resume/resume-comparison-view.tsx]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Deterministic preview heuristics in the preview layer | Persisted single-call LLM highlight artifacts stored separately from `optimizedCvState`. [VERIFIED: ROADMAP.md] [VERIFIED: STATE.md] | Phase 95 on the roadmap. [VERIFIED: ROADMAP.md] | Phase 97 should refine this persisted artifact path, not reintroduce client-side heuristics. [VERIFIED: 97-CONTEXT.md] |
| Linear rightward closure refinement only | Prompt-first hardening plus, if needed, tiny local arbitration between base/trim-left/metric-closure candidates. [VERIFIED: 97-CONTEXT.md] | Planned for Phase 97. [VERIFIED: 97-CONTEXT.md] | Better editorial starts and closures without reopening broad candidate scoring. [VERIFIED: 97-CONTEXT.md] |

**Deprecated/outdated:**
- Reopening aggressive candidate-scoring instability is explicitly out of scope for this phase. [VERIFIED: 97-CONTEXT.md]
- Renderer-driven highlight repair is not the winning architecture now that `highlightState` is persisted and response-gated. [VERIFIED: src/lib/routes/session-comparison/decision.ts] [VERIFIED: src/components/resume/resume-comparison-view.tsx]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Warning-sign language like "reads like a machine-selected action verb plus fragment" is a useful proxy for editorial failure. [ASSUMED] | Common Pitfalls | Low; it affects diagnostics language, not implementation. |
| A2 | The temptation to expand deterministic normalization because it is local and easy is a likely engineering failure mode here. [ASSUMED] | Common Pitfalls | Low; it affects planning emphasis, not runtime behavior. |
| A3 | Route/render regressions from normalization-only changes are more likely to come from edit sprawl than from the existing contracts themselves. [ASSUMED] | Common Pitfalls | Medium; if false, the plan may under-scope route checks. |

## Open Questions (RESOLVED)

1. **Should Phase 97 explicitly update both ATS and job-targeting regression fixtures, or only ATS fixtures plus one shared smoke test?**
   Resolution: ATS-focused fixture expansion plus one mandatory shared job-targeting pipeline regression is the required proof shape, because `generateCvHighlightState()` is shared across both flows and the phase scope explicitly allows one shared seam regression without broadening the architecture surface.

2. **Should short, compact measurable bullets now be allowed to highlight the full bullet more often?**
   Resolution: No broad allowance is added up front. The current compact measurable whole-bullet rule remains the baseline, and any further change must be introduced only if fixture-led prompt-first validation proves the existing helper is still insufficient for the accepted short semantic-unit cases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Local test execution and repo scripts. [VERIFIED: package.json] | Yes [VERIFIED: local runtime] | `v24.14.0` [VERIFIED: local runtime] | None needed. |
| npm | Running project scripts and focused test commands. [VERIFIED: package.json] | Yes [VERIFIED: local runtime] | `11.9.0` [VERIFIED: local runtime] | None needed. |
| Vitest CLI | Phase-local regression commands. [VERIFIED: package.json] [VERIFIED: vitest.config.ts] | Yes [VERIFIED: local runtime] | `1.6.1` [VERIFIED: local runtime] | `npm test` also runs Vitest. [VERIFIED: package.json] |

**Missing dependencies with no fallback:** None. [VERIFIED: local runtime]

**Missing dependencies with fallback:** None. [VERIFIED: local runtime]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` with `jsdom` for `*.test.tsx` and `node` otherwise. [VERIFIED: vitest.config.ts] |
| Config file | `vitest.config.ts`. [VERIFIED: vitest.config.ts] |
| Quick run command | `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts src/lib/routes/session-comparison/decision.test.ts src/components/resume/resume-comparison-view.test.tsx src/lib/agent/tools/pipeline.test.ts -t highlight`. [VERIFIED: local runtime] |
| Full suite command | `npm test`. [VERIFIED: package.json] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AC-01 | Metric bullets keep metric plus immediate complement. [VERIFIED: 97-CONTEXT.md] | unit | `npx vitest run src/lib/resume/cv-highlight-artifact.test.ts` | Yes [VERIFIED: codebase grep] |
| AC-02 | Generic lead verbs do not survive when a stronger local nucleus exists. [VERIFIED: 97-CONTEXT.md] | unit | `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts` | Yes [VERIFIED: codebase grep] |
| AC-03 | Short complete semantic bullets can highlight whole-bullet cases when editorially acceptable. [VERIFIED: 97-CONTEXT.md] | unit | `npx vitest run src/lib/resume/cv-highlight-artifact.test.ts` | Yes [VERIFIED: codebase grep] |
| AC-04 | Persisted/locked-preview behavior does not regress. [VERIFIED: 97-CONTEXT.md] | unit | `npx vitest run src/lib/routes/session-comparison/decision.test.ts src/components/resume/resume-comparison-view.test.tsx src/lib/agent/tools/pipeline.test.ts` | Yes [VERIFIED: codebase grep] |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts` for prompt/artifact edits, then add route/render tests if any shared fixture changes. [VERIFIED: codebase grep]
- **Per wave merge:** `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts src/lib/routes/session-comparison/decision.test.ts src/components/resume/resume-comparison-view.test.tsx src/lib/agent/tools/pipeline.test.ts`. [VERIFIED: codebase grep]
- **Phase gate:** `npm test` green before `/gsd-verify-work`. [VERIFIED: package.json]

### Wave 0 Gaps
- Add prompt-quality fixtures to `src/lib/agent/tools/detect-cv-highlights.test.ts` that assert resolved output for weak-lead and metric-closure bullets, because current tests cover invalid payload behavior much more than editorial prompt quality. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.test.ts]
- Expand `src/lib/resume/cv-highlight-artifact.test.ts` beyond current closure tests to cover left-trim editorial arbitration and explicit keep-`base_range` cases. [VERIFIED: src/lib/resume/cv-highlight-artifact.test.ts]
- Add one shared regression in `src/lib/agent/tools/pipeline.test.ts` or equivalent for job-targeting highlight persistence if prompt/result fixtures materially change resolved spans. [VERIFIED: src/lib/agent/tools/pipeline.test.ts]

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No; this phase does not change auth surfaces. [VERIFIED: codebase grep] | Existing Clerk/internal app-user boundary remains unchanged. [VERIFIED: CLAUDE.md] |
| V3 Session Management | No; no session lifecycle semantics change is required. [VERIFIED: codebase grep] | Keep `session.agentState.highlightState` persistence contract unchanged. [VERIFIED: src/lib/agent/ats-enhancement-pipeline.ts] |
| V4 Access Control | No direct access-control change, but locked-preview omission must remain intact. [VERIFIED: src/lib/routes/session-comparison/decision.ts] | Existing `buildHighlightStateResponseOutcome()` plus locked-preview sanitization. [VERIFIED: src/lib/agent/highlight-observability.ts] [VERIFIED: src/lib/routes/session-comparison/decision.ts] |
| V5 Input Validation | Yes. [VERIFIED: CLAUDE.md] | Keep `zod` payload parsing, item/range validation, clamping, overlap rejection, and editorial acceptance gates. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] [VERIFIED: src/lib/resume/cv-highlight-artifact.ts] |
| V6 Cryptography | No; this phase does not touch crypto. [VERIFIED: codebase grep] | None. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed or wrapped model JSON | Tampering | Fail closed through `parseHighlightPayload()`, `zod`, warn logging, and metrics. [VERIFIED: src/lib/agent/tools/detect-cv-highlights.ts] [VERIFIED: src/lib/agent/tools/detect-cv-highlights.test.ts] |
| Out-of-bounds or overlapping highlight spans | Tampering | Clamp, normalize, reject overlap, and enforce `isEditoriallyAcceptableHighlightRange()`. [VERIFIED: src/lib/resume/cv-highlight-artifact.ts] |
| Locked-preview highlight leakage | Information Disclosure | Keep omission logic in `buildHighlightStateResponseOutcome()` and session-comparison decision tests unchanged. [VERIFIED: src/lib/agent/highlight-observability.ts] [VERIFIED: src/lib/routes/session-comparison/decision.test.ts] |
| Prompt drift causing noisy spans | Integrity | Keep prompt edits test-backed and require artifact changes only after prompt-only verification. [VERIFIED: 97-CONTEXT.md] |

## Sources

### Primary (HIGH confidence)
- `c:\CurrIA\.planning\phases\CURRIA-97-close-cv-highlight-logic-with-hybrid-editorial-resolver\97-CONTEXT.md` - phase goal, required sequencing, guardrails, acceptance criteria.
- `c:\CurrIA\CLAUDE.md` - project constraints, architecture invariants, testing and logging rules.
- `c:\CurrIA\.planning\config.json` - `nyquist_validation` and `security_enforcement` are enabled.
- `c:\CurrIA\src\lib\agent\tools\detect-cv-highlights.ts` - detector prompt, single-call contract, parsing, and observability.
- `c:\CurrIA\src\lib\resume\cv-highlight-artifact.ts` - normalization, acceptance gates, segmentation, and artifact schema.
- `c:\CurrIA\src\lib\agent\ats-enhancement-pipeline.ts` - highlight generation/persistence lifecycle.
- `c:\CurrIA\src\lib\agent\highlight-observability.ts` - response classification and renderability accounting.
- `c:\CurrIA\src\lib\routes\session-comparison\decision.ts` - locked-preview omission and response logging.
- `c:\CurrIA\src\components\resume\resume-comparison-view.tsx` - render-only consumption of persisted highlight ranges.
- `c:\CurrIA\src\lib\agent\tools\detect-cv-highlights.test.ts` - existing detector validation coverage.
- `c:\CurrIA\src\lib\resume\cv-highlight-artifact.test.ts` - existing closure normalization tests.
- `c:\CurrIA\src\lib\agent\tools\pipeline.test.ts` - highlight persistence behavior in ATS/job-targeting flows.
- `c:\CurrIA\src\lib\routes\session-comparison\decision.test.ts` - response gating and observability regressions.
- `c:\CurrIA\src\components\resume\resume-comparison-view.test.tsx` - renderer highlight behavior and local save reset.
- `c:\CurrIA\package.json` - scripts and repo dependency versions.
- `c:\CurrIA\vitest.config.ts` - test environment and config.
- Local runtime commands on 2026-04-23 - `node --version`, `npm --version`, `npx vitest --version`.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependency recommendation is needed and the existing toolchain is verified from the repo plus local runtime. [VERIFIED: package.json] [VERIFIED: local runtime]
- Architecture: HIGH - the main seams, persistence flow, route gating, and renderer usage are directly visible in code and tests. [VERIFIED: codebase grep]
- Pitfalls: MEDIUM - most are grounded in the current code and phase context, but a few warning-sign descriptions are planner-oriented inferences. [VERIFIED: 97-CONTEXT.md] [ASSUMED]

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 for codebase-local findings unless adjacent highlight architecture changes earlier. [ASSUMED]
