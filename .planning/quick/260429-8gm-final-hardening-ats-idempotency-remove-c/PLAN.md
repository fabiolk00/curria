---
task_id: 260429-8gm
mode: quick-full
type: execute
title: Final Hardening - ATS Idempotency And Chat Dead Code Removal
autonomous: true
audit_status: "AUDIT.md was absent at planning time; executor must create/update it with static scan evidence."
do_not_commit:
  - .codex/config.toml
files_modified:
  - src/lib/agent/smart-generation-start-lock.ts
  - src/lib/agent/smart-generation-start-lock.test.ts
  - src/lib/agent/job-targeting-start-lock.ts
  - src/lib/agent/job-targeting-start-lock.test.ts
  - src/lib/routes/smart-generation/decision.ts
  - src/lib/routes/smart-generation/decision.test.ts
  - src/lib/routes/smart-generation/session-bootstrap.ts
  - src/app/api/profile/smart-generation/route.test.ts
  - src/lib/resume-generation/generate-billable-resume.test.ts
  - src/lib/jobs/processors/artifact-generation.test.ts
  - src/app/(auth)/chat/page.tsx
  - src/app/(auth)/chat/page.test.tsx
  - src/app/(auth)/chat/[sessionId]/page.tsx
  - src/lib/routes/app.ts
  - src/lib/routes/app.test.ts
  - src/lib/auth/redirects.test.ts
  - src/components/dashboard/session-list.tsx
  - src/components/dashboard/session-list.test.tsx
  - src/components/dashboard/sessions-list.tsx
  - src/components/dashboard/sessions-list.test.tsx
  - src/components/dashboard/chat-interface.tsx
  - src/components/dashboard/chat-interface.test.tsx
  - src/components/dashboard/chat-interface.route-stream.test.tsx
  - src/components/dashboard/chat-message.tsx
  - src/components/dashboard/resume-workspace.tsx
  - src/components/dashboard/resume-workspace.test.tsx
  - src/components/dashboard/ai-chat-access-card.tsx
  - tests/e2e/core-funnel.spec.ts
  - tests/e2e/long-vacancy-generation.spec.ts
  - tests/e2e/chat-transcript.spec.ts
  - tests/e2e/auth.guard.spec.ts
  - tests/e2e/recoverable-validation-credit-refresh.spec.ts
  - .planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/AUDIT.md
---

# Final Hardening Plan: ATS Idempotency + Remove Chat Dead Code

## Objective

Make Smart Generation idempotency explicit and canonical for both `ats_enhancement` and `job_targeting`, prove artifact generation reuses the stable start-lock boundary instead of session-only keys, and remove or quarantine user-facing chat product code that is no longer part of the launch funnel.

The executor must keep changes conservative and test-backed. Do not remove the Prisma `Message` model/table, `src/lib/db/session-messages.ts`, `src/lib/openai/chat.ts`, or backend chat/orchestration routes unless a task below explicitly says so. Those are persistence/runtime compatibility surfaces, not safe UI dead code for this quick task.

## Read First

- `AGENTS.md`
- `CLAUDE.md`
- `.planning/quick/260428-upq-refactor-smart-generation-as-core-pdf-on/260428-upq-01-SUMMARY.md`
- `src/lib/agent/job-targeting-start-lock.ts`
- `src/lib/routes/smart-generation/decision.ts`
- `src/lib/routes/smart-generation/session-bootstrap.ts`
- `src/app/api/profile/smart-generation/route.test.ts`
- `src/lib/resume-generation/generate-billable-resume.test.ts`
- `src/lib/routes/app.ts`
- `src/app/(auth)/chat/page.tsx`
- `src/components/dashboard/resume-workspace.tsx`

## Guardrails

- Strict TypeScript: do not add `any`; prefer existing domain types and discriminated unions.
- Do not log raw `cvState`, raw resume text, raw target job descriptions, request bodies, or generated resume content.
- Preserve preview-lock, history, credit reservation/finalization, billing reconciliation, and generated artifact semantics.
- Do not remove Prisma `Message` model/table or message persistence helpers.
- Do not commit `.codex/config.toml`; it was already dirty during planning.
- Keep `src/lib/openai/chat.ts` because it is the LLM helper used by ATS/job-targeting tools, not a user-facing chat product component.

## Task 1: Create the Canonical Smart Generation Start Lock

