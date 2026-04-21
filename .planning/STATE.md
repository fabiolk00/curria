---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: milestone
current_phase: 77
current_phase_name: corrigir encoding no pdf alinhar datas a direita na experiencia e reduzir o tooltip do badge estimado
current_plan: 01
status: complete
stopped_at: Completed 77-01-PLAN.md
last_updated: "2026-04-21T16:40:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 24
  completed_phases: 14
  total_plans: 14
  completed_plans: 14
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** A job seeker can reliably turn their real profile and a target role into an honest, ATS-ready resume output they can confidently download and use.
**Current focus:** PDF export now renders pt-BR and technical strings without broken glyphs, experience headers place dates on the right beside the role title, and the `Estimado` badge help cue is lighter and more compact.

## Current Position

Phase: 77 (corrigir encoding no pdf alinhar datas a direita na experiencia e reduzir o tooltip do badge estimado) - COMPLETE
Plan: 01 complete
Current Phase: 77
Current Phase Name: corrigir encoding no pdf alinhar datas a direita na experiencia e reduzir o tooltip do badge estimado
Current Plan: 01
Total Plans in Phase: 1
Status: Phase complete - verified locally
Last activity: 2026-04-21
Last Activity Description: PDF export now uses a broader Inter font asset with deterministic text sanitization, experience dates are right-aligned in the role header, and the estimated ATS badge tooltip is smaller and lighter without losing accessibility

Progress: [##########] 100%

## Performance Metrics

Baseline carried forward from earlier shipped milestones:

- Total plans completed: 81
- Milestones archived: 5

## Accumulated Context

### Roadmap Evolution

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
- [Phase 59]: The remaining opaque post-preflight failure path is now localized inside `generateBillableResume(...)` with explicit billable stages, stage-aware logs, and stage-failure metrics.
- [Phase 59]: Known billable state failures such as missing latest version, missing pending generation, reservation failures, render throws, and persistence failures now preserve stable typed codes or stage-tagged exceptions instead of collapsing into an unqualified opaque throw.

### Pending Todos

- Run `/gsd-audit-milestone`
- Then run `/gsd-complete-milestone`

### Blockers or Concerns

- No active implementation blocker is currently known.

## Session Continuity

Last session: 2026-04-21T09:00:00.000Z
Stopped at: Completed 77-01-PLAN.md
Resume file: None
