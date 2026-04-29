# Quick Task 260428-upq: Smart Generation Core PDF-Only Flow - Research

**Researched:** 2026-04-29 [VERIFIED: system date]
**Domain:** Next.js App Router guided resume generation, PDF artifact generation, AI chat de-primary refactor [VERIFIED: AGENTS.md; src/app/api/profile/smart-generation/route.ts:8-19]
**Confidence:** HIGH for code inventory, MEDIUM for product-order recommendations [VERIFIED: codebase grep; src/lib/routes/app.ts:1-24]

<user_constraints>
## User Constraints

- Task: Refactor Smart Generation as the core PDF-only guided resume flow and remove AI chat as the primary product surface. [VERIFIED: user prompt]
- Locked override: "dont generate any docx files and logic - we just work with PDF". [VERIFIED: user prompt]
- Do not edit production source files during research. [VERIFIED: user prompt]
- Write only this research output file. [VERIFIED: user prompt]
- Do not include raw resume text or raw job description in this report. [VERIFIED: user prompt]
</user_constraints>

## Project Constraints From CLAUDE.md

- Preserve brownfield product behavior unless scope explicitly changes; this task explicitly changes the primary product surface, but adjacent billing, ownership, and persisted artifact behavior should remain conservative. [VERIFIED: CLAUDE.md]
- Keep route handlers thin and put orchestration in `src/lib/**`; the Smart Generation route already follows context/decision/response modules. [VERIFIED: CLAUDE.md; src/app/api/profile/smart-generation/route.ts:3-19]
- Validate external input with `zod`; Smart Generation validates `CVStateSchema` plus optional `targetJobDescription`. [VERIFIED: CLAUDE.md; src/lib/routes/smart-generation/context.ts:1-14]
- Use structured logs through `logInfo`, `logWarn`, and `logError`; current trust, chat-access, lock, generation, and file-access paths already do this. [VERIFIED: CLAUDE.md; src/lib/routes/smart-generation/context.ts:24-35; src/lib/agent/request-orchestrator.ts:348-371; src/lib/agent/job-targeting-start-lock.ts:76-94]
- Treat `cvState` as canonical resume truth and `agentState` as operational context; Smart Generation bootstraps `cvState` plus operational `agentState` before running pipelines. [VERIFIED: CLAUDE.md; src/lib/routes/smart-generation/session-bootstrap.ts:53-61]
- Preserve dispatcher and `ToolPatch` patterns for agent/generation changes; Smart Generation dispatches `generate_file` through `dispatchToolWithContext`. [VERIFIED: CLAUDE.md; src/lib/routes/smart-generation/dispatch.ts:17-30]
- Prefer small, test-backed changes over broad rewrites. [VERIFIED: CLAUDE.md]

## Summary

Smart Generation is already the right route boundary for the new core guided flow: it resolves auth/trust/input, chooses ATS vs job-targeting mode, validates readiness/credits, bootstraps a session, runs the selected deterministic pipeline, validates handoff to the latest version, dispatches `generate_file`, and normalizes a public response. [VERIFIED: src/app/api/profile/smart-generation/route.ts:8-19; src/lib/routes/smart-generation/decision.ts:64-203]

The current frontend has not fully converged on that boundary: profile setup posts job-targeting starts to `/api/profile/smart-generation`, but ATS starts still post to `/api/profile/ats-enhancement`; chat and existing workspace generation still use `/api/agent` and `/api/session/:id/generate`. [VERIFIED: src/components/resume/user-data-page.tsx:907-920; src/components/dashboard/chat-interface.tsx:748-759; src/lib/dashboard/workspace-client.ts:211-248]

PDF-only is partially implemented in active generation: `generate_file` builds/upload/signs only a PDF and always returns `docxUrl: null`, but DOCX imports, dormant DOCX generation utilities, DTO fields, pricing copy, docs, tests, and chat file upload still reference DOCX. [VERIFIED: src/lib/agent/tools/generate-file.ts:496-532; src/lib/agent/tools/generate-file.ts:851-855; src/lib/agent/tools/parse-file.ts:21-55; src/lib/plans.ts:30-35; src/components/dashboard/chat-interface.tsx:988-990]

**Primary recommendation:** Make `/api/profile/smart-generation` the only profile-setup generation endpoint first, keep `/api/agent` as protected legacy/internal runtime until UI/navigation is safely de-primary, and remove active DOCX generation/import paths while retaining nullable compatibility fields until a separate persistence migration is planned. [VERIFIED: src/lib/routes/smart-generation/decision.ts:73-177; src/app/api/session/[id]/generate/route.ts:14-51; src/lib/db/resume-generations.ts:28-312]

## Standard Stack

Use the existing stack and do not add libraries for this refactor. [VERIFIED: package.json:24-36; package.json:74-122]

