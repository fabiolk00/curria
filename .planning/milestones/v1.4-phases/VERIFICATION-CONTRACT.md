# v1.4 Verification Contract

## Purpose

This archive defines the conservative backfill contract for the missing `VERIFICATION.md` files from milestone `v1.4`.

The goal is to let milestone audit evaluate the shipped `v1.4` work from committed phase evidence instead of failing only because the verification layer was absent at archive time.

## Canonical Archive Layout

The canonical archive root for reconstructed `v1.4` phase evidence is:

- `.planning/milestones/v1.4-phases/`

Each shipped `v1.4` phase must have exactly one archived directory here:

- `CURRIA-28-agent-input-and-setup-service-extraction`
- `CURRIA-29-agent-recovery-streaming-and-persistence-decomposition`
- `CURRIA-30-authenticated-route-and-billing-boundary-hardening`
- `CURRIA-31-long-vacancy-stability-and-release-hygiene-gates`
- `CURRIA-31.1-reduce-test-suite-runtime-and-add-ci-friendly-performance-pr`

This archive is historical only. It must not reactivate `v1.4` as the active milestone and must not restore those directories under `.planning/phases/`.

## Allowed Evidence Sources

Backfilled verification claims may cite only:

- committed `SUMMARY.md` artifacts from the original `v1.4` phase directories
- committed `PLAN.md`, `RESEARCH.md`, and `VALIDATION.md` artifacts where needed for scope or validation context
- committed tests and commands explicitly referenced by archived summaries
- archived milestone files:
  - `.planning/milestones/v1.4-ROADMAP.md`
  - `.planning/milestones/v1.4-REQUIREMENTS.md`
  - `.planning/milestones/v1.4-MILESTONE-AUDIT.md`
- repo history recovered directly from git

Backfilled verification must not rely on recollection, undocumented assumptions, or new product claims.

## Required VERIFICATION.md Shape

Each phase `VERIFICATION.md` must include:

1. Frontmatter with:
   - `phase`
   - `slug`
   - `status`
   - `verified`
2. A short verdict section.
3. A requirement coverage table for the phase's mapped REQ-IDs.
4. Evidence bullets that cite archived summaries, tests, or milestone artifacts.
5. Residual gaps or non-claims for anything still not fully proven.

## Status Rules

- Use `passed` only when the archived evidence supports the requirement without needing inference beyond the committed artifacts.
- Use `gaps_found` when a requirement still lacks enough evidence or when an archived summary explicitly describes an unresolved limitation.
- Prefer conservative partial or gap language when in doubt.

## Non-Claims

Verification documents must not:

- paste raw secrets, tokens, cookies, or environment blobs
- imply that `v1.4` is active again
- claim summary frontmatter was present when it was not
- convert archived implementation notes into stronger verification claims than the evidence supports

## Audit Goal

After the backfill:

- milestone audit should no longer fail solely because verification files are missing
- any remaining milestone debt should be explicit, conservative, and documented in the archived audit
