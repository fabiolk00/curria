# Quick Task 260422-vlo - End-to-End Highlight Outcome Observability Research

**Researched:** 2026-04-22  
**Domain:** Highlight artifact observability across generation, persistence, serialization, and rendering  
**Confidence:** HIGH

## User Constraints

- Focus on observability only, not behavior change. [VERIFIED: user request]
- Distinguish these zero-highlight outcomes explicitly: `not_invoked`, `valid_empty`, `all_filtered_out`, `invalid_payload`, `thrown_error`, `not_persisted`, `omitted_later`, and `renderer_mismatch`. [VERIFIED: user request]
- Write the research output to `C:/CurrIA/.planning/quick/260422-vlo-add-end-to-end-highlight-outcome-observa/260422-vlo-RESEARCH.md`. [VERIFIED: user request]

## Summary

Current telemetry only makes two highlight failures explicit: invalid model payloads are logged and counted in [`src/lib/agent/tools/detect-cv-highlights.ts`](C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts), and thrown detector errors are logged by the ATS/job-targeting pipelines in [`src/lib/agent/ats-enhancement-pipeline.ts`](C:/CurrIA/src/lib/agent/ats-enhancement-pipeline.ts) and [`src/lib/agent/job-targeting-pipeline.ts`](C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts). Valid empty output, locally filtered-to-zero output, rollback-driven loss, locked-preview omission, and renderer mismatch currently collapse into the same observable outcome: no highlights on screen. [VERIFIED: local code]

The minimal-risk path is to keep the persisted artifact shape unchanged and add one shared internal outcome taxonomy plus structured log and metric emission at four seams: detector, pipeline persistence/rollback, serializer omission, and renderability check. [VERIFIED: local code]

**Primary recommendation:** Keep `highlightState` behavior unchanged, but add a shared `HighlightOutcome` classifier and emit it consistently from detector, pipelines, serializers, and renderability checks. [VERIFIED: local code]

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless scope is explicitly changed. [VERIFIED: CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over new feature breadth. [VERIFIED: CLAUDE.md]
- Keep route handlers thin. [VERIFIED: CLAUDE.md]
- Validate external input with `zod`. [VERIFIED: CLAUDE.md]
- Use structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: CLAUDE.md]
- Prefer small, test-backed changes over broad rewrites in sensitive paths. [VERIFIED: CLAUDE.md]

## Standard Stack

### Core

| Module | Version | Purpose | Why Standard |
|---|---|---|---|
| `structured-log.ts` | repo module | Structured logs via `logInfo` / `logWarn` / `logError`. [VERIFIED: local code] | Already used by detector, pipelines, and routes. [VERIFIED: local code] |
| `metric-events.ts` | repo module | Counter emission via `recordMetricCounter`. [VERIFIED: local code] | Existing observability pattern for architecture counters. [VERIFIED: local code] |
| `cv-highlight-artifact.ts` | repo module | Canonical flattening, item IDs, range normalization, and segmentation. [VERIFIED: local code] | Renderer and detector already depend on the same artifact helpers. [VERIFIED: local code] |
| Vitest | `1.6.0`. [VERIFIED: package.json] | Automated regression coverage. [VERIFIED: local code] | Existing test framework for all touched seams. [VERIFIED: package.json][VERIFIED: local code] |

**Installation:** No new dependency is recommended. Reuse existing observability and artifact modules. [VERIFIED: local code]

## Zero-Highlight Introduction Points