| Area | Standard | Version / Location | Use In This Task |
|---|---|---:|---|
| Web framework | Next.js App Router | `next` 14.2.3 | Keep route handlers in `src/app/api/**` thin and delegate to `src/lib/routes/**`. [VERIFIED: package.json:78; src/app/api/profile/smart-generation/route.ts:3-19] |
| UI | React + Testing Library | React 18.3.1, Testing Library 16.3.2 | Update profile/dashboard components and component tests. [VERIFIED: package.json:90-99] |
| Validation | `zod` | 3.23.8 | Extend existing request schemas instead of hand parsing. [VERIFIED: package.json:86; src/lib/routes/smart-generation/context.ts:1-14] |
| Artifact rendering | `pdf-lib` | 1.17.1 | Keep PDF rendering through current `generatePDF` path. [VERIFIED: package.json:81; src/lib/agent/tools/generate-file.ts:857-900] |
| Tests | Vitest | 1.6.1 installed | Run focused route/component/tool tests before broad suites. [VERIFIED: npx vitest --version] |
| Browser tests | Playwright | 1.59.1 in repo | Use existing profile setup specs for end-to-end product surface checks. [VERIFIED: package.json:95; tests/e2e/profile-setup.spec.ts:361-562] |

**Installation:** none for implementation; dependency removal may later delete `docx` and `mammoth` only after imports/tests are removed. [VERIFIED: package.json:74-76; src/lib/agent/tools/generate-file.ts:6-13; src/lib/agent/tools/parse-file.ts:50-52]

## Wave 0 Inventory

| Touchpoint | Classification | Current State | Research Action |
|---|---|---|---|
| `src/components/resume/user-data-page.tsx` | UI/product copy, navigation/CTA, generation caller | ATS mode posts to `/api/profile/ats-enhancement`; job-target mode posts to `/api/profile/smart-generation`; copy presents guided ATS/target flow. [VERIFIED: src/components/resume/user-data-page.tsx:341-395; src/components/resume/user-data-page.tsx:850-920] | Change both modes to Smart Generation, then adjust tests to assert no direct ATS route. |
| `src/app/api/profile/smart-generation/route.ts` and `src/lib/routes/smart-generation/**` | Core API access gate and orchestration | Thin route delegates to context/decision/response; decision runs readiness, validation, optional job-target lock, pipeline, handoff check, and artifact dispatch. [VERIFIED: src/app/api/profile/smart-generation/route.ts:8-19; src/lib/routes/smart-generation/decision.ts:64-203] | Make this the core endpoint for ATS and job targeting. |
| `src/app/api/profile/ats-enhancement/route.ts` | Legacy/direct generation API | Duplicates Smart Generation's ATS auth/trust/readiness/session/pipeline/artifact flow without job-target support. [VERIFIED: src/app/api/profile/ats-enhancement/route.ts:19-115] | Convert to compatibility wrapper, deprecate, or remove after frontend migration. |
| `src/components/dashboard/chat-interface.tsx` | Primary AI chat UI and file upload UI | Posts messages/files to `/api/agent`, fetches message history, and accepts `.pdf,.docx` upload in chat. [VERIFIED: src/components/dashboard/chat-interface.tsx:644-655; src/components/dashboard/chat-interface.tsx:748-759; src/components/dashboard/chat-interface.tsx:988-990; src/components/dashboard/chat-interface.tsx:1155-1159] | De-primary or hide as legacy Pro surface; remove DOCX upload acceptance. |
| `/chat`, `/dashboard`, sidebar | Navigation/CTA | `/dashboard` redirects to `/chat`; `/chat` renders `ResumeWorkspace`; sidebar exposes `Nova conversa` and sessions only when AI chat is allowed. [VERIFIED: src/app/(auth)/dashboard/page.tsx:14-20; src/app/(auth)/chat/page.tsx:50-61; src/components/dashboard/sidebar.tsx:88-112; src/components/dashboard/sidebar.tsx:210-220] | Move default route/nav to `/profile-setup` or a Smart Generation workspace, not chat. |
| `/api/agent` / `request-orchestrator` | Internal agent runtime and API access gate | `getAiChatAccess` gates all agent requests and logs `agent.request.chat_access_denied`; non-chat heavy actions can dispatch async. [VERIFIED: src/lib/agent/request-orchestrator.ts:348-371; src/lib/agent/request-orchestrator.ts:594-615] | Keep runtime stable while removing it from primary navigation; do not delete in first wave. |
| `/api/session`, messages, ai-chat-snapshot | API access gate / chat history | Session list, message history, and AI-chat snapshot are protected by `getAiChatAccess`. [VERIFIED: src/app/api/session/route.ts:20-35; src/app/api/session/[id]/messages/route.ts:25-41; src/app/api/session/[id]/ai-chat-snapshot/route.ts:24-49] | Treat as legacy/pro chat surface, not core Smart Generation surface. |
| `/api/session/:id/generate` | Existing-session artifact generation | Generates base/target artifacts for existing owned sessions via durable jobs. [VERIFIED: src/app/api/session/[id]/generate/route.ts:14-51; src/lib/routes/session-generate/context.ts:26-125] | Preserve for history/workspace flows; do not confuse with profile setup start endpoint. |
| `src/lib/agent/tools/generate-file.ts` | Active artifact generation | Active `generateFile` path creates PDF only and returns `docxUrl: null`; dormant `generateDOCX` and `docx` imports remain. [VERIFIED: src/lib/agent/tools/generate-file.ts:496-532; src/lib/agent/tools/generate-file.ts:851-855] | Remove dormant DOCX generation logic and tests after confirming no callers. |
| `src/lib/agent/tools/parse-file.ts` / schemas / chat upload | Active DOCX import path | Parser accepts DOCX through Mammoth; chat upload accepts DOCX; profile upload route is PDF-only. [VERIFIED: src/lib/agent/tools/parse-file.ts:21-55; src/lib/agent/tools/schemas.ts:7; src/components/dashboard/chat-interface.tsx:1155-1159; src/app/api/profile/upload/route.ts:26-29] | Remove DOCX import from active user flows; keep profile PDF upload behavior. |
| `src/lib/plans.ts` / pricing comparison | Pricing/plan copy | Unit plan says "3 arquivos DOCX + PDF"; plan comparison still exposes "Chat com IA" as a plan row with Pro only. [VERIFIED: src/lib/plans.ts:30-35; src/lib/pricing/plan-comparison.ts:20-48; src/lib/pricing/plan-comparison.ts:69-83] | Rewrite pricing around PDF/guided generation and make chat secondary/legacy if retained. |
| File access routes/components | Ownership/artifact access | File access signs only PDF in response code and returns `docxUrl: null`; tests still include historical docx mocks. [VERIFIED: src/lib/routes/file-access/response.ts:88-144; src/lib/routes/file-access/decision.ts:111-140; src/app/api/file/[sessionId]/route.test.ts:362-405] | Keep PDF-only response contract; clean stale DOCX test fixtures carefully. |

