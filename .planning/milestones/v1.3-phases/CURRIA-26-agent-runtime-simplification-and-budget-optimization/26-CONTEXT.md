# Phase 26 Context

## Phase

Phase 26: Agent Runtime Simplification and Budget Optimization

## Goal

Make the core agent runtime cheaper and easier to optimize by separating latency-oriented responsibilities, tightening prompt and history budgets by phase, and reducing avoidable model/tool work in chat and ATS-visible turns.

## Main Focus

Main focus is agent response time improvement first.

Highest-priority targets are:

- chat response time
- ATS enhancement response time
- time to first useful assistant response
- prompt and history cost per turn
- unnecessary tool-loop churn

If there is a tradeoff between broader refactor polish and faster user-visible agent responses, faster chat and ATS responses win unless the non-latency work is required for correctness or safety.

## Why This Phase Exists

Phase 25 reduced visible blocking before streaming and deferred ordinary ATS rewrite work out of the general chat path. The next bottleneck is no longer only route orchestration. It is the runtime itself:

- `src/lib/agent/agent-loop.ts` still owns too many responsibilities
- the runtime still sends simple conversational turns through the full model path when deterministic behavior would be enough
- prompt, history, and tool budgets remain broad for shorter chat turns

This phase should reduce latency in a brownfield-safe way without weakening billing, auth, ownership, canonical state, or generation safety.

## Current State

- Phase 24 established baseline instrumentation and first-response timing.
- Phase 25 reduced request-path blocking and narrowed inline ATS work.
- The agent loop already has several deterministic helpers, but some simple turn types still wait for model retries before falling back.
- Prompt and tool budgets are globally safe, but not yet tuned tightly enough by phase.

## Planning Guardrails

- Preserve `cvState` as canonical truth and treat `agentState` as operational context only.
- Keep billing, auth, file generation, and ownership behavior unchanged unless required for correctness.
- Prefer extracting or isolating runtime responsibilities over broad semantic rewrites.
- Favor deterministic shortcuts for simple user intents when that shortens response time without harming quality.
- Keep regression coverage around generation approval, rewrite flows, and fallback behavior.

## Operator Prompt

Execute this phase in fully autonomous mode once planning is complete.

Main focus is improving agent response time everywhere the user feels it, especially:

- ATS enhancement
- chat responsiveness
- time to first useful assistant response
- prompt/history/tool cost per turn

Do not reinterpret the priority of this phase.
Do not drift into general cleanup unless it is required to improve latency or safely enable latency work.
Keep changes brownfield-safe, incremental, and test-backed.
Complete planning, execute the plans in order, verify the results, commit the work, and continue to the next roadmap phase unless a true blocker is encountered.

## Requirements

- `PERF-03`
- `PERF-04`
