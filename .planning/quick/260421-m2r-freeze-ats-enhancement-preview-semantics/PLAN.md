# Quick Task 260421-m2r Plan

## Goal

Freeze ATS enhancement preview behavior behind explicit contracts for summary, experience, contextual ATS skill highlighting, and no-target summary cleanup.

## Scope

1. Lock the preview contracts in focused automated tests.
2. Make the most important limits explicit in the preview highlight module.
3. Prepare a manual freeze gate for 15 real resumes without claiming proof the repo cannot produce on its own.

## Non-negotiable contracts

1. Summary never uses semantic highlight.
2. Summary never renders structured payload/raw JSON.
3. Experience never uses full-line highlight.
4. Experience allows at most 1 highlighted span per bullet.
5. Experience allows at most 2 highlighted bullets per experience entry.
6. ATS-relevant inline skills remain highlight-eligible only when contextual.
7. No-target ATS summary cannot contain internal labels such as `Resumo Profissional:` / `Professional Summary:`.

## Verification

- `npm run typecheck`
- `npx vitest run 'src/lib/resume/optimized-preview-contracts.test.ts' 'src/lib/resume/optimized-preview-highlights.test.ts' 'src/components/resume/resume-comparison-view.test.tsx' 'src/lib/agent/tools/pipeline.test.ts' 'src/lib/agent/tools/rewrite-section.test.ts' 'src/lib/templates/cv-state-to-template-data.test.ts' 'src/lib/agent/tools/generate-file.test.ts'`

## Manual freeze gate

Use `REAL-RESUME-FREEZE-GATE.md` to rate 15 real ATS enhancement resumes outside the repo. The codebase does not contain a committed corpus of 15 real user resumes, so that final acceptance step must be executed with product-safe real inputs.
