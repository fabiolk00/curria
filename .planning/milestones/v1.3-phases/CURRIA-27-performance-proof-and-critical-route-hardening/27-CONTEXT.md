# Phase 27 Context

## Phase

Phase 27: Performance Proof and Critical Route Hardening

## Goal

Lock in the response-time improvements with route-level proof, explicit latency/degradation logs on adjacent routes, and a final operator-facing handoff for the milestone.

## Main Focus

Main focus is agent response time improvement first.

Highest-priority targets are:

- route-level latency visibility for generation, download, and import-status flows
- before/after evidence for the chat and ATS response-time work already shipped
- milestone closure artifacts that explain what changed and what still carries residual risk

## Why This Phase Exists

Phases 24 through 26 improved the main agent path, but the milestone is not complete until the repo can prove those gains operationally and until adjacent routes with user-visible performance impact expose clearer degradation and timing evidence.

## Planning Guardrails

- Keep changes narrow and operationally focused.
- Prefer structured logging and focused regression proof over broad refactors.
- Do not weaken auth, ownership, billing, or file-access safety while adding observability.
- Keep the milestone close-out honest about qualitative versus measured claims.

## Requirements

- `PERF-05`