| Classification | Exact introduction point | Current signal | Recommended signal |
|---|---|---|---|
| `not_invoked` | `detectCvHighlights()` returns early when `items.length === 0` at `detect-cv-highlights.ts:308`, ATS skips generation when `shouldGenerateHighlights` is false at `ats-enhancement-pipeline.ts:477`, and job targeting skips generation when `validation.valid` is false at `job-targeting-pipeline.ts:248`. [VERIFIED: local code] | Silent. [VERIFIED: local code] | `logInfo('agent.highlight.outcome', { stage: 'invoke', outcome: 'not_invoked', reason })` plus one generic counter. [ASSUMED] |
| `valid_empty` | Parsed payload is valid, but the model returns `{"items":[]}` or equivalent zero candidate ranges before local filtering in `detect-cv-highlights.ts:353-375`. [VERIFIED: local code] | Silent by design today. [VERIFIED: local code] | Info log plus counter with `candidateItemCount: 0` and `resolvedRangeCount: 0`. [ASSUMED] |
| `all_filtered_out` | `validateAndResolveHighlights()` drops every candidate after local normalization/editorial checks in `cv-highlight-artifact.ts:852-905`. [VERIFIED: local code] | Silent; detector returns `[]` indistinguishably from `valid_empty`. [VERIFIED: local code] | Info log plus counter with drop stats such as `candidateRangeCount`, `normalizedRangeCount`, `editoriallyRejectedCount`, and `resolvedRangeCount: 0`. [ASSUMED] |
| `invalid_payload` | `parseHighlightPayload()` returns `invalid_payload`, which is handled in `detect-cv-highlights.ts:355-372`. [VERIFIED: local code] | Already logged with `agent.highlight_detection.invalid_payload` and counted with `architecture.highlight_detection.invalid_payload`. [VERIFIED: local code] | Keep existing warn/counter and also emit generic outcome classification for rollup dashboards. [ASSUMED] |
| `thrown_error` | Detector throws out of `detectCvHighlights()` and is caught in ATS/job-targeting pipelines at `ats-enhancement-pipeline.ts:479-495` and `job-targeting-pipeline.ts:248-265`. [VERIFIED: local code] | Warn log exists per workflow, but no shared highlight outcome counter or normalized reason. [VERIFIED: local code] | Warn log plus generic counter with `stage: 'detect'`, `outcome: 'thrown_error'`, and `errorMessage`. [ASSUMED] |
| `not_persisted` | A generated highlight artifact can be lost when pipeline rollback restores `previousHighlightState` on `persist_version` failure at `ats-enhancement-pipeline.ts:606-619` and `job-targeting-pipeline.ts:347-360`. [VERIFIED: local code] | Silent with respect to highlights; only workflow failure is logged. [VERIFIED: local code] | Warn log plus counter when `nextHighlightState` existed but rollback restores `previousHighlightState`, including `rollbackReason: 'persist_version_failed'`. [ASSUMED] |
| `omitted_later` | Comparison and session serializers intentionally omit `highlightState` for locked previews at `session-comparison/decision.ts:85-87` and `app/api/session/[id]/route.ts:79-81`. [VERIFIED: local code] | Silent with respect to highlights; omission is visible only indirectly through response shape. [VERIFIED: local code] | Info log plus counter with `stage: 'serialize'`, `outcome: 'omitted_later'`, and `reason: 'locked_preview'`. [ASSUMED] |
| `renderer_mismatch` | The renderer resolves ranges by current `itemId` and text in `resume-comparison-view.tsx:130-135`, `:278-282`, and `cv-highlight-artifact.ts:915-955`; a persisted artifact with non-empty `resolvedHighlights` can still render zero highlights if no current item IDs or normalized ranges match. [VERIFIED: local code] | Silent. [VERIFIED: local code] | Compute a renderability summary from current `optimizedCvState` plus `highlightState`; if `resolvedHighlights.length > 0` but renderable highlighted segments are zero, emit `renderer_mismatch`. [ASSUMED] |

## Recommended Outcome Model

Use one internal enum and one generic counter instead of many new public contracts. [ASSUMED]

```ts
type HighlightOutcome =
  | 'not_invoked'
  | 'valid_empty'
  | 'all_filtered_out'
  | 'invalid_payload'
  | 'thrown_error'
  | 'persisted'
  | 'not_persisted'
  | 'omitted_later'
  | 'renderer_mismatch'
```

