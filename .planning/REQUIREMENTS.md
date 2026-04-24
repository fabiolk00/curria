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

### Manual Edit vs Export Reliability

- [x] **MANUAL-EXPORT-LOCK-01**: Manual resume edits only treat an export as blocking when it belongs to the same session scope, and a real same-scope in-flight export no longer forces the current valid artifact into an unusable dead zone.
- [x] **MANUAL-EXPORT-UX-01**: When a manual save lands during a real active export, the edit is still persisted canonically and the UI reports the export update as deferred instead of presenting a generic save failure.
- [x] **MANUAL-EXPORT-TEST-01**: Regression coverage proves stale or unrelated export flags no longer block manual save, same-scope active exports preserve a usable artifact while edits persist, and download availability continues to reflect the actual artifact state.

### Manual Edit vs Active Export Review Hardening

- [x] **MANUAL-EXPORT-REVIEW-01**: The manual-edit versus active-export policy is reviewed as a product-state machine, and stale-artifact states are explicit instead of being silently served as if the latest PDF were already synchronized with the saved edit.
- [x] **MANUAL-EXPORT-REVIEW-TEST-01**: Regression coverage proves the adjusted policy across save-persisted plus stale-artifact cases, active same-scope export preservation, file-access signaling, and preview awareness.
- [x] **MANUAL-EXPORT-REVIEW-OBS-01**: Download and save observability make it measurable when a stale artifact is preserved after manual save or served while a newer export is still pending.

### Estimated ATS Readiness Help Affordance

- [x] **ATS-ESTIMATED-HELP-01**: Product surfaces that render the ATS Readiness `Estimado` badge also render a compact help affordance that explains the estimated range in plain PT-BR without exposing internal scoring jargon.
- [x] **ATS-ESTIMATED-HELP-TEST-01**: Regression coverage proves the help icon only appears for estimated readiness states and the explanation stays accessible through hover, focus, and click interactions.

### PDF Export Encoding and Experience Header Polish

- [x] **PDF-EXPORT-ENCODING-01**: PDF export embeds a broad enough Inter font asset and normalizes resume text deterministically so pt-BR accents plus common technical separators render without broken glyphs.
- [x] **PDF-EXPERIENCE-HEADER-01**: Experience entries in the PDF render the role title on the left and the period on the right within the same header line, while company and location stay on the line below.
- [x] **ATS-ESTIMATED-TOOLTIP-01**: The `Estimado` badge tooltip remains accessible but uses a smaller, lighter visual footprint so it reads as contextual help instead of a heavy popover.
- [x] **PDF-EXPORT-ENCODING-TEST-01**: Regression tests verify accented/technical PDF strings, same-line role/date alignment, company placement below the header, and the compact estimated-tooltip contract.
- [x] **REPO-HYGIENE-DOC-01**: Architecture and planning docs expose clear canonical entry points so contributors can find current source-of-truth guidance quickly.
- [x] **REPO-HYGIENE-GUARD-01**: Lightweight hygiene guardrails explain what belongs in `.planning/` and keep local scratch outputs out of version control.

### ATS Enhancement Generate File Handoff Hardening

- [x] **GEN-HANDOFF-01**: The `generate_file` execution seam defines the authoritative export source explicitly and rejects payload-to-source mismatches before billable generation begins.
- [x] **GEN-HANDOFF-ERR-01**: Post-persistence handoff and generate-file intake failures are surfaced as typed tool failures with route-visible HTTP semantics instead of opaque generic internal errors.
- [x] **GEN-HANDOFF-TEST-01**: Regression tests cover payload/source mismatch, post-persistence handoff preflight, typed dispatch failure mapping, and preview-lock transverse compatibility for the hardened seam.

### Billable Resume Failure Localization

- [x] **BILL-DIAG-01**: Post-preflight failures inside `generateBillableResume(...)` are localized to explicit downstream billable stages and no longer collapse into an unqualified opaque exception path.
- [x] **BILL-DIAG-OBS-01**: Billable export stage transitions and failures emit structured logs and stage-specific metrics that preserve `billableStage`, generation intent, and resume-generation context for diagnosis.
- [x] **BILL-DIAG-TEST-01**: Regression coverage proves typed billable failure narrowing, stage-tagged thrown exceptions, and top-level tool-log propagation for downstream billable failures.

### Pending Resume Generation Persistence Narrowing

