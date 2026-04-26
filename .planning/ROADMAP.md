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

### Phase 75: Code review e hardening por testes do fluxo de edição manual vs export ativo

**Goal:** Critically review the Phase 74 manual-edit versus active-export policy, make the stale-artifact state explicit across route/UI/download surfaces, and harden the dangerous edge cases through stronger tests before treating the flow as settled.
**Requirements**: [MANUAL-EXPORT-REVIEW-01, MANUAL-EXPORT-REVIEW-TEST-01, MANUAL-EXPORT-REVIEW-OBS-01]
**Depends on:** Phase 74
**Plans:** 1/1 plans complete

Plans:
- [x] 75-01-PLAN.md - Review the Phase 74 policy, expose stale-artifact state explicitly to file access and preview surfaces, harden manual-save versus active-export tests, and document the resulting state machine plus residual risks

### Phase 76: Adicionar ícone de ajuda no badge Estimado com explicação curta do contexto do ATS

**Goal:** Make the `Estimado` ATS Readiness badge self-explanatory by adding a compact help affordance that explains why the score is shown as a range without leaking internal scoring jargon.
**Requirements**: [ATS-ESTIMATED-HELP-01, ATS-ESTIMATED-HELP-TEST-01]
**Depends on:** Phase 75
**Plans:** 1/1 plans complete

Plans:
- [x] 76-01-PLAN.md - Add a shared estimated-score help badge with accessible tooltip behavior, wire it into ATS readiness surfaces that render `Estimado`, and cover display plus interaction regressions

### Phase 77: Corrigir encoding no PDF, alinhar datas ? direita na experi?ncia e reduzir o tooltip do badge Estimado

**Goal:** Eliminate broken glyphs in PDF export, move experience dates into a right-aligned same-line header beside the role title, and shrink the `Estimado` badge tooltip into a lighter contextual help affordance.
**Requirements**: [PDF-EXPORT-ENCODING-01, PDF-EXPERIENCE-HEADER-01, ATS-ESTIMATED-TOOLTIP-01, PDF-EXPORT-ENCODING-TEST-01]
**Depends on:** Phase 76
**Plans:** 1/1 plans complete

Plans:
- [x] 77-01-PLAN.md - Replace the PDF font embedding with a broader Inter asset plus deterministic text sanitization, render experience periods on the same header line as the role title with right alignment, reduce the estimated-score tooltip footprint, and harden PDF plus badge regression coverage

### Phase 78: Per-request Prisma query counting with N+1 threshold detection

**Goal:** Add request-scoped DB query counting with threshold-based N+1 suspicion logging for the highest-value API routes so we can detect abnormal PostgREST/DB fan-out without changing route contracts or business behavior.
**Requirements**: [DB-QUERY-OBS-01, DB-QUERY-OBS-02, DB-QUERY-TEST-01]
**Depends on:** Phase 77
**Plans:** 1/1 plans complete

Plans:
- [x] 78-01-PLAN.md - Add AsyncLocalStorage-backed request query context, instrument the live Supabase/PostgREST seam, wrap the priority API routes, and harden the feature with threshold/logging regression tests

### Phase 79: Decouple experience rendered highlight from diff and make diff score-only

**Goal:** Refactor optimized experience highlights so original-vs-optimized diff only drives improvement scoring, gating, and change indicators, while the rendered highlight span is selected from optimized bullet structure and contextual evidence alone.
**Requirements**: [EXP-HILITE-SPLIT-01, EXP-HILITE-SPLIT-GATE-01, EXP-HILITE-SPLIT-TEST-01]
**Depends on:** Phase 78
**Plans:** 1/1 plans complete

Plans:
- [x] 79-01-PLAN.md - Split experience highlight logic into diff-aware improvement gating plus optimized-text-first span selection, preserve preview contracts, and add regressions for structural spans and zero-highlight bullets

### Phase 81: Calibrate experience span candidate taxonomy and ranking after diff render split

**Goal:** Calibrate optimized-text-first experience span selection so candidate taxonomy, filtering, and ranking consistently prefer structural evidence over narrative phrasing while preserving compact, domain-agnostic highlights.
**Requirements**: [EXP-HILITE-TAXONOMY-01, EXP-HILITE-RANKING-01, EXP-HILITE-TAXONOMY-TEST-01]
**Depends on:** Phase 79
**Plans:** 1/1 plans complete

