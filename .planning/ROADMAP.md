# Roadmap: CurrIA

## Overview

This roadmap turns an already feature-rich brownfield product into a launch-ready release. It first aligns environment contracts and fail-fast behavior, then adds browser verification for the highest-value journey, validates settlement-based billing in staging, and finishes with observability plus a release-readiness sweep. The phases intentionally harden the existing core funnel instead of expanding product breadth.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Contract Alignment and Fail-Fast Guards** - Remove silent configuration drift and make release prerequisites explicit. (completed 2026-04-10)
- [x] **Phase 2: Core Funnel Browser Verification** - Add browser-level coverage for the launch-critical user journey. (completed 2026-04-10)
- [ ] **Phase 3: Billing Settlement Validation** - Prove that staged billing behavior matches the current contract and stays idempotent.
- [ ] **Phase 4: Observability and Launch Readiness** - Standardize diagnostics, error handling, and final launch checks.

## Phase Details

### Phase 1: Contract Alignment and Fail-Fast Guards
**Goal**: Eliminate silent misconfiguration across runtime, CI, and staging for the providers that power the launch funnel.
**Depends on**: Nothing (first phase)
**Requirements**: [OPS-01, OPS-02, OPS-03]
**Success Criteria** (what must be TRUE):
  1. CI and runtime read the same provider env names for the core funnel.
  2. Missing critical provider configuration fails early with actionable diagnostics.
  3. Release and staging docs match the live billing contract and required migrations.
**Plans**: 3 plans

Plans:
- [x] 01-01: Align env contracts in runtime code, CI, and related docs
- [x] 01-02: Add or tighten fail-fast guards for critical provider configuration
- [x] 01-03: Refresh production-readiness and staging validation instructions

### Phase 2: Core Funnel Browser Verification
**Goal**: Create automated browser confidence for the highest-value user journey from auth to resume artifact delivery.
**Depends on**: Phase 1
**Requirements**: [QA-01, QA-02, QA-03]
**Success Criteria** (what must be TRUE):
  1. Team can run browser tests for auth, profile setup or edit, and session creation.
  2. Team can run browser tests for agent interaction, target resume creation, and artifact download.
  3. CI fails clearly when the core funnel regresses.
**Plans**: 3 plans

Plans:
- [x] 02-01: Set up browser-test infrastructure and reusable fixtures
- [x] 02-02: Implement launch-critical journeys with staging-safe provider handling
- [x] 02-03: Integrate browser verification into CI and contributor docs

### Phase 3: Billing Settlement Validation
**Goal**: Verify that the settlement-based billing contract behaves correctly in staging and remains credit-safe under replay scenarios.
**Depends on**: Phase 1
**Requirements**: [BILL-01, BILL-02, BILL-03]
**Success Criteria** (what must be TRUE):
  1. One-time, activation, renewal, cancellation, and replay scenarios are validated against the current contract.
  2. Credit grants remain idempotent during duplicate or replayed webhook events.
  3. Dashboard display totals never contradict runtime credit balance in validated scenarios.
**Plans**: 3 plans

Plans:
- [x] 03-01: Reconcile staging migrations, fixtures, and billing test setup
- [ ] 03-02: Execute settlement validation scenarios and capture evidence
- [ ] 03-03: Fix any billing inconsistencies surfaced during validation

### Phase 4: Observability and Launch Readiness
**Goal**: Make production failures diagnosable, improve user-safe error handling, and close the milestone with a launch decision.
**Depends on**: Phase 2, Phase 3
**Requirements**: [OBS-01, OBS-02]
**Success Criteria** (what must be TRUE):
  1. Agent, billing, and profile import failures emit structured logs with useful request or entity context.
  2. Core funnel failure states show actionable user-safe errors instead of opaque dead ends.
  3. Launch blockers and remaining caveats are captured in a final readiness sweep.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Standardize structured logging on fragile server routes
- [ ] 04-02: Tighten user-facing error translation on the core funnel
- [ ] 04-03: Produce the final launch-readiness sweep and handoff notes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contract Alignment and Fail-Fast Guards | 3/3 | Complete    | 2026-04-10 |
| 2. Core Funnel Browser Verification | 3/3 | Complete    | 2026-04-10 |
| 3. Billing Settlement Validation | 1/3 | In Progress|  |
| 4. Observability and Launch Readiness | 0/3 | Not started | - |
