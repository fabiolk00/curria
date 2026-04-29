---
task_id: 260428-upq
mode: quick-full
type: index
title: Refactor Smart Generation as Core PDF-Only Flow
autonomous: true
waves: 2
plans:
  - 260428-upq-01-PLAN.md
  - 260428-upq-02a-PLAN.md
  - 260428-upq-02b-PLAN.md
  - 260428-upq-02c-PLAN.md
  - 260428-upq-03a-PLAN.md
  - 260428-upq-03b-PLAN.md
  - 260428-upq-04a-PLAN.md
  - 260428-upq-04b-PLAN.md
  - 260428-upq-04c-PLAN.md
locked_decisions:
  - id: U-01
    decision: "PDF-only active product behavior: do not generate DOCX files and do not keep DOCX generation/import logic active."
  - id: U-02
    decision: "Preserve nullable historical DB/type fields unless a safe migration exists; no destructive schema migration in this task."
  - id: U-03
    decision: "Smart Generation is the canonical guided resume generation entrypoint for ATS and job targeting."
  - id: U-04
    decision: "AI chat is no longer the primary product surface; keep chat entitlement only on true chat surfaces."
---

<objective>
Index for the split execution plans replacing the original monolithic quick-full plan.

Execute the scoped plans below by wave. Wave 1 plans have no intended source-file overlap. Wave 2 plans are final proof/package cleanup plans that depend on Wave 1 changes.
</objective>

<wave_structure>
| Wave | Plans | Why |
|---|---|---|
| 1 | `260428-upq-01`, `260428-upq-02a`, `260428-upq-02b`, `260428-upq-03a`, `260428-upq-03b`, `260428-upq-04a`, `260428-upq-04b` | Independent implementation slices with no intended file overlap. |
| 2 | `260428-upq-02c`, `260428-upq-04c` | `02c` proves entitlement boundaries after ungating/upload changes; `04c` removes dependencies after active imports are removed. |
</wave_structure>

<plan_set>
| Plan | Scope | Key Decisions |
|---|---|---|
| `260428-upq-01-PLAN.md` | Smart Generation canonical route, ATS/job-target start lock, old ATS wrapper | U-03, R-02 |
| `260428-upq-02a-PLAN.md` | Profile setup and authenticated layout non-chat ungating | U-04, R-01 |
| `260428-upq-02b-PLAN.md` | Session history/API/file access non-chat ownership coverage | U-04, R-01 |
| `260428-upq-02c-PLAN.md` | True chat remains gated plus normalized grep proof | U-04, R-01 |
| `260428-upq-03a-PLAN.md` | Dashboard/routes/sidebar/welcome guided-generation navigation | U-03, U-04, R-01 |
| `260428-upq-03b-PLAN.md` | Pricing/landing PDF-only copy and no chat feature row | U-01, U-03, U-04 |
| `260428-upq-04a-PLAN.md` | `generate_file` PDF-only artifact renderer | U-01, U-02, R-03 |
| `260428-upq-04b-PLAN.md` | Parser/tool/orchestrator/chat upload PDF-only import boundary | U-01, U-04 |
| `260428-upq-04c-PLAN.md` | Remove DOCX template scripts and dependencies from package/lockfiles | U-01, U-02, R-03 |
</plan_set>

<decision_coverage>
| Decision | Plan | Coverage | Notes |
|---|---|---|---|
| U-01 PDF-only active behavior | 03b, 04a, 04b, 04c | Full | Plan 03b removes visible claims; Plan 04a removes active generation; Plan 04b removes active import/tool/upload; Plan 04c removes scripts/dependencies. |
| U-02 Preserve nullable historical fields | 04a, 04c | Full | No Prisma/SQL migration; DB/type compatibility fields stay nullable and are grepped in Plan 04c. |
| U-03 Smart Generation canonical endpoint | 01, 03a, 03b | Full | Plan 01 moves ATS/job-target starts to Smart Generation; Plan 03a routes main UX toward profile setup; Plan 03b aligns product copy. |
| U-04 Chat not primary; entitlement only on chat | 02a, 02b, 02c, 03a, 03b, 04b | Full | Plans 02a/02b remove non-chat gates; Plan 02c proves true chat remains gated; Plans 03a/03b remove chat as main nav/copy; Plan 04b preserves request-orchestrator true-chat gate. |
</decision_coverage>

<validation>
Use `260428-upq-VALIDATION.md` for the per-plan automated checks and final combined gate. It includes the checker-required Nyquist coverage, raw-log privacy checks, true-chat entitlement checks, robust normalized grep, old ATS route caller guard, and DOCX lockfile dependency checks.
</validation>

<output>
Each split execution plan creates its own summary file:
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-01-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-02a-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-02b-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-02c-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-03a-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-03b-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-04a-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-04b-SUMMARY.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-04c-SUMMARY.md`

After all split plans complete, consolidate residual notes into `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-SUMMARY.md`.
</output>
