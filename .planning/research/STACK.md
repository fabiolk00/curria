# Stack Research: Agent Reliability and Response Continuity

## Existing Baseline

- `Next.js 14` App Router already owns the `/api/agent` HTTP and SSE boundary.
- `React 18` client components already render streamed transcript chunks in the dashboard chat.
- `TypeScript`, `Vitest`, and the existing route-level tests are enough for regression coverage without introducing a new test runner.
- `OpenAI` model selection already flows through `src/lib/agent/config.ts`, including combo defaults and optional per-phase overrides.
- `structured-log.ts` already provides a normalized logging layer that can carry request, model, and fallback metadata.

## Recommended Additions for This Milestone

- Add deployment provenance using existing env/build metadata rather than a new service. A response header, structured log field, or both should expose the live build or git SHA for `/api/agent`.
- Keep model-routing proof inside the current config contract. The important improvement is visibility and verification, not adding a second model-selection subsystem.
- Reuse the existing SSE route and chat UI. The milestone should harden the current stream contract instead of replacing it with websockets or background jobs.
- Extend current automated coverage with route-level SSE assertions and, where necessary, browser-level transcript checks that prove the rendered text matches the backend fallbacks.

## What Not to Add

- No new providers for analytics or observability. The repo already has structured logs; the gap is coverage and live proof.
- No new queue, event bus, or streaming transport. This issue is about correctness and visibility in the current request-response path.
- No broad prompt-framework rewrite. The milestone should isolate the dialog continuity and runtime parity seams first.

## Model Guidance

- `gpt-5-nano` remains the baseline combo default, but live logs show repeated `finishReason: "length"` in dialog flows, so the system must prove which model actually served the request before further tuning.
- Per-phase model overrides are acceptable only if the runtime contract is explicit in docs, logs, and tests.
- Recovery behavior matters as much as base-model choice; a stronger model alone does not fix a bad fallback contract.
