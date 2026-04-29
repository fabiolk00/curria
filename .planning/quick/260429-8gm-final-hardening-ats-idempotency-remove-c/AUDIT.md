# Final Hardening Audit: ATS Idempotency + Chat Dead Code

Date: 2026-04-29
Task: `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c`
Status: implemented, reviewed, fixed/no-op, and regression-tested.

## Executive Result

ATS Enhancement and Job Targeting now share one canonical durable start-lock/idempotency implementation:

- Canonical module: `src/lib/agent/smart-generation-start-lock.ts`.
- Job-targeting compatibility wrapper: `src/lib/agent/job-targeting-start-lock.ts`.
- Smart Generation decision path acquires a start lock for both modes before session bootstrap.
- Duplicate running requests return `already_running` with HTTP 202.
- Duplicate completed requests return `already_completed` with HTTP 200 before a fresh quota check.
- Failed or blocked starts are marked failed/retryable.
- Artifact generation receives a stable lock-derived key, not a session-only key.

User-facing chat product code is removed from the primary UX:

- `/chat` and `/chat/[sessionId]` are deprecated compatibility redirects, not chat screens.
- Chat workspace, chat composer/message UI, chat upgrade card, and chat E2E transcript flow were deleted.
- Dashboard/history/settings links now route to generated resume comparison/history surfaces.
- Normal generation/history/preview/file flows do not import or call AI-chat entitlement helpers.

## Wave Completion

| Wave | Result |
|---|---|
| Wave 1 audit | Completed. Initial scan found remaining chat surfaces and ATS lock work needing canonicalization. |
| Wave 2 generic lock | Completed. Added `smart-generation-start-lock.ts`; kept job-targeting wrapper only. |
| Wave 3 decision integration | Completed. Both modes acquire the generic lock and use stable artifact idempotency. |
| Wave 4 tests | Completed. Added ATS duplicate/replay/failure/isolation tests and job-targeting regression tests. |
| Wave 5 chat cleanup | Completed for user-facing code. Backend chat endpoints remain deprecated compatibility only. |
| Wave 6 scans | Completed. Remaining references are classified below. |
| Wave 7 validation | Completed. Lint, typecheck, Vitest, targeted Vitest, and changed Playwright E2E passed. |

## ATS Idempotency State

Pre-change audit result:

- The workspace had Smart Generation lock behavior moving in the right direction, but the canonical implementation still lived under `job-targeting-start-lock.ts` and required hardening/verification.
- The task context risk was valid: any ATS path using only `${copy.idempotencyKeyPrefix}:${session.id}` would allow duplicate logical ATS generations because every click can create a new session.

Final result:

- ATS key identity: `workflowMode + userId + hash(normalizedCvState)`.
- Job Targeting key identity: `workflowMode + userId + hash(normalizedCvState) + hash(normalizedTargetJobDescription)`.
- Raw CV text and raw job descriptions are never logged or embedded directly in lock keys.
- Lock logs include safe metadata only: user id, workflow mode, session id, backend, status, and hashes.
- `executeSmartGenerationDecision` no longer has a job-targeting-only branch.
- Quota is split into resume readiness and quota readiness so completed duplicate replay can bypass a fresh quota check without consuming a new credit.

## Files Changed

### Locking and Smart Generation

