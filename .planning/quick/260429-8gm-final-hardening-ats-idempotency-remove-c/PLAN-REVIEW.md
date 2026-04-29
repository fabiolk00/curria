# PLAN REVIEW: Final Hardening - ATS Idempotency + Remove Chat Dead Code

Verdict: BLOCK

The plan is close and has the right conservative instincts around not deleting runtime chat/LLM compatibility code. It is not sufficient as written because the planned execution order can still block idempotent completed replays behind a fresh quota check, and one required static scan is likely not executable without either widening the planned file list or narrowing the scan scope.

## Blocking Required Adjustments

### 1. Duplicate completed Smart Generation must bypass fresh quota/billing checks

The plan explicitly says to maintain this order:

1. Auth/context/readiness/quota/validation.
2. Acquire durable start lock.
3. Bootstrap session and run generation.

That preserves the current risk: after a successful ATS/job-targeting generation consumes the user's last credit, a duplicate request for the same user/CV/target can hit quota failure before the start lock is checked. That would return a credit error instead of `already_completed`, even though the completed generation should replay without creating a session, rendering again, reserving another credit, or consuming another credit.

Required change:

- Split non-billing validation from billing validation.
- Run auth/context/readiness/body validation first.
- Acquire the durable canonical start lock before any quota gate that is meant only for new generation work.
- If the lock returns `already_running` or `already_completed`, return that normalized duplicate response without checking quota or billing.
- If the lock is newly acquired, then check quota before session bootstrap/pipeline/artifact dispatch.
- If quota fails after lock acquisition, mark the start lock failed/retryable before returning the quota response.

Required tests:

- ATS duplicate after completed returns `already_completed` with the completed session id even when the fresh quota check would fail.
- Job-targeting duplicate after completed has the same replay behavior.
- Duplicate replay does not call `createSession`, `dispatchSmartGenerationArtifact`, `reserveCreditForGenerationIntent`, `consumeCreditForGeneration`, or render/upload helpers.
- Newly acquired lock plus quota failure marks the lock failed so the same request can retry after credits are restored.
- Existing `generateBillableResume` completed-replay tests must still prove no second reservation, consumption, render, history mutation, or preview-lock change.

### 2. The chat static scan will fail against retained backend compatibility copy

The plan's second static scan searches `src/app src/components src/lib tests` for:

```text
Chat com IA|Nova conversa|Comece uma nova conversa|/chat
```

Current code has backend/runtime compatibility hits outside the plan's allowlist, including `src/lib/billing/ai-chat-access.ts` and multiple backend route/orchestrator tests that assert the existing "Chat com IA exclusivo do plano PRO" copy. The plan does not list those files as modified, so the validation gate is not executable as written.

Required change, choose one:

- Preferred narrow path: keep backend compatibility surfaces and narrow the static scan to product UI/navigation surfaces where `/chat` is actually user-facing. Separately list retained backend/API chat compatibility copy in `AUDIT.md` with a reason.
- Broader path: rename the retained backend access copy to neutral "assistente IA" language, add every affected backend/test file to the plan, and keep the broad scan.

Do not leave the scan broad while omitting the known backend/test files from the execution plan.

### 3. Canonical start-lock extraction must update the caught error type explicitly

Task 1 correctly introduces `SmartGenerationStartLockBackendError` and keeps legacy job-targeting wrappers. Task 2 says Smart Generation production imports must use the canonical module, but the plan should explicitly require `decision.ts` to catch `SmartGenerationStartLockBackendError`, not the legacy `JobTargetingStartLockBackendError`.

Required change:

- `src/lib/routes/smart-generation/decision.ts` and `session-bootstrap.ts` import only from `@/lib/agent/smart-generation-start-lock`.
- The wrapper exports `JobTargetingStartLockBackendError` as an alias of the canonical class, preserving `instanceof` behavior for old imports.
- Wrapper tests assert old imports and reset aliases still work, but production Smart Generation code has no wrapper import.

## Flags / Required Clarifications Before Execution

### Redirecting `/chat` is enough; deleting backend routes is not required for this task

The plan is right not to delete:

- `src/app/api/agent/route.ts`
- `src/lib/agent/request-orchestrator.ts`
- `src/app/api/session/[id]/messages/route.ts`
- `src/app/api/session/[id]/ai-chat-snapshot/route.ts`
- `src/lib/db/session-messages.ts`
- Prisma `Message`
- `src/lib/openai/chat.ts`

Those are runtime compatibility or LLM helper surfaces, and `src/lib/openai/chat.ts` is still used by generation/targeting tools. Removing public `/chat` UI/routes plus product callers is sufficient for "chat dead code" in this quick hardening pass.

Add one audit line that says backend/API chat compatibility remains intentionally reachable for legacy/runtime compatibility, while product navigation no longer sends users there.

### ResumeWorkspace deletion should be gated by comparison/profile coverage

Deleting `ResumeWorkspace`, `ChatInterface`, `ChatMessage`, and `ai-chat-access-card` is reasonable only after `/chat` becomes redirect-only and production imports are gone. Because `ResumeWorkspace` currently contains recoverable validation and credit-refresh UI behavior, execution should not just delete its tests; it must move equivalent launch-funnel proof to profile setup, Smart Generation, or comparison coverage.

Required evidence in `AUDIT.md`:

- Static scan showing no production imports of the removed UI files.
- E2E or component proof that recoverable validation still works from profile setup/comparison without the `/chat?session=` workspace path.
- Confirmation that `/dashboard/resume/compare/<sessionId>` is the canonical post-generation surface.

### Validation commands are mostly realistic but need the scan fix

The Vitest, typecheck, lint, and Playwright commands are realistic for this repository. Playwright has a configured web server, so the e2e command shape is valid.

Two caveats:

- `npm run lint` is a limited project lint target and does not cover most changed UI/test files. Keep `npm run typecheck` as the real broad compile gate, and rely on focused Vitest/E2E for the touched UI.
- The broad chat copy scan is currently unrealistic until Blocking Adjustment 2 is resolved.

### `.codex/config.toml` protection is adequate

The plan's `do_not_commit` entry plus staged-file guard is adequate. Keep the explicit reset/guard before commit:

```powershell
git reset -- .codex/config.toml
$staged = @(git diff --cached --name-only)
if ($staged -contains ".codex/config.toml") { Write-Error ".codex/config.toml is staged"; exit 1 }
```

Also record the final `git status --short .codex/config.toml` result in `AUDIT.md`.

## Suggested Narrower Execution Path

1. First commit: canonical start-lock extraction only.
   - Move implementation to `smart-generation-start-lock.ts`.
   - Keep `job-targeting-start-lock.ts` as a wrapper.
   - Update production Smart Generation imports and error catches to canonical names.
   - Run only start-lock and Smart Generation decision/route tests.

2. Second commit: idempotent duplicate and billing behavior.
   - Reorder lock/quota handling so duplicates replay before new-work quota checks.
   - Add zero-credit duplicate completed tests and no-second-billing assertions.
   - Add artifact idempotency tests for both ATS and job-targeting.

3. Third commit: UI chat quarantine only.
   - Make `/chat` and `/chat/[sessionId]` redirect-only.
   - Canonicalize `/chat?session=` and `/chat/<id>` to comparison routes.
   - Replace session-list callers with `buildResumeComparisonPath`.
   - Delete chat UI components only after static import scans pass.
   - Keep backend/API/runtime compatibility files untouched.

4. Final audit/validation commit.
   - Write `AUDIT.md` with scans, retained backend rationale, validation results, and `.codex/config.toml` status.
   - Do not broaden into deleting backend chat routes in this quick task.

## Pass Conditions For A Revised Plan

- Duplicate completed ATS/job-targeting requests replay from the start lock before quota/billing checks.
- Duplicate replay cannot reserve, consume, render, upload, or create another session.
- `smart-generation-start-lock.ts` is canonical and Smart Generation production code imports it directly.
- Legacy job-targeting imports remain compatible through a wrapper with no lock state or hashing logic.
- Public `/chat` surfaces are redirect-only, and product navigation points to profile setup or comparison.
- Backend chat/agent/message compatibility surfaces are retained and documented, not accidentally deleted.
- Static scans are executable against the chosen scope.
- Final commit/push excludes `.codex/config.toml`.