**Files**

- Create: `src/lib/agent/smart-generation-start-lock.ts`
- Create: `src/lib/agent/smart-generation-start-lock.test.ts`
- Modify: `src/lib/agent/job-targeting-start-lock.ts`
- Modify: `src/lib/agent/job-targeting-start-lock.test.ts`

**Implementation**

Move the current workflow-aware implementation from `job-targeting-start-lock.ts` into the new canonical `smart-generation-start-lock.ts`. Preserve the current key behavior:

- `ats_enhancement`: key prefix `ats-enhancement-start`, user id, normalized CV hash only.
- `job_targeting`: key prefix `job-targeting-start`, user id, normalized CV hash, normalized target-job hash.

Expose canonical exports from the new module:

- `SmartGenerationStartLockBackendError`
- `SmartGenerationStartLockBackend`
- `SmartGenerationStartLockAcquireResult`
- `buildSmartGenerationStartLockFingerprint`
- `tryAcquireSmartGenerationStartLock`
- `tryAcquireSmartGenerationStartLockDurable`
- `markSmartGenerationStartLockRunningSession`
- `markSmartGenerationStartLockRunningSessionDurable`
- `markSmartGenerationStartLockCompleted`
- `markSmartGenerationStartLockCompletedDurable`
- `markSmartGenerationStartLockFailed`
- `markSmartGenerationStartLockFailedDurable`
- `resetSmartGenerationStartLocksForTests`
- `normalizeCvStateForLock`
- `normalizeJobTargetForLock`

Leave `job-targeting-start-lock.ts` as a compatibility wrapper that re-exports the canonical helpers and keeps the existing job-targeting-specific names working:

- `JobTargetingStartLockBackendError` aliases the canonical error.
- `JobTargetingStartLockBackend` aliases the canonical backend type.
- `buildJobTargetingStartLockFingerprint`, `buildJobTargetingStartIdempotencyKey`, `tryAcquireJobTargetingStartLock*`, and `markJobTargetingStartLock*` delegate to canonical helpers with `workflowMode: 'job_targeting'`.
- `resetJobTargetingStartLocksForTests` delegates to `resetSmartGenerationStartLocksForTests`.

The wrapper must contain no lock state, Redis client, hashing logic, or logger calls. That logic belongs only in `smart-generation-start-lock.ts`.

**Tests**

Add/port tests in `smart-generation-start-lock.test.ts` for:

- ATS same user + semantically identical normalized CV returns `already_running` while running.
- ATS same user + same CV returns `already_completed` with the completed session id after completion.
- ATS failure marks the lock retryable and a repeat request acquires a new lock.
- ATS same user + different CV acquires a distinct lock.
- ATS different user + same CV acquires a distinct lock.
- Job targeting same user + same CV + same normalized target remains compatible with the old idempotency key prefix.
- Job targeting same user + same CV + different target acquires a distinct lock.
- Redis durable path preserves `redis` backend in running/completed/failed markers.
- Production without Redis still fails closed.
- Logger calls include ids, hashes, backend, and status only; sentinel raw name/phone/company/CV bullet/target-job text must not appear in serialized `logInfo`, `logWarn`, or `logError` calls.

Keep `job-targeting-start-lock.test.ts` narrow: wrapper compatibility and import compatibility only.

**Verify**

```powershell
npx vitest run src/lib/agent/smart-generation-start-lock.test.ts src/lib/agent/job-targeting-start-lock.test.ts
```

**Done**

There is exactly one canonical start-lock implementation file, both workflow modes are covered by stable hash-based idempotency, and legacy imports continue to work through the wrapper.

## Task 2: Use the Canonical Lock in Smart Generation and Prove Artifact Idempotency

**Files**

- Modify: `src/lib/routes/smart-generation/decision.ts`
- Modify: `src/lib/routes/smart-generation/session-bootstrap.ts`
- Modify: `src/lib/routes/smart-generation/decision.test.ts`
- Modify: `src/app/api/profile/smart-generation/route.test.ts`
- Modify: `src/lib/resume-generation/generate-billable-resume.test.ts`
- Modify: `src/lib/jobs/processors/artifact-generation.test.ts`

**Implementation**

Update Smart Generation imports in `decision.ts` and `session-bootstrap.ts` to use `@/lib/agent/smart-generation-start-lock`, not the compatibility wrapper.

