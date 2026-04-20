---
phase: 43
fixed_at: 2026-04-20T00:43:03.9810205-03:00
review_path: C:\CurrIA\.planning\phases\CURRIA-43-refactor-export-and-billing-pipeline-resilience\REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 43: Code Review Fix Report

**Fixed at:** 2026-04-20T00:43:03.9810205-03:00
**Source review:** `C:\CurrIA\.planning\phases\CURRIA-43-refactor-export-and-billing-pipeline-resilience\REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Schema fallback bypasses billable-export eligibility and pre-charge quota checks

**Files modified:** `src/lib/resume-generation/generate-billable-resume.ts`, `src/lib/resume-generation/generate-billable-resume.test.ts`
**Commit:** `ad6f375`
**Applied fix:** Deferred schema-unavailable fallback returns until after the normal billable-source and pre-charge quota checks run, and added regressions proving fallback exports still reject `manual` sources and no-credit users before rendering. Requires human verification of the updated control-flow logic.

### WR-02: Fixed legacy generation ids can undercharge repeated exports after fallback

**Files modified:** `src/lib/resume-generation/generate-billable-resume.ts`, `src/lib/resume-generation/generate-billable-resume.test.ts`
**Commit:** `4b87e37`
**Applied fix:** Made fallback billing ids unique per export intent by incorporating the idempotency key or a deterministic CV snapshot hash, and added regressions proving repeated fallback exports in the same session scope use distinct billing anchors. Requires human verification of the billing-anchor semantics.

---

_Fixed: 2026-04-20T00:43:03.9810205-03:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
