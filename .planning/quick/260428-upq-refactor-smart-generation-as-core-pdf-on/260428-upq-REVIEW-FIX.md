---
phase: 260428-upq-refactor-smart-generation-as-core-pdf-on
fixed_at: 2026-04-29T03:01:58Z
review_path: .planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 260428-upq-refactor-smart-generation-as-core-pdf-on: Code Review Fix Report

**Fixed at:** 2026-04-29T03:01:58Z
**Source review:** .planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Recoverable validation blocks are marked as completed generations

**Files modified:** `src/lib/routes/smart-generation/decision.ts`, `src/lib/routes/smart-generation/decision.test.ts`
**Commit:** d466d1b
**Applied fix:** Recoverable smart-generation validation failures now mark the start lock failed/retryable instead of completed, with duplicate-start coverage proving the same request returns the recoverable validation contract again instead of `already_completed`.

### WR-02: Start locks can remain running after unexpected orchestration errors

**Files modified:** `src/lib/routes/smart-generation/decision.ts`, `src/lib/routes/smart-generation/decision.test.ts`
**Commit:** 0d4f0f8
**Applied fix:** Post-acquire orchestration is wrapped in a guarded try/catch that marks the start lock failed on unexpected bootstrap or pipeline errors, with retry coverage for both failure points.

### IN-01: PDF-only runtime is enforced, but public tool types and tests still advertise DOCX/image parsing

**Files modified:** `src/types/agent.ts`, `src/lib/agent/tools/parse-file.test.ts`
**Commit:** 0150036
**Applied fix:** `ParseFileInput.mime_type` is now PDF-only, and parse-file tests no longer mock DOCX extraction. Unsupported MIME rejection tests use explicit casts to document runtime validation without preserving unsupported public input types.

---

_Fixed: 2026-04-29T03:01:58Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