Recommended shared fields: `workflowMode`, `sessionId`, `stage`, `outcome`, `reason`, `inputItemCount`, `candidateItemCount`, `candidateRangeCount`, `resolvedItemCount`, `resolvedRangeCount`, `lockedPreview`, `artifactVersion`, `hasHighlightState`, and `hasOptimizedCvState`. [ASSUMED]

Recommended generic metric name: `architecture.highlight_outcome`. [ASSUMED] Keep `architecture.highlight_detection.invalid_payload` for backward compatibility. [VERIFIED: local code][ASSUMED]

## Architecture Patterns

### Pattern 1: Add stats without changing artifact behavior

Add a sibling helper in `cv-highlight-artifact.ts` that returns both `resolvedHighlights` and validation stats, then keep `validateAndResolveHighlights()` as a thin wrapper if callers outside the detector should stay unchanged. This preserves the artifact contract while making `valid_empty` and `all_filtered_out` distinguishable. [VERIFIED: local code][ASSUMED]

### Pattern 2: Emit outcome at stage boundaries only

- Detector boundary: after parse/validation in `detect-cv-highlights.ts`. [VERIFIED: local code]
- Pipeline boundary: when generation is skipped, when it throws, when the next state is prepared, and when rollback discards it. [VERIFIED: local code]
- Serializer boundary: when locked preview omits highlights. [VERIFIED: local code]
- Renderability boundary: when a response carries `highlightState`, but the current optimized CV would render zero highlighted segments. [VERIFIED: local code][ASSUMED]

### Pattern 3: Prefer shared renderability checks over UI-only logging

Because item IDs and segmentation logic already live in `cv-highlight-artifact.ts`, renderability can be computed server-side before sending the comparison/session payload. That is lower risk than inventing a browser-only telemetry path and matches the current architecture preference for shallow clients. [VERIFIED: local code][VERIFIED: CLAUDE.md][ASSUMED]

### Anti-Patterns to Avoid

- Do not add a new persisted highlight-status field to `agentState` for this task. Existing omission and rollback paths already make state changes explicit enough for logs and counters. [VERIFIED: local code][ASSUMED]
- Do not change `highlightState` shape or renderer behavior just to carry observability metadata. That increases brownfield risk for a telemetry-only task. [VERIFIED: CLAUDE.md][ASSUMED]
- Do not add route-specific highlight heuristics. Reuse the artifact helper so detection, serialization, and renderability talk about the same item IDs and ranges. [VERIFIED: local code]

## Minimal-Risk Code Changes

1. `src/lib/resume/cv-highlight-artifact.ts`
   Add `validateAndResolveHighlightsWithStats()` and `summarizeRenderableHighlights()` helpers that expose counts for candidate items/ranges, normalized ranges, resolved ranges, and renderable ranges without changing existing normalization rules. [VERIFIED: local code][ASSUMED]

2. `src/lib/agent/tools/detect-cv-highlights.ts`
   Emit one structured info outcome for `not_invoked`, `valid_empty`, `all_filtered_out`, and `persisted`, keep the current warn path for `invalid_payload`, and surface stats from the new helper. [VERIFIED: local code][ASSUMED]

3. `src/lib/agent/ats-enhancement-pipeline.ts` and `src/lib/agent/job-targeting-pipeline.ts`
   Emit explicit outcome logs when highlight generation is skipped, when detector throws, when a highlight artifact is present in `nextAgentState`, and when rollback restores `previousHighlightState`. [VERIFIED: local code][ASSUMED]

4. `src/lib/routes/session-comparison/decision.ts` and `src/app/api/session/[id]/route.ts`
   Emit serializer-side omission logs/counters for locked previews and renderability-mismatch logs/counters when an unlocked response carries a non-empty artifact that would render zero highlights. [VERIFIED: local code][ASSUMED]

