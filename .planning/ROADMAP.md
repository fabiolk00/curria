# Roadmap: CurrIA

## Overview

This roadmap starts milestone `v1.4 Agent Core Modularization, Security Hardening, and Release Stability` after `v1.3` shipped latency evidence, earlier visible responses, runtime budgeting, and adjacent route performance proof. The new work stays tightly brownfield: make the critical agent path easier to evolve, close trust gaps in authenticated and billing-sensitive routes, and raise generation and release confidence before scope expansion.

The main focus of this milestone is safe modularization and operational hardening first.

Highest-priority targets are:

- smaller and testable agent-service boundaries
- canonical-host and origin-trust hardening on sensitive routes
- stable long vacancy generation and preview behavior
- stronger CI protection for release-critical regressions

Any optional improvement that does not directly improve agent maintainability, authenticated-route safety, billing trust, or release stability should be treated as secondary and deferred unless it is required for correctness.

## Phases

**Phase Numbering:**
- Integer phases continue across milestones unless explicitly reset.
- This milestone continues from the previous roadmap, so the first phase here is **Phase 28**.

### Phase 28: Agent Input and Setup Service Extraction
**Goal**: Pull the front half of the agent runtime into smaller services so message preparation, vacancy detection, and pre-loop setup are easier to reason about and test.
**Depends on**: Nothing (first phase of milestone v1.4)
**Requirements**: [AGENT-01]
**Success Criteria** (what must be TRUE):
  1. The main agent route no longer owns the full message-preparation, vacancy-detection, and pre-loop setup flow inline.
  2. The new services have explicit contracts that preserve current behavior and the canonical `cvState` boundary.
  3. Focused automated proof exists for the extracted setup flow so future runtime changes are safer.
**Plans**: 3 plans

Plans:
- [ ] 28-01: Extract message preparation into a dedicated service with route-level contract preservation
- [ ] 28-02: Isolate vacancy detection and pre-loop setup behind explicit runtime boundaries
- [ ] 28-03: Add targeted regression tests for extracted agent input and setup flow

### Phase 29: Agent Recovery, Streaming, and Persistence Decomposition
**Goal**: Split the back half of the runtime into clearer retry, recovery, streaming, and persistence services with durable tests around handoff behavior.
**Depends on**: Phase 28
**Requirements**: [AGENT-02, AGENT-03]
**Success Criteria** (what must be TRUE):
  1. Retry and degraded-recovery policy live outside the central oversized loop file.
  2. Streaming and persistence responsibilities have narrower boundaries with predictable handoffs and logs.
  3. Automated tests protect the extracted flow against regressions in `cvState`, `agentState`, and deterministic generation persistence.
**Plans**: 3 plans

Plans:
- [ ] 29-01: Extract retry and recovery policy into dedicated runtime services
- [ ] 29-02: Separate streaming and persistence responsibilities from the central loop orchestration
- [ ] 29-03: Add regression proof for recovery, streaming, and persistence handoffs

### Phase 30: Authenticated Route and Billing Boundary Hardening
**Goal**: Remove weak trust assumptions from checkout, redirect, callback, and mutation flows so sensitive routes fail closed and leave useful evidence.
**Depends on**: Phase 28
**Requirements**: [SEC-01, SEC-02, SEC-03]
**Success Criteria** (what must be TRUE):
  1. Sensitive redirects and checkout flows derive trusted URLs from canonical configuration rather than raw request metadata.
  2. Authenticated mutations that matter for security or billing enforce explicit origin or CSRF validation and reject invalid callers.
  3. Billing and external callback flows have committed regression proof and structured logs around the intended trust boundary.
**Plans**: 2 plans

Plans:
- [ ] 30-01: Harden canonical-host and return-path validation across checkout and external redirect flows
- [ ] 30-02: Add explicit origin or CSRF enforcement and regression proof for sensitive authenticated mutations and billing callbacks

### Phase 31: Long Vacancy Stability and Release Hygiene Gates
**Goal**: Eliminate the known generation instability and encoding defects, then raise CI gates around workspace, preview, and release-critical regressions.
**Depends on**: Phase 29, Phase 30
**Requirements**: [REL-01, REL-02, REL-03]
**Success Criteria** (what must be TRUE):
  1. The long vacancy generation path completes reliably through workspace and preview-critical behavior under committed regression coverage.
  2. Broken text-encoding artifacts are removed from user-visible surfaces and protected from easy regression.
  3. CI or release automation now blocks merges when high-value state, preview, or generation regressions reappear.
**Plans**: 2 plans

Plans:
- [ ] 31-01: Fix long vacancy generation and encoding regressions with focused browser or route-level proof
- [ ] 31-02: Strengthen CI and release gates for workspace, preview, and generation-state stability

## Autonomous Execution Instruction

The intended operating mode for this milestone is:

- discuss -> plan -> execute -> verify -> advance to next phase
- prioritize the milestone in order from Phase 28 forward unless a true blocker appears
- stop only for missing credentials, missing infrastructure, unresolved repo conflicts, or a high-risk trust-boundary decision that cannot be made safely

Recommended entrypoint:

`/gsd-plan-phase 28`

## Progress

**Execution Order:**
Phases execute in numeric order: 28 -> 29 -> 30 -> 31

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 28. Agent Input and Setup Service Extraction | 0/3 | Not started | - |
| 29. Agent Recovery, Streaming, and Persistence Decomposition | 0/3 | Not started | - |
| 30. Authenticated Route and Billing Boundary Hardening | 0/2 | Not started | - |
| 31. Long Vacancy Stability and Release Hygiene Gates | 0/2 | Not started | - |

## Archived Milestones

- [v1.3 Agent Response Time and Runtime Performance](./milestones/v1.3-ROADMAP.md)
- [v1.2 Code Hygiene and Dead Code Reduction](./milestones/v1.2-ROADMAP.md)
- [v1.1 Agent Reliability and Response Continuity](./milestones/v1.1-ROADMAP.md)
- [v1.0 Launch Hardening for the Core Funnel](./milestones/v1.0-ROADMAP.md)