| File | Change |
|---|---|
| `src/lib/agent/smart-generation-start-lock.ts` | New canonical durable lock module for ATS Enhancement and Job Targeting. Provides generic acquire/mark-running/mark-completed/mark-failed/reset helpers and hashed stable identities. |
| `src/lib/agent/smart-generation-start-lock.test.ts` | New coverage for ATS/job-targeting lock identity, running conflicts, completed replay, failure retry, changed CV, changed target, and user isolation. |
| `src/lib/agent/job-targeting-start-lock.ts` | Replaced with a compatibility wrapper that delegates to the generic module. |
| `src/lib/agent/job-targeting-start-lock.test.ts` | Reduced to wrapper compatibility/regression tests. |
| `src/lib/routes/smart-generation/decision.ts` | Acquires generic lock for both workflow modes, handles duplicate responses, marks failures retryable, and passes stable lock-derived artifact idempotency keys. |
| `src/lib/routes/smart-generation/decision.test.ts` | Added/updated coverage for lock failure cleanup, recoverable validation behavior, and stable artifact idempotency. |
| `src/lib/routes/smart-generation/readiness.ts` | Split resume readiness from quota readiness so completed duplicate replay does not require fresh credits. |
| `src/lib/routes/smart-generation/session-bootstrap.ts` | Uses canonical Smart Generation lock types. |
| `src/app/api/profile/smart-generation/route.test.ts` | Added end-to-end route tests for ATS duplicate running/completed replay, stable artifact keys, failure retry, distinct CVs, distinct users, and job-targeting regression. |

### Deprecated Chat Redirects and Route Helpers

| File | Change |
|---|---|
| `src/app/(auth)/chat/page.tsx` | Replaced chat page with deprecated compatibility redirect to `/profile-setup` or resume comparison when a session query exists. |
| `src/app/(auth)/chat/[sessionId]/page.tsx` | Replaced legacy chat session page with deprecated redirect to resume comparison. |
| `src/app/(auth)/chat/page.test.tsx` | Rewritten to assert redirects and no AI-chat entitlement dependency. |
| `src/lib/routes/app.ts` | Removed `CHAT_PATH`/`buildChatPath`; canonicalizes legacy chat URLs to profile setup or resume comparison. |
| `src/lib/routes/app.test.ts` | Updated route canonicalization expectations. |
| `src/lib/auth/redirects.test.ts` | Updated authenticated legacy chat redirect behavior. |

### Deprecated Backend Chat Compatibility

| File | Change |
|---|---|
| `src/app/api/agent/route.ts` | Kept as deprecated compatibility route with explicit comment. New callers use Smart Generation. |
| `src/app/api/session/[id]/messages/route.ts` | Kept as deprecated legacy transcript route with explicit comment. Normal resume flows must not call it. |
| `src/app/api/session/[id]/ai-chat-snapshot/route.ts` | Kept as deprecated legacy snapshot route with explicit comment. Normal resume flows use ownership/artifact rules. |
| `src/app/api/session/route.ts` | Updated stale blocked POST copy away from `/api/agent`. |

### User-Facing History and Navigation

| File | Change |
|---|---|
| `src/components/dashboard/session-list.tsx` | Session links now open resume comparison, not chat. |
| `src/components/dashboard/session-list.test.tsx` | Updated expected href. |
| `src/components/dashboard/sessions-list.tsx` | History rows now open resume comparison and empty state uses generation-centric copy. Removed loose response parsing. |
| `src/components/dashboard/sessions-list.test.tsx` | Updated route/copy expectations. |
| `src/components/dashboard/events.ts` | Removed chat/new-conversation/session-sync events; retained artifact refresh event. |
| `src/components/dashboard/session-documents-panel.tsx` | Removed chat/session-sync listeners. |
| `src/lib/resume-history/resume-generation-history.ts` | Legacy `chat` history rows now render as neutral generated resume history. |
| `src/lib/resume-history/resume-generation-history.test.ts` | Updated legacy history copy expectations. |
| `src/lib/generated-resume-mock.ts` | Updated mock history copy away from chat language. |
| `src/app/api/profile/resume-generations/route.test.ts` | Updated generated history copy expectations. |
| `src/components/resume/generated-resume-history.test.tsx` | Updated copy expectations. |
| `src/components/resume/generated-resume-history-page.test.tsx` | Updated copy expectations. |

### E2E and Browser Fixtures

