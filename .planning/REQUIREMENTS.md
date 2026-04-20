# Requirements: CurrIA

**Defined:** 2026-04-16
**Core Value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.

## v1.6 Requirements

### Agent Orchestrator Boundary

- [x] **ORCH-01**: User can keep using `/api/agent` as the main entry point, with lightweight chat responses still streaming synchronously while heavy actions are acknowledged and dispatched asynchronously.
- [x] **ORCH-02**: Session load or create, message persistence, action classification, and execution-mode routing remain behaviorally consistent after `/api/agent` is reduced to a lightweight orchestrator.

### Durable Async Job Runtime

- [x] **JOB-01**: ATS enhancement, target-job rewriting, and artifact generation have durable persisted job records with explicit type, status, stage, progress, timestamps, and terminal result or error references.
- [x] **JOB-02**: ATS enhancement and target-job rewriting run outside the request path without changing their current business logic, validation semantics, or output persistence behavior.

### Artifact and State Coherence

- [x] **ART-01**: Artifact generation runs outside the request path and records which resume snapshot or version produced each generated file.
- [x] **STATE-01**: Async failures preserve the previous valid `optimizedCvState`, and preview plus generated outputs keep using the correct effective source between `optimizedCvState` and canonical `cvState`.

### Observability and Stabilization

- [x] **OBS-01**: UI and operators can query or stream job status, stage, progress, and terminal completion or failure state for ATS, targeting, and artifact work.
- [x] **TEST-01**: Regression coverage proves sync chat behavior, async dispatch, worker success and failure paths, snapshot consistency, and safe async integration under the new execution model.

### Agent Context Architecture

- [ ] **CTX-01**: Agent context is assembled through explicit layered builders for base rules, workflow rules, action contracts, source content, and output contracts instead of one monolithic phase-oriented prompt builder.
- [ ] **CTX-02**: Resume source-of-truth selection is explicit, typed, and inspectable so workflows can deterministically explain whether they are using canonical `cvState`, `optimizedCvState`, target-job context, validation state, or generated artifact metadata.
- [ ] **TEST-02**: Regression coverage proves lightweight chat stays minimal, ATS and job-targeting flows receive workflow-specific rewrite context, and context composition remains inspectable without changing current business semantics.

### Export and Billing Pipeline Resilience

- [x] **PIPE-RES-01**: No-target ATS export treats successful artifact generation as the primary outcome and keeps billing consumption plus generation-history persistence as explicit supporting stages, so late bookkeeping drift does not surface `INTERNAL_ERROR` after the artifact already exists.
- [x] **PIPE-TEST-01**: Focused regression coverage proves degraded generation billing infrastructure, degraded `resume_generations` persistence, and the successful-artifact-return contract for no-target ATS export.

### Credit Reservation, Ledger, and Reconciliation

- [x] **BILL-RES-01**: Billable resume export reserves exactly one credit before expensive render work starts, then finalizes or releases that hold through an explicit idempotent `reserve -> finalize/release` state machine keyed to the generation intent.
- [x] **BILL-LEDGER-01**: Export billing writes an append-only ledger and reservation trail that remains auditable even when `resume_generations` persistence is degraded, while `credit_accounts` continues serving as the fast runtime balance view.
- [ ] **BILL-OBS-01**: Operators and existing polling surfaces can distinguish reservation, render, finalize, release, and reconciliation states for billable exports through structured logs and stage-aware status reads.
- [ ] **BILL-TEST-01**: Regression coverage proves reservation idempotency, finalize/release safety, reconciliation behavior, and reservation-backed export integration without double-holds or double-charges.

## Future Requirements

| Requirement | Why Deferred |
|-------------|--------------|
| User-facing cancel or retry controls for background jobs | First land the durable async contract and prove correctness before adding more UX surface |
| Richer per-stage progress messaging beyond the required status lifecycle | Keep the first version focused on safety, observability, and parity with the current product flow |
| Queue-infrastructure swaps or multi-service runtime decomposition | The immediate need is to move heavy work off the request path, not to redesign deployment topology |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changing credits, billing, or entitlement semantics | The refactor must preserve billing correctness |
| Redesigning ATS rewrite rules, target-job rules, or artifact output rules | The milestone changes execution model, not business behavior |
| Reworking the chat-led UX shape or replacing `/api/agent` as the public surface | The current product entry point should remain stable |
| New onboarding breadth unrelated to async execution hardening | Launch hardening still has higher leverage than new feature breadth |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCH-01 | Phase 38 | Complete |
| ORCH-02 | Phase 38 | Complete |
| JOB-01 | Phase 37 | Complete |
| JOB-02 | Phase 39 | Complete |
| ART-01 | Phase 39 | Complete |
| STATE-01 | Phase 39 | Complete |
| OBS-01 | Phase 40 | Complete |
| TEST-01 | Phase 40 | Complete |
| CTX-01 | Phase 41 | Planned |
| CTX-02 | Phase 41 | Planned |
| TEST-02 | Phase 41 | Planned |
| PIPE-RES-01 | Phase 43 | Complete |
| PIPE-TEST-01 | Phase 43 | Complete |
| BILL-RES-01 | Phase 44 | Complete |
| BILL-LEDGER-01 | Phase 44 | Complete |
| BILL-OBS-01 | Phase 44 | Planned |
| BILL-TEST-01 | Phase 44 | Planned |

**Coverage:**
- v1.6 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
