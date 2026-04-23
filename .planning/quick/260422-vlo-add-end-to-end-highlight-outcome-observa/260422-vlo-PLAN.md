# Quick Task 260422-vlo - Add end-to-end highlight outcome observability for silent zero-highlight cases

## Goal

Make highlight outcomes diagnosable from detector call through pipeline persistence and response serialization, especially when the final user-visible result is "no highlights", without changing highlight rendering, export behavior, persistence semantics, or locked-preview behavior.

## Guardrails

- Observability only: add structured logs and focused regression tests, not product behavior changes.
- Keep `highlightState` shape, resume payloads, and response contracts unchanged.
- Preserve fail-closed highlight detection behavior and existing invalid-payload metric semantics.
- Do not log resume text, spans, or other sensitive content; counts, classifications, and branch reasons only.
- Prefer `logInfo`/`logWarn` over widening the metrics surface unless an existing counter pattern is already in use.

## Task 1 - Add detector start/completion outcome telemetry

**Files**
- `src/lib/agent/tools/detect-cv-highlights.ts`
- `src/lib/agent/tools/detect-cv-highlights.test.ts`

**Action**
- Add a start log at the top of `detectCvHighlights(...)` for non-empty runs with stable context fields (`sessionId`, `userId`, `workflowMode`, item count, stage).
- Add a completion log after parsing/validation that classifies the detector outcome with a compact `resultKind`, distinguishing at minimum:
  `validated_non_empty`, `validated_empty`, and the existing invalid-payload fail-closed path.
- Capture raw model-payload counts separately from validated counts so zero-highlight cases are diagnosable:
  raw item count, raw range count, validated item count, validated range count.
- Keep thrown model-call failures separate from invalid-payload handling; do not convert them into empty results.
- Preserve the existing invalid-payload warning + metric behavior, but extend the regression tests so the new start/completion logs prove the difference between:
  a valid empty result, a non-empty validated result, and an invalid payload.

**Verify**
- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts`

**Done**
- Every successful detector run emits start/completion telemetry.
- Zero-highlight results are distinguishable from invalid payloads.
- Raw vs validated counts are visible without exposing resume content.

## Task 2 - Add highlight persistence diagnostics in ATS and job-targeting pipelines

**Files**
- `src/lib/agent/ats-enhancement-pipeline.ts`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/lib/agent/tools/pipeline.test.ts`

**Action**
- After highlight generation is attempted, skipped, cleared, or fails, emit one structured outcome log per pipeline run summarizing the highlight-state persistence decision.
- Include stable diagnostics only: `workflowMode`, validation status, whether highlight generation was attempted, detector `resultKind` when available, resolved highlight count, and persistence disposition.
- Cover the important silent branches explicitly:
  valid rewrite with persisted empty `highlightState`,
  ATS skip because the finalized CV falls back to the original state,
  validation-failed paths that preserve/restore prior state,
  detector exception paths that clear `highlightState`.
- Keep current persistence behavior exactly as-is:
  no new fallback logic, no changes to when `highlightState` is stored, skipped, restored, or cleared.
- Add focused pipeline tests that assert the new diagnostics for at least one ATS flow and one job-targeting flow, including the persisted-empty case.

**Verify**
- `npx vitest run src/lib/agent/tools/pipeline.test.ts`

**Done**
- ATS and job-targeting flows both emit one clear highlight persistence outcome.
- Persisted-empty, skipped, restored, and failed-detection branches are observable.
- No pipeline state semantics change.

## Task 3 - Add response-surface omission observability without changing payloads

**Files**
- `src/lib/routes/session-comparison/decision.ts`
- `src/app/api/session/[id]/route.ts`
- `src/lib/routes/session-comparison/decision.test.ts`
- `src/app/api/session/[id]/route.test.ts`

**Action**
- Add lightweight structured logs on successful response assembly that classify highlight exposure for each surface without altering the JSON contract.
- Classify the response outcome with stable omission/presence reasons, covering at minimum:
  `locked_preview_omitted`,
  `missing_state_omitted`,
  `present_empty`,
  `present_non_empty`.
- Keep preview-lock sanitization as the reason the field is omitted; do not leak hidden highlight metadata and do not add new response fields.
- Add regression tests for both surfaces so locked-preview omission remains intact and unlocked missing-or-empty highlight cases produce the expected observability branch.

**Verify**
- `npx vitest run src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/route.test.ts`

**Done**
- Session and comparison responses emit omission/presence observability with no payload changes.
- Locked previews still omit `highlightState`.
- Missing-state and empty-state responses are distinguishable in telemetry.

## Final Verification

- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/route.test.ts`

## Risks And Mitigations

- Risk: observability work accidentally mutates highlight semantics.
  Mitigation: keep all changes outside highlight selection/rendering logic and lock behavior with existing detector/pipeline/route tests.

- Risk: telemetry becomes noisy or inconsistent across layers.
  Mitigation: use a small shared vocabulary for `resultKind` and persistence/omission reasons, and assert it in tests.

- Risk: sensitive resume content leaks into logs.
  Mitigation: log counts, booleans, and branch classifications only; never log text or spans.
