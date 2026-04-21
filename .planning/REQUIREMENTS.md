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
- [x] **BILL-OBS-01**: Operators and existing polling surfaces can distinguish reservation, render, finalize, release, and reconciliation states for billable exports through structured logs and stage-aware status reads.
- [x] **BILL-TEST-01**: Regression coverage proves reservation idempotency, finalize/release safety, reconciliation behavior, and reservation-backed export integration without double-holds or double-charges.

### Billing Transparency, Alerting, and Concurrency Proof

- [x] **BILL-UX-01**: Authenticated users can inspect recent export credit activity derived from `credit_reservations` and `credit_ledger_entries` inside the existing authenticated product surface without introducing a second billing-history source.
- [x] **BILL-ALERT-01**: Operators can detect actionable export billing anomalies such as stale `needs_reconciliation`, repeated finalize or release failures, and unusual reserved backlogs through repo-native metrics, thresholds, alert hooks, and documented commands.
- [x] **BILL-CONC-01**: Automated and staging-friendly proof demonstrates that concurrent export retries do not create double holds or unsafe reconciliation loops, and that reservation or reconciliation states can be reproduced and diagnosed repeatably.

### Route Decision Architecture Hardening

- [x] **ROUTE-ARCH-01**: Critical route modules keep explicit context, policy, decision, and response boundaries so request resolution, policy gating, orchestration, and HTTP mapping do not collapse back into semantically mixed route code.
- [x] **ROUTE-ARCH-TEST-01**: Mapper integrity, precedence-sensitive decisions, and artifact-lock invariants are covered by focused seam tests that prove public behavior stays unchanged while architectural boundaries remain enforced.
- [x] **ROUTE-ARCH-GUARD-01**: Route architecture documentation, review checklists, and hotspot watchlists make the critical pattern enforceable for dense policy routes without expanding it into low-risk CRUD surfaces.

### Route Architecture 10/10 Hardening

- [x] **HOTSPOT-DEC-01**: The remaining route hotspots are decomposed into route-specific helpers so `smart-generation/decision.ts` and `session-generate/decision.ts` stay orchestration-first instead of becoming semantic sink modules.
- [x] **ROUTE-INV-01**: Locked preview, locked compare, locked versions, and signed URL seams are enforced by executable invariants and exhaustive decision or response mappings.
- [x] **ROUTE-GOV-01**: Critical route anti-patterns are blocked by repo-native automation, CI checks, and PR review prompts instead of depending only on reviewer memory.
- [x] **ROUTE-OPS-01**: Architecture-specific telemetry and operational drill docs make locked preview, compare, versions, artifact availability, and replay-after-upgrade behavior observable and reviewable.
- [x] **ROUTE-PROOF-01**: A curated architecture proof pack and scorecard prove the sensitive route and preview flows before release and keep approved chokepoints explicit.

### Brownfield Route Consolidation and Repo Topology Alignment

- [x] **ROUTE-CONS-01**: Compare and comparison route ownership is explicit, the remaining dense brownfield compare surface follows the route-layer pattern, and future compare logic has one canonical architectural home.
- [x] **ROUTE-CONS-TEST-01**: Regression coverage proves the migrated compare or comparison surface preserves public contract, preview-aware behavior, not-found handling, and compare semantics after the extraction.
- [x] **ROUTE-CONS-DOC-01**: README, route-topology docs, governance artifacts, and component-boundary guidance reflect the current repo topology and the compare versus comparison canonical decision.

### Governance Enforcement Alignment

- [x] **ROUTE-GOV-ALIGN-01**: CI, route-architecture audit enforcement, and the documented critical-route governance surface all agree on which sensitive route families must pass architecture-specific checks.
- [x] **ROUTE-GOV-ALIGN-TEST-01**: The curated architecture proof pack includes the migrated `comparison` surface and stays green alongside the route-architecture audit and typecheck commands.
- [x] **ROUTE-GOV-ALIGN-DOC-01**: Review docs, scorecards, and architecture checklists describe the current automation truth and use repo-portable links.

### Repository Hygiene and Documentation Cleanup

- [x] **REPO-HYGIENE-01**: Temporary planning/debug artifacts are removed or ignored, while real historical phase records stay preserved as canonical project memory.
- [x] **REPO-HYGIENE-DOC-01**: Architecture and planning docs expose clear canonical entry points so contributors can find current source-of-truth guidance quickly.
- [x] **REPO-HYGIENE-GUARD-01**: Lightweight hygiene guardrails explain what belongs in `.planning/` and keep local scratch outputs out of version control.

### ATS Enhancement Generate File Handoff Hardening

- [x] **GEN-HANDOFF-01**: The `generate_file` execution seam defines the authoritative export source explicitly and rejects payload-to-source mismatches before billable generation begins.
- [x] **GEN-HANDOFF-ERR-01**: Post-persistence handoff and generate-file intake failures are surfaced as typed tool failures with route-visible HTTP semantics instead of opaque generic internal errors.
- [x] **GEN-HANDOFF-TEST-01**: Regression tests cover payload/source mismatch, post-persistence handoff preflight, typed dispatch failure mapping, and preview-lock transverse compatibility for the hardened seam.

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
| BILL-UX-01 | Phase 45 | Planned |
| BILL-ALERT-01 | Phase 45 | Planned |
| BILL-CONC-01 | Phase 45 | Planned |
| ROUTE-ARCH-01 | Phase 49 | Complete |
| ROUTE-ARCH-TEST-01 | Phase 49 | Complete |
| ROUTE-ARCH-GUARD-01 | Phase 49 | Complete |
| HOTSPOT-DEC-01 | Phase 50 | Complete |
| ROUTE-INV-01 | Phase 51 | Complete |
| ROUTE-GOV-01 | Phase 52 | Complete |
| ROUTE-OPS-01 | Phase 53 | Complete |
| ROUTE-PROOF-01 | Phase 54 | Complete |
| ROUTE-CONS-01 | Phase 55 | Complete |
| ROUTE-CONS-TEST-01 | Phase 55 | Complete |
| ROUTE-CONS-DOC-01 | Phase 55 | Complete |
| ROUTE-GOV-ALIGN-01 | Phase 56 | Complete |
| ROUTE-GOV-ALIGN-TEST-01 | Phase 56 | Complete |
| ROUTE-GOV-ALIGN-DOC-01 | Phase 56 | Complete |
| REPO-HYGIENE-01 | Phase 57 | Complete |
| REPO-HYGIENE-DOC-01 | Phase 57 | Complete |
| REPO-HYGIENE-GUARD-01 | Phase 57 | Complete |
| GEN-HANDOFF-01 | Phase 58 | Complete |
| GEN-HANDOFF-ERR-01 | Phase 58 | Complete |
| GEN-HANDOFF-TEST-01 | Phase 58 | Complete |

**Coverage:**
- v1.6 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
