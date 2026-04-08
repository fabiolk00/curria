---
title: CurrIA Architecture and Engineering Guide
audience: [developers, architects, operations]
related: [docs/INDEX.md, docs/CONCEPTS.md, docs/architecture-overview.md]
status: current
updated: 2026-04-01
---

# CurrIA - Architecture And Engineering Guide

See also: [Documentation Index](docs/INDEX.md) | [Getting Started](docs/GETTING_STARTED.md)

## Product Summary
CurrIA is a resume optimization SaaS for Brazilian job seekers. Users authenticate with Clerk, chat with an AI assistant, improve resume content into a canonical structured state, and generate ATS-oriented DOCX/PDF outputs.

This file is the project source of truth for system architecture and engineering invariants. It should track the code that runs today, not aspirational legacy notes.

## LLM Runtime Status

- CurrIA currently runs fully on OpenAI.
- Default model routing is controlled in `src/lib/agent/config.ts`.
- The runtime now uses one standardized model across `agent`, `structured`, and `vision`.
- The default standardized runtime model is `gpt-5-nano`.
- The active runtime model can be overridden with `OPENAI_MODEL`.
- `OPENAI_MODEL_COMBO` is retained only for backward compatibility and model-selection workflows.
- Model selection and pt-BR evaluation are documented in:
  - `docs/openai/MODEL_SELECTION_MATRIX.md`
  - `docs/openai/PORTUGUESE_QUALITY_GATE.md`
  - `docs/openai/PORTUGUESE_TEST_RESULTS.md`

## Credit Carryover Behavior

- When users change plans, remaining credits are **preserved and added** to the new plan credits.
- When monthly subscriptions **renew**, credits are **replaced** (not added) with the plan's credit allocation.
- **Implementation**: The application code in `src/lib/asaas/credit-grants.ts` detects the event type and sets the `p_is_renewal` parameter sent to the RPC. The RPC then applies the appropriate logic.
- See `docs/billing/IMPLEMENTATION.md` for detailed logic and examples.

## Plan Change Restrictions

- Users with an active monthly subscription cannot contract a second monthly plan in the same transaction
- This prevents creating duplicate active subscriptions in Asaas
- Users must cancel their current monthly plan first before purchasing a different monthly plan
- This restriction is enforced at both the UI (dialog) and API (`/api/checkout`) layers

## Core Architecture

### Identity model
- Clerk is the external identity provider.
- Domain logic does not use Clerk user IDs as primary keys.
- The application resolves every authenticated user to an internal app user in `users`.
- Auth mappings live in `user_auth_identities`.
- Runtime code should work with app user IDs after the auth boundary.

Primary code:
- `src/lib/auth/app-user.ts`
- `prisma/schema.prisma`
- `prisma/migrations/internal_user_model.sql`

### Credits and billing
- `credit_accounts` is the only runtime source of truth for credits.
- `user_quotas` is metadata-only for billing state such as plan, Asaas customer, subscription, and renewal information.
- `billing_checkouts` is the source of truth for post-cutover paid checkout resolution.
- Credit consumption happens when `/api/agent` creates a new session.
- Existing sessions do not consume credits per message.
- Asaas webhook processing is idempotent and stores processed deliveries in `processed_events`.
- Credits are granted only from trusted Asaas webhook events, never from frontend request bodies.
- Webhook deduplication is based on a stable payload fingerprint in `processed_events.event_fingerprint`, not on transient delivery IDs.
- Billing writes must use plan definitions from `src/lib/plans.ts`; credit amounts must not be duplicated elsewhere.
- New paid checkouts must use `externalReference = curria:v1:u:<appUserId>:c:<checkoutReference>`.
- Legacy `usr_<id>` external references are temporary migration support for pre-cutover recurring subscriptions only.
- Processed webhook deliveries are recorded only after billing side effects succeed, so failed deliveries remain retryable.
- Subscription cancellation updates billing metadata only and does not revoke already-earned credits.
- `PAYMENT_RECEIVED` and `SUBSCRIPTION_CREATED` resolve from `billing_checkouts`; `SUBSCRIPTION_RENEWED` and cancellation events resolve from `user_quotas.asaas_subscription_id`.
- Billing RPCs defensively re-validate their trust anchor before mutating state.

