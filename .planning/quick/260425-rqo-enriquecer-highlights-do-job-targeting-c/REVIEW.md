---
phase: 260425-rqo-enriquecer-highlights-do-job-targeting-c
reviewed: 2026-04-25T23:07:39.6795546Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/agent/tools/detect-cv-highlights.ts
  - src/lib/agent/job-targeting-pipeline.ts
  - src/lib/agent/tools/pipeline.test.ts
  - src/lib/agent/tools/detect-cv-highlights.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 260425-rqo: Code Review Report

**Reviewed:** 2026-04-25T23:07:39.6795546Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the four scoped files with focus on ATS behavior when `jobKeywords` are absent, the new job-targeting keyword extraction path, prompt changes, and regression coverage. I also ran `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts`; both suites passed (`46` tests passed, `1` skipped).

The implementation is fail-safe when `jobKeywords` is absent, but the new keyword source is narrower than the prompt contract and can disable the intended vacancy-aware ranking on strong matches. Coverage for the prompt wording itself also remains partially disabled.

## Warnings

### WR-01: Gap-only keyword extraction weakens or disables job-targeting highlight prioritization

**File:** `src/lib/agent/job-targeting-pipeline.ts:78-84,317-330`
**Issue:** `extractJobKeywords()` is sourced only from `session.agentState.gapAnalysis?.result?.missingSkills`. By contract, `missingSkills` are the skills that are missing or underrepresented, not the strongest vacancy signals already present in the rewritten CV. That creates two behavior problems:

1. When a job-targeting run is a strong match and `missingSkills` is empty, the detector gets `jobKeywords: []` and falls back to generic ATS highlighting even though `targetingPlan` already contains vacancy-aligned signals.
2. When `missingSkills` contains truly absent skills, the prompt tie-breaker is biased toward terms that cannot be highlighted from the rewritten text at all.

This means the new "vacancy prioritization" branch is either inactive on strong matches or driven by the wrong signal set.

**Fix:**
```ts
function extractJobKeywords(targetingPlan: Session['agentState']['targetingPlan']): string[] {
  return Array.from(new Set(
    [
      ...(targetingPlan?.mustEmphasize ?? []),
      ...(targetingPlan?.focusKeywords ?? []),
    ]
      .map((value) => value.trim())
      .filter(Boolean),
  )).slice(0, 20)
}

const jobKeywords = extractJobKeywords(targetingPlan)
```

If gaps still need to influence ties, add `missingSkills` only as a last fallback, not as the primary source. Add a pipeline test where `missingSkills` is empty but `targetingPlan.mustEmphasize` is populated, and assert non-empty `jobKeywords`.

## Info

### IN-01: Prompt-hardening regression guard is still skipped

**File:** `src/lib/agent/tools/detect-cv-highlights.test.ts:149-165`
**Issue:** The only test that asserts the broader prompt hardening rules is still `it.skip(...)`. The active tests verify the optional vacancy block is present or absent, but they do not execute assertions for the semantic-closure and anti-generic-start guidance in the changed prompt. A future prompt edit can silently drop those instructions without failing CI.

**Fix:** Re-enable this test or replace it with a smaller active assertion that checks the hardening strings that must remain invariant. If the team wants to avoid brittle full-prompt checks, assert only the critical clauses added in this area.

---

_Reviewed: 2026-04-25T23:07:39.6795546Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
