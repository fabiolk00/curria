---
phase: 260428-upq-refactor-smart-generation-as-core-pdf-on
reviewed: 2026-04-29T02:49:35Z
depth: standard
files_reviewed: 58
files_reviewed_list:
  - package.json
  - src/app/(auth)/chat/page.test.tsx
  - src/app/(auth)/dashboard/page.test.tsx
  - src/app/(auth)/dashboard/page.tsx
  - src/app/(auth)/dashboard/sessions/page.test.tsx
  - src/app/(auth)/dashboard/sessions/page.tsx
  - src/app/(auth)/layout.test.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/profile-setup/page.test.tsx
  - src/app/(auth)/profile-setup/page.tsx
  - src/app/api/agent/route.test.ts
  - src/app/api/profile/ats-enhancement/route.test.ts
  - src/app/api/profile/ats-enhancement/route.ts
  - src/app/api/profile/smart-generation/route.test.ts
  - src/app/api/session/[id]/ai-chat-snapshot/route.test.ts
  - src/app/api/session/[id]/messages/route.test.ts
  - src/app/api/session/[id]/route.test.ts
  - src/app/api/session/route.test.ts
  - src/app/api/session/route.ts
  - src/components/dashboard/ai-chat-access-card.tsx
  - src/components/dashboard/chat-interface.test.tsx
  - src/components/dashboard/chat-interface.tsx
  - src/components/dashboard/dashboard-shell.tsx
  - src/components/dashboard/preview-panel.test.tsx
  - src/components/dashboard/resume-workspace.tsx
  - src/components/dashboard/sidebar.test.tsx
  - src/components/dashboard/sidebar.tsx
  - src/components/dashboard/welcome-guide.test.tsx
  - src/components/dashboard/welcome-guide.tsx
  - src/components/landing/o-que-e-ats-page.tsx
  - src/components/landing/pricing-comparison-table.test.tsx
  - src/components/landing/pricing-comparison-table.tsx
  - src/components/landing/pricing-section.test.tsx
  - src/components/resume/user-data-page.test.tsx
  - src/components/resume/user-data-page.tsx
  - src/context/preview-panel-context.tsx
  - src/lib/agent/agent-intents.ts
  - src/lib/agent/request-orchestrator.test.ts
  - src/lib/agent/request-orchestrator.ts
  - src/lib/agent/tools/generate-file.test.ts
  - src/lib/agent/tools/generate-file.ts
  - src/lib/agent/tools/index.test.ts
  - src/lib/agent/tools/index.ts
  - src/lib/agent/tools/parse-file.test.ts
  - src/lib/agent/tools/parse-file.ts
  - src/lib/agent/tools/schemas.ts
  - src/lib/asaas/optional-billing-info.ts
  - src/lib/auth/redirects.test.ts
  - src/lib/dashboard/welcome-guide.ts
  - src/lib/plans.ts
  - src/lib/pricing/plan-comparison.ts
  - src/lib/routes/app.test.ts
  - src/lib/routes/app.ts
  - src/lib/routes/smart-generation/decision.ts
  - src/lib/routes/smart-generation/session-bootstrap.ts
  - src/lib/templates/create-template.ts
  - src/lib/templates/test-template.ts
  - tests/e2e/profile-setup.spec.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 260428-upq: Code Review Report

**Reviewed:** 2026-04-29T02:49:35Z
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found

## Summary

Reviewed the production, test, and package-surface changes from `6f7b1cb..HEAD` plus current uncommitted changes, excluding planning artifacts, lockfiles, generated files, and the unrelated `.codex/config.toml` change.

No Critical issues were found. AI-chat entitlement checks appear constrained to true chat surfaces (`/api/agent`, chat page, messages, and chat snapshot); normal session history, preview, file access, and smart generation are still auth/ownership/billing-artifact based. Active generation/import behavior is PDF-only at runtime, and removed DOCX dependencies were not found in `package.json` or lockfiles.

The main risks are in Smart Generation start-lock idempotency: recoverable validation blocks are recorded as completed starts, and unexpected orchestration throws can leave a start lock running until TTL.

## Critical Issues

None.

## Warnings

### WR-01: Recoverable validation blocks are marked as completed generations

**File:** `src/lib/routes/smart-generation/decision.ts:144-164`

