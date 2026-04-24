---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: milestone
current_phase: 94
current_phase_name: promote core contextual stack evidence in preview highlights without reopening phase 92
current_plan: 01 complete
status: phase_complete
stopped_at: Completed 94-01-PLAN.md
last_updated: "2026-04-24T09:54:10.0000000-03:00"
last_activity: 2026-04-24
progress:
  total_phases: 57
  completed_phases: 11
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.
**Current focus:** ATS summary rewrites are now denser and less repetitive, and preview highlights better surface execution-backed contextual stack evidence without weakening preserved metrics or changing Layer 3 ordering.

## Current Position

Phase: 94 (promote core contextual stack evidence in preview highlights without reopening phase 92) - COMPLETE
Plan: 01 complete
Current Phase: 94
Current Phase Name: promote core contextual stack evidence in preview highlights without reopening phase 92
Current Plan: 01 complete
Total Plans in Phase: 1
Status: Phase complete - verified locally
Last activity: 2026-04-24
Last Activity Description: Quick task 260424-dpi fixed the production build type mismatch between /chat and the optional billing surface contract

Progress: [##########] 100%

## Performance Metrics

Baseline carried forward from earlier shipped milestones:

- Total plans completed: 87
- Milestones archived: 5

## Accumulated Context

### Roadmap Evolution

- Phase 99 added: Adaptar a UI de profile do currículo para layout CRM preservando 100% da lógica e funcionalidade existente.
- Phase 100 added: Clarify ATS enhancement intent selector while preserving target-job generation behavior.
- Phase 100 completed: ATS enhancement now has an explicit intent selector, local accessible empty-target validation, and focused unit/browser proof while preserving the existing generation contracts.
- Phase 97 added: Close CV highlight logic with hybrid editorial resolver.
- Phase 95 added: Replace deterministic preview highlights with persisted single-call LLM highlight artifacts.
- Phase 93 added: Summary editorial hardening to reduce repetition and increase information density in ATS enhancement preview.
- Phase 94 added: Promote core contextual stack evidence in preview highlights without reopening Phase 92.
- Phase 93 completed: ATS enhancement summaries now enforce stronger first-line positioning, anti-repetition, and additive second-sentence density without changing ATS scoring or export behavior.
- Phase 94 completed: execution-backed contextual stack evidence now surfaces more competitively in preview highlights while stack-only mentions stay suppressed and preserved metrics remain dominant.
- v1.6 remained focused on async runtime hardening first, then route-architecture hardening for sensitive surfaces.
- Phase 48 extracted explicit route context, policy, decision, and response seams.
- Phase 49 hardened those seams with boundary docs, seam tests, and hotspot guardrails.
- Phase 50 completed: smart-generation and session-generate decision hotspots are now decomposed into route-specific orchestration helpers.
- Phase 51 completed: locked preview, compare, versions, and response mappings now have executable invariants and exhaustive seams.
- Phase 52 completed: route architecture anti-patterns are enforced by CI audit and PR checklist prompts.
- Phase 53 completed: architecture telemetry counters and incident drill docs now cover locked and artifact-available flows.
- Phase 54 completed: a curated architecture proof pack, scorecard, and approved chokepoint map now gate sensitive route behavior.
- Phase 55 completed: compare ownership is canonicalized, comparison is extracted into route layers, and repo-topology docs now match the current architecture.
- Phase 56 completed: CI now runs the architecture proof pack, the audit enforces compare/comparison/versions seams, and governance docs reflect the enforced critical-route surface.
- Phase 57 completed: temporary planning/debug leftovers are cleaned up, architecture docs have a canonical index, and planning hygiene rules are now documented.
- Phase 58 completed: the ATS enhancement to generate_file handoff now validates authoritative source coherence before export, preserves typed precondition failures, and is regression-tested across smart-generation and preview-lock flows.

### Decisions

- Keep critical route hardening route-specific; do not build a generic route framework.
- Preserve public behavior while reducing semantic density.
- Treat preview-lock, replay, compare, versions, and file-access contracts as executable invariants.
- Enforce obvious route anti-patterns in CI instead of relying on review memory.
- Use a curated proof pack rather than the entire test suite as the release-facing architecture gate.
- [Phase 55]: Keep POST /api/session/[id]/compare as the canonical compare seam; keep GET /api/session/[id]/comparison compatibility-only.
- [Phase 55]: Preserve preview-lock sanitization in the comparison decision layer before resume text generation or scoring.
- [Phase 55]: README stays onboarding-focused and links to architecture docs instead of restating them.
- [Phase 55]: approved-chokepoints.md remains unchanged because session-comparison/decision.ts is not a new monitored chokepoint.
- [Phase 56]: CI enforcement must match the PR checklist for critical-route changes.
- [Phase 56]: The route-architecture audit must enforce `compare`, `comparison`, and `versions` alongside the previously audited critical surfaces.
- [Phase 56]: The architecture proof pack now includes the `comparison` route plus its seam tests.
- [Phase 57]: `.planning/.tmp-copy-audit.json` and `.planning/debug/` are local-only artifacts and must stay ignored.
- [Phase 57]: Historical phase directories remain canonical project memory when they explain real decisions, even if they are old.
- [Phase 58]: `generate_file` uses session-backed source resolution as the authoritative export source; payload `cv_state` is now validated for coherence instead of treated as an equal source of truth.
- [Phase 58]: Smart-generation performs a post-persistence handoff preflight before dispatching `generate_file`.
- [Phase 58]: Intake and handoff coherence problems surface as typed `PRECONDITION_FAILED` failures instead of opaque internal-error exceptions where possible.
- [Phase 59]: The remaining opaque post-preflight failure path is now localized inside `generateBillableResume(...)` with explicit billable stages, stage-aware logs, and stage-failure metrics.
- [Phase 59]: Known billable state failures such as missing latest version, missing pending generation, reservation failures, render throws, and persistence failures now preserve stable typed codes or stage-tagged exceptions instead of collapsing into an unqualified opaque throw.
- [Phase 60]: Pending resume-generation persistence failures now distinguish create vs reuse branches, preserve raw DB diagnostics, and surface narrower billable failure codes for this hotspot.
- [Phase 61]: `resume_generations` create persistence now writes `updated_at` explicitly on insert so direct Supabase inserts stay aligned with the table contract and the existing update path.
- [Phase 62]: ATS enhancement now has one canonical product-facing ATS Readiness contract that keeps raw heuristic scores internal, enforces monotonic displayed post-enhancement scores, and withholds optimized display scores when confidence or quality gates do not justify them safely.
- [Phase 63]: ATS Readiness observability now logs decision metadata with contract version and metrics, old sessions without persisted readiness resolve through one canonical fallback path, and remaining product surfaces no longer choose raw `atsScore` as their primary source of truth.
- [Phase 64]: ATS enhancement no longer leaves the optimized product score empty; canonical readiness now emits either an exact score or a short estimated numeric range in pt-BR for the main product surfaces.
- [Phase 65]: ATS Readiness is now formally versioned as contract v2, legacy persisted shapes normalize centrally into the v2 display contract, and residual internal raw-score references are either isolated as heuristic diagnostics or aligned to the canonical readiness semantics.
- [Phase 66]: Internal runtime and persistence now refer to the raw ATS diagnostic as `internalHeuristicAtsScore`, while compatibility adapters still expose legacy `atsScore` only where older consumers need it.
- [Phase 66]: The semantic boundary is now explicit in types, context builders, agent persistence, and tests: raw ATS telemetry is diagnostic only, and ATS Readiness v2 remains the sole product-facing score contract.
- [Phase 67]: Session-response and agent done-chunk compatibility aliases now emit explicit telemetry so legacy ATS score sunset decisions can be guided by real usage.
- [Phase 67]: `docs/ats-readiness-product-vs-internal.md` now captures the final semantic boundary between ATS Readiness v2 and internal heuristic ATS diagnostics for onboarding and future cleanup work.
- [Phase 68]: ATS rewrite prompts now treat quantified bullets as premium evidence and explicitly forbid replacing factual metric bullets with generic wording.
- [Phase 68]: Validation now detects editorial metric regression when strong original impact bullets lose their numbers, scope, or substantive result in the optimized rewrite.
- [Phase 69]: ATS enhancement now records structured editorial telemetry for premium-bullet detection, metric regressions, recovery-path selection, and final preservation status using counts and flags only.
- [Phase 69]: Editorial observability is centralized in the ATS rewrite domain and intentionally avoids logging bullet text, names, or other sensitive resume content.
- [Phase 70]: Preview-panel editing now resolves the same canonical resume owner used by generated export, preferring `optimizedCvState` when the active preview is backed by the optimized resume.
- [Phase 70]: Manual edit persistence now invalidates stale artifact metadata for the edited resume source and the editor modal immediately triggers regeneration so preview and export cannot silently drift apart.
- [Phase 71]: Optimized resume comparison previews now derive a selective semantic highlight map at render time, emphasizing only meaningful improvements such as stronger keywords, seniority reinforcement, and preserved/prompted metric impact.
- [Phase 71]: Highlight rendering is preview-only: the original column stays clean, export/persistence remain untouched, and whole-line emphasis is reserved for materially improved premium bullets while minor wording/punctuation changes are ignored.
- [Phase 72]: Export filenames are now built by one centralized helper that strips accents, removes invalid characters, collapses separators, and chooses between `Curriculo_{Nome}` and `Curriculo_{Nome}_{Vaga}` based on a reliable job-targeting signal.
- [Phase 72]: The file-download route now returns canonical filename metadata so preview downloads and the documents panel use the same product filename instead of local hardcoded fallbacks.
- [Phase 72.1]: PDF export now embeds the same Inter font family used by the in-product preview, so the exported resume no longer feels typographically disconnected from the product experience.
- [Phase 72.1]: The PDF resume template remains ATS-safe and single-column, but now uses a calmer executive hierarchy with softer separators, stronger top-of-page hierarchy, and more breathable experience and skills spacing.
- [Phase 73]: Optimized preview highlights now operate on short semantic chunks with explicit density limits instead of permissive token-by-token additions, which removes most isolated word highlights from the summary.
- [Phase 73]: Premium highlight behavior remains intact for materially improved high-value bullets such as quantified metric/scope cases, while the inline green treatment is now visually softer and less diff-like.
- [Phase 74]: Session-generate export conflicts are now scoped to the current session/target instead of any active artifact job owned by the user, so unrelated exports no longer block manual-edit regeneration.
- [Phase 74]: When a real same-scope export is already in progress, manual save now persists the edited resume without immediately invalidating the last valid artifact, and the editor surfaces the PDF refresh as deferred instead of failing the save.
- [Phase 75]: The Phase 74 policy is no longer treated as implicitly safe: preserved stale artifacts now carry explicit `staleArtifact` metadata through file-access responses, preview surfaces, and tests so “saved but PDF still old” is visible instead of silent.
- [Phase 75]: The current policy is accepted only in adjusted form: keeping the old PDF available during a same-scope active export is defensible as long as the product surfaces clearly mark that artifact as stale and awaiting resynchronization.
- [Phase 76]: `Estimado` ATS Readiness states now use a shared badge component with an embedded help affordance, so the explanation of the estimated range stays consistent anywhere that badge is rendered.
- [Phase 92]: Layer 1 highlight eligibility now treats optimized-bullet evidence as independent from diff improvement, using explicit `evidenceScore` and `improvementScore` thresholds.
- [Phase 92]: Layer 3 editorial ordering remains unchanged; no combined ranking score was introduced, and stack-only mentions do not cross the evidence path.
- [Phase 59]: The remaining opaque post-preflight failure path is now localized inside `generateBillableResume(...)` with explicit billable stages, stage-aware logs, and stage-failure metrics.
- [Phase 59]: Known billable state failures such as missing latest version, missing pending generation, reservation failures, render throws, and persistence failures now preserve stable typed codes or stage-tagged exceptions instead of collapsing into an unqualified opaque throw.
- Phase 78 added: Per-request Prisma query counting with N+1 threshold detection
- [Phase 78]: The repo's live DB seam for these routes is Supabase/PostgREST, not a Prisma singleton, so request-scoped DB query observability is implemented via `getSupabaseAdminClient()` custom `global.fetch` instrumentation rather than unused Prisma-only infrastructure.
- [Phase 78]: `/api/agent` is a streaming exception and flushes request query metrics on SSE completion/failure, while the other tracked routes use the generic request wrapper for automatic summary logging.
- Phase 80 added: Repeated query fingerprinting for stronger N+1 detection
- [Phase 80]: Repeated-pattern diagnostics now sit on top of the existing Phase 78 tracking architecture; the live seam remains Supabase/PostgREST descriptor tracking rather than SQL parsing or Prisma-only instrumentation.
- [Phase 80]: Fingerprinting is conservative by design: UUIDs, numbers, opaque ids, and list shapes normalize, but semantic string filters such as status-like values should stay distinct when possible.
- [Phase 87]: Experience highlight surfacing now has an explicit same-entry Layer 3 selector that ranks finalized bullet results by editorial tier/category priority instead of raw improvement score alone.
- [Phase 87]: Tier 1 same-entry evidence now consumes visible slots before Tier 2, while existing caps, zero-highlight safety, and renderer tier/category contracts remain unchanged.
- Phase 87 completed: same-entry experience highlight surfacing is now an explicit Layer 3 selector with editorial Tier 1 dominance ahead of Tier 2.
- Phase 87 completed: same-entry visible highlight selection now uses an explicit Layer 3 editorial selector with Tier 1 dominance and preserved caps/contracts.
- Phase 88 completed: the same-entry surfacing selector now exposes explicit editorial policy constants, direct edge-case coverage, and debug-only decision traceability without reopening adjacent layers.
- Phase 89 completed: the same-entry surfacing trace now documents mixed-context runtime-local debug semantics, and the exported policy constant is confirmed uncoupled from tests as a fixture.
- Phase 90 added: ATS enhancement observability will now close the loop between summary recovery semantics, summary clarity gates, and final `estimated_range` versus exact-score outcomes.
- Phase 90 completed: ATS enhancement sessions now emit one self-contained summary clarity outcome event tying summary recovery semantics directly to final `estimated_range` or exact-score outcomes.
- Phase 91 added: ATS enhancement log semantics will stop treating healthy validation recovery as a warning and will reserve `warn` for the confirmed smart-repair-then-clarity-fail path.
- Phase 91 completed: ATS enhancement warning-level logs now align only to the confirmed smart-repair-then-clarity-fail path, while healthy validation recovery emits informational progress only.
- Phase 92 added: optimized-preview highlight eligibility will stop penalizing preserved strong metrics just because original-vs-optimized diff is small.
- Phase 92 completed: Layer 1 now exposes explicit evidence and improvement signals, preserved metric bullets remain eligible with zero diff, and superficial stack-only bullets stay suppressed.
- Phase 93 completed: summary editorial hardening stays ATS-only, and the post-review fix keeps the new anti-repetition gate from leaking into `job_targeting` or rejecting additive repeated-domain summaries.
- Phase 94 completed: contextual stack promotion now scores against the rendered refined span, keeps terse stack-only rewrites below the evidence path, and preserves Phase 92 metric precedence.

### Pending Todos

- Run `/gsd-audit-milestone`
- Then run `/gsd-complete-milestone`

### Blockers or Concerns

- No active implementation blocker is currently known.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260422-suf | Normalize highlight span boundaries ignoring punctuation separators and refine broken mid-phrase highlights | 2026-04-22 | working-tree | Validated | [260422-suf-normalize-highlight-span-boundaries-igno](./quick/260422-suf-normalize-highlight-span-boundaries-igno/) |
| 260422-vlo | Add end-to-end highlight outcome observability for silent zero-highlight cases | 2026-04-22 | working-tree | Validated | [260422-vlo-add-end-to-end-highlight-outcome-observa](./quick/260422-vlo-add-end-to-end-highlight-outcome-observa/) |
| 260424-c9m | Alinhar user-data-page.tsx ao layout do zip de referência com fidelidade visual máxima sem regredir os fluxos existentes | 2026-04-24 | working-tree | Validated | [260424-c9m-alinhar-user-data-page-tsx-ao-layout-do-](./quick/260424-c9m-alinhar-user-data-page-tsx-ao-layout-do-/) |
| 260424-d2p | Renomear endpoints de auth/dashboard para `/profile-setup`, `/chat` e `/dashboard/resumes-history`, atualizando redirects, redirect_to e cobertura de testes | 2026-04-24 | working-tree | Validated | [260424-d2p-rename-auth-dashboard-endpoints-dashboar](./quick/260424-d2p-rename-auth-dashboard-endpoints-dashboar/) |
| 260424-dpi | Fix production build type error by aligning `/chat` with the optional billing surface contract | 2026-04-24 | working-tree | Validated | [260424-dpi-fix-production-build-type-error-chat-pag](./quick/260424-dpi-fix-production-build-type-error-chat-pag/) |

## Session Continuity

Last session: 2026-04-22T09:52:30.000Z
Stopped at: Completed 94-01-PLAN.md
Resume file: None
