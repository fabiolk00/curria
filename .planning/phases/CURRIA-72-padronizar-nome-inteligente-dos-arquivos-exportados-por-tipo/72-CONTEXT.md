# Phase 72 Context

## Goal

Standardize intelligent resume export filenames so ATS enhancement exports use `Curriculo_{Nome}` and job-targeted exports use `Curriculo_{Nome}_{Vaga}` when a reliable target role is available.

## Problem

Download surfaces were using local hardcoded names such as `Resume.pdf`, `currículo-ats.pdf`, and `currículo-vaga.pdf`. That created inconsistent naming across preview, comparison, and file-route consumers.

## Decisions

- Add one canonical helper for filename normalization and final filename construction.
- Remove accents, invalid filename characters, and repeated separators while keeping names readable.
- Only append the target title when the flow is job targeting and the role title is reliable.
- Return canonical filename metadata from the file-download route so frontends consume the same decision.
- Keep the change scoped to download naming; do not change artifact storage paths or resume persistence.

## Verification

- `npm run typecheck`
- `npm run audit:copy-regression`
- `npx vitest run "src/lib/resume/export-filename.test.ts" "src/hooks/use-session-documents.test.tsx" "src/components/dashboard/session-documents-panel.test.tsx" "src/app/api/file/[sessionId]/route.test.ts"`
