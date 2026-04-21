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
| 44. Implement credit reservation, ledger, and billing reconciliation | 2/2 | Complete   | 2026-04-20 |

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
**Plans:** 2/2 plans complete

Plans:
- [x] 44-01-PLAN.md — Add reservation and ledger schema plus atomic reserve/finalize/release billing wrappers
- [x] 44-02-PLAN.md — Integrate reservation-backed export runtime, reconciliation support, and stage-aware diagnostics

### Phase 45: Improve billing transparency alerts and concurrency proof

**Goal:** Make reservation-backed export billing inspectable to users, actionable to operators, and provably safe under concurrent retries without changing the existing billing state machine or authenticated surfaces.
**Requirements**: [BILL-UX-01, BILL-ALERT-01, BILL-CONC-01]
**Depends on:** Phase 44
**Plans:** 3/3 plans complete

Plans:
- [x] 45-01-PLAN.md — Freeze shared billing activity and anomaly contracts over the existing ledger and reservation audit trail
- [x] 45-02-PLAN.md — Add authenticated export credit history to the existing settings surface
- [x] 45-03-PLAN.md — Land anomaly alert hooks plus concurrency and staging proof for reservation-backed export billing

### Phase 48: Route Policy Extraction and Decision Normalization

**Goal:** Refactor the most semantically dense API routes so repeated product-policy logic moves out of route bodies into explicit context, policy, decision, and response modules without changing current business behavior.
**Requirements**: [ROUTE-POLICY-01, ROUTE-POLICY-TEST-01, ROUTE-POLICY-DOC-01]
**Depends on:** Phase 45
**Plans:** 3 plans

Plans:
- [x] 48-01-PLAN.md — Extract session generate route context, policy gates, orchestration, and HTTP mapping into explicit route modules
- [x] 48-02-PLAN.md — Normalize file access and smart-generation route decisions around preview lock, artifact access, and persisted generation outputs
- [x] 48-03-PLAN.md — Thin versions and compare routes, add decision-module regression proof, and document route policy boundaries

### Phase 49: Hardening The Route Decision Architecture

**Goal:** Stabilize the new route decision architecture from Phase 48 so context, policy, decision, and response boundaries stay explicit under continued feature work without changing current product behavior.
**Requirements**: [ROUTE-ARCH-01, ROUTE-ARCH-TEST-01, ROUTE-ARCH-GUARD-01]
**Depends on:** Phase 48
**Plans:** 2 plans

**Success Criteria** (what must be TRUE):
  1. Critical route layers have explicit, enforceable boundaries, and `response.ts` only maps normalized decisions instead of reinterpreting product semantics.
  2. `context.ts` stays focused on typed request resolution, while the hottest route decision modules are either decomposed pragmatically or explicitly documented as monitored hotspots.
  3. Precedence-sensitive route behavior is preserved through seam tests, review guardrails, and architecture docs without changing public route contracts.

Plans:
- [x] 49-01-PLAN.md — Freeze route-boundary docs, review guardrails, and mapper/precedence seam proof
- [x] 49-02-PLAN.md — Refactor the remaining route hotspots while preserving generate, file-access, and smart-generation behavior

### Phase 50: Hotspot Decomposition

**Goal:** Decompose the last semantically dense route decision modules so `smart-generation` and `session-generate` stay orchestration-first without changing public route behavior.
**Requirements**: [HOTSPOT-DEC-01]
**Depends on:** Phase 49
**Plans:** 1/1 plans complete

Plans:
- [x] 50-01-PLAN.md — Refactor smart-generation and session-generate decision hotspots into route-specific helpers with explicit split thresholds

### Phase 51: Invariant Enforcement

**Goal:** Turn preview, signing, compare, and versions contracts into executable invariants with exhaustive decision-to-response mappings.
**Requirements**: [ROUTE-INV-01]
**Depends on:** Phase 50
**Plans:** 1/1 plans complete

Plans:
- [x] 51-01-PLAN.md — Add locked-preview, compare, versions, and decision exhaustiveness invariants across route seams

### Phase 52: Architecture Governance Automation