Maintain the current order:

1. Auth/context/readiness/quota/validation.
2. Acquire durable start lock.
3. Bootstrap session and mark running session on the lock.
4. Run ATS or job-targeting pipeline.
5. Validate handoff against optimized state and latest `cv_versions`.
6. Dispatch `generate_file`.
7. Mark lock completed only after artifact dispatch succeeds.
8. Mark lock failed for pipeline failure, recoverable validation block, handoff failure, `generate_file` failure, or thrown errors.

Artifact idempotency must be stable-start-lock based for both modes:

- `dispatchSmartGenerationArtifact(...)` receives `idempotencyKey: `${startLock.idempotencyKey}:artifact``.
- Do not fall back to `session.id` for Smart Generation after a lock is acquired.
- Keep session-generate/manual artifact idempotency unchanged.
- Do not change `generateBillableResume` billing, preview-lock, history, reconciliation, or completed-replay behavior except to add regression coverage if missing.

If a test currently imports `resetJobTargetingStartLocksForTests`, move Smart Generation route/decision tests to `resetSmartGenerationStartLocksForTests` from the canonical module. Leave one wrapper test proving the old reset alias still works.

**Tests**

Add/update route or decision tests for:

- ATS duplicate while running returns normalized `already_running`, creates one session, runs one ATS pipeline, and dispatches no second artifact.
- ATS duplicate after completed returns normalized `already_completed` with the completed session id and creates no second session.
- ATS failure paths mark failed and permit retry with the same user/CV.
- ATS same user/different CV creates a different lock and is not deduped.
- ATS different user/same CV creates a different lock and is not deduped.
- Job-targeting regression: same user/CV/target still dedupes; same user/CV/different target does not dedupe.
- Recoverable job-targeting validation returns the recoverable payload again on retry rather than getting stuck as completed.
- Successful ATS and job-targeting artifact dispatch call `generate_file` with `idempotency_key` matching `^(ats-enhancement-start|job-targeting-start):...:artifact$`.
- `generateBillableResume` replays an existing completed generation by idempotency key without reserving another credit or rendering again, including locked preview behavior.
- `processArtifactGenerationJob` passes the job idempotency key through to `generateBillableResume` and updates the correct session or target generated output once.

**Verify**

```powershell
npx vitest run src/lib/agent/smart-generation-start-lock.test.ts src/lib/agent/job-targeting-start-lock.test.ts src/lib/routes/smart-generation/decision.test.ts src/app/api/profile/smart-generation/route.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/processors/artifact-generation.test.ts
```

**Done**

Smart Generation production code imports only the canonical lock module, both modes use stable start-lock artifact keys, duplicate/running/completed/failure semantics are covered, and billing/history/preview-lock tests remain green.

## Task 3: Quarantine User-Facing Chat Code, Add Static Audit, Validate, Commit, Push

**Files**

- Modify: `src/app/(auth)/chat/page.tsx`
- Modify: `src/app/(auth)/chat/page.test.tsx`
- Modify: `src/app/(auth)/chat/[sessionId]/page.tsx`
- Modify: `src/lib/routes/app.ts`
- Modify: `src/lib/routes/app.test.ts`
- Modify: `src/lib/auth/redirects.test.ts`
- Modify: `src/components/dashboard/session-list.tsx`
- Modify: `src/components/dashboard/session-list.test.tsx`
- Modify: `src/components/dashboard/sessions-list.tsx`
- Modify: `src/components/dashboard/sessions-list.test.tsx`
- Delete if no production imports remain: `src/components/dashboard/chat-interface.tsx`
- Delete if no production imports remain: `src/components/dashboard/chat-interface.test.tsx`
- Delete if no production imports remain: `src/components/dashboard/chat-interface.route-stream.test.tsx`
- Delete if no production imports remain: `src/components/dashboard/chat-message.tsx`
- Delete if no production imports remain: `src/components/dashboard/resume-workspace.tsx`
- Delete if no production imports remain: `src/components/dashboard/resume-workspace.test.tsx`
- Delete if no production imports remain: `src/components/dashboard/ai-chat-access-card.tsx`
- Modify/delete as appropriate: `tests/e2e/chat-transcript.spec.ts`
- Modify: `tests/e2e/core-funnel.spec.ts`
- Modify: `tests/e2e/long-vacancy-generation.spec.ts`
- Modify: `tests/e2e/auth.guard.spec.ts`
- Modify: `tests/e2e/recoverable-validation-credit-refresh.spec.ts`
- Create/update: `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/AUDIT.md`

