---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: milestone
current_phase: 108
current_phase_name: adicionar camada dinamica de evidencia semantica para targeted rewrite de job_targeting
current_plan: 01 completed
status: in_progress
stopped_at: Completed Phase 108 semantic evidence classification for targeted rewrite
last_updated: "2026-04-27T09:31:30.0000000-03:00"
last_activity: 2026-04-29
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
**Current focus:** AI chat access is now restricted to active Pro subscribers across the authenticated UI and server routes, while preserving the existing billing and session architecture.

## Current Position

Phase: 108 (adicionar camada dinamica de evidencia semantica para targeted rewrite de job_targeting) - IN PROGRESS
Plan: 01 completed
Current Phase: 108
Current Phase Name: adicionar camada dinamica de evidencia semantica para targeted rewrite de job_targeting
Current Plan: 01 completed
Total Plans in Phase: 1
Status: In progress
Last activity: 2026-04-29
Last Activity Description: Completed quick plan 260428-upq-01: Smart Generation canonical guided route and workflow-aware start locks.

Progress: [##########] 100%

## Performance Metrics

Baseline carried forward from earlier shipped milestones:

- Total plans completed: 87
- Milestones archived: 5

## Accumulated Context

### Roadmap Evolution

- Phase 109 added: Recoverable job targeting validation with summary retry, user-facing modal, and paid override.
- Phase 110 added: Low-fit warning gate and safer bridge emphasis for off-target and partially-adherent job targeting.
- Phase 108 added: Dynamic semantic evidence classification for targeted rewrite only inside job_targeting.

- Phase 107 added: Harden highlight de job_targeting com origem rastreável, gate auditado e keywords defensivas.
- Phase 106 completed: job_targeting now blocks only on hard validation issues, persists soft warnings, and falls back to semantic target-role extraction while shared ATS validation compatibility remains intact.
- Phase 106 added: Refatorar o pipeline job_targeting para validacao por severidade e extracao de cargo semantica.
- Phase 104 added: Warn before job target generation when vacancy match is weak and require user confirmation to continue.
- Phase 105 added: Refine career fit from a boolean warning into a graduated low/medium/high risk evaluation with contextual gating.
- Phase 103 added: Align Monthly and Pro plan price and credit limits across UI, billing, and tests.
- Phase 102 added: Restrict AI chat access to active Pro subscribers across UI and API.
- Phase 101 completed: the existing resume history UI now renders live protected generation history with latest-6 pagination and download/open actions.
- Phase 101 added: Connect the existing resume history UI to real generated artifacts and protected access.
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

- [Quick 260428-upq-01]: Smart Generation is now the canonical guided generation start route for ATS enhancement and job targeting.
- [Quick 260428-upq-01]: `/api/profile/ats-enhancement` remains only as a deprecated compatibility wrapper around Smart Generation.
- [Quick 260428-upq-01]: ATS and job-targeting artifact idempotency now use the stable start-lock idempotency boundary before falling back to session identity.
- [Phase 101]: Keep durable history metadata on `resume_generations` instead of introducing a parallel artifact-history store.
- [Phase 101]: Reuse `/api/file/[sessionId]` with an opt-in `download=pdf` mode so history cards open protected URLs without exposing storage paths.
- [Phase 101]: Reuse `/dashboard/resume/compare/[sessionId]` as the viewer/open destination instead of building a new history viewer.
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
| 260429-zsb | Add Job Targeting score breakdown card inspired by the zip reference layout | 2026-04-29 | working-tree | Validated | [260429-zsb-add-job-targeting-score-breakdown-card](./quick/260429-zsb-add-job-targeting-score-breakdown-card/) |
| 260429-vrb | Shorten and normalize Job Targeting recommendation card copy | 2026-04-29 | working-tree | Validated | [260429-vrb-shorten-target-recommendation-copy](./quick/260429-vrb-shorten-target-recommendation-copy/) |
| 260429-pdc | Delete dead Job Targeting rewrite-diff code after simplifying generated resume review | 2026-04-29 | working-tree | Validated | [260429-pdc-delete-dead-job-targeting-diff-code](./quick/260429-pdc-delete-dead-job-targeting-diff-code/) |
| 260429-ovc | Simplify generated resume review screen for Job Targeting while keeping ATS Enhancement comparison | 2026-04-29 | working-tree | Validated | [260429-ovc-simplify-generated-resume-review-screen-](./quick/260429-ovc-simplify-generated-resume-review-screen-/) |
| 260429-os7 | Shorten low-fit Job Targeting warning into concise bullet list | 2026-04-29 | working-tree | Validated | [260429-os7-shorten-low-fit-job-targeting-warning-in](./quick/260429-os7-shorten-low-fit-job-targeting-warning-in/) |
| 260422-suf | Normalize highlight span boundaries ignoring punctuation separators and refine broken mid-phrase highlights | 2026-04-22 | working-tree | Validated | [260422-suf-normalize-highlight-span-boundaries-igno](./quick/260422-suf-normalize-highlight-span-boundaries-igno/) |
| 260422-vlo | Add end-to-end highlight outcome observability for silent zero-highlight cases | 2026-04-22 | working-tree | Validated | [260422-vlo-add-end-to-end-highlight-outcome-observa](./quick/260422-vlo-add-end-to-end-highlight-outcome-observa/) |
| 260424-c9m | Alinhar user-data-page.tsx ao layout do zip de referência com fidelidade visual máxima sem regredir os fluxos existentes | 2026-04-24 | working-tree | Validated | [260424-c9m-alinhar-user-data-page-tsx-ao-layout-do-](./quick/260424-c9m-alinhar-user-data-page-tsx-ao-layout-do-/) |
| 260424-d2p | Renomear endpoints de auth/dashboard para `/profile-setup`, `/chat` e `/dashboard/resumes-history`, atualizando redirects, redirect_to e cobertura de testes | 2026-04-24 | working-tree | Validated | [260424-d2p-rename-auth-dashboard-endpoints-dashboar](./quick/260424-d2p-rename-auth-dashboard-endpoints-dashboar/) |
| 260424-dpi | Fix production build type error by aligning `/chat` with the optional billing surface contract | 2026-04-24 | working-tree | Validated | [260424-dpi-fix-production-build-type-error-chat-pag](./quick/260424-dpi-fix-production-build-type-error-chat-pag/) |
| 260424-euu | cleanup dead code: consolidate session-generate helpers, remove orphan parse and tracker showcase | 2026-04-24 | working-tree | Typechecked | [260424-euu-cleanup-dead-code-consolidate-session-ge](./quick/260424-euu-cleanup-dead-code-consolidate-session-ge/) |
| 260424-ey2 | remove orphan seo-role-landing-page component | 2026-04-24 | working-tree | Typechecked | [260424-ey2-remove-orphan-seo-role-landing-page-comp](./quick/260424-ey2-remove-orphan-seo-role-landing-page-comp/) |
| 260424-f0q | fix new mojibake findings from audit:copy-regression | 2026-04-24 | working-tree | Validated | [260424-f0q-fix-new-mojibake-findings-from-audit-cop](./quick/260424-f0q-fix-new-mojibake-findings-from-audit-cop/) |
| 260424-f3o | fix excess top spacing below resume section titles | 2026-04-24 | working-tree | Validated | [260424-f3o-fix-excess-top-spacing-below-resume-sect](./quick/260424-f3o-fix-excess-top-spacing-below-resume-sect/) |
| 260424-f7v | fix cross-platform path normalization in copy audit baseline matching | 2026-04-24 | working-tree | Validated | [260424-f7v-fix-cross-platform-path-normalization-in](./quick/260424-f7v-fix-cross-platform-path-normalization-in/) |
| 260424-f9w | remove all spacing below resume section titles | 2026-04-24 | working-tree | Validated | [260424-f9w-remove-all-spacing-below-resume-section-](./quick/260424-f9w-remove-all-spacing-below-resume-section-/) |
| 260424-fgc | set resume section top padding to 1.5 | 2026-04-24 | working-tree | Validated | [260424-fgc-set-resume-section-top-padding-to-1-5](./quick/260424-fgc-set-resume-section-top-padding-to-1-5/) |
| 260425-gsl | Remove the "Dúvidas? Fale conosco" phrase from the pricing comparison frontend | 2026-04-25 | working-tree | Validated | [260425-gsl-remove-the-d-vidas-fale-conosco-phrase-f](./quick/260425-gsl-remove-the-d-vidas-fale-conosco-phrase-f/) |

| 260425-gy2 | Merge the plan comparison table and pricing cards into a continuous hybrid pricing experience | 2026-04-25 | working-tree | Validated | [260425-gy2-merge-plan-comparison-table-with-pricing](./quick/260425-gy2-merge-plan-comparison-table-with-pricing/) |
| 260425-h8b | Fix new mojibake regressions that broke the copy audit baseline | 2026-04-25 | working-tree | Validated | [260425-h8b-fix-copy-regression-audit-failures-cause](./quick/260425-h8b-fix-copy-regression-audit-failures-cause/) |

| 260425-h9z | Revert the pricing hybrid rewrite and keep only a scroll cue above the comparison table | 2026-04-25 | working-tree | Validated | [260425-h9z-revert-pricing-hybrid-rewrite-and-add-on](./quick/260425-h9z-revert-pricing-hybrid-rewrite-and-add-on/) |

| 260425-heh | Analyze the landing-page-responsiveness branch and adapt its responsive patterns to the current pricing work | 2026-04-25 | working-tree | Validated | [260425-heh-analyze-branch-responsiveness-pull-its-l](./quick/260425-heh-analyze-branch-responsiveness-pull-its-l/) |

| 260425-k00 | Remove the hero scroll indicator and move mobile CTAs below the before/after block | 2026-04-25 | working-tree | Validated | [260425-k00-restore-the-colored-hero-headline-stylin](./quick/260425-k00-restore-the-colored-hero-headline-stylin/) |

| 260425-oxl | Reorder the landing navbar links to ATS, areas, then pricing | 2026-04-25 | working-tree | Validated | [260425-oxl-reorder-landing-navbar-links-to-ats-resu](./quick/260425-oxl-reorder-landing-navbar-links-to-ats-resu/) |

| 260425-p87 | Move the mobile hero title lower so it clears the fixed navbar | 2026-04-25 | working-tree | Validated | [260425-p87-move-the-landing-hero-title-lower-so-the](./quick/260425-p87-move-the-landing-hero-title-lower-so-the/) |

| 260425-po6 | Hide the pricing comparison section on mobile and align pricing cards with the comparison matrix | 2026-04-25 | working-tree | Validated | [260425-po6-hide-the-pricing-comparison-section-on-m](./quick/260425-po6-hide-the-pricing-comparison-section-on-m/) |
| 260425-u7m | Add symmetric session-comparison highlightState return/log coverage for ATS and job_targeting flows | 2026-04-25 | working-tree | Validated | [260425-u7m-add-session-comparison-decision-tests-fo](./quick/260425-u7m-add-session-comparison-decision-tests-fo/) |
| 260425-vsz | Recover stale download session ids and harden post-generation file lookup | 2026-04-26 | working-tree | Validated | [260425-vsz-recover-from-stale-download-session-ids-](./quick/260425-vsz-recover-from-stale-download-session-ids-/) |
| 260425-w1z | Fix missing job-targeting cv_version_source enum value | 2026-04-26 | working-tree | Validated | [260425-w1z-fix-missing-job-targeting-cv-version-sou](./quick/260425-w1z-fix-missing-job-targeting-cv-version-sou/) |
| 260425-w5l | Analyze and eliminate unexpected stale download session warnings | 2026-04-26 | working-tree | Validated | [260425-w5l-analyze-and-eliminate-unexpected-stale-d](./quick/260425-w5l-analyze-and-eliminate-unexpected-stale-d/) |
| 260425-wdg | Ajustar sitemap.xml e indexacao SEO do CurrIA | 2026-04-26 | working-tree | Scoped Validated | [260425-wdg-ajustar-sitemap-xml-e-indexacao-seo-do-c](./quick/260425-wdg-ajustar-sitemap-xml-e-indexacao-seo-do-c/) |
| 260426-isx | Hardening pós-refatoração da validação `job_targeting`: corrigir copy da Regra 8, exibir warnings de sucesso e separar hardIssues de softWarnings no modal 422 | 2026-04-26 | working-tree | Validated | [260426-isx-hardening-pos-refatoracao-validacao-job-](./quick/260426-isx-hardening-pos-refatoracao-validacao-job-/) |
| 260426-hjh | Hardening final do highlight compartilhado: auditoria ATS, compatibilidade legada e thresholds nomeados | 2026-04-26 | working-tree | Validated | [260426-hjh-hardening-final-highlight-job-targeting-ats-](./quick/260426-hjh-hardening-final-highlight-job-targeting-ats-/) |
| 260426-hat | Hardening arquitetural: trace consolidado de job_targeting e documentação das quatro validações ATS | 2026-04-26 | working-tree | Validated | [260426-hat-hardening-arquitetural-observabilidade-validacao-ats-](./quick/260426-hat-hardening-arquitetural-observabilidade-validacao-ats-/) |
| 260426-hrv | Hardening do trace `repairAttempted` e remoção da quarta validação ATS vacuamente redundante | 2026-04-26 | working-tree | Validated | [260426-hrv-hardening-trace-repairattempted-e-validacao-ats-](./quick/260426-hrv-hardening-trace-repairattempted-e-validacao-ats-/) |

| 260426-qfa | Fix preview-lock transverse test sessions mock to match file-access lookup contract | 2026-04-26 | working-tree | Validated | [260426-qfa-fix-preview-lock-transverse-sessions-mock-for-architecture-proof-pack](./quick/260426-qfa-fix-preview-lock-transverse-sessions-mock-for-architecture-proof-pack/) |

| 260426-qcg | Restore E2E chat access by allowing valid synthetic auth cookies through the centralized AI chat access contract | 2026-04-26 | working-tree | Validated | [260426-qcg-restore-e2e-chat-access-via-synthetic-bypass](./quick/260426-qcg-restore-e2e-chat-access-via-synthetic-bypass/) |

| 260426-qrx | Remove ATS Readiness scoring and final/estimated side badges from the resume comparison surface | 2026-04-26 | working-tree | Validated | [260426-qrx-remover-ats-readiness-da-comparacao-de-curriculo](./quick/260426-qrx-remover-ats-readiness-da-comparacao-de-curriculo/) |

| 260426-qct | Remove ATS Readiness from the chat header and chat-generated assistant messages while preserving the current approval gate | 2026-04-26 | working-tree | Scoped Validated | [260426-qct-remover-ats-readiness-do-chat](./quick/260426-qct-remover-ats-readiness-do-chat/) |
| 260427-qse | Harden semantic evidence isolation so enrichment runs only in job_targeting targeted rewrite, with acronym, grounding, and cross-domain safeguards | 2026-04-27 | working-tree | Validated | [260427-qse-hardening-semantic-evidence-targeted-rewrite-isolation](./quick/260427-qse-hardening-semantic-evidence-targeted-rewrite-isolation/) |
| 260427-qtr | Final hardening to lock semantic evidence to the enriched targeted-rewrite entrypoint with explicit contract, trace semantics, and acronym-context regression proof | 2026-04-27 | working-tree | Validated | [260427-qtr-final-hardening-semantic-evidence-targeted-rewrite-regression-safety](./quick/260427-qtr-final-hardening-semantic-evidence-targeted-rewrite-regression-safety/) |
| 260427-trm | Hardening session history access, job targeting start idempotency, and override review highlights | 2026-04-28 | working-tree | Validated | [260427-trm-hardening-session-history-access-job-tar](./quick/260427-trm-hardening-session-history-access-job-tar/) |
| 260427-v3b | Hardening lock backend consistency, core display cleanup, override N+1 reduction, and override observability | 2026-04-28 | working-tree | Validated | [260427-v3b-hardening-lock-backend-consistency-core-](./quick/260427-v3b-hardening-lock-backend-consistency-core-/) |
| 260427-val | UX hardening review warning panel for generated resumes with override | 2026-04-28 | working-tree | Validated | [260427-val-ux-hardening-review-warning-panel-for-ge](./quick/260427-val-ux-hardening-review-warning-panel-for-ge/) |
| 260427-vo5 | UX + Core Requirement Hardening: dynamic review panel and domain-agnostic requirement display | 2026-04-28 | working-tree | Validated | [260427-vo5-ux-core-requirement-hardening-dynamic-re](./quick/260427-vo5-ux-core-requirement-hardening-dynamic-re/) |
| 260428-82i | Fix copy regression audit mojibake findings | 2026-04-28 | working-tree | Validated | [260428-82i-fix-copy-regression-audit-mojibake-findi](./quick/260428-82i-fix-copy-regression-audit-mojibake-findi/) |
| 260428-ovr | Hardening final do Override Review Card com base no pipeline trace | 2026-04-28 | working-tree | Validated | [260428-ovr-override-review-card-hardening](./quick/260428-ovr-override-review-card-hardening/) |
| 260428-uxr | Hardening UX do Review Warning Panel com scroll interno e accordion | 2026-04-28 | working-tree | Validated | [260428-ux-review-warning-panel-scroll-accordion](./quick/260428-ux-review-warning-panel-scroll-accordion/) |
| 260428-oqb | Hardening tecnico do log do fluxo /job-targeting/override | 2026-04-28 | working-tree | Validated | [260428-oqb-hardening-t-cnico-do-log-do-fluxo-job-ta](./quick/260428-oqb-hardening-t-cnico-do-log-do-fluxo-job-ta/) |
| 260428-u03 | Job Targeting 2.0 explanations, safe recommendations, and rewrite diff | 2026-04-29 | e487795 | Validated | [260428-u03-job-targeting-2-0-explanations-safe-reco](./quick/260428-u03-job-targeting-2-0-explanations-safe-reco/) |
| 260428-upq-01 | Smart Generation canonical route and start lock for ATS and job targeting | 2026-04-29 | 73303e9 | Validated | [260428-upq-refactor-smart-generation-as-core-pdf-on](./quick/260428-upq-refactor-smart-generation-as-core-pdf-on/) |

## Session Continuity

Last session: 2026-04-22T09:52:30.000Z
Stopped at: Completed 260428-upq-01-PLAN.md
Resume file: None