**Goal:** Enforce critical route architecture through repo-native automation, CI checks, and PR review prompts instead of manual review alone.
**Requirements**: [ROUTE-GOV-01]
**Depends on:** Phase 51
**Plans:** 1/1 plans complete

Plans:
- [x] 52-01-PLAN.md — Add route-architecture audit automation, CI enforcement, and critical-route PR checklist prompts

### Phase 53: Operational Excellence

**Goal:** Add architecture telemetry and operational drill guidance so locked-preview and artifact-access behavior stays observable in staging and production.
**Requirements**: [ROUTE-OPS-01]
**Depends on:** Phase 52
**Plans:** 1/1 plans complete

Plans:
- [x] 53-01-PLAN.md — Instrument architecture telemetry counters and document TTL review plus incident-drill operations

### Phase 54: Architecture Proof Pack

**Goal:** Ship a curated release-proof suite, architecture scorecard, and approved chokepoint map for the sensitive route flows.
**Requirements**: [ROUTE-PROOF-01]
**Depends on:** Phase 53
**Plans:** 1/1 plans complete

Plans:
- [x] 54-01-PLAN.md — Build the architecture proof pack command, scorecard, and approved chokepoints documentation

### Phase 55: Brownfield Route Consolidation And Repo Topology Alignment

**Goal:** Consolidate the winning route architecture and reduce remaining brownfield ambiguity without changing product behavior.
**Requirements**: [ROUTE-CONS-01, ROUTE-CONS-TEST-01, ROUTE-CONS-DOC-01]
**Depends on:** Phase 54
**Plans:** 2/2 plans complete

Plans:
- [x] 55-01-PLAN.md — Canonicalize compare ownership and extract the brownfield comparison route into the route-layer pattern with regression proof
- [x] 55-02-PLAN.md — Refresh README, component-boundary guidance, and route governance artifacts for the consolidated topology

### Phase 56: Governance Enforcement Alignment

**Goal:** Close the remaining governance-level gaps so CI, automation, docs, and curated proof flows match the architecture promises already documented in the repo without changing runtime behavior.
**Requirements**: [ROUTE-GOV-ALIGN-01, ROUTE-GOV-ALIGN-TEST-01, ROUTE-GOV-ALIGN-DOC-01]
**Depends on:** Phase 55
**Plans:** 1/1 plans complete

Plans:
- [x] 56-01-PLAN.md — Align CI, audit scope, proof pack membership, and governance docs with the documented critical-route architecture

### Phase 57: Repository Hygiene And Documentation Cleanup

**Goal:** Remove leftover repo debris, clarify canonical documentation entry points, and keep `.planning/` trustworthy without changing runtime behavior.
**Requirements**: [REPO-HYGIENE-01, REPO-HYGIENE-DOC-01, REPO-HYGIENE-GUARD-01]
**Depends on:** Phase 56
**Plans:** 1/1 plans complete

Plans:
- [x] 57-01-PLAN.md — Remove local planning debris, add narrow hygiene guardrails, and curate architecture/planning doc entry points

### Phase 58: ATS Enhancement Generate File Handoff Hardening

**Goal:** Make the ATS enhancement to `generate_file` handoff explicit, validated, observable, and regression-tested so post-persistence export failures stop collapsing into opaque internal errors.
**Requirements**: [GEN-HANDOFF-01, GEN-HANDOFF-ERR-01, GEN-HANDOFF-TEST-01]
**Depends on:** Phase 57
**Plans:** 1/1 plans complete

Plans:
- [x] 58-01-PLAN.md - Harden the post-ATS generate_file handoff with an explicit intake contract, coherence preflight, typed failures, and seam regression coverage

### Phase 59: Generate Billable Resume Exception Localization And Typed Failure Narrowing

**Goal:** Localize post-preflight billable export failures to explicit downstream stages, narrow expected billable exceptions into typed failures where safe, and preserve stage metadata in logs and metrics without changing export or billing semantics.
**Requirements**: [BILL-DIAG-01, BILL-DIAG-OBS-01, BILL-DIAG-TEST-01]
**Depends on:** Phase 58
**Plans:** 1/1 plans complete

