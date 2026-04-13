Aligned ATS resume generation with the root reference PDF pattern (`curriculo_ats_fabio_kroker_linha_separadora.pdf`).

What changed:
- Updated `src/lib/templates/cv-state-to-template-data.ts` to produce ATS-oriented template data with:
  - grouped `Competencias-Chave`
  - `Idiomas` extracted out of the skills list
  - richer certification display data
  - preserved experience bullets instead of hiding the first bullet as a tech-stack line
- Updated `src/lib/agent/tools/generate-file.ts` so the generated PDF follows the reference structure more closely:
  - single-column header with clean contact lines
  - PT-BR section labels
  - grouped skills lines
  - experience blocks with separators and simpler ATS-safe formatting
  - Helvetica-based text-only PDF output with no decorative layout patterns
- Updated `src/app/api/profile/ats-enhancement/route.ts` so the `Melhorar para ATS` flow sends stronger PT-BR ATS rewrite guidance focused on truthfulness, keywords, parsing, and impact.
- Updated `src/lib/agent/tools/rewrite-section.ts` system guidance to reinforce non-invention, ATS clarity, and natural keyword use.
- Updated `src/components/resume/user-data-page.tsx` ATS card copy to reflect the actual process and template style shown to the user.

Verification:
- `npx vitest run src/lib/templates/cv-state-to-template-data.test.ts src/lib/agent/tools/generate-file.test.ts src/app/api/profile/ats-enhancement/route.test.ts src/components/resume/user-data-page.test.tsx`
- `npx playwright test tests/e2e/profile-setup.spec.ts --project=chromium`

Notes:
- The repo root currently contains `curriculo_ats_fabio_kroker_linha_separadora.pdf`; that was used as the live reference model for this change.
- `user-data-page` tests still emit the existing Radix dialog ref warning, but the suite passes.