- [x] **PENDING-PERSIST-01**: Pending resume-generation persistence distinguishes create vs reuse failure branches and preserves raw persistence diagnostics instead of collapsing both paths into one generic persistence error.
- [x] **PENDING-PERSIST-OBS-01**: Pending-generation persistence failures log branch, DB code/details, latest version, source scope, and generation intent context so ATS-without-target failures are diagnosable from runtime logs.
- [x] **PENDING-PERSIST-TEST-01**: Regression coverage proves create-branch failure, reuse-branch failure, narrowed failure codes, and top-level tool-log propagation for pending-generation persistence problems.

### Canonical ATS Readiness Scoring Contract

- [x] **ATS-READINESS-01**: ATS enhancement uses one canonical ATS Readiness score contract for product surfaces while preserving raw heuristic ATS scoring separately for internal diagnostics and experiments.
- [x] **ATS-READINESS-CONF-01**: Product-facing ATS Readiness scores are confidence-aware, quality-gated, withheld when unsafe to show, and non-decreasing after successful ATS enhancement with a minimum displayed floor of 89.
- [x] **ATS-READINESS-TEST-01**: Regression coverage proves monotonic ATS Readiness display, quality-gated withholding, confidence classification, API contract shaping, and the historical optimized-lower-than-original failure mode can no longer occur.

### ATS Readiness Hardening and Migration Audit

- [x] **ATS-READINESS-HARDEN-01**: No product-facing ATS enhancement surface computes display score ownership outside the canonical ATS Readiness module, and remaining legacy ATS score fields are compatibility-only and clearly deprecated.
- [x] **ATS-READINESS-OBS-01**: Canonical ATS Readiness decisions emit structured logs, contract-version metadata, and outcome metrics for finalization, withholding, floor-89 application, low confidence, monotonicity protection, comparison rendering, and legacy fallback usage.
- [x] **ATS-READINESS-MIGRATION-01**: Legacy ATS sessions without persisted `atsReadiness` resolve through one deterministic canonical fallback path, and mixed old/new session shapes remain safe across session and comparison routes.

### Manual Edit Persistence and Export Coherence

- [x] **MANUAL-EDIT-CANON-01**: Manual resume edits persist to the correct canonical owner (`session.cvState`, `session.agentState.optimizedCvState`, or target `derivedCvState`) so preview re-entry and subsequent edits always rehydrate the latest saved draft.
- [x] **MANUAL-EDIT-EXPORT-01**: Preview and export stay aligned after manual resume edits by invalidating stale artifact metadata and regenerating the PDF from the same canonical edited source used by the preview flow.
- [x] **MANUAL-EDIT-OBS-01**: Manual edit persistence and artifact invalidation emit structured lifecycle logs so future preview/export divergence can be diagnosed without logging resume content.

### Premium ATS-Safe PDF Export Template

- [x] **PDF-TEMPLATE-PREMIUM-01**: The PDF export template uses a more refined single-column hierarchy with improved top-of-page rhythm, section dividers, experience spacing, and skill-section organization without introducing ATS-risky layout constructs such as sidebars, columns, tables, or decorative boxes.
- [x] **PDF-TEMPLATE-FONT-01**: The exported PDF reuses the same Inter font family used by the in-product preview so the document feels visually consistent with the product while remaining readable and text-selectable.
- [x] **PDF-TEMPLATE-TEST-01**: Export regression tests continue to verify that the PDF keeps essential sections, content order, and artifact behavior intact after the visual template refinement.

### Optimized Preview Highlight Recalibration

- [x] **OPT-PREVIEW-HILITE-CALIBRATION-01**: Optimized preview highlights now favor short semantic chunks and materially improved premium bullets instead of isolated single-word token highlights, especially inside the summary block.
- [x] **OPT-PREVIEW-HILITE-CALIBRATION-STYLE-01**: The optimized-column highlight style is softer and more editorial so the preview feels premium rather than like a raw technical diff.
- [x] **OPT-PREVIEW-HILITE-CALIBRATION-TEST-01**: Highlight regression tests now cover suppression of isolated words/technology tokens, bounded summary density, and preservation of strong premium cases such as `15%` plus `LATAM`.

### Experience Highlight Entry Surfacing Policy

- [x] **EXP-HILITE-SURFACING-01**: Experience highlight rendering now uses a dedicated entry-level surfacing selector that consumes finalized bullet highlight results for a single experience entry and decides which bullets receive the limited visible highlight slots without re-running parsing, completion, or winner selection.
- [x] **EXP-HILITE-SURFACING-PRIORITY-01**: Within a single experience entry, visible highlight slots explicitly prioritize `strong` evidence ahead of `secondary`, with category ordering that prefers `metric`, then `scope_scale`, before Tier 2 contextual categories can consume remaining capacity.
- [x] **EXP-HILITE-SURFACING-TEST-01**: Focused unit coverage verifies tier dominance, cap preservation, zero-highlight safety, deterministic tie-breaking, and renderer-contract propagation for the entry-level surfacing policy.