## Current Tests And Gaps

| Behavior | Existing Coverage | Gap / Required Wave 0 Test |
|---|---|---|
| Smart ATS mode | Smart route test covers no target description and `profile-ats:<session>` handoff. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:156-215] | Add frontend assertion that ATS mode calls `/api/profile/smart-generation`, not `/api/profile/ats-enhancement`. [VERIFIED: src/components/resume/user-data-page.test.tsx:621-625] |
| Smart job targeting | Smart route test covers target description, job-target pipeline, and `profile-target:<session>` handoff. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:227-275] | Keep this test and add one ATS+target table-style assertion if route response shape changes. |
| Duplicate job-target starts | Smart route test covers simultaneous start dedupe. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:281-321] | Extend generalized lock tests if ATS enhancement also gets a durable start lock. |
| Invalid / incomplete CV | Smart route tests cover readiness and missing ATS sections. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:333-389] | Add explicit malformed-body/schema 400 test for Smart Generation if request schema is touched. [VERIFIED: src/lib/routes/smart-generation/context.ts:37-40] |
| Insufficient credits | Profile E2E disables ATS action at zero credits and billable generation tests stop before create when quota is false. [VERIFIED: tests/e2e/profile-setup.spec.ts:361-376; src/lib/resume-generation/generate-billable-resume.test.ts:502-522] | Add route-level Smart Generation 402 test by mocking `checkUserQuota(false)`; current Smart route test setup mocks true only. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:126-132; src/lib/routes/smart-generation/readiness.ts:28-34] |
| Pipeline validation block | Smart route tests cover structured job-target validation and recoverable validation block payload. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:390-532] | Add ATS pipeline validation failure coverage in Smart route if ATS direct route is removed. |
| Successful response shape | Smart route tests assert `success`, `sessionId`, `creditsUsed`, `resumeGenerationId`, `generationType`, and state handoff behavior. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:173-184; src/app/api/profile/smart-generation/route.test.ts:532-663] | Add `docxUrl` absence/PDF-only response expectations where response types are edited. |
| Ownership/artifact access | File route tests cover owner access, non-owner rejection, target ownership, no-artifact responses, stale artifacts, and locked previews. [VERIFIED: src/app/api/file/[sessionId]/route.test.ts:101-113; src/app/api/file/[sessionId]/route.test.ts:362-405; src/app/api/file/[sessionId]/route.test.ts:1016-1083] | Add integration-like Smart Generation -> profile download test if localStorage/session handoff changes. [VERIFIED: src/components/resume/user-data-page.test.tsx:1396-1520] |
| Cross-origin/trust | Smart route and ATS direct route both test cross-origin rejection. [VERIFIED: src/app/api/profile/smart-generation/route.test.ts:666-677; src/app/api/profile/ats-enhancement/route.test.ts:349-360] | Preserve when consolidating endpoints. |
| PDF-only generation | `generate-file` tests assert PDF URL and `docxUrl: null`; there is a test that DOCX generation is not called in a validation case. [VERIFIED: src/lib/agent/tools/generate-file.test.ts:156-167; src/lib/agent/tools/generate-file.test.ts:572-589] | Add active-path test that fresh successful generation never calls or exports `generateDOCX`, then delete the dormant function. |

