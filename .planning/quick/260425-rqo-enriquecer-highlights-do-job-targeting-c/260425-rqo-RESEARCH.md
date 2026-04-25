# Quick Task 260425-rqo - Research

**Researched:** 2026-04-25 [VERIFIED: user request]  
**Domain:** Job-targeting highlight enrichment through the shared detector seam. [VERIFIED: local code]  
**Confidence:** HIGH. [VERIFIED: local code]

## User Constraints

- Scope only [detect-cv-highlights.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:513), [job-targeting-pipeline.ts](/C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts:311), [pipeline.test.ts](/C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1401), and [detect-cv-highlights.test.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:106). [VERIFIED: user request]
- Preserve ATS behavior when `jobKeywords` are absent. [VERIFIED: user request]
- Focus on the current detector contract, the prompt seam, the job-targeting call site, the exact tests needed, and the main regression risks. [VERIFIED: user request]
- Write the findings under `.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/`. [VERIFIED: user request]

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless scope is explicitly changed. [VERIFIED: CLAUDE.md]
- Prefer reliability, observability, and verification over broader redesign. [VERIFIED: CLAUDE.md]
- Keep changes small and test-backed in sensitive agent flows. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical resume truth and avoid reopening unrelated agent architecture. [VERIFIED: CLAUDE.md]

## Summary

`detectCvHighlights()` currently has a narrow shared contract: flattened resume items in, resolved highlight ranges out, and fail-closed telemetry-rich handling for invalid payloads and thrown model errors. No vacancy signal is part of either the context type or the OpenAI user payload today. [VERIFIED: local code]

The lowest-risk seam is the system prompt, not the response schema, resolver, or user payload. The exact `messages[1].content === JSON.stringify({ items })` contract is already asserted in tests, and the same generator is used by both ATS and job-targeting flows. [VERIFIED: local code] Adding optional job-targeting-only prompt context while keeping the payload and output schema unchanged is the safest path. [ASSUMED]

**Primary recommendation:** Reuse job-targeting's existing `mustEmphasize -> focusKeywords` precedence to feed optional prompt-only vacancy signals into `detectCvHighlights`, and treat missing or empty keywords as the exact current behavior. [VERIFIED: local code] [ASSUMED]

## Current Detector Contract

- `detectCvHighlights(items, context?)` accepts `CvHighlightInputItem[]` plus optional `{ userId, sessionId, workflowMode, onCompleted }`; there is no job or vacancy field today. [VERIFIED: local code]
- The OpenAI request uses `zodResponseFormat(cvHighlightStructuredEnvelopeSchema, 'cv_highlight_detection')`, a fixed system prompt, and a user message of `JSON.stringify({ items })`. [VERIFIED: local code]
- `generateCvHighlightState(cvState, context?)` only flattens `cvState` and forwards the same context into `detectCvHighlights`. [VERIFIED: local code]
- The result taxonomy is already explicit and should stay stable: `not_invoked`, `valid_empty`, `all_filtered_out`, `invalid_payload`, and `thrown_error`. [VERIFIED: local code]
- Invalid payloads fail closed with `[]`, a warning log, and `architecture.highlight_detection.invalid_payload`; thrown model errors rethrow after completion telemetry. [VERIFIED: local code]

## Prompt Seam

- `buildHighlightSystemPrompt()` is a zero-argument helper used only when composing the detector's system message. [VERIFIED: local code]
- The detector suite has no active prompt snapshot; the only direct prompt-inspection test is intentionally skipped and marked as documentation-only. [VERIFIED: local code]
- Because the parser and response schema are already hardened, prompt text is the safest enrichment seam; changing the schema or the resolver would widen the blast radius unnecessarily. [VERIFIED: local code] [ASSUMED]
- The user payload is already pinned by [detect-cv-highlights.test.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:106), so keeping `messages[1].content` as `{ items }` avoids contract churn. [VERIFIED: local code]
- If vacancy guidance is added, it should be conditional and phrased as a tie-breaker among already factual strong spans, not as permission to invent or broaden highlights. [ASSUMED]

## Job-Targeting Call Site

