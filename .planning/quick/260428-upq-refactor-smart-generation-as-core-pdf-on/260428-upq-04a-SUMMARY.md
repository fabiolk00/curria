---
phase: 260428-upq
plan: 04a
subsystem: artifact-generation
tags: [pdf, agent-tools, preview-panel, compatibility]
requires: []
provides:
  - PDF-only generate_file rendering/upload/signing behavior
  - Preview context narrowed to active PDF artifacts
  - Compatibility response shape with docxUrl null and nullable docxPath metadata preserved
affects: [generate_file, preview-panel, pdf-only-product]
tech-stack:
  added: []
  patterns:
    - "Active artifact behavior is PDF-only while nullable DOCX fields remain compatibility-only."
key-files:
  created:
    - .planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-04a-SUMMARY.md
  modified:
    - src/lib/agent/tools/generate-file.ts
    - src/lib/agent/tools/generate-file.test.ts
    - src/context/preview-panel-context.tsx
    - src/components/dashboard/preview-panel.test.tsx
key-decisions:
  - "Removed active DOCX rendering and generateFileDeps.generateDOCX instead of leaving dormant generation tooling."
  - "Kept docxUrl: null and nullable docxPath metadata compatibility without writing new DOCX artifact paths."
patterns-established:
  - "PDF is the only active generated artifact in generate_file and preview context."
requirements-completed: []
duration: 5min
completed: 2026-04-29
---

# Phase 260428-upq Plan 04a: Generate File PDF-Only Artifact Renderer Summary

**PDF-only generate_file artifact rendering with nullable DOCX compatibility retained for historical response/state shapes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-29T02:19:55Z
- **Completed:** 2026-04-29T02:25:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Removed dormant DOCX renderer imports, helpers, exported `generateDOCX`, and `generateFileDeps.generateDOCX`.
- Kept successful generation on one PDF upload/signing path with `docxUrl: null`.
- Narrowed preview context to PDF files and kept preview tests tolerant of nullable historical `docxUrl`.

## Task Commits

1. **Task 1 RED: PDF-only generation dependency test** - `e0cf3c6` (test)
2. **Task 1 GREEN: Remove DOCX renderer from generate_file** - `88ebd6c` (feat)
3. **Task 2: Narrow preview context to PDF artifacts** - `4aabb87` (feat)

## Files Created/Modified

- `src/lib/agent/tools/generate-file.ts` - removed DOCX rendering code and kept active PDF generation/signing.
- `src/lib/agent/tools/generate-file.test.ts` - added PDF-only dependency/upload proof and updated validation-failure coverage.
- `src/context/preview-panel-context.tsx` - narrowed `PreviewFile.type` to `pdf`.
- `src/components/dashboard/preview-panel.test.tsx` - changed the active preview fixture to `docxUrl: null`.

## Decisions Made

- DOCX renderer removal happened in 04a even though template scripts still import it until 04c; this follows the plan dependency order where 04c deletes those scripts after active imports are gone.
- No schema, Prisma, or historical mapper fields were touched.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. Existing contact/summary placeholder strings in `generate-file.ts` are intentional generation fallbacks, not plan stubs.

## Threat Flags

None. The plan modified an existing artifact-generation trust boundary but introduced no new endpoint, auth path, file access pattern, or schema boundary.

## Verification

- `npx vitest run src/lib/agent/tools/generate-file.test.ts` - passed, 22 tests.
- `npx vitest run src/components/dashboard/preview-panel.test.tsx` - passed, 6 tests.
- `npx vitest run src/lib/agent/tools/generate-file.test.ts src/components/dashboard/preview-panel.test.tsx` - passed, 28 tests.
- `rg -n 'from ''docx''|from "docx"|generateDOCX|buildDocxDocument|createDocx|Packer\.toBuffer' src/lib/agent/tools/generate-file.ts src/context/preview-panel-context.tsx` - no matches.

## Issues Encountered

- The initial RED test failed as expected because `generateFileDeps` still exposed `generateDOCX`.
- An unrelated concurrent commit landed while executing this plan; no files from that work were touched or reverted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04a is complete. 04b can now remove active DOCX import/upload boundaries, and 04c can delete DOCX template tooling after 04b is complete.

## Self-Check: PASSED

- Summary file created.
- Task commits found: `e0cf3c6`, `88ebd6c`, `4aabb87`.
- Verified modified files exist.

---
*Phase: 260428-upq*
*Completed: 2026-04-29*
