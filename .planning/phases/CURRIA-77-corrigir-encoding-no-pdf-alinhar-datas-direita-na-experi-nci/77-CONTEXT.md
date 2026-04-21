# Phase 77 Context

## Goal

Correct the remaining PDF polish issues after the premium export template work:

- broken glyphs in exported pt-BR/technical text
- experience dates that should sit on the same line as the role title, right-aligned
- an `Estimado` badge tooltip that feels too large for a lightweight contextual hint

## Scope

- PDF generation in `src/lib/agent/tools/generate-file.ts`
- estimated badge help UI in `src/components/ats-readiness-status-badge.tsx`
- focused regression coverage for PDF text rendering and experience header layout

## Constraints

- keep the PDF ATS-safe and single-column
- do not reopen ATS Readiness semantics or export naming
- preserve the shared Inter visual direction established in the previous PDF phase
