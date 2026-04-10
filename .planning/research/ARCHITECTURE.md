# Architecture Research: Agent Reliability and Response Continuity

## Relevant Flow

1. `src/app/api/agent/route.ts` authenticates, validates the request, resolves or creates the session, and opens the SSE stream.
2. The same route persists detected target-job context before streaming begins.
3. `src/lib/agent/agent-loop.ts` builds prompts, chooses the phase model, streams OpenAI output, applies recovery logic, and emits deterministic fallbacks when needed.
4. The route serializes those chunks as SSE.
5. `src/components/dashboard/chat-interface.tsx` reads the SSE stream and incrementally builds the assistant message shown to the user.

## Primary Integration Points

- `src/lib/agent/config.ts`: model combo defaults, phase-specific resolution, token caps.
- `src/lib/agent/agent-loop.ts`: truncation handling, recovery prompts, fallback selection, structured logs.
- `src/app/api/agent/route.ts`: request/session provenance and stream lifecycle.
- `src/components/dashboard/chat-interface.tsx`: transcript assembly and fallback rendering.
- `src/lib/observability/structured-log.ts`: stable log schema for deployment and runtime evidence.

## Architectural Priorities

- Prove deployed parity before changing behavior. If production logs do not show the current fields, behavior fixes alone will stay ambiguous.
- Keep the route and loop as the canonical source of truth. The UI should reflect the final assistant outcome, not invent recovery semantics.
- Prefer additive metadata over transport changes. A build identifier and richer per-turn logs are lower risk than changing the stream protocol.
- Make route-level tests exercise the real import path for config and loop behavior, not only helper functions.

## Suggested Build Order

1. Add provenance and log evidence to the live route.
2. Tighten dialog recovery and deterministic fallback behavior.
3. Verify transcript assembly in the client against the real SSE output.
4. Close remaining gaps with route-level and browser-level regression proof.
