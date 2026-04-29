---
phase: 260429-8gm-final-hardening-ats-idempotency-remove-c
reviewed: 2026-04-29T09:45:32Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - ".codex/config.toml"
  - "src/app/(auth)/chat/[sessionId]/page.tsx"
  - "src/app/(auth)/chat/page.test.tsx"
  - "src/app/(auth)/chat/page.tsx"
  - "src/app/api/profile/resume-generations/route.test.ts"
  - "src/app/api/profile/smart-generation/route.test.ts"
  - "src/app/api/session/route.ts"
  - "src/components/dashboard/ai-chat-access-card.tsx"
  - "src/components/dashboard/chat-interface.route-stream.test.tsx"
  - "src/components/dashboard/chat-interface.test.tsx"
  - "src/components/dashboard/chat-interface.tsx"
  - "src/components/dashboard/chat-message.tsx"
  - "src/components/dashboard/events.ts"
  - "src/components/dashboard/resume-workspace.test.tsx"
  - "src/components/dashboard/resume-workspace.tsx"
  - "src/components/dashboard/session-documents-panel.tsx"
  - "src/components/dashboard/session-list.test.tsx"
  - "src/components/dashboard/session-list.tsx"
  - "src/components/dashboard/sessions-list.test.tsx"
  - "src/components/dashboard/sessions-list.tsx"
  - "src/components/resume/generated-resume-history-page.test.tsx"
  - "src/components/resume/generated-resume-history.test.tsx"
  - "src/lib/agent/job-targeting-start-lock.test.ts"
  - "src/lib/agent/job-targeting-start-lock.ts"
  - "src/lib/agent/smart-generation-start-lock.test.ts"
  - "src/lib/agent/smart-generation-start-lock.ts"
  - "src/lib/auth/redirects.test.ts"
  - "src/lib/generated-resume-mock.ts"
  - "src/lib/resume-history/resume-generation-history.test.ts"
  - "src/lib/resume-history/resume-generation-history.ts"
  - "src/lib/routes/app.test.ts"
  - "src/lib/routes/app.ts"
  - "src/lib/routes/smart-generation/decision.test.ts"
  - "src/lib/routes/smart-generation/decision.ts"
  - "src/lib/routes/smart-generation/readiness.ts"
  - "src/lib/routes/smart-generation/session-bootstrap.ts"
  - "tests/e2e/auth.guard.spec.ts"
  - "tests/e2e/chat-transcript.spec.ts"
  - "tests/e2e/core-funnel.spec.ts"
  - "tests/e2e/fixtures/api-mocks.ts"
  - "tests/e2e/long-vacancy-generation.spec.ts"
  - "tests/e2e/recoverable-validation-credit-refresh.spec.ts"
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 260429-8gm-final-hardening-ats-idempotency-remove-c: Code Review Report

**Reviewed:** 2026-04-29T09:45:32Z
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Reviewed the uncommitted final-hardening changes for smart-generation start locks, lock-before-quota duplicate replay, stable ATS/job-targeting artifact idempotency keys, retired chat redirects, deleted chat UI/workspace surfaces, updated history/preview/file paths, and E2E fixture changes.

No Critical or Warning product findings were found. The smart-generation path avoids raw CV/job-description logging, duplicate completed starts bypass fresh quota checks while the start lock is retained, failed starts are marked retryable, and normal comparison/history/file flows do not depend on AI-chat entitlement gates.

The only finding is an Info-level staging risk for an unrelated local Codex config change.

## Info

### IN-01: Unrelated Codex Config Change In Working Tree

**File:** `.codex/config.toml:2`
**Issue:** The quick-task diff includes `model_reasoning_effort` changing from `medium` to `xhigh`. This is not product code and conflicts with the stated expectation that `.codex/config.toml` should not be part of the task staging set.
**Fix:** Keep `.codex/config.toml` unstaged for the product commit, or revert the local setting before staging:

```toml
model_reasoning_effort = "medium"
```

## Verification

Targeted tests passed:

```bash
npx vitest run src/lib/agent/smart-generation-start-lock.test.ts src/lib/agent/job-targeting-start-lock.test.ts src/app/api/profile/smart-generation/route.test.ts src/lib/routes/smart-generation/decision.test.ts src/lib/routes/app.test.ts src/lib/auth/redirects.test.ts 'src/app/(auth)/chat/page.test.tsx'
```

Residual test risk: full typecheck, full Vitest, and Playwright E2E were not run. The updated long-vacancy E2E now verifies Smart Generation submission and comparison routing, but no longer repeats `/api/session/:id/generate` cycles against the template preview/download flow; that artifact-stability coverage now depends on lower-level tests and other E2E coverage.

---

_Reviewed: 2026-04-29T09:45:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