Focused validation commands:

```bash
npx vitest run src/app/api/profile/smart-generation/route.test.ts src/components/resume/user-data-page.test.tsx src/lib/agent/job-targeting-start-lock.test.ts src/lib/agent/tools/generate-file.test.ts
npx vitest run src/app/api/file/[sessionId]/route.test.ts src/lib/routes/file-access/decision.test.ts src/lib/routes/file-access/response.test.ts
npm run test:e2e -- --project=chromium tests/e2e/profile-setup.spec.ts
```

[VERIFIED: package.json:29-36; docs/developer-rules/TESTING.md:15-17]

## Frontend Generation Call Graph

- Profile setup ATS action currently persists profile, then posts sanitized resume data to `/api/profile/ats-enhancement`. [VERIFIED: src/components/resume/user-data-page.tsx:904-920]
- Profile setup job-target action currently persists profile, then posts sanitized resume data plus optional `targetJobDescription` to `/api/profile/smart-generation`. [VERIFIED: src/components/resume/user-data-page.tsx:850-920]
- Profile setup validation override calls `/api/session/:id/job-targeting/override`, not Smart Generation. [VERIFIED: src/components/resume/user-data-page.tsx:1209; src/lib/dashboard/workspace-client.ts:231-248]
- Dashboard chat sends user messages and optional uploaded files to `/api/agent`. [VERIFIED: src/components/dashboard/chat-interface.tsx:733-759]
- Workspace "Gerar arquivo base" calls `generateResume`, which posts to `/api/session/:id/generate`. [VERIFIED: src/components/dashboard/workspace-side-panel.tsx:63-75; src/lib/dashboard/workspace-client.ts:211-228]
- Preview/download components call `/api/file/:sessionId` through `getDownloadUrls`. [VERIFIED: src/lib/dashboard/workspace-client.ts:134-158; src/components/dashboard/preview-panel.tsx:121-140; src/hooks/use-session-documents.ts:70-88]

## Start Lock Extension Pattern

- Current job-targeting lock computes a SHA-256 hash of normalized `cvState` and normalized target job text, then builds an idempotency key from user id plus truncated hashes. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:60-67; src/lib/agent/job-targeting-start-lock.ts:121-188]
- Current lock logs `idempotencyKeyHash`, `targetJobHash`, `resumeHash`, backend, status, user id, and optional session id; it does not log raw resume content or raw target job description in lock events. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:199-209; src/lib/agent/job-targeting-start-lock.ts:247-298; src/lib/agent/job-targeting-start-lock.ts:336-363]
- Current durable lock uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present, falls back to memory outside production, and throws in production without Redis. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:70-114; src/lib/agent/job-targeting-start-lock.ts:308-370]
- Current Smart Generation only acquires this lock for `workflowMode === 'job_targeting'` and marks running/completed/failed around session bootstrap and generation. [VERIFIED: src/lib/routes/smart-generation/decision.ts:85-126; src/lib/routes/smart-generation/decision.ts:137-195; src/lib/routes/smart-generation/session-bootstrap.ts:45-50]

Recommended extension:

- Extract a generic `smart-generation-start-lock` that takes `{ userId, cvState, workflowMode, targetJobDescription? }`, uses the existing normalized CV hash, includes a target-job hash only for job targeting, and logs only hashes plus ids. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:139-188]
- Use lock status values already understood by Smart Generation response (`already_running`, `already_completed`) to avoid new frontend state shapes. [VERIFIED: src/lib/routes/smart-generation/types.ts:43-58; src/lib/routes/smart-generation/decision.ts:110-121]
- Keep raw target text and resume text out of logs; job-targeting pipeline currently has other log paths that can include validation issue messages, so do not add raw text while moving lock logic. [VERIFIED: src/lib/agent/job-targeting-pipeline.ts:1453-1464]

## PDF-Only And DOCX Inventory