### Experience Highlight Entry Surfacing Hardening

- [x] **EXP-HILITE-SURFACING-HARDEN-01**: The experience-entry editorial surfacing policy is externalized into a named exported constant with explicit intent comments, and cap ownership is explicit in the surfacing API or documented at the cap source.
- [x] **EXP-HILITE-SURFACING-HARDEN-TEST-01**: Direct Layer 3 tests cover no-eligible-highlight entries, deterministic same-category ties, and explicit cap enforcement after editorial selection.
- [x] **EXP-HILITE-SURFACING-HARDEN-OBS-01**: The surfacing layer exposes lightweight debug-only observability that explains eligible, selected, and suppressed bullets without affecting normal product behavior or production UX.

### Experience Highlight Surfacing Safety Validation

- [x] **EXP-HILITE-SAFETY-SSR-01**: The real execution path into `buildOptimizedPreviewHighlights(...)` and `selectVisibleExperienceHighlightsForEntry(...)` is traced and documented so SSR/debug-flag assumptions are explicit, and `shouldTraceExperienceHighlightSurfacing()` is either hardened or explicitly documented as safe for that context.
- [x] **EXP-HILITE-SAFETY-COUPLING-01**: Tests and shared test helpers are audited for fixture coupling to `EXPERIENCE_HIGHLIGHT_CATEGORY_PRIORITY`, and any constant-internals assertions are replaced with observable-behavior assertions.
- [x] **EXP-HILITE-SAFETY-VALIDATION-01**: The phase produces a validation note confirming whether the debug flag is server-only/test-only or mixed-context, whether any coupling was found, and whether the correct outcome was targeted fixes or validation-only with no editorial behavior changes.

### Experience Highlight Layer 1 Evidence Scoring

- [x] **EXP-HILITE-EVIDENCE-01**: `evaluateExperienceBulletImprovement(...)` returns a numeric `evidenceScore` derived from the optimized bullet itself, so preserved strong metrics, quantified scope, and measurable outcomes stay editorially visible even when the rewrite delta is small.
- [x] **EXP-HILITE-EVIDENCE-ELIGIBILITY-01**: Experience-bullet highlight eligibility now uses two independent paths, `evidenceScore >= EVIDENCE_THRESHOLD || improvementScore >= IMPROVEMENT_THRESHOLD`, while Layer 1 continues returning signals only and does not take same-entry ranking decisions away from Layer 2 or Layer 3.
- [x] **EXP-HILITE-EVIDENCE-TEST-01**: Regression coverage proves preserved metrics become eligible again, new metrics stay eligible, weak stack-only bullets do not gain false eligibility, and same-entry editorial surfacing still favors Tier 1 metric evidence over scope/scale under cap pressure.

### Resume Profile CRM Layout Fidelity

- [ ] **RESUME-PROFILE-CRM-01**: The resume profile page must adopt the approved clean CRM-style layout with a compact header, two-column section cards, black primary actions, and no KPI/sidebar shells while preserving the existing live data sources, profile save/load flow, import flow, enhancement flow, download flow, dialogs, toasts, and route contracts.
- [ ] **RESUME-PROFILE-EDIT-01**: Profile section edit affordances must trigger the real existing editing behavior by reusing the current `VisualResumeEditor` flow, preserving section expand/focus semantics, disabled/loading states, and canonical `resumeData` normalization plus sanitization behavior.
- [ ] **RESUME-PROFILE-TEST-01**: Focused regression coverage must prove the CRM-style page still supports profile load/save, import modal access, section edit actions, ATS and target-job setup flows, missing-requirements and rewrite-validation dialogs, empty-state rendering, and overflow-safe long-content behavior without snapshot-only assertions.

### ATS Enhancement Intent Clarity

- [x] **ATS-INTENT-UI-01**: The enhancement panel must expose an explicit UI intent selector between ATS improvement and target-job adaptation, default ATS intent to the general-improvement path, hide the large vacancy textarea in ATS mode, and show mode-matched product copy before submit without changing the existing generation handler or backend contract.
- [x] **ATS-INTENT-GUARD-01**: Selecting target-job adaptation without a non-empty vacancy description must be blocked locally in the UI before generation starts, while ATS selection clears any draft target-job description and submit behavior continues to follow the existing `generationMode` and endpoint split.
- [x] **ATS-INTENT-TEST-01**: Focused component and browser regression coverage must prove default ATS selection, explicit target-job selection, local empty-target validation, ATS-clear behavior, preserved dialogs/toasts/loading/credit messaging, and unchanged ATS versus smart-generation endpoint semantics.

