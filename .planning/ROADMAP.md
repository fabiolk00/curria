# Roadmap: CurrIA

## Overview

This roadmap starts milestone `v1.6 Async Agent Orchestration and Background Job Runtime` after `v1.5` closed the verification and archive-proof gap for the previous cycle. The next milestone keeps the current chat-driven product shape and deterministic resume semantics, but changes where heavy execution happens so `/api/agent` no longer carries the full cost of ATS enhancement, target-job rewriting, and artifact generation inside one long-lived request.

The main focus of this milestone is request-path reduction, durable async execution, and state-consistent integration first.

Highest-priority targets are:

- freeze the shared async execution contracts before work splits across boundaries
- keep lightweight chat synchronous while heavy actions dispatch to background jobs
- move ATS enhancement, target-job rewriting, and artifact generation off the synchronous request path
- preserve `cvState`, `optimizedCvState`, preview behavior, and generated artifact traceability under async execution
- refactor the remaining monolithic agent context builder into layered workflow, action, and source-of-truth contracts after the async foundation is stable

Any optional work that changes business rules, billing semantics, or the public UX shape should be treated as secondary and deferred unless it is required for correctness.

## Phases

**Phase Numbering:**
- Integer phases continue across milestones unless explicitly reset.
- This milestone continues from the previous roadmap, so the first phase here is **Phase 37**.

### Phase 37: Freeze async execution contracts and durable job foundations
**Goal**: Define the shared action, job, lifecycle, dispatch, and source-of-truth contracts, then establish the durable job persistence shape the rest of the refactor depends on.
**Depends on**: Nothing (first phase of milestone v1.6)
**Requirements**: [JOB-01]
**Success Criteria** (what must be TRUE):
  1. Shared `AgentActionType`, execution mode, `JobType`, `JobStatus`, dispatch payload, and job persistence contracts are explicit and stable before the implementation splits.
  2. Durable job records can represent queued, running, completed, failed, and optional cancelled states with stage and progress visibility.
  3. Source-of-truth rules for `cvState`, `optimizedCvState`, preview selection, and artifact snapshot metadata are documented where later phases can rely on them.
**Plans**: 1 plan

Plans:
- [x] 37-01: Freeze async execution contracts and implement durable job persistence foundations

### Phase 38: Refactor `/api/agent` into a lightweight orchestrator
**Goal**: Keep `/api/agent` as the public entry point while extracting request-boundary responsibilities, preserving sync lightweight chat, and dispatching heavy actions asynchronously.
**Depends on**: Phase 37
**Requirements**: [ORCH-01, ORCH-02]
**Success Criteria** (what must be TRUE):
  1. `/api/agent` still handles auth, session continuity, and message persistence correctly, but no longer executes heavy ATS, targeting, or artifact work inline.
  2. Lightweight chat continues to stream synchronously with the current UX shape and message ordering.
  3. Heavy actions resolve through explicit action classification, execution-mode routing, async dispatch handoff, and orchestration logs.
**Plans**: 1 plan

Plans:
- [x] 38-01: Extract request-boundary orchestration, preserve sync chat, and dispatch heavy actions asynchronously

### Phase 39: Move ATS, targeting, and artifact work into async processors
**Goal**: Execute the heavy resume pipelines through durable workers while preserving the existing business semantics, validation rules, and persistence behavior.
**Depends on**: Phase 37
**Requirements**: [JOB-02, ART-01, STATE-01]
**Success Criteria** (what must be TRUE):
  1. ATS enhancement and target-job rewriting no longer need to run in the request path, and they preserve the previous valid optimized snapshot on failure.
  2. Artifact generation no longer runs inline, records which snapshot generated the file, and keeps file output aligned with preview source selection.
  3. Worker stage transitions, retries, and terminal writes avoid duplicate destructive updates and preserve existing business outcomes.
**Plans**: 1 plan

Plans:
- [x] 39-01: Implement async ATS, targeting, and artifact processors with state-safe persistence

### Phase 40: Integrate status flow, observability, and stabilization
**Goal**: Wire the orchestrator and workers together, expose job status cleanly to UI or SSE consumers, and prove the new async execution model through focused regression coverage.
**Depends on**: Phase 38, Phase 39
**Requirements**: [OBS-01, TEST-01]
**Success Criteria** (what must be TRUE):
  1. UI and operators can observe queued, running, completed, and failed job states with stage and progress detail through the supported status surfaces.
  2. Structured logs and retry-safe handling make dispatch, worker execution, and failures diagnosable without hiding regressions.
  3. Regression coverage proves sync chat parity, async dispatch behavior, worker success and failure handling, and preview or artifact consistency for the selected source snapshot.
**Plans**: 1 plan

Plans:
- [x] 40-01: Wire async status flow, observability, and regression proof across the new execution model

### Phase 41: Refactor agent context into layered workflow, action, and source builders
**Goal**: Replace the remaining monolithic prompt/context assembly with explicit layered builders so chat, ATS enhancement, job targeting, and artifact-support flows each receive the right instructions, source data, and output contracts.
**Depends on**: Phase 40
**Requirements**: [CTX-01, CTX-02, TEST-02]
**Success Criteria** (what must be TRUE):
  1. Agent context is composed through explicit base, workflow, action, source, and output-contract layers rather than one phase-oriented prompt builder.
  2. The selected source-of-truth for original resume, optimized resume, target-job context, validation state, and artifact metadata is explicit and inspectable for every supported workflow.
  3. Lightweight chat stays minimal while ATS and job-targeting rewrite flows become easier to reason about, test, and evolve without changing the current business semantics.