| File | Change |
|---|---|
| `tests/e2e/auth.guard.spec.ts` | Authenticated `/chat` now redirects to profile setup. |
| `tests/e2e/core-funnel.spec.ts` | Uses generated resume comparison and PDF download instead of chat transcript flow. |
| `tests/e2e/long-vacancy-generation.spec.ts` | Submits long target JD through Smart Generation and opens comparison. |
| `tests/e2e/recoverable-validation-credit-refresh.spec.ts` | Removed dead chat workspace scenario; kept profile setup recoverable validation flow. |
| `tests/e2e/fixtures/api-mocks.ts` | Removed unused `/api/agent` SSE mock and chat message fixture path; added explicit comparison API mock. |
| `test-results/**` | Updated/deleted tracked E2E evidence for the remaining recoverable validation scenario after removing the chat workspace scenario. |

### Planning Artifacts

| File | Change |
|---|---|
| `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/AUDIT.md` | Final audit and scan report. |
| `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/PLAN.md` | Planner output. |
| `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/PLAN-REVIEW.md` | Plan reviewer output. |
| `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/REVIEW.md` | Code reviewer output. |
| `.planning/quick/260429-8gm-final-hardening-ats-idempotency-remove-c/REVIEW-FIX.md` | No-op fix report for the only review note: keep `.codex/config.toml` unstaged. |

## Files Deleted

| File | Reason |
|---|---|
| `src/components/dashboard/ai-chat-access-card.tsx` | Chat-only upgrade banner. |
| `src/components/dashboard/chat-interface.tsx` | Open-ended chat UI. |
| `src/components/dashboard/chat-interface.test.tsx` | Tests for removed chat UI. |
| `src/components/dashboard/chat-interface.route-stream.test.tsx` | Tests for removed chat streaming UI. |
| `src/components/dashboard/chat-message.tsx` | Chat-only message renderer. |
| `src/components/dashboard/resume-workspace.tsx` | Chat workspace shell. |
| `src/components/dashboard/resume-workspace.test.tsx` | Tests for removed chat workspace. |
| `tests/e2e/chat-transcript.spec.ts` | E2E chat transcript/product flow. |
| `tests/e2e/helpers/sse.ts` | Unused after removing `/api/agent` E2E fixture. |

## Remaining Chat References

Required scan:

`rg -n "Chat com IA|chat com IA|chat iterativo|AI chat|ai_chat|PRO_PLAN_REQUIRED|AI_CHAT_FEATURE|getAiChatAccess|aiChatAccessReason|aiChatAccessCode|ai-chat-snapshot|/api/agent|Nova Conversa|conversation|conversa" src tests scripts docs prisma README.md CLAUDE.md vercel.json --glob "!test-results/**"`

Classifications:

| Remaining group | Classification | Why retained |
|---|---|---|
| `src/app/api/agent/route.ts`, `src/lib/agent/request-orchestrator.ts`, related tests | Deprecated compatibility backend | No product UI links to it. Kept temporarily to avoid breaking unknown legacy clients. Explicitly marked deprecated at the route. |
| `src/app/api/session/[id]/messages/route.ts` and tests | Deprecated compatibility backend | Legacy transcript endpoint only. Normal history/preview/download flows do not call it. Explicitly marked deprecated. |
| `src/app/api/session/[id]/ai-chat-snapshot/route.ts` and tests | Deprecated compatibility backend | Legacy snapshot endpoint only. Normal generated resume access does not call it. Explicitly marked deprecated. |
| `src/lib/billing/ai-chat-access*` and tests | Deprecated backend support | Still used only by deprecated true-chat endpoints. Not imported by Smart Generation, history, preview, file access, profile setup, or generated resume routes. |
| `src/app/(auth)/chat/**`, route tests, `src/lib/routes/app.ts` | Deprecated compatibility redirect | These URLs no longer render chat; they redirect to profile setup or resume comparison. |
| `src/lib/openai/chat.ts` and OpenAI chat completions references | Internal LLM API naming | This is the OpenAI chat-completions helper used by generation internals, not product chat UI. |
| `src/lib/agent/**` references to `messages`, `conversation`, `AgentStreamChunk` | Internal legacy agent runtime | The generation pipelines still reuse some agent/tool infrastructure. Remaining chat runtime is isolated behind deprecated `/api/agent`. |
| `prisma` `Message`/migrations and `src/lib/db/session-messages.ts` | Legacy schema/historical data | Database/table removal was explicitly out of scope without a safe migration. |
| `docs/**`, `CLAUDE.md`, scripts targeting `/api/agent` | Historical/internal documentation and tooling | Not user-facing product UI. They should be cleaned in a separate docs/tooling pass if `/api/agent` is fully removed. |
| `src/components/dashboard/sidebar.test.tsx` `"Nova conversa"` | Negative test | Asserts the button is not rendered. |
| `src/app/(auth)/profile-setup/page.test.tsx`, `src/app/(auth)/dashboard/sessions/page.test.tsx` | Guard tests | Assert non-chat pages do not load AI-chat entitlement. |