Plans:
- [x] 59-01-PLAN.md - Add explicit billable-stage tracking, stage-aware error narrowing, tool-log propagation, metrics, and regression tests for post-preflight export failures

### Phase 60: Pending Resume Generation Persistence Narrowing

**Goal:** Identify and narrow the pending resume-generation persistence failure path so create vs reuse failures stop collapsing into one broad persistence error and become diagnosable from logs, metrics, and top-level tool failures.
**Requirements**: [PENDING-PERSIST-01, PENDING-PERSIST-OBS-01, PENDING-PERSIST-TEST-01]
**Depends on:** Phase 59
**Plans:** 1/1 plans complete

Plans:
- [x] 60-01-PLAN.md - Split create vs reuse pending-generation persistence, log raw DB failure details, add narrower failure codes, and cover the narrowed seam with regression tests

### Phase 61: Resume Generation Timestamp Persistence Fix

**Goal:** Ensure the `resume_generations` create path always persists `updated_at` explicitly so pending-generation inserts stay aligned with the DB/model timestamp contract.
**Requirements**: [RESUME-GEN-TS-01, RESUME-GEN-TS-ALIGN-01, RESUME-GEN-TS-TEST-01]
**Depends on:** Phase 60
**Plans:** 1/1 plans complete

Plans:
- [x] 61-01-PLAN.md - Align resume-generation create timestamps with the DB contract and prove the create branch persists updated_at explicitly

### Phase 62: Canonical ATS Readiness scoring contract for ATS enhancement flow

**Goal:** Replace ambiguous ATS scoring behavior with a canonical ATS Readiness scoring contract that preserves raw heuristic scoring internally while enforcing a stable, quality-gated, non-decreasing product score for ATS enhancement flows.
**Requirements**: [ATS-READINESS-01, ATS-READINESS-CONF-01, ATS-READINESS-TEST-01]
**Depends on:** Phase 61
**Plans:** 1/1 plans complete

Plans:
- [x] 62-01-PLAN.md - Introduce a canonical ATS Readiness scoring module, separate raw vs displayed scores, enforce monotonic display policy with confidence and quality gates, migrate ATS enhancement UI/API surfaces, and add regression coverage

### Phase 63: Hardening, cleanup, observability, and migration audit for canonical ATS Readiness scoring

**Goal:** Eliminate residual ambiguity around ATS Readiness ownership by centralizing legacy-session fallback, product-surface score sourcing, observability, and migration-safe compatibility handling for the canonical ATS Readiness contract.
**Requirements**: [ATS-READINESS-HARDEN-01, ATS-READINESS-OBS-01, ATS-READINESS-MIGRATION-01]
**Depends on:** Phase 62
**Plans:** 1/1 plans complete

Plans:
- [x] 63-01-PLAN.md - Centralize ATS Readiness fallback resolution, add decision observability, deprecate remaining product-facing legacy score paths, and document/test legacy-session migration safety

### Phase 64: Converter withheld_pending_quality em faixa estimada numerica no ATS Readiness Score (UI em pt-BR)

**Goal:** Convert ATS enhancement results that previously surfaced as withheld/pending scores into short estimated numeric ranges so the main product flow always shows an exact score or a monotonic estimated range in pt-BR without reopening the canonical ATS Readiness architecture.
**Requirements**: [ATS-READINESS-RANGE-01, ATS-READINESS-RANGE-OBS-01, ATS-READINESS-RANGE-TEST-01]
**Depends on:** Phase 63
**Plans:** 1/1 plans complete

Plans:
- [x] 64-01-PLAN.md - Extend the canonical ATS Readiness contract with exact-vs-range display semantics, convert withheld outcomes into short numeric ranges, preserve observability, normalize pt-BR product copy, and add regression coverage for no-empty-score behavior

### Phase 65: Versionamento explicito do contrato ATS Readiness e cleanup interno final

**Goal:** Promote the ATS Readiness product contract to an explicit v2, normalize legacy readiness payloads into the v2 shape centrally, reduce ambiguous residual `atsScore` references, and align agent/streaming language with the current canonical readiness semantics.
**Requirements**: [ATS-READINESS-V2-01, ATS-READINESS-V2-COMPAT-01, ATS-READINESS-V2-CLEANUP-01]
**Depends on:** Phase 64
**Plans:** 1/1 plans complete

