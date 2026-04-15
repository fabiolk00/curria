# Phase 7 Research: Transcript Integrity and End-to-End Agent Verification

**Date:** 2026-04-10
**Phase:** 07-transcript-integrity-and-end-to-end-agent-verification

## Goal

Prove that the assistant turn the user sees in chat matches the backend SSE stream and recovery behavior, then give operators a committed way to reproduce and inspect the original `reescreva` incident.

## Evidence Collected

### The remaining gap is now the visible transcript, not the backend recovery contract

- Phase 5 already proved the repo can expose release provenance, resolved model headers, and request-correlated diagnostics for `/api/agent`.
- Phase 6 already hardened the backend seam so terse follow-ups such as `reescreva` preserve rewrite intent, latest vacancy context, and the explicit dialog or confirm model contract.
- The remaining milestone requirements are all user-visible or operator-facing:
  - `UX-01`: one request must render as one coherent visible assistant turn
  - `QA-04`: automated verification must connect route behavior to final rendered chat output
  - `QA-05`: the original incident must be reproducible and inspectable with committed evidence

That means Phase 7 should focus on transcript assembly, integration proof, and operator replay evidence, not another backend-only fallback pass.

### `ChatInterface` is the main visible-transcript seam

- `src/components/dashboard/chat-interface.tsx` owns:
  - optimistic insertion of the user message
  - creation of the single in-flight assistant bubble
  - SSE parsing and chunk application
  - replacement of the thinking bubble when the stream ends with no assistant text
  - reconciliation with `/api/session/:id/messages`
  - reconciliation with `/api/session/:id` snapshot updates after `done`
- The component already appends `text` chunks into one assistant bubble keyed by `assistantMessageId`, but it also has several asynchronous sources that can touch the same conversation:
  - the live SSE stream
  - the session-messages fetch triggered by `sessionId`
  - the session snapshot refetch triggered by `done`

Phase 7 therefore needs to protect the single visible assistant turn across all three paths, not only across the live SSE stream itself.

### Current UI tests cover many stream edges, but not the real route-to-visible-transcript seam

- `src/components/dashboard/chat-interface.test.tsx` already proves:
  - recoverable `LLM_INVALID_OUTPUT` errors are not surfaced as warning text
  - empty `done` turns replace the thinking bubble with a fallback
  - session headers and SSE `sessionCreated` keep the session state synchronized
  - optimistic messages survive an empty first history fetch
- Those tests are still synthetic from the UI’s perspective because they mock `fetch('/api/agent')` with handcrafted SSE payloads.
- `src/app/api/agent/route.sse.test.ts` proves the real route stream for degraded dialog flows, but it stops at the network boundary and does not render the chat UI.

So the repo can currently prove the backend stream and the component stream parser independently, but it cannot yet prove that the real route output becomes the expected final visible transcript.

### The Playwright lane does not yet cover degraded transcript behavior

- The committed browser lane in `tests/e2e/core-funnel.spec.ts` proves session creation, target state, preview readiness, and artifact delivery.
- The current E2E fixture helpers in `tests/e2e/fixtures/api-mocks.ts` can already emit arbitrary SSE streams, but the browser lane does not yet assert:
  - that only one assistant bubble survives a degraded turn
  - that stale vacancy bootstrap text does not reappear for `reescreva`
  - that the transcript remains stable after session hydration or refresh

Phase 7 should use that existing Playwright infrastructure instead of introducing a new browser framework.

### Operator evidence should build on the Phase 5 parity workflow instead of inventing another deployment-diagnosis path

- `scripts/check-agent-runtime-parity.ts` and the Phase 5 runbook already give operators a safe way to confirm release headers and runtime parity against a live deployment.
- Phase 6’s verification explicitly left a follow-up: replay a representative deployed `reescreva` flow and capture the final visible assistant turn.
- The remaining missing piece is a committed replay path that captures:
  - release headers
  - request IDs
  - SSE event sequence
  - final assistant text
  - enough metadata to tie the visible transcript back to the stabilized backend behavior

This suggests Phase 7 should add a transcript-focused replay tool or workflow that composes with the existing parity command instead of replacing it.

### No dedicated Phase 7 context file or UI-SPEC exists, and that is acceptable

- There is no `07-CONTEXT.md`.
- There is no `07-UI-SPEC.md`.
- That is acceptable because Phase 7 is not a visual redesign phase. It is a reliability and verification phase around an existing chat surface.
- The planning baseline is already concrete enough from:
  - `.planning/PROJECT.md`
  - `.planning/ROADMAP.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/STATE.md`
  - `.planning/phases/06-dialog-continuity-and-model-routing-hardening/06-VERIFICATION.md`
  - the live incident transcript that motivated the milestone

## Recommended Plan Split

### Wave 1

- `07-01`: Harden transcript assembly and reconciliation in `ChatInterface` so one request remains one visible assistant turn across SSE, history hydration, and `done` snapshot refetches.

This should land first because the browser and integration proof in later plans needs a stable client transcript contract.

### Wave 2

- `07-02`: Add real route-to-visible transcript verification and a focused browser regression for degraded transcript paths.

This wave should prove that the stabilized backend stream from Phase 6 actually becomes the right visible assistant message in both component integration and Chromium browser flows.

### Wave 3

- `07-03`: Add operator replay tooling and repro guidance that captures transcript evidence and closes the original `reescreva` incident with committed artifacts.

This belongs last so the docs and replay tooling target the final transcript behavior rather than an intermediate implementation.

## Risks and Constraints

- Phase 7 must not reopen or weaken the Phase 6 backend continuity and model-routing guarantees.
- Transcript fixes must preserve canonical session state, header state, and message-count updates driven by `done`.
- Browser proof should stay deterministic and lean on existing mocked SSE fixtures instead of introducing flaky external dependencies.
- Operator replay tooling must be safe to run against dev or deployed environments and should reuse the Phase 5 parity contract wherever possible.
- This phase should remain behavior-focused; it does not need a UI redesign contract.

## Validation Architecture

### Automated proof

1. Keep `npm run typecheck` green throughout the phase.
2. Extend component tests around `src/components/dashboard/chat-interface.tsx` to prove one request maps to one visible assistant turn even when degraded SSE paths fire.
3. Add a route-to-UI integration seam so a real `/api/agent` response stream is rendered through the chat component.
4. Add a focused Chromium regression for degraded transcript behavior using the existing Playwright fixture system.
5. Add automated coverage for any new operator replay tooling and keep `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` green before closeout.

### Manual proof

1. Run `npm run agent:parity -- --url <deployment> ...` against the active deployment before using live incidents as proof.
2. Replay one representative vacancy -> `reescreva` flow and capture:
   - release headers
   - SSE sequence
   - final visible assistant bubble
   - request IDs or fallback metadata needed for correlation
3. Confirm that the visible transcript contains one coherent assistant turn for the user request and no stale bootstrap repetition.

### Success signal for Phase 7

Phase 7 can be considered complete only when all of the following are true:

- one request renders as one coherent visible assistant turn in the chat UI
- automated verification covers both the real route stream and the final visible assistant transcript
- a representative `reescreva` incident can be replayed, inspected, and closed with committed evidence