Primary code:
- `src/lib/asaas/quota.ts`
- `src/app/api/webhook/asaas/route.ts`
- `src/lib/asaas/webhook.ts`
- `src/lib/asaas/billing-checkouts.ts`
- `docs/billing/IMPLEMENTATION.md`
- `docs/billing/MIGRATION_GUIDE.md`

### Session state model
Sessions are stored as a top-level bundle with explicit versioning:
- `stateVersion`
- `phase`
- `cvState`
- `agentState`
- `generatedOutput`
- `atsScore`

State responsibilities:
- `cvState`: canonical structured resume truth
- `agentState`: operational context used to drive the agent
- `generatedOutput`: generated artifact metadata only
- `cv_versions`: immutable snapshots of trusted `cvState`
- `resume_targets`: target-specific derived resume variants and optional gap analysis

Primary code:
- `src/types/cv.ts`
- `src/types/agent.ts`
- `src/lib/db/sessions.ts`

### User profile and cvState seeding
- A `UserProfile` table stores a canonical `cvState` at the user scope, not the session scope.
- Source is either `linkedin` (extracted via LinkdAPI) or `pdf` (parsed via the existing `parse_file` logic).
- `UserProfile.cvState` is populated through one of two paths:
  - LinkedIn URL extraction via LinkdAPI with async job processing
  - PDF upload parsed via the existing `parse_file` logic adapted for profile scope
- After either extraction method, the user can review and manually edit each `cvState` field in a structured form on the profile setup screen before saving.
- When a new session is created with an empty `cvState`, the system seeds it from `UserProfile.cvState` if one exists.
- Seeding happens in `src/lib/db/sessions.ts` at session creation time via `seedCvStateFromProfile()`.
- The session `cvState` is the single source of truth after seeding. `UserProfile` is not consulted again during the session.
- `UserProfile` is never mutated by tools. It is only updated through the profile setup pipeline (LinkedIn extraction, PDF upload, or manual save).

Primary code:
- `src/lib/linkedin/linkdapi.ts`
- `src/lib/linkedin/extract-profile.ts`
- `src/lib/linkedin/import-jobs.ts`
- `src/lib/db/sessions.ts` (seedCvStateFromProfile function)

### Tool architecture
Tools do not mutate `session` directly.

Tool flow:
1. `executeTool()` runs tool logic
2. tool returns `{ output, patch? }`
3. `dispatchTool()` calls `applyToolPatch()`
4. `applyToolPatch()` merges and persists the patch centrally
5. the in-memory `session` snapshot is updated from the merged result

Primary code:
- `src/lib/agent/tools/index.ts`
- `src/lib/db/sessions.ts`

## Error Handling

All structured tool failures use the error codes defined in `src/lib/agent/tool-errors.ts`.

The 8 codes:
- `VALIDATION_ERROR` (`400`): input or structured-state validation failed
- `PARSE_ERROR` (`400`): file parsing or extraction failed
- `LLM_INVALID_OUTPUT` (`500`): model output failed parsing or schema validation
- `NOT_FOUND` (`404`): required entity was missing
- `UNAUTHORIZED` (`401`): auth or ownership check failed inside the tool layer
- `GENERATION_ERROR` (`500`): generation/render/upload/signing failed after validation passed
- `RATE_LIMITED` (`429`): upstream or resolved rate limit failure
- `INTERNAL_ERROR` (`500`): unexpected fallback

Key files:
- `src/lib/agent/tool-errors.ts`
- `docs/error-codes.md`
- `docs/logging.md`
- `docs/tool-development.md`

Current runtime behavior:
- tool failures use `{ success: false, code, error }`
- dispatcher logs `errorCode` and `errorMessage`
- route adapters preserve structured tool failures and map them to HTTP status codes
- route-level auth/body validation may still return plain `{ error: ... }` responses outside the tool layer

Developer guidance:
- use `docs/tool-development.md` and `docs/error-codes.md` when adding or modifying a tool
- use `docs/error-codes.md` to choose the right code
- use `docs/logging.md` to query production failures by `errorCode`

## Session State Contracts

### `cvState`
Canonical structured resume data only.

