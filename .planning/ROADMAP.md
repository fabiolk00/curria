# Roadmap: CurrIA

## Overview

This roadmap starts milestone `v1.5 Verification Closure and Runtime Residuals` after `v1.4` shipped meaningful hardening work but closed with explicit audit debt. The next cycle is intentionally operational and proof-oriented: turn milestone verification into a first-class deliverable, make archive metadata trustworthy, and either reduce or formalize the remaining non-E2E runtime budget.

The main focus of this milestone is delivery proof and runtime-contract integrity first.

Highest-priority targets are:

- committed phase verification artifacts that satisfy milestone audit
- accurate milestone closeout metadata even when decimal phases exist
- explicit proof or further reduction for the remaining non-E2E runtime bottlenecks

Any optional work that does not improve verification closure, archive integrity, or residual runtime proof should be treated as secondary and deferred unless it is required for correctness.

## Phases

**Phase Numbering:**
- Integer phases continue across milestones unless explicitly reset.
- This milestone continues from the previous roadmap, so the first phase here is **Phase 32**.

### Phase 32: Phase Verification Backfill and Audit Contract
**Goal**: Backfill the missing phase-verification layer and make milestone audit consume committed requirement evidence for the recently shipped hardening work.
**Depends on**: Nothing (first phase of milestone v1.5)
**Requirements**: [VER-01, VER-02]
**Success Criteria** (what must be TRUE):
  1. Recent shipped phases can produce `VERIFICATION.md` artifacts that follow the audit workflow's required requirement-and-evidence shape.
  2. The verification artifacts clearly distinguish passed coverage, residual gaps, and accepted debt instead of relying on summary prose.
  3. Milestone-style audit reruns can determine requirement coverage from committed verification evidence rather than failing only because proof files are absent.
**Plans**: 3 plans

Plans:
- [x] 32-01: Define and implement the required phase verification shape for recently shipped phases
- [x] 32-02: Backfill verification artifacts for the v1.4 implementation phases and reconcile requirement evidence
- [x] 32-03: Rerun audit-style proof and close the requirement-evidence contract gaps

### Phase 33: Milestone Archive and Traceability Integrity
**Goal**: Keep roadmap, traceability, archive, and state metadata aligned during milestone closeout so future archives do not require manual repair.
**Depends on**: Phase 32
**Requirements**: [DOC-01, DOC-02]
**Success Criteria** (what must be TRUE):
  1. Decimal phases and shipped plan counts survive roadmap and milestone archive flows without silent drift.
  2. Completing a milestone leaves ROADMAP, REQUIREMENTS, STATE, and milestone archive files in a coherent next-cycle-ready state.
  3. The repo has regression proof or deterministic checks for the closeout metadata contract.
**Plans**: 2 plans

Plans:
- [x] 33-01: Harden milestone closeout and archive metadata handling for decimal phases and shipped stats
- [x] 33-02: Add regression proof for traceability, archive output, and next-cycle planning reset behavior

### Phase 34: Non-E2E Runtime Residual Budgeting
**Goal**: Narrow the remaining non-E2E runtime pain to an explicit contract by profiling the post-v1.4 outliers and either reducing them further or formalizing an accepted budget.
**Depends on**: Phase 33
**Requirements**: [PERF-04, PERF-05]
**Success Criteria** (what must be TRUE):
  1. The repo identifies which residual suites dominate the non-E2E runtime after the earlier structural fixes.
  2. The top residual bottleneck is either improved materially or explicitly accepted through a documented budget and gate.
  3. Local and CI runtime proof make future drift visible without needing another ad hoc investigation cycle.
**Plans**: 2 plans

Plans:
- [ ] 34-01: Re-profile the residual non-E2E outliers and publish the current budget evidence
- [ ] 34-02: Reduce or explicitly gate the dominant remaining runtime bottleneck

## Autonomous Execution Instruction

The intended operating mode for this milestone is:

- discuss -> plan -> execute -> verify -> advance to next phase
- prioritize the milestone in order from Phase 32 forward unless a true blocker appears
- stop only for missing credentials, missing infrastructure, unresolved repo conflicts, or a high-risk decision about accepted proof or runtime debt that cannot be made safely

Recommended entrypoint:

`/gsd-plan-phase 34`

## Current Milestone

- `v1.5 Verification Closure and Runtime Residuals` - active

## Progress

**Execution Order:**
Phases execute in numeric order: 32 -> 33 -> 34

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. Phase Verification Backfill and Audit Contract | 3/3 | Complete | 2026-04-15 |
| 33. Milestone Archive and Traceability Integrity | 2/2 | Complete | 2026-04-15 |
| 34. Non-E2E Runtime Residual Budgeting | 0/2 | Not started | - |

## Archived Milestones

- [v1.4 Agent Core Modularization, Security Hardening, and Release Stability](./milestones/v1.4-ROADMAP.md) - shipped 2026-04-15, 5 phases, 13 plans, verification backfilled with accepted runtime debt
- [v1.3 Agent Response Time and Runtime Performance](./milestones/v1.3-ROADMAP.md)
- [v1.2 Code Hygiene and Dead Code Reduction](./milestones/v1.2-ROADMAP.md)
- [v1.1 Agent Reliability and Response Continuity](./milestones/v1.1-ROADMAP.md)
- [v1.0 Launch Hardening for the Core Funnel](./milestones/v1.0-ROADMAP.md)