**Issue:** When the pipeline returns a recoverable validation block, this branch calls `markSmartGenerationStartLockCompletedDurable` even though no artifact was generated and the response is a 422 validation flow. A duplicate request for the same CV/target then returns `already_completed` from `src/lib/routes/smart-generation/decision.ts:118-128`. The UI treats `already_completed` as a real success in `src/components/resume/user-data-page.tsx:969-974`, stores the session, and routes to comparison instead of showing the recoverable validation modal/override path. This is an idempotency and billing-flow regression: a validation-blocked draft can look like a completed PDF generation.

**Fix:** Do not record recoverable validation as a completed start. Either add a distinct lock state that replays the recoverable 422 payload, or mark the start lock failed/retryable before returning the normalized validation response.

```ts
if (!pipeline.success || !pipeline.optimizedCvState) {
  const recoverableBlock = 'recoverableBlock' in pipeline ? pipeline.recoverableBlock : undefined

  if (smartGenerationStartIdempotencyKey && smartGenerationStartLockBackend) {
    await markSmartGenerationStartLockFailedDurable({
      idempotencyKey: smartGenerationStartIdempotencyKey,
      backend: smartGenerationStartLockBackend,
    })
  }

  return normalizeSmartGenerationPipelineFailure({
    pipeline,
    workflow,
    sessionId: session.id,
    patchedSession,
  })
}
```

Add a route test that submits a recoverable job-targeting request twice and asserts the second response does not return `already_completed`; it should return the same recoverable validation contract or retry the validation flow.

### WR-02: Start locks can remain running after unexpected orchestration errors

**File:** `src/lib/routes/smart-generation/decision.ts:137-142`

**Issue:** After a start lock is acquired at `src/lib/routes/smart-generation/decision.ts:132-134`, the code awaits `bootstrapSmartGenerationSession` and `runSmartGenerationPipeline` without an outer failure guard. Explicit result branches clear the lock for known pipeline, handoff, and dispatch failures, but thrown errors from session creation, lock session marking, profile patching, pipeline execution, preview consistency checks, or artifact dispatch escape without calling `markSmartGenerationStartLockFailedDurable`. The duplicate request then sees `already_running` until the 10-minute lock TTL, even though no active generation may exist.

**Fix:** Wrap the post-acquire orchestration in a `try/catch` and clear the start lock on unexpected errors unless it has already been marked completed or failed. Keep the existing explicit failure handling, but make the unexpected path retryable.

```ts
let startLockClosed = false

try {
  const { session, patchedSession } = await bootstrapSmartGenerationSession(context, {
    smartGenerationStartIdempotencyKey,
    smartGenerationStartLockBackend,
  })

  // existing pipeline, handoff, dispatch, and success handling...

  await markSmartGenerationStartLockCompletedDurable({
    idempotencyKey: smartGenerationStartIdempotencyKey,
    sessionId: session.id,
    backend: smartGenerationStartLockBackend,
  })
  startLockClosed = true
} catch (error) {
  if (!startLockClosed && smartGenerationStartIdempotencyKey && smartGenerationStartLockBackend) {
    await markSmartGenerationStartLockFailedDurable({
      idempotencyKey: smartGenerationStartIdempotencyKey,
      backend: smartGenerationStartLockBackend,
    }).catch(() => undefined)
  }
  throw error
}
```

Add tests that force `bootstrapSmartGenerationSession` or `runSmartGenerationPipeline` to throw after acquisition, then assert the same smart-generation request can be retried immediately instead of receiving `already_running`.

## Info

### IN-01: PDF-only runtime is enforced, but public tool types and tests still advertise DOCX/image parsing

**File:** `src/types/agent.ts:687-694`

**Issue:** `ParseFileInput.mime_type` still includes DOCX, PNG, and JPEG values even though the active product is PDF-only and `ParseFileInputSchema` now only allows `application/pdf`. The parse-file tests also keep a `mammoth` mock and DOCX extraction setup in `src/lib/agent/tools/parse-file.test.ts:9-19` and `src/lib/agent/tools/parse-file.test.ts:50-65`. Runtime behavior rejects these formats, but the type/test surface still communicates that non-PDF inputs are supported and can let future code compile against unsupported import paths.

**Fix:** Narrow `ParseFileInput.mime_type` to `application/pdf` and remove the `mammoth` mock/test setup. Keep negative tests by passing unsupported MIME values through an explicit cast at the call site, so the tests document runtime rejection without preserving unsupported public types.

---

## Verification

- Ran `npm test -- src/lib/agent/tools/parse-file.test.ts`; it passed.
- Full test suite was not run during this review.
- Lockfiles were inspected for `docx`/`mammoth` dependency remnants but were not counted as reviewed source files.

_Reviewed: 2026-04-29T02:49:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