Current fields:
- `fullName`
- `email`
- `phone`
- `linkedin?`
- `location?`
- `summary`
- `experience`
- `skills`
- `education`
- `certifications?`

Rules:
- `cvState` is the resume truth used for generation.
- No raw parsed text belongs in `cvState`.
- No target job description belongs in `cvState`.
- Resume rewrites must update only the targeted canonical field.

### `agentState`
Operational context for the agent loop.

Current fields:
- `sourceResumeText?`
- `targetJobDescription?`
- `parseStatus`
- `parseError?`
- `attachedFile?`
- `rewriteHistory`
- `gapAnalysis?`
- `phaseMeta?`

Rules:
- Parsed text from `parse_file` goes to `agentState.sourceResumeText`.
- Job targeting context goes to `agentState.targetJobDescription`.
- Rewrite metadata belongs in `agentState.rewriteHistory`.
- Structured gap analysis belongs in `agentState.gapAnalysis`.
- `rewriteHistory` stores the latest known rewrite per section, not the full conversation.

### `generatedOutput`
Artifact metadata only.

Current fields:
- `status`
- `docxPath?`
- `pdfPath?`
- `generatedAt?`
- `error?`

Rules:
- Signed URLs are never persisted here.
- Only durable storage metadata belongs in this object.
- The client may receive signed URLs in tool output, but they are transient.

### `stateVersion`
- Lives at the top level of the session bundle.
- Defaults to `1`.
- Increment only when the bundle shape or interpretation changes.
- Do not use it for feature flags or business logic.

## Data Flow

### Identity flow
1. Clerk authenticates the request.
2. `getCurrentAppUser()` resolves or bootstraps an internal app user through `get_or_create_app_user`.
3. Runtime code uses the returned app user ID.

### Agent request flow
`POST /api/agent`
1. Resolve current app user
2. Apply authenticated rate limiting
3. Validate request body with Zod
4. Optionally scrape supported job-posting URLs from user input
5. Load an existing session or create a new one
6. On new session only, verify credits and consume one credit
7. Increment message count with the atomic session cap helper
8. Persist the user message
9. Build system context from `cvState`, `agentState`, and `atsScore`
10. Run the OpenAI tool loop
11. Stream SSE chunks to the client

### Tool-to-state flow
- `parse_file` -> `agentState`
  - updates `parseStatus`
  - stores parsed text in `sourceResumeText`
- `parse_file` may populate canonical `cvState` through validated ingestion
- first trusted canonical population creates a `cv_versions` snapshot with source `ingestion`
- `score_ats` -> `atsScore` and optional `agentState.targetJobDescription`
- `analyze_gap` -> `agentState.targetJobDescription` and `agentState.gapAnalysis`
- `rewrite_section` -> `cvState` plus `agentState.rewriteHistory`
  - successful canonical rewrite creates a `cv_versions` snapshot with source `rewrite`
- manual base canonical edit -> `cvState` only
  - successful changes create a `cv_versions` snapshot with source `manual`
  - unchanged edits must not create noisy versions
  - target-derived `resume_targets` remain isolated
- `set_phase` -> `phase`
- `generate_file` -> reads canonical `cvState`, writes `generatedOutput`
- `create_target_resume` -> persists a row in `resume_targets` and a `cv_versions` snapshot with source `target-derived`

### File generation flow
1. Read canonical `session.cvState`
2. Map `cvState` plus optional targeting context into the locked ATS template data shape
3. Generate DOCX via `docx`
4. Generate PDF via `pdf-lib`
5. Upload both to Supabase Storage bucket `resumes`
6. Return signed URLs to the client
7. Persist only `generatedOutput` metadata

### Profile setup flow — LinkedIn path
1. User submits LinkedIn URL via `POST /api/profile/extract`
2. Route validates URL and inserts a pending row in `linkedin_import_jobs`
3. Frontend polls `GET /api/profile/status/:jobId`
4. Status route atomically claims the pending job and extracts inline
5. Extraction calls LinkdAPI, maps response to `cvState`, and saves to `UserProfile`
6. User reviews extracted fields in the structured profile form and edits any incomplete or incorrect fields
7. User saves the final profile via `PUT /api/profile`
8. On next session creation, `sessions.ts` seeds `cvState` from `UserProfile.cvState`

