# Roadmap: CurrIA

## Overview

This roadmap starts milestone `v1.3 Agent Response Time and Runtime Performance` after `v1.2` shipped the hygiene baseline and after earlier milestones hardened deterministic resume pipelines, billing safety, and boundary proof. The new work is intentionally focused and operational: make the agent feel faster everywhere the user notices it, especially in chat and ATS enhancement flows.

The main focus of this milestone is agent response time improvement first.

Highest-priority targets are:

- ATS enhancement response time
- chat response time
- time to first SSE output
- time to first useful assistant response
- total completion time for agent-assisted turns

Any optional improvement that does not directly improve ATS enhancement latency, chat latency, first-response latency, or runtime efficiency should be treated as secondary and deferred unless it is required for correctness or safety.

## Phases

**Phase Numbering:**
- Integer phases continue across milestones unless explicitly reset.
- This milestone continues from the previous roadmap, so the first phase here is **Phase 24**.

### Phase 24: Agent Response Baseline and Chat/ATS Latency Instrumentation
**Goal**: Establish latency evidence and stage-level observability for the user-visible agent flows before deeper performance changes begin.
**Depends on**: Nothing (first phase of milestone v1.3)
**Requirements**: [PERF-01, PERF-02]
**Success Criteria** (what must be TRUE):
  1. The repo records request-stage latency for the main agent path with explicit visibility into first SSE and first useful response timing.
  2. Chat and ATS enhancement paths have enough structured evidence to identify the biggest contributors to perceived and total latency.
  3. The milestone contains an explicit autonomous execution contract that keeps later work focused on response-time improvements first.
**Plans**: 1 plan

Plans:
- [x] 24-01: Create the performance baseline, autonomous execution contract, and first-response optimization plan

### Phase 25: Chat and ATS Enhancement Request-Path Reduction
**Goal**: Remove or defer non-essential synchronous work that delays visible chat and ATS enhancement responses.
**Depends on**: Phase 24
**Requirements**: [PERF-02, PERF-03]
**Success Criteria** (what must be TRUE):
  1. The agent emits visible progress or useful assistant output earlier in the chat path.
  2. ATS enhancement no longer blocks on avoidable inline work before user-facing value is shown.
  3. Deferred or async-safe work preserves canonical state, billing safety, and route-level guarantees.
**Plans**: 3 plans

Plans:
- [x] 25-01: Reduce blocking work before first chat response
- [x] 25-02: Decouple or defer non-essential ATS enhancement work
- [x] 25-03: Verify latency gains and state-safety invariants for the reduced request path

### Phase 26: Agent Runtime Simplification and Budget Optimization
**Goal**: Make the core runtime cheaper and easier to optimize by reducing oversized orchestration boundaries, prompt weight, and unnecessary tool churn.
**Depends on**: Phase 25
**Requirements**: [PERF-03, PERF-04]
**Success Criteria** (what must be TRUE):
  1. The central agent runtime is broken into clearer responsibilities that are easier to optimize and test.
  2. Prompt, history, and tool budgets are tighter without unacceptable quality regressions.
  3. Common requests use deterministic fast paths where a model round-trip or extra tool loop is unnecessary.
**Plans**: 3 plans

Plans:
- [ ] 26-01: Break down the core agent runtime into latency-oriented responsibility slices
- [ ] 26-02: Reduce prompt, history, and tool-loop cost by phase
- [ ] 26-03: Add regression proof for behavior-preserving runtime optimization

### Phase 27: Performance Proof and Critical Route Hardening
**Goal**: Lock in the speed improvements with route-level proof, operational documentation, and focused hardening of adjacent routes that influence perceived agent performance.
**Depends on**: Phase 24, Phase 25, Phase 26
**Requirements**: [PERF-05]
**Success Criteria** (what must be TRUE):
  1. The repo can show before/after evidence for chat and ATS enhancement response-time improvements.
  2. Critical adjacent routes with user-visible performance impact have explicit latency and degradation proof.
  3. The milestone ends with autonomous execution instructions, verification expectations, and operator handoff committed.
**Plans**: 3 plans

Plans:
- [ ] 27-01: Harden performance-sensitive adjacent routes and external-call degradation behavior
- [ ] 27-02: Publish before/after latency proof and operator guidance
- [ ] 27-03: Close the milestone with autonomous verification and handoff artifacts

## Autonomous Execution Instruction

The intended operating mode for this milestone is:

- discuss -> plan -> execute -> verify -> advance to next phase
- run autonomously from Phase 24 forward until all remaining roadmap phases are completed
- do not pause after a single phase
- do not wait for manual approval between phases
- stop only for a true blocker involving missing credentials, missing infrastructure, unresolved repo conflicts, or a high-risk decision that cannot be made safely

Recommended entrypoint:

`/gsd-autonomous --from 24`

## Progress

**Execution Order:**
Phases execute in numeric order: 24 -> 25 -> 26 -> 27

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 24. Agent Response Baseline and Chat/ATS Latency Instrumentation | 1/1 | Complete | 2026-04-14 |
| 25. Chat and ATS Enhancement Request-Path Reduction | 3/3 | Complete | 2026-04-15 |
| 26. Agent Runtime Simplification and Budget Optimization | 0/3 | Not Started | |
| 27. Performance Proof and Critical Route Hardening | 0/3 | Not Started | |

## Archived Milestones

- [v1.2 Code Hygiene and Dead Code Reduction](./milestones/v1.2-ROADMAP.md)
- [v1.1 Agent Reliability and Response Continuity](./milestones/v1.1-ROADMAP.md)
- [v1.0 Launch Hardening for the Core Funnel](./milestones/v1.0-ROADMAP.md)