Plans:
- [x] 81-01-PLAN.md - Re-rank experience span candidates by structural taxonomy, filter weak standalone spans, preserve compact caps, and add regressions proving metrics/scope/contextual stacks beat narrative phrasing

### Phase 80: Repeated query fingerprinting for stronger N+1 detection

**Goal:** Extend request-scoped DB tracking with repeated normalized request-pattern aggregation so high-count requests can surface stronger N+1 suspicion signals without changing route behavior.
**Requirements**: [DB-FP-OBS-01, DB-FP-OBS-02, DB-FP-TEST-01]
**Depends on:** Phase 79
**Plans:** 1/1 plans complete

Plans:
- [x] 80-01-PLAN.md - Add conservative query fingerprint normalization, aggregate repeated request patterns per request, enrich warning payloads with repetition diagnostics, and harden the behavior with focused tests

### Phase 82: Small tuning for contextual_stack recovery and span completeness in experience highlights

**Goal:** Recover obvious contextual stack winners and improve compact span completeness so rendered experience highlights stay structurally strong while avoiding weak truncated tails.
**Requirements**: [EXP-HILITE-STACK-01, EXP-HILITE-COMPLETE-01, EXP-HILITE-COMPLETE-TEST-01]
**Depends on:** Phase 81
**Plans:** 1/1 plans complete

Plans:
- [x] 82-01-PLAN.md - Recover strong contextual stack clusters, trim dangling connector tails, slightly complete compact metric and scope spans, and add focused regressions without reopening diff-aware gating

### Phase 83: Small Phase 83 - improve completeness of metric and scope/scale highlight spans

**Goal:** Improve the visual completeness of metric and scope/scale experience highlights so winners stay compact but read as complete evidence phrases rather than clipped fragments.
**Requirements**: [EXP-HILITE-METRIC-COMPLETE-01, EXP-HILITE-SCOPE-COMPLETE-01, EXP-HILITE-METRIC-COMPLETE-TEST-01]
**Depends on:** Phase 82
**Plans:** 1/1 plans complete

Plans:
- [x] 83-01-PLAN.md - Add tightly bounded completion rules for metric and scope/scale winners, preserve compactness and zero-highlight behavior, and add regressions for readable evidence phrases without narrative drift

### Phase 84: Generalize metric and scope scale span completion beyond current phrase shapes

**Goal:** Generalize metric and scope/scale span completion so rendered experience highlights stay compact and readable across different resume segments and phrasing styles instead of depending on the previous batch's phrase shapes.
**Requirements**: [EXP-HILITE-GENERALIZE-01, EXP-HILITE-GENERALIZE-02, EXP-HILITE-GENERALIZE-TEST-01]
**Depends on:** Phase 83
**Plans:** 1/1 plans complete

Plans:
- [x] 84-01-PLAN.md - Replace narrow completion shapes with reusable local phrase-structure rules for metric and scope/scale spans, add cross-domain regressions, and verify that compactness and zero-highlight behavior remain intact

### Phase 85: Fix ATS enhancement gates for summary clarity and keyword visibility

**Goal:** Correct ATS enhancement quality gates so concise but structurally stronger summaries and genuinely reinforced ATS keywords can pass final readiness without depending on length bias or the weak no-JD keyword proxy.
**Requirements**: [ATS-GATE-SUMMARY-01, ATS-GATE-KEYWORDS-01, ATS-GATE-TEST-01]
**Depends on:** Phase 84
**Plans:** 1/1 plans complete

Plans:
- [x] 85-01-PLAN.md - Replace the summary-length gate with structural clarity checks, emit explicit ATS keyword visibility signals during ats_enhancement, keep the no-JD fallback as backup only, and add focused readiness/pipeline regressions

### Phase 86: Introduce evidence-tiered presentation for experience highlights

**Goal:** Preserve the stabilized experience selector while introducing visual evidence tiers so stronger ATS evidence keeps premium inline emphasis and contextual evidence stops looking editorially equivalent.
**Requirements**: [EXP-TIER-RENDER-01, EXP-TIER-RENDER-02, EXP-TIER-RENDER-TEST-01]
**Depends on:** Phase 85
**Plans:** 1/1 plans complete