### Profile setup flow — PDF path
1. Planned follow-up: user uploads a PDF via `POST /api/profile/upload`
2. Planned follow-up: route parses the PDF using the existing `parse_file` logic
3. Planned follow-up: parsed text is transformed into a `cvState` object
4. Planned follow-up: result is saved to `UserProfile` with source `pdf`
5. Planned follow-up: user reviews extracted fields in the structured profile form and edits any incomplete or incorrect fields
6. Planned follow-up: user saves the final profile via `PUT /api/profile`
7. Planned follow-up: future sessions seed from that saved `UserProfile.cvState`

## API Surface

### Implemented routes
- `POST /api/agent`
- `GET /api/session`
- `POST /api/session` returns `403` by design
- `GET /api/session/[id]/messages`
- `GET /api/file/[sessionId]`
- `POST /api/checkout`
- `POST /api/webhook/asaas`
- `POST /api/webhook/clerk`
- `GET /api/cron/cleanup`
- `POST /api/profile/extract` — validates LinkedIn URL, enqueues extraction job
- `GET /api/profile/status/:jobId` — returns job state and queue position
- `POST /api/profile/upload` — accepts PDF, parses and saves to UserProfile
- `PUT /api/profile` — saves manually edited cvState fields to UserProfile
- `GET /api/profile` — returns the saved UserProfile for the current user

### Important route realities
- `/api/agent` uses true OpenAI streaming. Text chunks are forwarded to client SSE in real time, tool call deltas are accumulated server-side until the stream ends, and persisted tool patches are emitted only after the DB write succeeds. Multi-turn tool flows remain iterative and generate follow-up streaming calls with tool results in the message history.
- `/api/file/[sessionId]` is implemented and verifies auth plus session ownership before returning signed URLs.
- `/api/file/[sessionId]` also accepts `?targetId=<id>` for target-specific generated files.
- File delivery can happen from either `generate_file` tool output or `/api/file/[sessionId]`.
- `POST /api/profile/upload` is planned but not implemented yet, even though the broader profile setup flow already exists.

## Engineering Invariants

### Identity invariants
- Never use a Clerk user ID as a domain primary key.
- Domain tables should reference internal app user IDs.
- Compatibility lookup from legacy Clerk references is allowed only at system boundaries.

### Session invariants
- `cvState` is canonical resume truth.
- `agentState` is operational context, not resume truth.
- `generatedOutput` is artifact metadata, not resume truth.
- `stateVersion` is bundle-level metadata.

### Tool invariants
- Tools must not mutate session objects directly.
- Tool-originated state changes must be expressed as `ToolPatch`.
- Tool-originated state changes must be merged and persisted through the dispatcher.
- Partial patches must not erase unrelated state.
- Malformed tool output must be rejected before persistence.
- Target-specific resume creation must not overwrite canonical base `cvState`.

### Billing invariants
- Runtime credit reads and writes go through `credit_accounts`.
- `user_quotas.credits_remaining` is legacy compatibility data and not authoritative.
- Processed Asaas webhook deliveries are recorded only after successful side effects.

### Generation invariants
- `generate_file` reads canonical base `cvState` by default and target-derived `cvState` only when an explicit `target_id` is selected.
- ATS output structure is locked to a single-column seven-block template:
  - header
  - resumo profissional
  - habilidades
  - experiencia profissional
  - educacao
  - certificacoes when present
  - idiomas when present
- Targeting may reorder existing skills and bullets, but must never fabricate new resume content.
- `generatedOutput` must not store signed URLs.
- Durable storage paths belong in `generatedOutput`; signed URLs belong only in tool output.

### Versioning and targeting invariants
- `cv_versions` entries are immutable snapshots.
- Raw resume text must never be stored in `cv_versions`.
- `resume_targets` are separate from the session bundle.
- Multiple target resumes may coexist for one session.
- Each target-specific derived `cvState` must stay isolated from the base canonical `cvState` and from other targets.
- Manual edits currently apply only to base canonical `cvState`.
- Future target-specific manual edits must be modeled as target-owned writes, not as base-session mutations.

