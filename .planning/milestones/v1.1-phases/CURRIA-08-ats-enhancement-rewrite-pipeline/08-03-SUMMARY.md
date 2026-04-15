# 08-03 Summary

## Outcome

Wave 3 promoted ATS-enhanced resumes into first-class versioned artifacts and made downstream generation prefer the optimized snapshot when available.

## What changed

- extended the persisted CV version source contract with `ats-enhancement`
- added `prisma/migrations/20260414_ats_enhancement_versioning.sql` for the enum change
- updated CV version labeling so ATS-enhancement snapshots show up distinctly in timeline/history flows
- allowed ATS-enhancement snapshots through the billable generation allowlist
- changed base generation source selection to prefer `agentState.optimizedCvState` before falling back to canonical `cvState`
- aligned targeted tests around versioning, compare, generation, and session snapshot behavior

## Verification

- `pnpm vitest run src/lib/db/cv-versions.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/app/api/session/[id]/compare/route.test.ts src/app/api/session/[id]/generate/route.test.ts`
- `pnpm tsc --noEmit`

## Notes

The effective export path now honors a validated ATS rewrite without changing the rule that canonical base facts still live in `session.cvState`.