Plans:
- [x] 65-01-PLAN.md - Promote ATS Readiness to contract v2, normalize legacy contracts centrally, isolate raw atsScore as internal-only telemetry, align agent copy, and add compatibility regression coverage

### Phase 66: Cleanup final do raw ATS interno e consolidacao definitiva de nomenclatura

**Goal:** Reduce the remaining semantic ambiguity around legacy raw ATS diagnostics by renaming internal `atsScore` usage to explicit heuristic-diagnostic names, isolating compatibility adapters, and reinforcing the boundary between internal ATS telemetry and the ATS Readiness v2 product contract.
**Requirements**: [ATS-RAW-CLEANUP-01, ATS-RAW-CLEANUP-COMPAT-01, ATS-RAW-CLEANUP-TEST-01]
**Depends on:** Phase 65
**Plans:** 1/1 plans complete

Plans:
- [x] 66-01-PLAN.md - Rename internal raw ATS score seams to explicit heuristic-diagnostic names, keep legacy adapters compatibility-only, and add regression coverage so product paths stay on ATS Readiness v2

### Phase 67: Estabilizacao pos-refactor do ATS Readiness

**Goal:** Add production-oriented stabilization hooks after the ATS Readiness refactor by measuring compatibility-field emission, documenting the semantic boundary for onboarding, and keeping sunset decisions data-driven without reopening the scoring contract.
**Requirements**: [ATS-STABILIZE-OBS-01, ATS-STABILIZE-DOC-01, ATS-STABILIZE-TEST-01]
**Depends on:** Phase 66
**Plans:** 1/1 plans complete

Plans:
- [x] 67-01-PLAN.md - Add compat-field telemetry, publish a short ATS Readiness boundary note, and cover the stabilization seam with regression tests

### Phase 68: Hardening do rewrite ATS para preservar e promover metricas reais de impacto

**Goal:** Prevent ATS enhancement rewrites from diluting strong quantified impact in the original resume by preserving premium metric bullets, detecting editorial regressions, and reinforcing rewrite prompts plus validation around factual measurable outcomes.
**Requirements**: [ATS-METRIC-PRESERVE-01, ATS-METRIC-PRESERVE-GATE-01, ATS-METRIC-PRESERVE-TEST-01]
**Depends on:** Phase 67
**Plans:** 1/1 plans complete

Plans:
- [x] 68-01-PLAN.md - Add premium metric-bullet detection, metric-regression validation, stronger rewrite guardrails, and regression coverage for quantified ATS rewrite preservation

### Phase 69: Observabilidade editorial para preservacao de metricas reais no rewrite ATS

**Goal:** Make the Phase 68 editorial metric-preservation guard measurable in production by emitting safe structured events and counters for premium-bullet detection, metric regressions, recovery-path selection, and final preservation outcomes in ATS enhancement flows.
**Requirements**: [ATS-METRIC-OBS-01, ATS-METRIC-OBS-RECOVERY-01, ATS-METRIC-OBS-TEST-01]
**Depends on:** Phase 68
**Plans:** 1/1 plans complete

Plans:
- [x] 69-01-PLAN.md - Add centralized editorial observability for premium-bullet detection, regression diagnosis, recovery-path selection, and final preservation outcomes without leaking resume content

### Phase 70: Corrigir persistencia da edicao manual no preview do curriculo e alinhar preview reedicao e export

**Goal:** Fix the manual resume editing consistency seam so preview edits persist canonically, rehydration reads the latest saved draft, and export no longer serves stale artifacts after manual changes.
**Requirements**: [MANUAL-EDIT-CANON-01, MANUAL-EDIT-EXPORT-01, MANUAL-EDIT-OBS-01]
**Depends on:** Phase 69
**Plans:** 1/1 plans complete

Plans:
- [x] 70-01-PLAN.md - Align preview editing with the canonical resume owner, persist manual edits durably, invalidate stale artifacts, regenerate export from the edited source, and cover the disappearing-edit regression

