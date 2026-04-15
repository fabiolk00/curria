# Phase 6 Research: Dialog Continuity and Model Routing Hardening

**Date:** 2026-04-10
**Phase:** 06-dialog-continuity-and-model-routing-hardening

## Goal

Eliminate truncation-driven repetition for dialog follow-ups like `reescreva` and make the dialog or confirm model-routing contract explicit, stable, and testable.

## Evidence Collected

### The live incident is now clearly a continuity failure inside the dialog path

- The reported runtime incident enters `phase: "dialog"` and starts a normal turn with `maxOutputTokens: 900`.
- The first completion ends with `finishReason: "length"` and `usedConciseRecovery: true`.
- Follow-up recoveries then continue finishing with `finishReason: "length"` and no tool calls.
- The visible assistant reply repeats the earlier vacancy acknowledgement instead of continuing with a rewrite.

This means the current failure is not intake bootstrap or file parsing. It is a dialog-turn continuity failure after truncation and recovery.

### The current loop already has phase-aware fallback hooks, but they are still too generic for terse rewrite follow-ups

- `src/lib/agent/agent-loop.ts` already contains:
  - `buildRecoveryUserPrompt(...)`
  - `recoverTruncatedTurn(...)`
  - `recoverConciseTurn(...)`
  - `buildDialogFallback(...)`
  - `resolveDeterministicAssistantFallback(...)`
- The current dialog fallback already distinguishes:
  - continuation approvals such as `pode fazer`
  - a latest pasted vacancy during `dialog`
  - saved target-job context
  - resume-only context

That is a good foundation, but the live `reescreva` case shows a remaining gap: terse rewrite intent can still degrade into an unhelpful continuation or stale bootstrap-like response when recovery runs out of room.

### Latest-intent preservation is the highest-leverage seam for AGNT-01 and AGNT-03

- `buildRecoveryUserPrompt(...)` carries saved resume and target-job context into concise recovery prompts.
- `buildDialogFallback(...)` already favors the latest pasted vacancy over saved target context.
- The remaining problem is not lack of context presence, but lack of sharper intent preservation when the latest user message is a short rewrite instruction such as `reescreva`, `continue`, `pode fazer`, or a section-targeted request.

Phase 6 should therefore prefer the latest rewrite intent over any generic continuation suggestion whenever the user already has resume plus target context loaded.

### The model-routing contract is present in code, but still needs hard proof and clearer operator-facing wording

- `src/lib/agent/config.ts` already resolves:
  - the active combo
  - the resolved agent model
  - the optional `OPENAI_DIALOG_MODEL`
  - per-phase routing via `resolveAgentModelForPhase(...)`
- The intended contract is:
  - `dialog` and `confirm` use `OPENAI_DIALOG_MODEL` when explicitly set
  - otherwise `dialog` and `confirm` inherit the resolved agent model

Phase 6 should keep this contract obvious in code and docs so operators do not think they changed the agent model while dialog traffic still follows a hidden default.

### The repo already has the right test seams for this phase

- Loop-level coverage exists in:
  - `src/lib/agent/streaming-loop.test.ts`
  - `src/lib/agent/__tests__/streaming-prompt-regression.test.ts`
- Route-level coverage exists in:
  - `src/app/api/agent/route.sse.test.ts`
  - `src/app/api/agent/route.model-selection.test.ts`
  - `src/app/api/agent/route.test.ts`
- Config coverage already exists in:
  - `src/lib/agent/config.test.ts`

That means Phase 6 does not need a new framework. It needs tighter assertions on the existing loop, route, and fresh-import env seams.

### No dedicated Phase 6 context file exists, so the research baseline comes from roadmap, requirements, Phase 5, and the incident transcript

- There is no `06-CONTEXT.md`.
- The planning baseline therefore comes from:
  - `.planning/ROADMAP.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/PROJECT.md`
  - `.planning/phases/05-deployed-agent-parity-and-evidence/05-VERIFICATION.md`
  - the user-provided incident transcript and logs

This is acceptable because the phase scope is already narrow and concrete: continuity and model routing, not a new product surface.

## Recommended Plan Split

### Wave 1

- `06-01`: Tighten dialog fallback selection, latest-intent preservation, and best-visible-text retention in the agent loop.
- `06-02`: Align the per-phase model-routing contract with docs, env examples, and route-level model-selection proof.

These can run in parallel because one changes recovery behavior in `agent-loop.ts`, while the other hardens `config.ts`, docs, and model-routing tests.

### Wave 2

- `06-03`: Lock the behavior in with targeted regressions for truncation, empty-response recovery, terse rewrite follow-ups, latest-vacancy replacement, and route-level model selection.

This belongs last so the tests target the final Phase 6 behavior instead of intermediate assumptions.

## Risks and Constraints

- Phase 6 must not regress the deterministic vacancy bootstrap used on the first saved-target handoff from `analysis` into `dialog`.
- Phase 6 must preserve the release and fallback observability added in Phase 5, especially `model`, `assistantTextChars`, `usedLengthRecovery`, `usedConciseRecovery`, and `fallbackKind`.
- Phase 6 should not overreach into transcript rendering or frontend message stitching. That belongs to Phase 7.
- Model-routing changes must remain compatible with `OPENAI_MODEL_COMBO`, `OPENAI_AGENT_MODEL`, and `OPENAI_DIALOG_MODEL` instead of introducing a second hidden default.

## Validation Architecture

### Automated proof

1. Keep `npm run typecheck` green after each plan wave.
2. Use loop and route SSE tests to prove terse rewrite follow-ups do not regress into repeated vacancy bootstrap copy.
3. Use config and route model-selection tests to prove both override and fallback behavior under fresh imports.
4. Re-run the focused dialog-routing suite before phase closeout.
5. Re-run `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` before closing the planning artifacts.

### Manual proof

1. Replay one representative `dialog` follow-up like `reescreva` against a dev or deployed environment and confirm the visible assistant turn is a rewrite or a non-repetitive continuation.
2. Correlate the request logs from Phase 5 to verify the selected model and fallback branch match the expected Phase 6 behavior.

### Success signal for Phase 6

Phase 6 can be considered complete only when all of the following are true:

- a terse `dialog` follow-up no longer repeats earlier vacancy bootstrap copy
- recovery preserves the latest rewrite intent and latest vacancy context when present
- dialog and confirm turns follow one explicit resolved model contract
- route and loop regressions protect the new behavior
