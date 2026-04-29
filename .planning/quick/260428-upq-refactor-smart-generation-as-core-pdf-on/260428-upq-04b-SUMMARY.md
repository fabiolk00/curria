---
phase: 260428-upq
plan: 04b
subsystem: upload-boundary
tags: [pdf, parser, agent-tools, request-validation, chat-ui]
requires:
  - phase: 260428-upq
    provides: 04a PDF-only artifact generation
provides:
  - PDF-only parse_file behavior
  - PDF-only agent tool schema and request upload validation
  - PDF-only chat upload helper and accept attribute
affects: [parse_file, agent-request-orchestrator, chat-interface, pdf-only-product]
tech-stack:
  added: []
  patterns:
    - "Non-PDF resume uploads are rejected before parser/tool execution."
key-files:
  created:
    - .planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-04b-SUMMARY.md
  modified:
    - src/lib/agent/tools/parse-file.ts
    - src/lib/agent/tools/parse-file.test.ts
    - src/lib/agent/tools/schemas.ts
    - src/lib/agent/tools/index.ts
    - src/lib/agent/tools/index.test.ts
    - src/lib/agent/request-orchestrator.ts
    - src/lib/agent/request-orchestrator.test.ts
    - src/lib/agent/agent-intents.ts
    - src/components/dashboard/chat-interface.tsx
    - src/components/dashboard/chat-interface.test.tsx
key-decisions:
  - "PDF-only import means parser, schema, request validation, and chat upload helper all reject DOCX and image inputs."
  - "The true-chat entitlement gate in request-orchestrator remains before request body validation."
patterns-established:
  - "Upload MIME allowlists should contain only application/pdf for active resume import."
requirements-completed: []
duration: 7min
completed: 2026-04-29
---

# Phase 260428-upq Plan 04b: PDF-Only Import Boundary Summary

**PDF-only resume import boundaries across parser, OpenAI tool schema, agent request validation, and chat upload UI.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-29T02:25:18Z
- **Completed:** 2026-04-29T02:32:20Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Removed DOCX parsing and image OCR from `parse_file`; non-PDF inputs now return a PDF-only validation failure.
- Removed DOCX/image MIME values from tool schemas, tool descriptions, and `/api/agent` request validation.
- Kept AI chat entitlement gating intact before upload body validation.
- Removed `.docx` accept/filename handling from chat upload code and added direct PDF helper coverage.

## Task Commits

1. **Task 1 RED: Parser PDF-only boundary tests** - `ffad652` (test)
2. **Task 1 GREEN: Make parse_file PDF-only** - `3e9124d` (feat)
3. **Task 2 RED: Tool/request upload boundary tests** - `1ad7bd8` (test)
4. **Task 2 GREEN: Make tool/request boundaries PDF-only** - `fb3c031` (feat)
5. **Task 3: Make chat upload UI PDF-only** - `8a3e8a5` (feat)

## Files Created/Modified

- `src/lib/agent/tools/parse-file.ts` - accepts PDF only and removes DOCX/image parser paths.
- `src/lib/agent/tools/parse-file.test.ts` - covers PDF success, DOCX rejection, image rejection, and scanned-PDF copy.
- `src/lib/agent/tools/schemas.ts` - narrows `parse_file` MIME schema to `application/pdf`.
- `src/lib/agent/tools/index.ts` - advertises `parse_file` as a PDF-only tool.
- `src/lib/agent/tools/index.test.ts` - covers PDF-only tool definition and DOCX validation rejection.
- `src/lib/agent/request-orchestrator.ts` - narrows request upload MIME validation to PDF.
- `src/lib/agent/request-orchestrator.test.ts` - proves DOCX upload rejection after chat entitlement gating.
- `src/lib/agent/agent-intents.ts` - removes DOCX as a generation-request keyword.
- `src/components/dashboard/chat-interface.tsx` - removes `.docx` upload handling and accept value.
- `src/components/dashboard/chat-interface.test.tsx` - covers PDF helper acceptance and DOCX rejection.

## Decisions Made

- Image OCR was removed from active `parse_file` behavior because this plan requires PDF-only active import, not only DOCX rejection.
- Historical nullable DOCX fields and compatibility response shapes were left untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. Existing upload trust boundaries were narrowed; no new network endpoint, auth path, file access pattern, or schema migration was introduced.

## Verification

- `npx vitest run src/lib/agent/tools/parse-file.test.ts` - passed, 4 tests.
- `npx vitest run src/lib/agent/tools/index.test.ts src/lib/agent/request-orchestrator.test.ts` - passed, 32 tests.
- `npx vitest run src/components/dashboard/chat-interface.test.tsx` - passed, 40 tests.
- `npx vitest run src/lib/agent/tools/parse-file.test.ts src/lib/agent/tools/index.test.ts src/lib/agent/request-orchestrator.test.ts src/components/dashboard/chat-interface.test.tsx` - passed, 76 tests.
- `rg -n 'mammoth|application/vnd.openxmlformats-officedocument.wordprocessingml.document|\.docx|DOCX|image/png|image/jpeg|PDF ou DOCX' [owned active files]` - no matches.

## Issues Encountered

- The parser RED test initially exposed the image OCR path attempting to initialize OpenAI without `OPENAI_API_KEY`; removing image OCR resolved this as part of the PDF-only boundary.
- No authentication gates occurred.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04b is complete. Because 04a and 04b are complete, 04c can now remove DOCX template scripts and the `docx`/`mammoth` package dependencies.

## Self-Check: PASSED

- Summary file created.
- Task commits found: `ffad652`, `3e9124d`, `1ad7bd8`, `fb3c031`, `8a3e8a5`.
- Verified modified files exist.

---
*Phase: 260428-upq*
*Completed: 2026-04-29*