### Phase 71: Highlight visual inteligente das melhorias no preview otimizado do curriculo

**Goal:** Add a preview-only, subtle green highlight layer to the optimized resume comparison so users can quickly see meaningful ATS/content improvements without polluting the original, export artifacts, or persisted resume state.
**Requirements**: [OPT-PREVIEW-HILITE-01, OPT-PREVIEW-HILITE-GUARD-01, OPT-PREVIEW-HILITE-TEST-01]
**Depends on:** Phase 70
**Plans:** 1/1 plans complete

Plans:
- [x] 71-01-PLAN.md - Add a selective semantic highlight helper for optimized preview content, render subtle green emphasis only on meaningful changes in the optimized column, and cover relevance-vs-noise regressions without touching export or persistence

### Phase 72: Padronizar nome inteligente dos arquivos exportados por tipo de fluxo

**Goal:** Centralize intelligent export filenames so ATS exports use `Curriculo_{Nome}` while job-targeted exports append a reliable normalized target role, and propagate that canonical filename through file/download surfaces without touching resume content.
**Requirements**: [EXPORT-FILENAME-01, EXPORT-FILENAME-CANON-01, EXPORT-FILENAME-TEST-01]
**Depends on:** Phase 71
**Plans:** 1/1 plans complete

Plans:
- [x] 72-01-PLAN.md - Add centralized filename normalization/build helpers, expose canonical export filenames from the file access route, update preview/download consumers to use them, and cover ATS vs job-targeting naming regressions

### Phase 72.1: Refinar o template de export em PDF para um layout mais premium e ATS-safe, usando a mesma fonte do preview (INSERTED)

**Goal:** Refine the exported PDF resume template into a more premium, executive-looking layout while keeping the document single-column, ATS-safe, and visually consistent with the in-product preview by reusing the same Inter font family.
**Requirements**: [PDF-TEMPLATE-PREMIUM-01, PDF-TEMPLATE-FONT-01, PDF-TEMPLATE-TEST-01]
**Depends on:** Phase 72
**Plans:** 1/1 plans complete

Plans:
- [x] 72.1-01-PLAN.md - Embed the preview font in the PDF export, refine hierarchy/spacing in the single-column template, and update export tests so the PDF stays ATS-safe while looking more premium

### Phase 73: Recalibrar o highlight verde do preview otimizado para reduzir ruido visual e destacar apenas melhorias com sentido completo

**Goal:** Recalibrate optimized-preview highlights so the green emphasis favors short semantic chunks and materially improved premium bullets instead of fragmented single-word token diffs, keeping the preview cleaner and more persuasive without touching export or persistence.
**Requirements**: [OPT-PREVIEW-HILITE-CALIBRATION-01, OPT-PREVIEW-HILITE-CALIBRATION-STYLE-01, OPT-PREVIEW-HILITE-CALIBRATION-TEST-01]
**Depends on:** Phase 72
**Plans:** 1/1 plans complete

Plans:
- [x] 73-01-PLAN.md - Raise highlight thresholds, group meaningful additions into short semantic chunks, preserve premium whole-line bullet cases, soften the visual treatment, and add regression coverage against noisy single-word highlights

### Phase 74: Corrigir bloqueio indevido de edição manual por exportação e restaurar confiabilidade do download do arquivo

**Goal:** Ensure manual resume edits no longer fall into an export deadlock by narrowing real export conflicts, preserving a still-valid artifact while a same-scope export is active, and keeping save/download states actionable instead of leaving the user unable to save or download.
**Requirements**: [MANUAL-EXPORT-LOCK-01, MANUAL-EXPORT-UX-01, MANUAL-EXPORT-TEST-01]
**Depends on:** Phase 73
**Plans:** 1/1 plans complete

Plans:
- [x] 74-01-PLAN.md - Narrow export conflict policy to the current session scope, keep the previous artifact available when a real same-scope export is already active during manual save, treat post-save export conflicts as saved-but-deferred in the editor UX, add observability for save/download conflict states, and cover the real deadlock regression with route and modal tests