**Implementation**

Remove public navigation to chat and quarantine the old chat routes:

- `/chat` with no session redirects to `/profile-setup`.
- `/chat?session=<id>` redirects to `/dashboard/resume/compare/<id>`.
- `/chat/[sessionId]` redirects to `/dashboard/resume/compare/<sessionId>`.
- `canonicalizeAppPath('/chat?session=sess_123')` and `canonicalizeAppPath('/chat/sess_123')` return the comparison route.
- `canonicalizeAppPath('/chat')` returns `/profile-setup`.

Update or remove route helpers:

- Replace product callers of `buildChatPath(sessionId)` with `buildResumeComparisonPath(sessionId)`.
- Remove `buildChatPath` and `CHAT_PATH` if no production callers remain. If external test compatibility needs a helper, rename it to an explicit legacy helper and keep it internal to `app.ts`.
- Update `SessionList` and `SessionsList` to open resume comparison/history, not chat.
- Remove chat copy such as `Nova conversa`, `Chat com IA`, `Comece uma nova conversa`, and `/chat` links from user-facing components.

Delete user-facing chat UI components only after static scans show no production imports:

- `ChatInterface`
- `ChatMessage`
- `ResumeWorkspace`
- `ChatUpgradeCard`/`ai-chat-access-card`

Do not delete backend compatibility surfaces in this task:

- Keep `src/app/api/agent/route.ts`.
- Keep `src/lib/agent/request-orchestrator.ts`.
- Keep `src/app/api/session/[id]/messages/route.ts`.
- Keep `src/app/api/session/[id]/ai-chat-snapshot/route.ts`.
- Keep `src/lib/db/session-messages.ts`.
- Keep Prisma `Message`.

Rebase E2E coverage on the launch funnel instead of deleting release proof:

- `auth.guard.spec.ts` should prove authenticated users land on `/profile-setup` or another canonical non-chat route, not `/chat`.
- `core-funnel.spec.ts` should exercise profile setup, smart generation/comparison, and protected PDF download using existing mocks.
- `long-vacancy-generation.spec.ts` should use the Smart Generation/profile setup path or be replaced by a route/unit stress test for long vacancy payloads if browser UI coverage is no longer appropriate.
- `recoverable-validation-credit-refresh.spec.ts` should keep the profile setup recoverable flow; remove or replace the workspace `/chat?session=` variant with comparison/profile setup coverage.
- Delete `chat-transcript.spec.ts` if its only purpose is the removed chat transcript UI.

Create/update `AUDIT.md` with:

- Initial audit state: `AUDIT.md` absent at plan time.
- List of removed/quarantined user-facing chat files.
- List of intentionally retained backend/runtime files and why.
- Static scan commands and results.
- Test commands and pass/fail status.
- Confirmation that `.codex/config.toml` was not staged or committed.

**Static Scans**

Run these and paste results into `AUDIT.md`:

```powershell
# No production imports of removed chat UI files.
$bad = @(rg -n "chat-interface|chat-message|resume-workspace|ai-chat-access-card|ChatInterface|ChatMessage|ResumeWorkspace|ChatUpgradeCard" src/app src/components src/lib --glob "!**/*.test.ts" --glob "!**/*.test.tsx" 2>$null)
if ($bad.Count -gt 0) { $bad; exit 1 }

# No user-facing product links/copy for the retired chat UI outside compatibility route tests/helpers.
$allowed = @(
  "src/app/(auth)/chat/page.tsx",
  "src/app/(auth)/chat/[sessionId]/page.tsx",
  "src/app/(auth)/chat/page.test.tsx",
  "src/lib/routes/app.ts",
  "src/lib/routes/app.test.ts",
  "src/lib/auth/redirects.test.ts"
)
$hits = @(rg -n "Chat com IA|Nova conversa|Comece uma nova conversa|/chat" src/app src/components src/lib tests --glob "!**/node_modules/**" 2>$null | ForEach-Object { $_ -replace "\\","/" })
$bad = $hits | Where-Object {
  $line = $_
  -not ($allowed | Where-Object { $line.StartsWith($_ + ":") })
}
if ($bad) { $bad; exit 1 }

# Prisma Message/table compatibility is preserved.
$required = @("model Message", "from('messages')", "session-messages")
foreach ($pattern in $required) {
  $hit = @(rg -n --fixed-strings $pattern prisma src/lib/db src/app/api/session 2>$null | Select-Object -First 1)
  if ($hit.Count -eq 0) { Write-Error ("Missing preserved message compatibility marker: " + $pattern); exit 1 }
}

# No .codex/config.toml staged.
$staged = @(git diff --cached --name-only)
if ($staged -contains ".codex/config.toml") { Write-Error ".codex/config.toml is staged"; exit 1 }
```