Plans:
- [x] 86-01-PLAN.md - Carry winner category/tier through the preview contract, keep strong inline treatment for metric/scope evidence, render contextual evidence with secondary emphasis, and add focused motor/UI regressions without retuning the selector

### Phase 87: Formalize experience-entry highlight surfacing policy as an explicit code layer

**Goal:** Formalize an explicit, testable experience-entry surfacing layer so visible optimized-preview highlights follow editorial evidence priority within each experience entry instead of relying on incidental bullet order or generic score side effects.
**Requirements**: [EXP-HILITE-SURFACING-01, EXP-HILITE-SURFACING-PRIORITY-01, EXP-HILITE-SURFACING-TEST-01]
**Depends on:** Phase 86
**Plans:** 1/1 plans complete

Plans:
- [x] 87-01-PLAN.md - Formalize the same-entry visible highlight selector as explicit Layer 3, preserve caps/contracts, and add focused editorial surfacing regressions (completed 2026-04-21)

### Phase 88: Harden experience-entry highlight surfacing with explicit policy constant, edge-case tests, and debug observability

**Goal:** Harden the new experience-entry surfacing layer so its editorial policy, cap contract, edge-case behavior, and debug traceability are explicit and durable without reopening selector, completion, tier-rendering, or ATS behavior.
**Requirements**: [EXP-HILITE-SURFACING-HARDEN-01, EXP-HILITE-SURFACING-HARDEN-TEST-01, EXP-HILITE-SURFACING-HARDEN-OBS-01]
**Depends on:** Phase 87
**Plans:** 1/1 plans complete

Plans:
- [x] 88-01-PLAN.md - Harden the same-entry Layer 3 selector with explicit policy constants, direct edge-case coverage, and debug-only surfacing observability (completed 2026-04-21)

### Phase 89: Validate SSR safety of debug flag and constant coupling in experience-entry surfacing layer

**Goal:** Validate the real execution context and test coupling around the Phase 88 same-entry surfacing hardening so SSR/debug-flag assumptions and exported-policy usage are explicit, safe, and regression-proof without changing editorial behavior.
**Requirements**: [EXP-HILITE-SAFETY-SSR-01, EXP-HILITE-SAFETY-COUPLING-01, EXP-HILITE-SAFETY-VALIDATION-01]
**Depends on:** Phase 88
**Plans:** 1/1 plans complete

Plans:
- [x] 89-01-PLAN.md - Validate the mixed render-context debug semantics and audit exported-policy constant usage in tests without changing Layer 3 behavior (completed 2026-04-21)

### Phase 90: Instrument and aggregate summary-clarity recovery paths that fall back to estimated_range

**Goal:** Make the ATS enhancement summary recovery path explicitly measurable by emitting one self-contained session-level observability event that ties summary recovery semantics to the final score outcome, especially when summary clarity still fails and the product falls back to `estimated_range`.
**Requirements**: [ATS-SUMMARY-CLARITY-OBS-01, ATS-SUMMARY-CLARITY-CONVERGENCE-01, ATS-SUMMARY-CLARITY-TEST-01]
**Depends on:** Phase 89
**Plans:** 1/1 plans complete

Plans:
- [x] 90-01-PLAN.md - Emit a session-level ATS summary clarity outcome event at the latest safe convergence point, with explicit booleans and focused observability tests (completed 2026-04-21)

### Phase 91: Fix validation_recovered log level and surface warn signal at summary_clarity_outcome

**Goal:** Correct the ATS enhancement log semantics so healthy recoveries stop emitting `warn`, while the confirmed problematic smart-repair-to-clarity-fail path surfaces as the only `warn` signal through `summary_clarity_outcome`.
**Requirements**: [ATS-SUMMARY-LOGLEVEL-01, ATS-SUMMARY-WARN-SIGNAL-01, ATS-SUMMARY-LOGLEVEL-TEST-01]
**Depends on:** Phase 90
**Plans:** 1/1 plans complete

Plans:
- [x] 91-01-PLAN.md - Reclassify ATS summary recovery log levels so `validation_recovered` is informational and only the confirmed `summaryRepairThenClarityFail` path emits `warn` (completed 2026-04-21)

### Phase 92: Layer 1 evidence scoring: make preserved strong metrics eligible for highlight

