# Phase 25 Context

## Phase

Phase 25: Chat and ATS Enhancement Request-Path Reduction

## Goal

Remove or defer non-essential synchronous work that delays visible chat and ATS enhancement responses, while preserving billing safety, canonical state rules, and brownfield route guarantees.

## Main Focus

Main focus is agent response time improvement first.

Highest-priority targets are:

- ATS enhancement latency
- chat responsiveness
- time to first SSE output
- time to first useful assistant response

If there is a tradeoff between broader cleanup and faster user-visible agent responses, faster chat and ATS responses win unless the non-latency work is required for correctness or safety.

## Why This Phase Exists

Phase 24 established the measurement baseline and proved where the main agent route spends time. The repo can now move beyond observability and reduce user-visible delay in the request path itself.

The current opportunity is not a broad rewrite. It is a brownfield-safe reduction of blocking work before the user sees useful chat or ATS progress. The practical targets are:

- work done before the first stream event or first useful assistant message
- inline ATS enhancement tasks that can be deferred safely
- repeated request-path setup that does not need to block visible output
- state-preserving reductions in tool-loop or orchestration work that currently delays user feedback

## Current State

- Phase 24 is complete and provides request-stage timing plus first-response SSE markers.
- The active milestone is explicitly performance-first and autonomous.
- The agent route remains operationally heavy, but Phase 24 now gives enough evidence to reduce the synchronous path safely.
- The next work should stay small and test-backed rather than attempting a broad runtime rewrite in one step.

## Planning Guardrails

- Keep route handlers thin and preserve existing zod validation and structured logging patterns.
- Preserve `cvState` as canonical truth and treat `agentState` as operational context only.
- Do not change billing behavior, ownership checks, or artifact-access rules unless required for correctness.
- Prefer deferred, staged, or progressive work over large structural rewrites inside this phase.
- Favor explicit regression proof around the first-response path and ATS safety boundaries.

## Operator Prompt

Execute this phase in fully autonomous mode once planning is complete.

Main focus is improving agent response time everywhere the user feels it, especially:

- ATS enhancement
- chat responsiveness
- time to first SSE output
- time to first useful assistant response

Do not reinterpret the priority of this phase.
Do not drift into general cleanup unless it is required to improve latency or safely enable latency work.
Keep changes brownfield-safe, incremental, and test-backed.
Complete planning, execute the plans in order, verify the results, commit the work, and continue to the next roadmap phase unless a true blocker is encountered.

## Requirements

- `PERF-02`
- `PERF-03`
