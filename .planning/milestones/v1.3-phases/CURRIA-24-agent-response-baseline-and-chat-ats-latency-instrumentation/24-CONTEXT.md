# Phase 24 Context

## Phase

Phase 24: Agent Response Baseline and Chat/ATS Latency Instrumentation

## Goal

Establish latency evidence, a performance-first autonomous execution contract, and an explicit optimization plan for the user-visible agent flows before deeper changes begin.

## Main Focus

Main focus is agent response time improvement first.

Highest-priority targets are:

- ATS enhancement response time
- chat response time
- time to first SSE output
- time to first useful assistant response
- total completion time for agent-assisted turns

If there is a tradeoff between broad cleanup and response-time improvement, response-time improvement wins unless the non-latency work is required for correctness or safety.

## Why This Phase Exists

The repo already has strong work on reliability, deterministic pipelines, billing proof, and code hygiene. What remains visibly weak is speed perception and request-path cost in the agent experience. The current bottlenecks appear concentrated in:

- `src/app/api/agent/route.ts`
- `src/lib/agent/agent-loop.ts`
- ATS enhancement side effects triggered inline
- chat orchestration, retries, and tool-loop behavior

Before deeper changes land, the project needs:

- a committed latency baseline
- explicit stage-level observability
- a written autonomous execution contract that keeps the milestone focused

## Current State

- The current roadmap has no shipped performance-focused milestone yet.
- The agent runtime is feature-rich but operationally heavy.
- Chat and ATS enhancement both route through code paths that likely do too much synchronous work before visible output.
- The user explicitly wants the system to execute this milestone autonomously through planning, execution, verification, and commit flow without repeated manual prompting.

## Operator Prompt

Execute this work in fully autonomous mode.

Main focus is improving agent response time everywhere the user feels it, especially:

- ATS enhancement
- chat responsiveness
- time to first SSE output
- time to first useful assistant response

Do not reinterpret the priority of this plan.
Do not drift into general cleanup unless it is required to improve latency or safely enable latency work.
Plan, execute, verify, commit, and continue phase-by-phase until all remaining roadmap work is complete.
Do not stop after one phase.
Do not wait for manual approval between phases.
Only stop for a true blocker involving missing credentials, missing infrastructure, unresolved repo conflicts, or a high-risk product decision that cannot be safely made automatically.

## Requirements

- `PERF-01`
- `PERF-02`