| Area | Active Generation Logic? | Current DOCX Conflict | Required Handling |
|---|---:|---|---|
| `generateFile` active path | Yes | Active path is already PDF-only, but keeps `docxPath` locals and returns `docxUrl: null`. [VERIFIED: src/lib/agent/tools/generate-file.ts:482-532] | Keep PDF path; simplify DOCX locals only after compatibility tests pass. |
| `generateDOCX` utility | No active caller in `generateFile` path | Dormant DOCX renderer and `docx` imports remain exported. [VERIFIED: src/lib/agent/tools/generate-file.ts:6-13; src/lib/agent/tools/generate-file.ts:851-855; src/lib/agent/tools/generate-file.ts:1196-1200] | Remove if no tests/scripts require it after template tooling decision. |
| Template scripts | Developer tooling | `src/lib/templates/test-template.ts` writes `test-output.docx`; `create-template.ts` creates `ats-standard.docx`. [VERIFIED: src/lib/templates/test-template.ts:1-32; src/lib/templates/create-template.ts:9-219] | Remove or quarantine as legacy tooling; do not keep DOCX creation in PDF-only plan. |
| File parser | Yes for chat upload/agent tools | `parse-file` accepts DOCX via `mammoth`; schemas list DOCX MIME. [VERIFIED: src/lib/agent/tools/parse-file.ts:21-55; src/lib/agent/tools/schemas.ts:7; src/lib/agent/tools/index.ts:74-83] | Remove DOCX accept/parse from active product flows. |
| Profile upload | Yes | Profile upload route is already PDF-only and rejects non-PDF via message constants/tests. [VERIFIED: src/app/api/profile/upload/route.ts:26-29; src/app/api/profile/upload/route.test.ts:116-124] | Keep as the PDF import path. |
| Chat upload | Yes if chat remains accessible | Chat accepts `.pdf,.docx` and checks file name/type. [VERIFIED: src/components/dashboard/chat-interface.tsx:988-990; src/components/dashboard/chat-interface.tsx:1155-1159] | Remove DOCX from accept/check even if chat stays legacy. |
| Types/API compatibility | Historical compatibility | `GeneratedOutput` and dashboard DTOs contain `docxPath`/`docxUrl`; DB mapping contains `output_docx_path`. [VERIFIED: src/types/agent.ts:599-774; src/types/dashboard.ts:235-236; src/lib/db/resume-generations.ts:28-312] | Keep nullable fields in first wave unless a migration removes stored columns. |
| Pricing/docs/copy | Product copy | Pricing, README, feature docs, state docs, and ATS landing copy still mention DOCX. [VERIFIED: src/lib/plans.ts:30-35; README.md:3-14; docs/FEATURES.md:121; docs/state-model.md:83-246; src/components/landing/o-que-e-ats-page.tsx:52] | Update copy to PDF-only where product-facing; defer internal docs only if outside quick task scope. |

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | Session bundles and resume generation rows can persist `docxPath` / `output_docx_path`; file-access tests and DB mappers still model these nullable fields. [VERIFIED: src/types/agent.ts:599; src/lib/db/resume-generations.ts:28-312; src/app/api/file/[sessionId]/route.test.ts:67-70] | Code edit for new PDF-only writes; separate DB migration only if removing columns, not needed for first safe wave. |
| Stored data | Chat transcripts exist behind `/api/session/:id/messages` and may contain historical chat UX content. [VERIFIED: src/app/api/session/[id]/messages/route.ts:59-60; src/components/dashboard/chat-interface.tsx:644-655] | Do not rewrite historical messages; de-primary UI and keep legacy read path unless product decides deletion. |
| Live service config | No live dashboard/service config was inspected in this code-only research. [VERIFIED: executed codebase-only search] | Planner must not assume Asaas/Supabase/Upstash dashboards contain no old labels; no code task should require external service edits unless separately verified. |
| OS-registered state | No OS-registered product state was found in the repo touchpoints searched for this web-app refactor. [VERIFIED: codebase grep over `src`, `tests`, `docs`, `README.md`, `package.json`] | None for this phase. |
| Secrets/env vars | Start locks rely on Upstash Redis env vars; no rename is required to generalize the lock. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:70-114] | Keep env names; avoid logging env values. |
| Build artifacts / installed packages | `docx` and `mammoth` are installed dependencies and have active imports in DOCX generation/import code. [VERIFIED: package.json:74-76; src/lib/agent/tools/generate-file.ts:6-13; src/lib/agent/tools/parse-file.ts:50-52] | Remove dependencies only after removing imports, tests, and template scripts. |

## Recommended Implementation Order

