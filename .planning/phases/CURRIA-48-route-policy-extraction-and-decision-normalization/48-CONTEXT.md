# Phase 48 Context - Route Policy Extraction and Decision Normalization

## Decisions

- Preserve all current business behavior, response semantics, billing correctness, preview lock guarantees, replay behavior, and durable job flow.
- Treat this phase as architectural hardening only; no product redesign.
- Keep the monolith and current route surfaces intact; extract policy decisions into internal helpers rather than introducing new runtime roles or services.
- Prefer route-specific modules under `src/lib/routes/**` with lightweight shared helpers only where duplication is real.
- Preserve `cvState` as canonical truth, `agentState` as operational context, and current preview lock or historical artifact precedence rules.

## Scope

- `src/app/api/session/[id]/generate/route.ts`
- `src/app/api/file/[sessionId]/route.ts`
- `src/app/api/profile/smart-generation/route.ts`
- `src/app/api/session/[id]/versions/route.ts`
- `src/app/api/session/[id]/compare/route.ts`
- new route modules under `src/lib/routes/**`
- regression and decision-module tests for the extracted behavior
- route architecture documentation for future contributors

## Locked Invariants

- active export blocking stays behaviorally identical
- billing reconciliation pending stays behaviorally identical
- durable job idempotency and retry semantics stay behaviorally identical
- historical preview lock beats current-plan inference
- signed URL emission remains centrally gated
- compare and versions sanitization stay preview-aware and do not leak locked content
- public payloads and status codes remain unchanged unless an internal normalization requires a no-op field reorder only

## Deferred

- redesigning billing
- redesigning durable jobs
- redesigning preview lock behavior
- changing replay semantics
- route-wide framework extraction beyond the five target routes
- refactoring lower-risk routes in this phase
