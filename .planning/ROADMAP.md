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
- [x] 34-01: Re-profile the residual non-E2E outliers and publish the current budget evidence
- [x] 34-02: Reduce or explicitly gate the dominant remaining runtime bottleneck

### Phase 35: Harden rewrite state coherence between ATS optimized state, chat follow-up rewrites, and target resume derivation

**Goal:** Keep deterministic ATS and job-targeting rewrites coherent after optimization so follow-up chat rewrites and target resume derivation use the latest effective optimized resume state instead of falling back to stale base `cvState`.
**Requirements**: [COH-01, COH-02]
**Depends on:** Phase 34
**Success Criteria** (what must be TRUE):
  1. Once `optimizedCvState` exists, chat rewrite follow-ups and deterministic helpers prefer that effective resume source over stale base `cvState`.
  2. Target resume derivation paths reuse the latest effective optimized resume so ATS enhancement and later job targeting stay coherent.
  3. Regression proof catches stale-source drift for follow-up rewrites, including resume sections such as experience, and for target resume creation after a prior ATS rewrite.
**Plans:** 2 plans

Plans:
- [x] 35-01: Route chat rewrite sourcing and deterministic target derivation through the effective optimized resume state
- [x] 35-02: Lock rewrite-state coherence with targeted regressions, validation, and operator-facing proof

## Autonomous Execution Instruction

The intended operating mode for this milestone is:

- discuss -> plan -> execute -> verify -> advance to next phase
- prioritize the milestone in order from Phase 32 forward unless a true blocker appears
- stop only for missing credentials, missing infrastructure, unresolved repo conflicts, or a high-risk decision about accepted proof or runtime debt that cannot be made safely

Recommended entrypoint:

`/gsd-audit-milestone v1.5`

## Current Milestone

- `v1.5 Verification Closure and Runtime Residuals` - active

## Progress

**Execution Order:**
Phases execute in numeric order: 32 -> 33 -> 34 -> 35 -> 36

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. Phase Verification Backfill and Audit Contract | 3/3 | Complete | 2026-04-15 |
| 33. Milestone Archive and Traceability Integrity | 2/2 | Complete | 2026-04-15 |
| 34. Non-E2E Runtime Residual Budgeting | 2/2 | Complete | 2026-04-15 |
| 35. Harden rewrite state coherence between ATS optimized state, chat follow-up rewrites, and target resume derivation | 2/2 | Complete | 2026-04-15 |
| 36. Make target job analysis robust to freeform vacancy text and reduce rewrite failures from weak target-role parsing | 1/1 | Complete | 2026-04-15 |

## Archived Milestones

- [v1.4 Agent Core Modularization, Security Hardening, and Release Stability](./milestones/v1.4-ROADMAP.md) - shipped 2026-04-15, 5 phases, 13 plans, verification backfilled with accepted runtime debt
- [v1.3 Agent Response Time and Runtime Performance](./milestones/v1.3-ROADMAP.md)
- [v1.2 Code Hygiene and Dead Code Reduction](./milestones/v1.2-ROADMAP.md)
- [v1.1 Agent Reliability and Response Continuity](./milestones/v1.1-ROADMAP.md)
- [v1.0 Launch Hardening for the Core Funnel](./milestones/v1.0-ROADMAP.md)

### Phase 36: Make target job analysis robust to freeform vacancy text and reduce rewrite failures from weak target-role parsing
**Goal**: Make job targeting resilient when the user pastes arbitrary vacancy text, so the system derives useful targeting context from vacancy semantics instead of brittle heading or title parsing.
**Requirements**: [VAC-01, VAC-02]
**Depends on**: Phase 35
**Success Criteria** (what must be TRUE):
  1. Job targeting can derive grounded emphasis from freeform vacancy text even when no clean role title exists.
  2. Headings, recruiter prose, and other noisy vacancy lines no longer become the main `targetRole` anchor.
  3. The rewrite flow reduces preventable validation failures from unsupported skill injection while preserving factual honesty.
**Plans**: 1 plan

Plans:
- [x] 36-01: Re-anchor target-job analysis on vacancy semantics and sanitize rewrite output for freeform input