1. Add failing tests for the desired boundary: ATS profile generation posts to `/api/profile/smart-generation`, Smart route returns 402 on insufficient credits, and successful Smart responses remain PDF-only. [VERIFIED: src/components/resume/user-data-page.test.tsx:621-736; src/lib/routes/smart-generation/readiness.ts:28-34; src/lib/agent/tools/generate-file.ts:525-530]
2. Switch profile setup ATS mode from `/api/profile/ats-enhancement` to `/api/profile/smart-generation`, then decide whether the old ATS route becomes a wrapper or is removed. [VERIFIED: src/components/resume/user-data-page.tsx:907-920; src/app/api/profile/ats-enhancement/route.ts:19-115]
3. Generalize start-lock logic for both Smart Generation modes before relying on frontend double-click guards. [VERIFIED: src/components/resume/user-data-page.tsx:887-893; src/lib/agent/job-targeting-start-lock.ts:230-370]
4. Move primary navigation/default entry from chat to profile/Smart Generation: `/dashboard` redirect, sidebar "Nova conversa", sessions visibility, and `/chat` copy need coordinated updates. [VERIFIED: src/app/(auth)/dashboard/page.tsx:14-20; src/components/dashboard/sidebar.tsx:88-112; src/app/(auth)/chat/page.tsx:50-61]
5. Keep `/api/agent` and chat history protected but secondary until legacy session behavior and Pro entitlement rules are deliberately retired. [VERIFIED: src/lib/agent/request-orchestrator.ts:348-371; src/app/api/session/[id]/messages/route.ts:25-41]
6. Remove active DOCX import/generation logic and user-visible DOCX copy after Smart Generation tests are green; keep nullable persistence fields for compatibility in this wave. [VERIFIED: src/lib/agent/tools/generate-file.ts:851-855; src/lib/agent/tools/parse-file.ts:21-55; src/lib/db/resume-generations.ts:28-312]
7. Clean tests/fixtures so PDF-only expectations are consistent across file access, preview, history, and profile setup. [VERIFIED: src/app/api/file/[sessionId]/route.test.ts:143-144; src/components/dashboard/preview-panel.test.tsx:71-72; src/components/resume/user-data-page.test.tsx:1426-1501]

## High-Risk Files

| File | Risk |
|---|---|
| `src/components/resume/user-data-page.tsx` | It owns the profile setup CTAs, target-job textarea, endpoint selection, local double-click guard, localStorage handoff, download action, and validation override UI. [VERIFIED: src/components/resume/user-data-page.tsx:850-920; src/components/resume/user-data-page.tsx:1013-1028; src/components/resume/user-data-page.tsx:1209] |
| `src/lib/routes/smart-generation/decision.ts` | It sequences readiness, locking, session bootstrap, pipeline, handoff validation, artifact dispatch, and lock completion/failure. [VERIFIED: src/lib/routes/smart-generation/decision.ts:64-203] |
| `src/lib/routes/smart-generation/session-bootstrap.ts` | It writes `cvState`, `sourceResumeText`, workflow mode, and target description into the new session. [VERIFIED: src/lib/routes/smart-generation/session-bootstrap.ts:41-61] |
| `src/lib/agent/job-targeting-start-lock.ts` | It is safe because it logs hashes, but generalizing it incorrectly can leak raw resume/job text or fail production without Redis. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:70-114; src/lib/agent/job-targeting-start-lock.ts:199-209] |
| `src/lib/agent/tools/generate-file.ts` | It contains active PDF generation plus dormant DOCX exports; careless deletion can break tests/scripts or type contracts. [VERIFIED: src/lib/agent/tools/generate-file.ts:496-532; src/lib/agent/tools/generate-file.ts:851-855; src/lib/agent/tools/generate-file.ts:1196-1200] |
| `src/lib/agent/tools/parse-file.ts` and `src/lib/agent/tools/schemas.ts` | These keep DOCX import active through agent/chat file flows. [VERIFIED: src/lib/agent/tools/parse-file.ts:21-55; src/lib/agent/tools/schemas.ts:7] |
| `src/app/(auth)/dashboard/page.tsx`, `src/app/(auth)/chat/page.tsx`, `src/components/dashboard/sidebar.tsx` | These make chat the default app destination and primary CTA. [VERIFIED: src/app/(auth)/dashboard/page.tsx:14-20; src/app/(auth)/chat/page.tsx:50-61; src/components/dashboard/sidebar.tsx:88-112] |
| `src/lib/billing/ai-chat-access.ts` and `.server.ts` | These encode Pro-only chat copy and gate behavior that should not accidentally block Smart Generation. [VERIFIED: src/lib/billing/ai-chat-access.ts:4-16; src/lib/billing/ai-chat-access.server.ts:45-58] |
| `src/lib/plans.ts` and `src/lib/pricing/plan-comparison.ts` | Pricing copy still advertises DOCX and chat. [VERIFIED: src/lib/plans.ts:30-49; src/lib/pricing/plan-comparison.ts:20-48] |
| `src/app/api/file/[sessionId]/route.test.ts` and file-access modules | They guard ownership/artifact behavior and include historical DOCX fixtures. [VERIFIED: src/app/api/file/[sessionId]/route.test.ts:362-405; src/app/api/file/[sessionId]/route.test.ts:1016-1083] |

## Common Pitfalls