**Plans**: 1 plan

Plans:
- [x] 41-01: Refactor agent context into layered workflow-aware and source-aware builders

### Phase 42: Redesign public SEO role landing pages with premium editorial UX
**Goal**: Rebuild the public SEO role landing experience so it feels closer to Stripe, Linear, and modern premium SaaS product pages while preserving the existing content hierarchy, CTA logic, SEO structure, and config-driven rendering.
**Depends on**: Phase 41
**Requirements**: [SEO-UX-01]
**Success Criteria** (what must be TRUE):
  1. `SeoRoleLandingPage` remains config-driven and keeps the current routing, CTA semantics, metadata flow, and role content intact.
  2. The public role landing experience no longer reads like a repeated card grid; hero, section rhythm, surfaces, and spacing feel editorial, premium, and profession-aware.
  3. `developer`, `data_engineer`, and `finance` each have distinct premium visuals, while the remaining roles inherit a strong reusable default visual system that is ready for future specialization.
  4. Public PT-BR copy remains correct, headings stay intentional for the Brazilian audience, and build plus copy-audit safety rails remain green after the redesign.
**Plans**: 1 plan

Plans:
- [x] 42-01: Rebuild the SEO role landing renderer with premium visual primitives and role-specific hero systems

## Autonomous Execution Instruction

The intended operating mode for this milestone is:

- discuss -> plan -> execute -> verify -> advance to next phase
- freeze contracts in Phase 37 before parallelizing the orchestrator and worker workstreams
- treat Phase 38 and Phase 39 as parallelizable after Phase 37 if the shared contracts remain unchanged
- stop only for missing credentials, missing infrastructure, unresolved repo conflicts, or a high-risk decision about job semantics or source-of-truth behavior that cannot be made safely

Recommended entrypoint:

`/gsd-discuss-phase 37`

## Current Milestone

- `v1.6 Async Agent Orchestration and Background Job Runtime` - active

## Progress

**Execution Order:**
Phases execute in numeric order: 37 -> 38 -> 39 -> 40 -> 41 -> 42 -> 43

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. Freeze async execution contracts and durable job foundations | 1/1 | Completed | 2026-04-16 |
| 38. Refactor `/api/agent` into a lightweight orchestrator | 1/1 | Complete    | 2026-04-16 |
| 39. Move ATS, targeting, and artifact work into async processors | 1/1 | Completed | 2026-04-16 |
| 40. Integrate status flow, observability, and stabilization | 1/1 | Complete    | 2026-04-17 |
| 41. Refactor agent context into layered workflow, action, and source builders | 1/1 | Completed | 2026-04-17 |
| 42. Redesign public SEO role landing pages with premium editorial UX | 1/1 | Completed | 2026-04-17 |
| 43. Refactor export and billing pipeline resilience | 1/1 | Completed | 2026-04-20 |
| 44. Implement credit reservation, ledger, and billing reconciliation | 1/2 | In Progress | 2026-04-20 |

## Archived Milestones

- [v1.5 Verification Closure and Runtime Residuals](./milestones/v1.5-ROADMAP.md) - shipped 2026-04-16, 5 phases, 10 plans, milestone audit passed with accepted debt
- [v1.4 Agent Core Modularization, Security Hardening, and Release Stability](./milestones/v1.4-ROADMAP.md) - shipped 2026-04-15, 5 phases, 13 plans, verification backfilled with accepted runtime debt
- [v1.3 Agent Response Time and Runtime Performance](./milestones/v1.3-ROADMAP.md)
- [v1.2 Code Hygiene and Dead Code Reduction](./milestones/v1.2-ROADMAP.md)
- [v1.1 Agent Reliability and Response Continuity](./milestones/v1.1-ROADMAP.md)
- [v1.0 Launch Hardening for the Core Funnel](./milestones/v1.0-ROADMAP.md)

### Phase 43: Refactor export and billing pipeline resilience

**Goal:** Separate artifact generation, billing consumption, and generation-record persistence inside the billable export path so successful ATS exports stay recoverable under schema drift without weakening billing safety.
**Requirements**: [PIPE-RES-01, PIPE-TEST-01]
**Depends on:** Phase 42
**Plans:** 1/1 plans complete

Plans:
- [x] 43-01-PLAN.md — Refactor the billable export pipeline so artifact success, billing safety, and degraded persistence handling are explicit and test-backed

### Phase 44: Implement credit reservation, ledger, and billing reconciliation

**Goal:** Upgrade billable export generation to a reservation-backed credit flow with append-only ledger records, reconciliation support, and stage-aware billing observability while preserving the existing route and durable-job surfaces.
**Requirements**: [BILL-RES-01, BILL-LEDGER-01, BILL-OBS-01, BILL-TEST-01]
**Depends on:** Phase 43
**Plans:** 1/2 plans executed

Plans:
- [x] 44-01-PLAN.md — Add reservation and ledger schema plus atomic reserve/finalize/release billing wrappers
- [ ] 44-02-PLAN.md — Integrate reservation-backed export runtime, reconciliation support, and stage-aware diagnostics
