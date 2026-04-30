# Quick Task 260429-zsb: Add Job Targeting Score Breakdown Card

## Goal

Adapt the `b_gVw3MKVJl8H.zip` reference layout into the current Job Targeting resume review screen, especially the clean sidebar score breakdown card.

## Scope

- Add a Job Targeting-only score breakdown with 1-100 bars for:
  - Habilidades
  - Experiência
  - Formação
- Derive scores from the existing targeting plan and evidence model instead of mock data.
- Backfill the score on comparison responses for older generated sessions that already have targeting-plan data.
- Show compact critical gaps using safe, cleaned labels.
- Keep ATS Enhancement comparison behavior unchanged.
- Keep the main Job Targeting layout clean: generated resume as the primary column and a 300px sidebar.
- Do not import demo components or dead code from the zip.

## Validation

- `npm test -- src/lib/agent/job-targeting/score-breakdown.test.ts src/components/resume/job-targeting-score-card.test.tsx src/components/resume/resume-comparison-view.test.tsx src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