- Deleting `/api/agent` first would break chat-route tests, sessions/history, and existing-session runtime paths before the primary surface has a replacement. [VERIFIED: src/components/dashboard/chat-interface.test.tsx:259-1539; src/app/api/agent/route.test.ts:132-372]
- Keeping `/api/profile/ats-enhancement` as the frontend ATS path will leave Smart Generation non-core for half the guided flow. [VERIFIED: src/components/resume/user-data-page.tsx:907-920]
- Removing `docxPath` / `docxUrl` types in the same wave as product refactor can break stored artifact compatibility and file-access tests. [VERIFIED: src/types/agent.ts:599-774; src/lib/db/resume-generations.ts:28-312; src/app/api/file/[sessionId]/route.test.ts:143-144]
- Extending start locks by logging raw request bodies would violate the no-raw-resume/no-raw-job-description constraint. [VERIFIED: user prompt; src/lib/agent/job-targeting-start-lock.ts:199-209]
- Relying only on the frontend `isRunningAtsEnhancementRef` leaves duplicate server requests possible from retries, tabs, or direct API callers. [VERIFIED: src/components/resume/user-data-page.tsx:887-893; src/lib/routes/smart-generation/decision.ts:85-126]
- Updating pricing copy without `src/lib/plans.ts` will violate the project's single source of truth for plans. [VERIFIED: src/lib/plans.ts:1-5]

## Validation Architecture

| Property | Value |
|---|---|
| Nyquist validation | Enabled in `.planning/config.json`. [VERIFIED: .planning/config.json:12] |
| Security enforcement | Enabled in `.planning/config.json`. [VERIFIED: .planning/config.json:13] |
| Unit/component framework | Vitest plus Testing Library. [VERIFIED: package.json:29; docs/developer-rules/TESTING.md:15-17] |
| Browser framework | Playwright. [VERIFIED: package.json:34-35; docs/developer-rules/TESTING.md:15-17] |
| Quick route/component command | `npx vitest run src/app/api/profile/smart-generation/route.test.ts src/components/resume/user-data-page.test.tsx` [VERIFIED: npx vitest --version] |
| PDF/file command | `npx vitest run src/lib/agent/tools/generate-file.test.ts src/app/api/file/[sessionId]/route.test.ts` [VERIFIED: package.json:29; src/lib/agent/tools/generate-file.test.ts; src/app/api/file/[sessionId]/route.test.ts] |
| Browser command | `npm run test:e2e -- --project=chromium tests/e2e/profile-setup.spec.ts` [VERIFIED: package.json:34; tests/e2e/profile-setup.spec.ts:361-562] |

Wave 0 gaps:

- Add Smart route 402 insufficient-credit API test. [VERIFIED: src/lib/routes/smart-generation/readiness.ts:28-34; src/app/api/profile/smart-generation/route.test.ts:126-132]
- Add user-data-page test proving ATS mode uses `/api/profile/smart-generation` and no longer calls `/api/profile/ats-enhancement`. [VERIFIED: src/components/resume/user-data-page.test.tsx:621-625]
- Add PDF-only regression that active generation has no DOCX artifact creation or `docxUrl` exposure. [VERIFIED: src/lib/agent/tools/generate-file.ts:496-532]
- Add navigation test proving `/dashboard` and sidebar primary CTA land on the guided Smart Generation surface instead of `/chat`. [VERIFIED: src/app/(auth)/dashboard/page.test.tsx:22-44; src/components/dashboard/sidebar.test.tsx:120-146]

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---:|---|
| V2 Authentication | Yes | Use `getCurrentAppUser` at route boundary. [VERIFIED: src/lib/routes/smart-generation/context.ts:19-22; src/lib/routes/session-generate/context.ts:32-43] |
| V3 Session Management | Yes | Keep existing server-owned session creation and retrieval; avoid client-owned session ids except as lookup keys. [VERIFIED: src/lib/routes/smart-generation/session-bootstrap.ts:43-61; src/lib/routes/file-access/context.ts:128-148] |
| V4 Access Control | Yes | Use owner-aware session lookup and target lookup before artifact signing. [VERIFIED: src/lib/routes/file-access/context.ts:128-148; src/lib/routes/file-access/context.ts:246-263] |
| V5 Input Validation | Yes | Use `zod` schemas for Smart Generation and session generation bodies. [VERIFIED: src/lib/routes/smart-generation/context.ts:12-14; src/lib/routes/session-generate/context.ts:14-24] |
| V6 Cryptography | Yes | Use existing SHA-256 hashing for lock fingerprints; do not create custom reversible fingerprints. [VERIFIED: src/lib/agent/job-targeting-start-lock.ts:60-67; src/lib/agent/job-targeting-start-lock.ts:169-188] |

Threat patterns:

- IDOR on downloads: must keep `/api/file/:sessionId` owner lookup and target ownership checks. [VERIFIED: src/app/api/file/[sessionId]/route.test.ts:1016-1083]
- CSRF/cross-origin mutation: must preserve `validateTrustedMutationRequest` in Smart Generation and session generation. [VERIFIED: src/lib/routes/smart-generation/context.ts:24-35; src/lib/routes/session-generate/context.ts:58-72]
- Raw PII/job text logging: lock extension must log hashes only. [VERIFIED: user prompt; src/lib/agent/job-targeting-start-lock.ts:199-209]
- Credit abuse: keep quota checks before session bootstrap/generation and billable credit reservation inside generation. [VERIFIED: src/lib/routes/smart-generation/readiness.ts:28-34; src/lib/resume-generation/generate-billable-resume.ts:1136-1416]
- Locked preview leakage: keep `assertNoRealArtifactForLockedPreview` and file-access locked preview behavior. [VERIFIED: src/lib/generated-preview/locked-preview.ts:169-189; src/lib/routes/file-access/decision.ts:127-140]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Tests/scripts | Yes | v24.14.0 | None needed. [VERIFIED: `node --version`] |
| npm | Test scripts | Yes | 11.9.0 | None needed. [VERIFIED: `npm --version`] |
| Vitest | Unit/component tests | Yes | 1.6.1 | Use `npm test` if `npx` behavior changes. [VERIFIED: `npx vitest --version`; package.json:29] |
| ripgrep | Research/code inventory | Yes | 15.1.0 | PowerShell `Select-String`. [VERIFIED: `rg --version`] |

Missing dependencies with no fallback: none found for research and focused validation. [VERIFIED: environment probes above]

## Assumptions Log

All material claims in this research are verified from the user prompt, project files, codebase grep, or local tool version probes. [VERIFIED: sources listed below]

| # | Claim | Section | Risk If Wrong |
|---|---|---|---|
| - | None. | - | - |

## Open Questions

1. RESOLVED: `/chat` remains a true Pro chat and deep-link surface. It must become unreachable from normal navigation/default CTAs, but the route and true chat APIs remain gated by AI-chat entitlement. [VERIFIED: checker issue `research_resolution`; 260428-upq-02c-PLAN.md]
2. RESOLVED: the old `/api/profile/ats-enhancement` route stays temporarily as a compatibility wrapper around Smart Generation. It must not duplicate ATS orchestration, and static guards must prove normal product callers do not post to it. [VERIFIED: checker issue `research_resolution`; 260428-upq-01-PLAN.md]
3. RESOLVED: nullable DOCX persistence fields stay for historical compatibility while new active behavior is PDF-only. No Prisma/SQL migration is part of this quick task. [VERIFIED: checker issue `research_resolution`; 260428-upq-04a-PLAN.md, 260428-upq-04c-PLAN.md]

## Sources

Primary sources:

- User prompt and constraints for PDF-only override and no raw text/report constraints. [VERIFIED: user prompt]
- `AGENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, and `CLAUDE.md` for project/product/architecture constraints. [VERIFIED: mandatory file read; CLAUDE.md read]
- Smart Generation route/modules and tests. [VERIFIED: src/app/api/profile/smart-generation/route.ts; src/lib/routes/smart-generation/**; src/app/api/profile/smart-generation/route.test.ts]
- Profile setup frontend and tests. [VERIFIED: src/components/resume/user-data-page.tsx; src/components/resume/user-data-page.test.tsx]
- Chat/workspace routes/components and tests. [VERIFIED: src/app/(auth)/chat/page.tsx; src/components/dashboard/chat-interface.tsx; src/components/dashboard/resume-workspace.tsx]
- PDF/DOCX generation, file access, and persistence files. [VERIFIED: src/lib/agent/tools/generate-file.ts; src/lib/agent/tools/parse-file.ts; src/lib/routes/file-access/**; src/lib/db/resume-generations.ts]
- Package/test/environment files and probes. [VERIFIED: package.json; docs/developer-rules/TESTING.md; local `node`, `npm`, `vitest`, `rg` probes]

## Metadata

**Confidence breakdown:**

- Code inventory: HIGH because required files plus focused greps were inspected. [VERIFIED: mandatory file read; codebase grep]
- Test inventory: HIGH for named existing tests and MEDIUM for gaps because gaps are inferred from absence of matching test names/search results. [VERIFIED: rg over `*.test.ts`, `*.test.tsx`, and `tests/e2e`]
- Implementation order: MEDIUM because it is a recommendation based on current coupling and user scope. [VERIFIED: source sections above]
- Runtime state: MEDIUM because code-level persistence was inspected but live Supabase/Asaas/Upstash dashboards were not. [VERIFIED: Runtime State Inventory]

**Valid until:** 2026-05-06 for this fast-moving branch. [VERIFIED: current date plus 7-day quick-task horizon]
