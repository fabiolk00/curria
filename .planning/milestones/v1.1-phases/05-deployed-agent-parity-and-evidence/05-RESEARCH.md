# Phase 5 Research: Deployed Agent Parity and Evidence

**Date:** 2026-04-10
**Phase:** 05-deployed-agent-parity-and-evidence

## Goal

Prove which build, model configuration, and recovery path the live `/api/agent` route is serving so production incidents can be tied to an actual deploy instead of guessed from local code.

## Evidence Collected

### The agent loop already emits richer completion diagnostics than the live incident logs showed

- `src/lib/agent/agent-loop.ts` already logs:
  - `model`
  - `assistantTextChars`
  - `usedLengthRecovery`
  - `usedConciseRecovery`
  - `fallbackKind`
- Those fields appear on `agent.turn.completed`, `agent.response.truncated_after_recovery`, and `agent.response.empty_fallback` or `agent.response.empty_recovered`.
- The live incident report for `reescreva` did not show these fields, which strongly suggests the environment in question is not yet proven to be on the same runtime contract as the current repo.

This is the clearest direct gap against `OPS-04` and `OPS-06`.

### `/api/agent` already has stable SSE and session headers, but no deploy provenance

- `src/app/api/agent/route.ts` already returns `X-Session-Id` for new sessions and emits `sessionCreated` early.
- The route logs request lifecycle events and streams the final assistant outcome correctly.
- What is missing is any response or log-level release metadata that identifies:
  - which build served the request
  - where that release identifier came from
  - which resolved agent or dialog model contract was active

Right now an operator can tell a request happened, but not which deployed code path served it.

### The current repo has no dedicated release-metadata helper or post-deploy parity check

- `next.config.js` does not define a custom build id or surface release metadata.
- `package.json` has no parity-check or deploy-proof script for `/api/agent`.
- The docs describe model selection in `src/lib/agent/config.ts`, but there is no operator runbook for confirming that the deployed route matches those expectations.

This is the cleanest direct gap against `OPS-06`.

### The existing automated coverage is already close to what Phase 5 needs

- Route-level tests already exist:
  - `src/app/api/agent/route.test.ts`
  - `src/app/api/agent/route.model-selection.test.ts`
  - `src/app/api/agent/route.sse.test.ts`
- Loop-level coverage already exists in:
  - `src/lib/agent/streaming-loop.test.ts`
- UI transcript coverage already exists in:
  - `src/components/dashboard/chat-interface.test.tsx`

That means Phase 5 does not need a new test framework. It needs new assertions on top of existing route, loop, and script seams.

### Structured logging is compatible with safe provenance fields

- `src/lib/observability/structured-log.ts` only accepts flat scalar fields.
- That is a good fit for safe provenance values such as:
  - short commit SHA
  - release id
  - release source
  - resolved agent model
  - resolved dialog model
- It is not a safe place to dump raw env objects, request cookies, or arbitrary model responses.

Phase 5 should therefore use a small helper that produces explicit, safe scalars rather than serializing process env wholesale.

## Recommended Plan Split

### Wave 1

- `05-01`: Add server-derived release metadata to `/api/agent` responses and route or loop logs.

This comes first because every later operator proof depends on having a trustworthy provenance surface.

### Wave 2

- `05-02`: Add a safe post-deploy parity script and operator docs that read the new provenance surface without consuming credits or mutating session state.

This should wait until the route exposes a stable, documented metadata contract.

### Wave 3

- `05-03`: Lock the new provenance and log schema in with regression coverage.

This comes last because the tests and docs need to target the final metadata surface from Waves 1 and 2.

## Risks and Constraints

- Provenance must be derived only from server-side env or build metadata, never from client input.
- Provenance headers and logs must stay secret-safe; safe release identifiers and model names are fine, raw env content is not.
- The parity check must not burn credits or create sessions; it should use a safe request shape that still returns provenance headers.
- Phase 5 should not overreach into transcript UX fixes. It exists to prove the live runtime first, so later phases can debug behavior from solid evidence.

## Validation Architecture

### Automated proof

1. Keep `npm run typecheck` green after every code change.
2. Extend route tests to prove provenance headers exist on stream and non-stream responses.
3. Extend loop tests to lock the required completed-turn log fields.
4. Add script coverage for the post-deploy parity checker so docs and CLI behavior cannot silently drift.
5. Re-run `node .codex/get-shit-done/bin/gsd-tools.cjs state validate` before closing the phase planning artifacts.

### Manual or operator proof

1. Run the parity script against a deployed URL and verify the reported release and resolved models match the intended rollout.
2. Trigger one real or safe diagnostic `/api/agent` request and confirm the release id, request id, model, and fallback path can be correlated in logs.
3. Confirm the parity workflow does not create a new session or consume credits.

### Success signal for Phase 5

Phase 5 can be considered complete only when all of the following are true:

- a live `/api/agent` response exposes safe server-derived provenance
- completed-turn logs include the request-correlated model and recovery fields operators need
- the repo contains a committed parity script and operator instructions for checking the deployed route
- automated tests lock the provenance and log-schema contract in place