**Goal:** Make Layer 1 highlight eligibility depend on editorial evidence strength in the optimized bullet, so preserved strong metrics remain eligible even when original-vs-optimized improvement delta is small.
**Requirements**: [EXP-HILITE-EVIDENCE-01, EXP-HILITE-EVIDENCE-ELIGIBILITY-01, EXP-HILITE-EVIDENCE-TEST-01]
**Depends on:** Phase 91
**Plans:** 1/1 plans complete

Plans:
- [x] 92-01-PLAN.md - Add explicit Layer 1 evidence scoring and independent eligibility thresholds while preserving Layer 2/Layer 3 ownership (completed 2026-04-21)

### Phase 93: Summary editorial hardening: reduce repetition and increase information density in ATS enhancement preview

**Goal:** Harden the ATS enhancement summary rewrite so optimized summaries become less repetitive, more information-dense, and more strongly positioned in the opening line without changing ATS gates, scoring policy, or export behavior.
**Requirements**: [ATS-SUMMARY-EDITORIAL-01, ATS-SUMMARY-DENSITY-01, ATS-SUMMARY-EDITORIAL-TEST-01]
**Depends on:** Phase 92
**Plans:** 1/1 plans complete

Plans:
- [x] 93-01-PLAN.md - Harden summary anti-repetition, information density, and first-line positioning while preserving ATS pipeline safety (completed 2026-04-22)

### Phase 94: Promote core contextual stack evidence in preview highlights without reopening Phase 92

**Goal:** Promote strong contextual stack evidence in preview highlights so real execution-centric stack bullets can compete better without weakening preserved metrics or changing Layer 3 editorial policy.
**Requirements**: [EXP-HILITE-STACK-CONTEXT-01, EXP-HILITE-STACK-COMPETE-01, EXP-HILITE-STACK-TEST-01]
**Depends on:** Phase 93
**Plans:** 1/1 plans complete

Plans:
- [x] 94-01-PLAN.md - Promote core contextual stack evidence while preserving metric dominance, Layer 3 policy, and stack-only suppression (completed 2026-04-22)

### Phase 95: Replace deterministic preview highlights with persisted single-call LLM highlight artifacts

**Goal:** Persist one-shot LLM-generated highlight artifacts separately from `optimizedCvState` so ATS enhancement and job-targeting previews render validated item-local highlights without deterministic client heuristics or legacy metric-preservation preview state.
**Requirements**: [P95-HILITE-ARTIFACT-01, P95-HILITE-PIPELINE-01, P95-HILITE-RENDER-TEST-01]
**Depends on:** Phase 94
**Success Criteria** (what must be TRUE):
  1. ATS enhancement and job-targeting persist a separate `highlightState` artifact for the finalized optimized resume, and exactly one detector call is made per successful rewrite payload.
  2. Invalid highlight ranges fail closed locally, rollback/reset flows restore or clear `highlightState` with `optimizedCvState`, and locked previews do not leak highlight metadata.
  3. Session/comparison responses and the resume comparison renderer consume persisted highlights directly, while the deterministic preview helper and legacy metric-preservation preview code are removed with regression proof.
**Plans:** 1/1 plans complete

Plans:
- [x] 95-01-PLAN.md — Add persisted highlight contracts, single-call detector lifecycle, thin route serialization, renderer migration, and legacy preview cleanup (completed 2026-04-22)

### Phase 96: Harden highlight artifact safety, observability, and semantic stability

**Goal:** Harden persisted highlight artifacts around segmentation safety, invalid-payload observability, and stable item identity so preview consumers stay deterministic and fail closed.
**Requirements**: [HILITE-SAFETY-01, HILITE-OBS-01, HILITE-STABILITY-01]
**Depends on:** Phase 95
**Plans:** 1/1 plans complete

Plans:
- [x] 96-01-PLAN.md - Harden highlight segmentation safety, invalid-payload observability, and stable highlight identity contracts without reopening renderer architecture (completed 2026-04-22)

### Phase 97: Close CV highlight logic with hybrid editorial resolver

**Goal:** Close the remaining CV highlight span gap by hardening detector editorial guidance first and only adding minimal artifact-side resolver logic for prompt-proven residual weak-start or under-closure cases.
**Requirements**: [CV-HILITE-EDITORIAL-01, CV-HILITE-RESOLVER-01, CV-HILITE-SHARED-SMOKE-01]
**Depends on:** Phase 95
**Plans:** 1 plan