**Verify**

```powershell
npx vitest run src/lib/agent/smart-generation-start-lock.test.ts src/lib/agent/job-targeting-start-lock.test.ts src/lib/routes/smart-generation/decision.test.ts src/app/api/profile/smart-generation/route.test.ts src/lib/resume-generation/generate-billable-resume.test.ts src/lib/jobs/processors/artifact-generation.test.ts src/lib/routes/app.test.ts src/lib/auth/redirects.test.ts "src/app/(auth)/chat/page.test.tsx" src/components/dashboard/session-list.test.tsx src/components/dashboard/sessions-list.test.tsx src/components/resume/user-data-page.test.tsx
npm run typecheck
npm run lint
npm run test:e2e -- --project=chromium tests/e2e/profile-setup.spec.ts tests/e2e/recoverable-validation-credit-refresh.spec.ts tests/e2e/core-funnel.spec.ts tests/e2e/long-vacancy-generation.spec.ts tests/e2e/auth.guard.spec.ts
```

If the full E2E gate is too slow in the executor environment, run at minimum `profile-setup.spec.ts`, `recoverable-validation-credit-refresh.spec.ts`, and every E2E file changed by this task. Record any skipped command and reason in `AUDIT.md`.

**Commit And Push**

```powershell
git status --short
git add src tests .planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/AUDIT.md
git reset -- .codex/config.toml
$staged = @(git diff --cached --name-only)
if ($staged -contains ".codex/config.toml") { Write-Error ".codex/config.toml is staged"; exit 1 }
git commit -m "fix: harden smart generation idempotency and remove chat dead code"
git push
```

**Done**

The public chat UI is gone or redirected, no product code links users to `/chat`, retained backend message/runtime compatibility is documented, static scans are recorded, validation passes, and the final commit/push excludes `.codex/config.toml`.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Moving lock code breaks legacy job-targeting imports. | Keep `job-targeting-start-lock.ts` as a wrapper and retain wrapper tests. |
| Duplicate ATS completion gets stuck because failed/recoverable paths do not clear the lock. | Explicit route/decision tests for completed, running, failed, retry, and recoverable validation. |
| Artifact generation accidentally falls back to session id and double-charges/rerenders. | Assert `generate_file` and `generateBillableResume` use stable start-lock idempotency keys and replay existing generations. |
| Raw CV/job data leaks into logs while adding canonical lock diagnostics. | Sentinel raw-value logger tests across `logInfo`, `logWarn`, and `logError`. |
| Chat UI deletion removes a still-used workspace recovery flow. | Keep profile setup recoverable override coverage and preserve backend override route; replace workspace E2E coverage rather than deleting recoverable behavior. |
| Removing chat files breaks `Message` persistence assumptions. | Do not delete Prisma `Message`, `session-messages.ts`, or backend routes; add static preserved-marker scan. |
| Dirty local config is accidentally committed. | Explicit `git reset -- .codex/config.toml` and staged-file guard before commit. |

## Final Success Criteria

- `src/lib/agent/smart-generation-start-lock.ts` is the only file with lock state, Redis client, hashing, and lock logging.
- `src/lib/agent/job-targeting-start-lock.ts` is compatibility-only.
- Smart Generation route/session bootstrap imports the canonical lock module.
- ATS and job targeting both use stable start-lock artifact idempotency keys.
- Automated tests cover duplicate/running/completed/failure/same-vs-different CV/user, job-targeting regression, and artifact replay.
- Public chat UI/routes are removed or redirect-only, and no production product surface links to `/chat`.
- `AUDIT.md` records static scans, retained compatibility surfaces, and validation results.
- `.codex/config.toml` is not committed.
