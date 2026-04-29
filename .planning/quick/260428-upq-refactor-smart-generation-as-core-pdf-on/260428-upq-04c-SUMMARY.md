---
task_id: 260428-upq
plan_id: 260428-upq-04c
status: completed
---

# 260428-upq-04c Summary

## Completed

- Removed active DOCX template scripts from `package.json`.
- Removed the active DOCX template script source files.
- Removed `docx` and `mammoth` from `package.json`.
- Updated `package-lock.json` and `pnpm-lock.yaml` so neither lockfile retains active DOCX parser/generator packages.
- Preserved nullable historical DOCX fields and compatibility DTO names in DB/types/runtime compatibility paths.

## Verification

- `rg -n '"docx"|"mammoth"|node_modules/docx|node_modules/mammoth|docx@|mammoth@|template:create|template:test' package.json package-lock.json pnpm-lock.yaml` - passed with no matches.
- `pnpm install --lockfile-only` - completed successfully and removed stale `docx`/`mammoth` entries from `pnpm-lock.yaml`.
- Historical compatibility fields remain in `src/types`, `src/lib/db`, and Prisma/migrations.

## Changed Files

- `src/lib/templates/create-template.ts`
- `src/lib/templates/test-template.ts`
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