No remaining user-facing pricing/dashboard/profile/history CTA opens a chat product surface.

## Remaining DOCX References

Required scan:

`rg -n "DOCX|docx|mammoth|application/vnd.openxmlformats-officedocument.wordprocessingml.document" . --glob "!node_modules/**" --glob "!test-results/**" --glob "!.next/**"`

Classifications:

| Remaining group | Classification | Why retained |
|---|---|---|
| `src/lib/agent/tools/generate-file.ts`, `src/lib/resume-generation/generate-billable-resume.ts`, file-access routes/types/hooks | PDF-only runtime with nullable DOCX compatibility | Current generation emits PDF and returns `docxUrl: null`; old nullable fields remain for API/DB compatibility. |
| `prisma/schema.prisma`, migrations, DB helpers | Historical compatibility | `outputDocxPath` remains nullable; no destructive schema migration in this task. |
| File/history tests containing `docxUrl: null` or legacy `docxPath` | Compatibility tests | Preserve old artifact/history semantics and locked preview protections. |
| Upload/parse tests containing DOCX MIME | Negative tests | Assert DOCX uploads are rejected under the PDF-only contract. |
| `README.md`, `CLAUDE.md`, `docs/**` | Stale/internal docs | Product runtime is PDF-only, but broad docs cleanup is separate from code hardening. |
| `mammoth` | No source/package hits | Already absent. |

## Validation

Passed:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm test -- smart-generation`
- `npm test -- ats-enhancement`
- `npm test -- job-targeting`
- `npm test -- resume-generation`
- `npm test -- billing`
- `npm test -- file`
- `npm test -- session`
- `npm run test:e2e -- --project=chromium tests/e2e/core-funnel.spec.ts tests/e2e/long-vacancy-generation.spec.ts tests/e2e/recoverable-validation-credit-refresh.spec.ts tests/e2e/auth.guard.spec.ts`

Code review:

- `gsd-code-reviewer` produced `REVIEW.md`.
- No critical or warning findings.
- One info finding: `.codex/config.toml` is unrelated and must stay unstaged.
- `gsd-code-fixer` produced `REVIEW-FIX.md` as a no-op fix report.

## Known Follow-Ups

- Fully delete deprecated backend chat endpoints and AI-chat entitlement helpers after confirming no external clients depend on them.
- Clean internal docs/scripts that still describe `/api/agent` as a primary flow.
- Consider a later safe migration for legacy `Message`/`messages` and `outputDocxPath` schema fields.
- Consider renaming internal OpenAI helper paths away from `chat` only if it can be done without broad churn.

## Risk Assessment

Low-to-medium.

Billing/idempotency risk was reduced by making ATS Enhancement use the same stable start-lock model as Job Targeting. The main residual risk is intentional compatibility: deprecated chat backend endpoints still exist, but they are isolated, route-marked, and no normal resume flow depends on their entitlement gate.