### Profile invariants
- `UserProfile.cvState` is not session truth. It is a seed source only.
- Tools must never write to `UserProfile` directly.
- `UserProfile` is updated only through the profile setup pipeline: LinkedIn extraction, PDF upload, or manual save from the profile form.
- Seeding must not overwrite a `cvState` that already has data.
- If `UserProfile` does not exist, session creation proceeds normally with empty `cvState`.
- Manual edits on the profile screen write directly to `UserProfile` via `PUT /api/profile`. This does not create a `cv_versions` entry — versioning only applies to session-scoped `cvState`.

## Current Stack
- Next.js 14 App Router
- React 18
- Tailwind CSS + shadcn/ui
- Clerk
- Supabase JS runtime access to Postgres and Storage
- Prisma schema and SQL migration helpers
- OpenAI SDK
- Asaas
- Upstash Redis / Ratelimit
- Vitest + React Testing Library

## Removed Dependencies

- `stripe` was removed because billing is implemented through Asaas and there are no runtime imports in `src/` or `next.config.js`.
- `resend` was removed because there is no email delivery flow implemented in `src/` or `next.config.js`.
- `embla-carousel-react` was removed because the only related code was the unused `src/components/ui/carousel.tsx` wrapper and nothing imports that wrapper.
- `cmdk` was removed because the only related code was the unused `src/components/ui/command.tsx` wrapper and nothing imports that wrapper.
- `input-otp` was removed because the only related code was the unused `src/components/ui/input-otp.tsx` wrapper and nothing imports that wrapper.
- `react-day-picker` was removed because the only related code was the unused `src/components/ui/calendar.tsx` wrapper and nothing imports that wrapper.
- `react-resizable-panels` was removed because it has no imports in `src/` or `next.config.js`.

Keep these removed unless a concrete feature lands that imports them in application code.

## Key Files By Concern

### Identity
- `src/lib/auth/app-user.ts`
- `src/types/user.ts`

### Session persistence
- `src/lib/db/sessions.ts`
- `src/types/agent.ts`
- `src/types/cv.ts`

### Agent loop
- `src/app/api/agent/route.ts`
- `src/lib/agent/context-builder.ts`
- `src/lib/agent/config.ts`
- `src/lib/agent/tools/index.ts`

### Billing
- `src/lib/asaas/quota.ts`
- `src/app/api/webhook/asaas/route.ts`
- `src/lib/asaas/webhook.ts`
- `src/lib/plans.ts`

### Generation
- `src/lib/agent/tools/generate-file.ts`
- `src/lib/templates/ats-standard.docx`

### Profile setup
- `src/lib/linkedin/linkdapi.ts`
- `src/lib/linkedin/extract-profile.ts`
- `src/lib/linkedin/import-jobs.ts`
- `src/app/api/profile/extract/route.ts`
- `src/app/api/profile/status/[jobId]/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/(auth)/dashboard/resumes/new/page.tsx`
- `src/components/resume/user-data-page.tsx`

## Developer Onboarding

### How to understand the system quickly
1. Read `README.md`
2. Read `docs/architecture-overview.md`
3. Read `docs/state-model.md`
4. Read `docs/tool-development.md`
5. Inspect:
   - `src/app/api/agent/route.ts`
   - `src/lib/db/sessions.ts`
   - `src/lib/agent/tools/index.ts`
   - `src/lib/auth/app-user.ts`
   - `src/lib/asaas/quota.ts`

### How to add a new tool safely
1. Add or extend the tool input/output types in `src/types/agent.ts`
2. Implement tool logic with explicit validation
3. Return `{ output, patch? }`, never direct session mutation
4. Register the tool in `src/lib/agent/tools/index.ts`
5. Keep the patch minimal and targeted
6. Add unit tests plus any session-evolution coverage required

### How to modify session state safely
- Decide whether the new data is resume truth, operational context, or artifact metadata.
- Put it in exactly one of `cvState`, `agentState`, or `generatedOutput`.
- Extend `ToolPatch` only if the new field should be tool-writable.
- Preserve bundle compatibility and update `stateVersion` only if interpretation changes.

## Commands
Use the current package scripts:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run db:push
npm run db:migrate
npm run db:studio
```