Plans:
- [ ] 97-01-PLAN.md — Harden prompt-first highlight selection, add minimal deterministic resolver only if residual gaps remain, and prove shared persisted-highlight seams stay unchanged

### Phase 98: Resolve CV highlight truncation with hybrid text-anchored detector contract

**Goal:** Replace fragile numeric-only highlight offsets with fragment-first structured detection and deterministic local text anchoring while keeping persisted highlight state unchanged.
**Requirements**: [CV-HILITE-TEXT-ANCHOR-01, CV-HILITE-STRUCTURED-OUTPUT-01, CV-HILITE-SHARED-REGRESSION-01]
**Depends on:** Phase 97
**Plans:** 1 plan

Plans:
- [ ] 98-01-PLAN.md - Return exact highlight fragments plus nullable fallback offsets, resolve fragment -> range locally, and prove shared persisted-highlight seams stay unchanged

### Phase 99: Adaptar a UI de profile do currículo para layout CRM preservando 100% da lógica e funcionalidade existente

**Goal:** Adapt the resume profile page into the approved clean CRM-style layout while preserving the exact existing profile, import, edit, save, enhancement, validation, download, routing, and toast behavior already implemented in `src/components/resume/user-data-page.tsx`.
**Requirements**: [RESUME-PROFILE-CRM-01, RESUME-PROFILE-EDIT-01, RESUME-PROFILE-TEST-01]
**Depends on:** Phase 98
**Plans:** 1 plan

Plans:
- [ ] 99-01-PLAN.md — Replace the profile shell with CRM cards, wire section edit buttons into the real editor, and preserve only real download behavior

### Phase 100: Clarify ATS enhancement intent selector while preserving target-job generation behavior

**Goal:** Clarify the ATS enhancement panel so users explicitly choose between general ATS improvement and target-job adaptation before generation, while preserving the existing handler, endpoint selection, dialogs, toasts, loading states, credits behavior, and compare-page handoff.
**Requirements**: [ATS-INTENT-UI-01, ATS-INTENT-GUARD-01, ATS-INTENT-TEST-01]
**Depends on:** Phase 99
**Plans:** 1 plan

Plans:
- [x] 100-01-PLAN.md - Add a UI-only enhancement intent selector, preserve `generationMode` as the behavior seam, refresh the enhancement-panel layout, and add focused unit/browser regression coverage without changing backend generation contracts

### Phase 101: Connect the existing resume history UI to real generated artifacts and protected access

**Goal:** Reuse the existing `Currículos recentes` dashboard surface and back it with durable generation-history metadata, authenticated pagination, protected PDF access, and viewer/open actions without rewriting the current generation or billing architecture.
**Requirements**: [RESUME-HISTORY-PERSIST-01, RESUME-HISTORY-ACCESS-01, RESUME-HISTORY-UI-01, RESUME-HISTORY-TEST-01]
**Depends on:** Phase 100
**Plans:** 1 plan

Plans:
- [x] 101-01-PLAN.md - Extend `resume_generations` with history metadata, expose the latest 6 owned records through a protected paginated API, adapt the existing history UI to real data and actions, and add focused service/API/UI regression coverage

### Phase 102: Restrict AI chat access to active Pro subscribers across UI and API

**Goal:** Guarantee that only authenticated users with active Pro entitlement can access the AI chat UI and API surfaces, using server-side authorization over the existing billing metadata.
**Requirements**: [CHAT-PRO-UI-01, CHAT-PRO-API-01, CHAT-PRO-TEST-01]
**Depends on:** Phase 101
**Plans:** 1 plan

Plans:
- [x] 102-01-PLAN.md - Restrict AI chat access to active Pro subscribers across UI and API with one centralized authorization seam, blocked-state UI, protected session/history routes, and focused regression coverage

### Phase 103: Alinhar preço e créditos dos planos Mensal e Pro entre UI, billing e testes

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 102
**Plans:** 1 plan

Plans:
- [ ] 103-01-PLAN.md - Align canonical Monthly and Pro values, localize displayed price formatting, remove pricing-table drift, and refresh focused billing and UI regressions

### Phase 104: Warn before job target generation when vacancy match is weak and require user confirmation to continue

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 103
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 104 to break down)

### Phase 105: Refinar career fit de warning booleano para avaliacao graduada com risco low medium high e gating contextual