- `runJobTargetingPipeline()` builds `targetingPlan` before highlight generation and calls `generateCvHighlightState(rewriteResult.optimizedCvState, { userId, sessionId, workflowMode: 'job_targeting', onCompleted })` only when validation passes and the optimized CV differs from the original CV. [VERIFIED: local code]
- The ATS pipeline calls the same helper with the same shared context shape but only `workflowMode: 'ats_enhancement'`. [VERIFIED: local code]
- `TargetingPlan` already exposes `focusKeywords` and `mustEmphasize`, and `rewrite-resume-full` already prefers `mustEmphasize` over `focusKeywords` when deriving focus signals. [VERIFIED: local code]
- Reusing that same precedence for highlight enrichment is the cleanest way to keep job-targeting highlights aligned with the rewrite logic. [ASSUMED]
- Highlight persistence reasons and gating should not change: unchanged CV still skips detection, validation failure still restores the previous state, and persist-version failure still rolls back to the previous valid state. [VERIFIED: local code]

## Exact Tests Needed

1. In [detect-cv-highlights.test.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:106), extend the existing request-contract test so the enriched path asserts two things together: the system prompt includes vacancy-guidance text when `workflowMode: 'job_targeting'` and non-empty `jobKeywords` are provided, and the user payload sent to OpenAI still equals `{ items }`. [VERIFIED: local code] [ASSUMED]

2. In [detect-cv-highlights.test.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:412), add a no-keywords regression proving that omitted or empty `jobKeywords` keeps the base request behavior and preserves the current `valid_empty` / `all_filtered_out` / `thrown_error` taxonomy. [VERIFIED: local code] [ASSUMED]

3. In [pipeline.test.ts](/C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1401), extend the successful `job_targeting` completion test so `mockGenerateCvHighlightState` is asserted with enriched context using plan-derived keywords plus unchanged `workflowMode: 'job_targeting'`. [VERIFIED: local code] [ASSUMED]

4. In [pipeline.test.ts](/C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1605), keep the unchanged-CV skip test intact and add one changed-CV regression where highlight generation still runs even if the derived job-keyword list is empty, proving that keywords are advisory context and not a new gate. [VERIFIED: local code] [ASSUMED]

5. In [pipeline.test.ts](/C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1212), keep or strengthen the ATS-side assertion that `runAtsEnhancementPipeline()` still calls `generateCvHighlightState` without the new keyword field, so ATS or shared-base behavior remains opt-in only from the job-targeting call site. [VERIFIED: local code] [ASSUMED]

## Regression Risks

- Changing the OpenAI user payload shape from `{ items }` will break the current detector contract test and is unnecessary for this task. [VERIFIED: local code]
- Making vacancy guidance unconditional inside `buildHighlightSystemPrompt()` will leak behavior changes into ATS because ATS and job-targeting share the same detector helper. [VERIFIED: local code]
- Deriving highlight guidance from raw `targetJobDescription` instead of plan-filtered signals risks noisy generic spans and misalignment with the rewrite logic. [VERIFIED: local code] [ASSUMED]
- Treating `jobKeywords` as a prerequisite for highlight generation would regress valid job-targeting rewrites whose targeting plan yields weak or empty signals. [VERIFIED: local code] [ASSUMED]
- Any response-schema or result-kind change would reopen parsing, observability, and persistence behavior well beyond this quick task's scope. [VERIFIED: local code]

## Sources

- [detect-cv-highlights.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:118) - prompt builder, context type, request shape, result taxonomy, and `generateCvHighlightState`. [VERIFIED: local code]
- [job-targeting-pipeline.ts](/C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts:311) - highlight-generation gate and job-targeting call site. [VERIFIED: local code]
- [detect-cv-highlights.test.ts](/C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:106) - current detector request contract and outcome coverage. [VERIFIED: local code]
- [pipeline.test.ts](/C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1401) - current job-targeting highlight persistence path and unchanged-CV skip regression. [VERIFIED: local code]
- [ats-enhancement-pipeline.ts](/C:/CurrIA/src/lib/agent/ats-enhancement-pipeline.ts:511) - shared ATS call site that must stay unaffected. [VERIFIED: local code]
- [build-targeting-plan.ts](/C:/CurrIA/src/lib/agent/tools/build-targeting-plan.ts:186) and [rewrite-resume-full.ts](/C:/CurrIA/src/lib/agent/tools/rewrite-resume-full.ts:103) - existing `mustEmphasize` / `focusKeywords` precedence. [VERIFIED: local code]
- [CLAUDE.md](/C:/CurrIA/CLAUDE.md:1) - project constraints. [VERIFIED: CLAUDE.md]
