---
phase: CURRIA-43-refactor-export-and-billing-pipeline-resilience
reviewed: 2026-04-20T03:36:31Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/resume-generation/generate-billable-resume.ts
  - src/lib/resume-generation/generate-billable-resume.test.ts
  - src/lib/asaas/quota.ts
  - src/lib/asaas/quota.test.ts
  - src/lib/jobs/processors/artifact-generation.ts
  - src/lib/jobs/processors/artifact-generation.test.ts
  - src/app/api/session/[id]/generate/route.ts
  - src/app/api/session/[id]/generate/route.test.ts
  - src/lib/jobs/processors/shared.ts
  - src/lib/jobs/repository.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-04-20T03:36:31Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The review focused on the Phase 43 export hardening changes across billable generation, Asaas quota fallback, durable artifact processing, and the session generate route.

The main regressions are both in the new no-`resume_generations` fallback path: it now bypasses the existing billable-export guardrails before rendering, and it reuses a fixed synthetic generation id that can suppress future charges for later exports in the same session scope.

## Warnings

### WR-01: Schema fallback bypasses billable-export eligibility and pre-charge quota checks

**File:** `src/lib/resume-generation/generate-billable-resume.ts:275-292, 335-352, 440-457`
**Issue:** When `resume_generations` lookup or insert fails, the function returns through `generateWithoutResumeGenerationPersistence(...)` before executing the normal `getLatestCvVersionForScope(...)` and `checkUserQuota(...)` guardrails at lines 407-425. In practice, a degraded schema can now allow exports from non-billable sources such as `manual`, and it also wastes rendering work for users who already have no credits because the insufficient-credit result only arrives after file generation.
**Fix:**
```ts
const latestCvVersion = await getLatestCvVersionForScope(input.sessionId, input.targetId)
if (!latestCvVersion || !BILLABLE_CV_VERSION_SOURCES.has(latestCvVersion.source)) {
  return {
    output: toolFailure(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Gere uma nova versão otimizada pela IA antes de exportar este currículo.',
    ),
  }
}

const hasCredits = await checkUserQuota(input.userId)
if (!hasCredits) {
  return {
    output: toolFailure(
      TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
      'Seus créditos acabaram. Gere um novo currículo quando houver saldo disponível.',
    ),
  }
}
```
Run those checks before any early return into the schema-unavailable fallback, and add regressions in `src/lib/resume-generation/generate-billable-resume.test.ts` for `manual` source and `no credits` while `resume_generations` is unavailable.

### WR-02: Fixed legacy generation ids can undercharge repeated exports after fallback

**File:** `src/lib/resume-generation/generate-billable-resume.ts:191-214`
**Issue:** The fallback path derives `legacyGenerationId` from only `sessionId` plus `targetId/base`. If `resume_generations` app reads are degraded but `consume_credit_for_generation(...)` still works, every later export in the same base/target scope reuses the same synthetic id. The billing RPC is idempotent on `resume_generation_id`, so a second successful export can return `true` without deducting another credit, which violates the phase’s billing-safety goal.
**Fix:**
```ts
const legacyGenerationId = [
  'legacy',
  input.sessionId,
  input.targetId ?? 'base',
  input.idempotencyKey ?? createHash('sha256').update(JSON.stringify(input.sourceCvState)).digest('hex'),
].join(':')
```
Make the fallback billing anchor unique per logical generation intent, not per session scope. At minimum it should incorporate the request idempotency key; if that is absent, use a deterministic snapshot fingerprint. Add a regression in `src/lib/resume-generation/generate-billable-resume.test.ts` that performs two distinct successful fallback exports in the same session and asserts the billing ids differ.

---

_Reviewed: 2026-04-20T03:36:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