**Goal:** Replace the rigid boolean weak-fit warning with a graduated career-fit risk evaluation that distinguishes adjacent versus distant role moves, warns on medium and high risk, and only requires explicit override for structurally high-risk targeting.
**Requirements**: [CAREER-FIT-RISK-01, CAREER-FIT-GATE-01, CAREER-FIT-TEST-01]
**Depends on:** Phase 104
**Plans:** 0 plans

**Success Criteria** (what must be TRUE):
  1. Career fit is no longer treated primarily as a boolean mismatch; the agent persists a structured low/medium/high evaluation with explainable signals and compatible fallback surfaces.
  2. Adjacent profile moves such as BI/data candidates targeting analytics-oriented roles no longer trigger the same hard behavior as distant family jumps, while distant plus weak-signal cases still surface strong protection.
  3. The agent loop, prompt guardrail, and committed tests prove that medium risk warns without blocking, high risk requires explicit confirmation before generation, and existing compatibility contracts stay intact.

Plans:
- [ ] TBD (run /gsd-plan-phase 105 to break down)

### Phase 106: Refatorar o pipeline job_targeting para validacao por severidade e extracao de cargo semantica

**Goal:** Corrigir os falsos positivos e o bloqueio excessivo do `job_targeting` ao tornar a validacao compartilhada sensivel a severidade, preservar explicitamente o isolamento do `ats_enhancement`, e substituir o fallback fraco de cargo alvo por extracao semantica em camadas.
**Requirements**: [JOB-TARGET-VAL-01, JOB-TARGET-ROLE-01, JOB-TARGET-ATS-ISO-01, JOB-TARGET-TEST-01]
**Depends on:** Phase 105
**Plans:** 1 plan

**Success Criteria** (what must be TRUE):
  1. `validateRewrite` continua seguro para `ats_enhancement`, usa o curriculo original inteiro como ancora de evidencia para a Regra 8, e retorna um contrato com `blocked`, `hardIssues`, `softWarnings`, e alias de compatibilidade sem quebrar consumidores ATS.
  2. O pipeline `job_targeting` salva a versao quando so houver warnings de severidade media, persiste esses warnings no estado e sinaliza extracao de cargo com baixa confianca sem abortar a execucao.
  3. `buildTargetingPlan` continua heuristico como camada zero, chama LLM apenas quando a heuristica falha, registra a origem da extracao, e nao adiciona nenhuma lista hardcoded nova de cargos.
  4. Os arquivos compartilhados tocados documentam explicitamente por que o fluxo `ats_enhancement` nao foi afetado, e testes cobrindo ambos os modos passam.

Plans:
- [x] 106-01-PLAN.md - Isolar a validacao compartilhada por severidade, liberar soft warnings no job_targeting, adicionar extracao semantica de target role em camadas, e provar por testes e artefatos que o ATS continua intacto

### Phase 107: Harden highlight de job_targeting com origem rastreável e gate auditado

**Goal:** Garantir que o highlight do `job_targeting` seja gerado, persistido e servido com origem rastreável, sem poluir keywords com placeholders de baixa confiança e sem alterar o comportamento validado do highlight ATS.
**Requirements**: [JOB-TARGET-HILITE-ORIGIN-01, JOB-TARGET-HILITE-GATE-01, JOB-TARGET-HILITE-KEYWORDS-01, JOB-TARGET-HILITE-TEST-01]
**Depends on:** Phase 106
**Plans:** 1 plan

**Success Criteria** (what must be TRUE):
  1. O mapeamento do gate, das keywords e da exposição ao cliente fica documentado e alinhado ao código real antes das mudanças estruturais.
  2. O artefato `highlightState` passa a carregar origem e timestamp de geração sem mudar o comportamento visual ou editorial do ATS.
  3. O `job_targeting` não usa `Vaga Alvo` como keyword de highlight em cenários de baixa confiança e emite observabilidade suficiente para explicar quando o highlight roda ou é pulado.
  4. Os testes cobrem geração normal, rollback, reexecução idêntica, baixa confiança e a continuidade do ATS sem regressões.

Plans:
- [ ] 107-01-PLAN.md - Auditar o fluxo atual do highlight, adicionar metadado de origem ao artefato compartilhado, endurecer gate e keywords do job_targeting, e provar por testes que o ATS continua intacto
