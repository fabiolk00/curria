# Phase 77 Validation

Validated locally with:

- `npx vitest run "src/lib/agent/tools/generate-file.test.ts" "src/components/ats-readiness-status-badge.test.tsx"`
- `npm run typecheck`
- `npm run audit:copy-regression`

Notes:

- PDF extraction assertions now cover accented pt-BR strings (`Estagiário`, `Graduação`) and technical strings (`ETL`, `Python - Programming Language`).
- Experience-header assertions verify that the title and period share the same header line while the company/location line appears below.