5. `src/lib/observability/metric-events.ts`
   Add a single generic metric union entry for highlight outcomes rather than many one-off metric names. [VERIFIED: local code][ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Highlight telemetry transport | A new analytics client or database table. [ASSUMED] | Existing `structured-log.ts` and `metric-events.ts`. [VERIFIED: local code] | Lowest-risk path already used across the codebase. [VERIFIED: local code] |
| Renderer mismatch detection | UI-specific highlight heuristics. [ASSUMED] | Shared helper based on `buildExperienceBulletHighlightItemIds()`, `getHighlightRangesForItem()`, and `segmentTextByHighlightRanges()`. [VERIFIED: local code] | Prevents detector/render drift. [VERIFIED: local code] |
| Persistence diagnosis | New persisted status flags. [ASSUMED] | Pipeline-side log/counter emission around existing rollback points. [VERIFIED: local code] | Observability need is temporal, not state-model driven. [VERIFIED: local code][ASSUMED] |

## Common Pitfalls

### Pitfall 1: Empty array ambiguity

`detectCvHighlights()` currently returns `[]` for at least four materially different cases: no input items, valid empty model response, locally filtered output, and invalid payload. [VERIFIED: local code] Without stats, post-hoc diagnosis is impossible. [VERIFIED: local code]

### Pitfall 2: ATS and job-targeting do not skip for the same reasons

ATS skips highlight generation when the final optimized CV matches the original CV, while job targeting only gates on `validation.valid`. These are not equivalent “not invoked” reasons and should not be logged as one opaque skip. [VERIFIED: local code]

### Pitfall 3: Omission is not failure

Locked-preview serializers intentionally drop `highlightState`; that should be counted as `omitted_later`, not as a detector or persistence failure. [VERIFIED: local code]

### Pitfall 4: Non-empty artifact does not guarantee visible highlights

The comparison view derives summary and bullet highlights from the current optimized text and current deterministic item IDs. A stored artifact can therefore be present but visually empty. [VERIFIED: local code]

## Code Examples

### Recommended detector outcome emission

```ts
const result = validateAndResolveHighlightsWithStats(items, parsedPayload.value)

logInfo('agent.highlight.outcome', {
  workflowMode: context?.workflowMode,
  sessionId: context?.sessionId,
  stage: 'detect',
  outcome: result.stats.candidateRangeCount === 0
    ? 'valid_empty'
    : result.resolvedHighlights.length === 0
      ? 'all_filtered_out'
      : 'persisted',
  inputItemCount: items.length,
  candidateItemCount: result.stats.candidateItemCount,
  candidateRangeCount: result.stats.candidateRangeCount,
  resolvedItemCount: result.resolvedHighlights.length,
  resolvedRangeCount: result.stats.resolvedRangeCount,
})
recordMetricCounter('architecture.highlight_outcome', {
  stage: 'detect',
  outcome,
  workflowMode: context?.workflowMode,
})
```

### Recommended serializer-side omission and mismatch emission

```ts
const renderability = summarizeRenderableHighlights(optimizedCvState, session.agentState.highlightState)

if (isLockedPreview(session.generatedOutput) && session.agentState.highlightState) {
  logInfo('agent.highlight.outcome', {
    stage: 'serialize',
    outcome: 'omitted_later',
    reason: 'locked_preview',
    resolvedHighlightCount: session.agentState.highlightState.resolvedHighlights.length,
  })
} else if (renderability.hasArtifact && renderability.renderableRangeCount === 0) {
  logWarn('agent.highlight.outcome', {
    stage: 'renderability',
    outcome: 'renderer_mismatch',
    storedRangeCount: renderability.storedRangeCount,
    renderableRangeCount: 0,
  })
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `1.6.0`. [VERIFIED: package.json] |
| Config file | None detected; tests are colocated and run through package scripts. [VERIFIED: local code][VERIFIED: package.json] |
| Quick run command | `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/route.test.ts` [VERIFIED: local code][VERIFIED: package.json] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Task Coverage Map

| Behavior | Test Type | Automated Command | Existing File |
|---|---|---|---|
| Detector distinguishes `valid_empty`, `all_filtered_out`, and `invalid_payload`. [ASSUMED] | unit | `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts` [VERIFIED: package.json] | yes. [VERIFIED: local code] |
| Pipelines log `not_invoked`, `thrown_error`, and `not_persisted`. [ASSUMED] | integration | `npx vitest run src/lib/agent/tools/pipeline.test.ts` [VERIFIED: package.json] | yes. [VERIFIED: local code] |
| Comparison decision and session route log `omitted_later` and `renderer_mismatch`. [ASSUMED] | unit/route | `npx vitest run src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/route.test.ts` [VERIFIED: package.json] | yes. [VERIFIED: local code] |

### Wave 0 Gaps

- Add detector assertions for valid-empty versus filtered-to-zero outcome logging/counters. [VERIFIED: local code][ASSUMED]
- Add pipeline assertions for ATS skip reasons and rollback-driven `not_persisted`. [VERIFIED: local code][ASSUMED]
- Add serializer assertions that locked omission is counted separately from unlocked renderability mismatch. [VERIFIED: local code][ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no. [VERIFIED: local code] | Existing auth boundaries are unchanged by this task. [VERIFIED: local code] |
| V3 Session Management | no. [VERIFIED: local code] | No session/auth flow change is recommended. [VERIFIED: local code] |
| V4 Access Control | yes. [VERIFIED: local code] | Preserve locked-preview omission of `highlightState`. [VERIFIED: local code] |
| V5 Input Validation | yes. [VERIFIED: CLAUDE.md][VERIFIED: local code] | Reuse existing `zod` validation style and internal helper validation. [VERIFIED: CLAUDE.md][VERIFIED: local code] |
| V6 Cryptography | no. [VERIFIED: local code] | No crypto change is involved. [VERIFIED: local code] |

### Known Threat Pattern

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Highlight metadata leaking through locked previews. [VERIFIED: local code] | Information Disclosure | Keep omission behavior and count it as `omitted_later`, not as a failure. [VERIFIED: local code][ASSUMED] |

## Assumptions Log

All factual claims in this note were verified from the local codebase, project docs, or the user request. Recommended log names, counter names, and helper names are implementation proposals, not existing facts. [VERIFIED: local code][VERIFIED: user request][VERIFIED: CLAUDE.md]

## Open Questions

1. Should the generic counter be introduced as one new metric name (`architecture.highlight_outcome`) or should the task stay log-only to avoid widening the typed metric union? Current code supports either path, but one generic metric gives better aggregation with minimal API surface. [VERIFIED: local code][ASSUMED]

## Sources

### Primary

- `C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts` - detector flow, invalid payload handling, and early-return cases. [VERIFIED: local code]
- `C:/CurrIA/src/lib/resume/cv-highlight-artifact.ts` - local range validation, filtering, item-ID derivation, and segmentation. [VERIFIED: local code]
- `C:/CurrIA/src/lib/agent/ats-enhancement-pipeline.ts` - ATS skip, detector error handling, persistence, and rollback. [VERIFIED: local code]
- `C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts` - job-targeting skip, detector error handling, persistence, and rollback. [VERIFIED: local code]
- `C:/CurrIA/src/lib/routes/session-comparison/decision.ts` - comparison response omission seam. [VERIFIED: local code]
- `C:/CurrIA/src/app/api/session/[id]/route.ts` - session response omission seam. [VERIFIED: local code]
- `C:/CurrIA/src/components/resume/resume-comparison-view.tsx` - actual render seam. [VERIFIED: local code]
- `C:/CurrIA/CLAUDE.md` - project constraints. [VERIFIED: CLAUDE.md]
- `C:/CurrIA/.planning/config.json` - validation and security enforcement settings. [VERIFIED: .planning/config.json]
- `C:/CurrIA/package.json` - Vitest version and test scripts. [VERIFIED: package.json]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing observability and test primitives are explicit in local code and `package.json`. [VERIFIED: local code][VERIFIED: package.json]
- Architecture: HIGH - all zero-highlight introduction points were traced through detector, pipelines, serializers, and renderer. [VERIFIED: local code]
- Pitfalls: HIGH - each pitfall maps to a concrete silent branch in current code. [VERIFIED: local code]

**Research date:** 2026-04-22  
**Valid until:** 2026-05-22