### Generated Resume History

- [x] **RESUME-HISTORY-PERSIST-01**: Generated resume history must remain durable in `resume_generations`, preserving normalized history metadata for source kind, card copy, timestamps, and artifact ownership without replacing the current billing-aware generation flow.
- [x] **RESUME-HISTORY-ACCESS-01**: Authenticated users must be able to read only their own latest 6 history items and open/download them through protected app routes that never expose raw storage paths or bypass existing file-access ownership checks.
- [x] **RESUME-HISTORY-UI-01**: The existing `Currículos recentes` screen must use live history data, preserve the approved dashboard-card visual direction, differentiate chat/ATS geral/vaga alvo, and paginate 4 cards per page with explicit loading, empty, and error states.
- [x] **RESUME-HISTORY-TEST-01**: Focused service, API, and UI regression coverage must prove latest-6 pagination, secure ownership filtering, source-kind mapping, safe URLs, and the real-history rendering/actions on the existing screen without screenshot-only assertions.

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
| BILL-DIAG-01 | Phase 59 | Complete |
| BILL-DIAG-OBS-01 | Phase 59 | Complete |
| BILL-DIAG-TEST-01 | Phase 59 | Complete |
| PENDING-PERSIST-01 | Phase 60 | Complete |
| PENDING-PERSIST-OBS-01 | Phase 60 | Complete |
| PENDING-PERSIST-TEST-01 | Phase 60 | Complete |
| RESUME-GEN-TS-01 | Phase 61 | Complete |
| RESUME-GEN-TS-ALIGN-01 | Phase 61 | Complete |
| RESUME-GEN-TS-TEST-01 | Phase 61 | Complete |
| ATS-READINESS-01 | Phase 62 | Complete |
| ATS-READINESS-CONF-01 | Phase 62 | Complete |
| ATS-READINESS-TEST-01 | Phase 62 | Complete |
| ATS-READINESS-HARDEN-01 | Phase 63 | Complete |
| ATS-READINESS-OBS-01 | Phase 63 | Complete |
| ATS-READINESS-MIGRATION-01 | Phase 63 | Complete |
| ATS-READINESS-RANGE-01 | Phase 64 | Complete |
| ATS-READINESS-RANGE-OBS-01 | Phase 64 | Complete |
| ATS-READINESS-RANGE-TEST-01 | Phase 64 | Complete |
| ATS-READINESS-V2-01 | Phase 65 | Complete |
| ATS-READINESS-V2-COMPAT-01 | Phase 65 | Complete |
| ATS-READINESS-V2-CLEANUP-01 | Phase 65 | Complete |
| ATS-RAW-CLEANUP-01 | Phase 66 | Complete |
| ATS-RAW-CLEANUP-COMPAT-01 | Phase 66 | Complete |
| ATS-RAW-CLEANUP-TEST-01 | Phase 66 | Complete |
| ATS-STABILIZE-OBS-01 | Phase 67 | Complete |
| ATS-STABILIZE-DOC-01 | Phase 67 | Complete |
| ATS-STABILIZE-TEST-01 | Phase 67 | Complete |
| ATS-METRIC-PRESERVE-01 | Phase 68 | Complete |
| ATS-METRIC-PRESERVE-GATE-01 | Phase 68 | Complete |
| ATS-METRIC-PRESERVE-TEST-01 | Phase 68 | Complete |
| ATS-METRIC-OBS-01 | Phase 69 | Complete |
| ATS-METRIC-OBS-RECOVERY-01 | Phase 69 | Complete |
| ATS-METRIC-OBS-TEST-01 | Phase 69 | Complete |
| MANUAL-EXPORT-REVIEW-01 | Phase 75 | Complete |
| MANUAL-EXPORT-REVIEW-TEST-01 | Phase 75 | Complete |
| MANUAL-EXPORT-REVIEW-OBS-01 | Phase 75 | Complete |
| ATS-ESTIMATED-HELP-01 | Phase 76 | Complete |
| ATS-ESTIMATED-HELP-TEST-01 | Phase 76 | Complete |
| PDF-EXPORT-ENCODING-01 | Phase 77 | Complete |
| PDF-EXPERIENCE-HEADER-01 | Phase 77 | Complete |
| ATS-ESTIMATED-TOOLTIP-01 | Phase 77 | Complete |
| PDF-EXPORT-ENCODING-TEST-01 | Phase 77 | Complete |
| MANUAL-EDIT-CANON-01 | Phase 70 | Complete |
| MANUAL-EDIT-EXPORT-01 | Phase 70 | Complete |
| MANUAL-EDIT-OBS-01 | Phase 70 | Complete |
| OPT-PREVIEW-HILITE-01 | Phase 71 | Complete |
| OPT-PREVIEW-HILITE-GUARD-01 | Phase 71 | Complete |
| OPT-PREVIEW-HILITE-TEST-01 | Phase 71 | Complete |
| EXPORT-FILENAME-01 | Phase 72 | Complete |
| EXPORT-FILENAME-CANON-01 | Phase 72 | Complete |
| EXPORT-FILENAME-TEST-01 | Phase 72 | Complete |
| PDF-TEMPLATE-PREMIUM-01 | Phase 72.1 | Complete |
| PDF-TEMPLATE-FONT-01 | Phase 72.1 | Complete |
| PDF-TEMPLATE-TEST-01 | Phase 72.1 | Complete |
| OPT-PREVIEW-HILITE-CALIBRATION-01 | Phase 73 | Complete |
| OPT-PREVIEW-HILITE-CALIBRATION-STYLE-01 | Phase 73 | Complete |
| OPT-PREVIEW-HILITE-CALIBRATION-TEST-01 | Phase 73 | Complete |
| EXP-HILITE-SURFACING-01 | Phase 87 | Complete |
| EXP-HILITE-SURFACING-PRIORITY-01 | Phase 87 | Complete |
| EXP-HILITE-SURFACING-TEST-01 | Phase 87 | Complete |
| EXP-HILITE-SURFACING-HARDEN-01 | Phase 88 | Complete |
| EXP-HILITE-SURFACING-HARDEN-TEST-01 | Phase 88 | Complete |
| EXP-HILITE-SURFACING-HARDEN-OBS-01 | Phase 88 | Complete |
| EXP-HILITE-SAFETY-SSR-01 | Phase 89 | Complete |
| EXP-HILITE-SAFETY-COUPLING-01 | Phase 89 | Complete |
| EXP-HILITE-SAFETY-VALIDATION-01 | Phase 89 | Complete |
| ATS-SUMMARY-CLARITY-OBS-01 | Phase 90 | Complete |
| ATS-SUMMARY-CLARITY-CONVERGENCE-01 | Phase 90 | Complete |
| ATS-SUMMARY-CLARITY-TEST-01 | Phase 90 | Complete |
| ATS-SUMMARY-LOGLEVEL-01 | Phase 91 | Complete |
| ATS-SUMMARY-WARN-SIGNAL-01 | Phase 91 | Complete |
| ATS-SUMMARY-LOGLEVEL-TEST-01 | Phase 91 | Complete |
| EXP-HILITE-EVIDENCE-01 | Phase 92 | Complete |
| EXP-HILITE-EVIDENCE-ELIGIBILITY-01 | Phase 92 | Complete |
| EXP-HILITE-EVIDENCE-TEST-01 | Phase 92 | Complete |
| ATS-SUMMARY-EDITORIAL-01 | Phase 93 | Complete |
| ATS-SUMMARY-DENSITY-01 | Phase 93 | Complete |
| ATS-SUMMARY-EDITORIAL-TEST-01 | Phase 93 | Complete |
| EXP-HILITE-STACK-CONTEXT-01 | Phase 94 | Complete |
| EXP-HILITE-STACK-COMPETE-01 | Phase 94 | Complete |
| EXP-HILITE-STACK-TEST-01 | Phase 94 | Complete |
| RESUME-PROFILE-CRM-01 | Phase 99 | Planned |
| RESUME-PROFILE-EDIT-01 | Phase 99 | Planned |
| RESUME-PROFILE-TEST-01 | Phase 99 | Planned |
| ATS-INTENT-UI-01 | Phase 100 | Complete |
| ATS-INTENT-GUARD-01 | Phase 100 | Complete |
| ATS-INTENT-TEST-01 | Phase 100 | Complete |
| RESUME-HISTORY-PERSIST-01 | Phase 101 | Complete |
| RESUME-HISTORY-ACCESS-01 | Phase 101 | Complete |
| RESUME-HISTORY-UI-01 | Phase 101 | Complete |
| RESUME-HISTORY-TEST-01 | Phase 101 | Complete |

**Coverage:**
- v1.6 requirements: 108 total
- Mapped to phases: 108
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
