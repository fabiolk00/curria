# CurrIA - Architecture And Engineering Guide

## Product Summary
CurrIA is a resume optimization SaaS for Brazilian job seekers. Users authenticate with Clerk, chat with an AI assistant, improve resume content into a canonical structured state, and generate ATS-oriented DOCX/PDF outputs.

This file is the project source of truth for system architecture and engineering invariants. It should track the code that runs today, not aspirational legacy notes.

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
- `docs/billing-implementation.md`
- `docs/billing-migration-guide.md`

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
- `.claude/rules/error-handling.md`

Current runtime behavior:
- tool failures use `{ success: false, code, error }`
- dispatcher logs `errorCode` and `errorMessage`
- route adapters preserve structured tool failures and map them to HTTP status codes
- route-level auth/body validation may still return plain `{ error: ... }` responses outside the tool layer

Developer guidance:
- use `.claude/rules/error-handling.md` when adding or modifying a tool
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
10. Run the Anthropic tool loop
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
2. Generate DOCX via Docxtemplater
3. Generate PDF via `pdf-lib`
4. Upload both to Supabase Storage bucket `resumes`
5. Return signed URLs to the client
6. Persist only `generatedOutput` metadata

## API Surface

### Implemented routes
- `POST /api/agent`
- `GET /api/session`
- `POST /api/session` returns `403` by design
- `GET /api/session/[id]/messages`
- `POST /api/checkout`
- `POST /api/webhook/asaas`
- `POST /api/webhook/clerk`
- `GET /api/cron/cleanup`

### Important route realities
- `/api/agent` uses SSE, but Anthropic is currently called with `stream: false` and the server re-streams word chunks.
- `/api/file/[sessionId]` is not implemented.
- File delivery currently happens through signed URLs returned by `generate_file`.

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
- `generate_file` reads only canonical `cvState`.
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

## Current Stack
- Next.js 14 App Router
- React 18
- Tailwind CSS + shadcn/ui
- Clerk
- Supabase JS runtime access to Postgres and Storage
- Prisma schema and SQL migration helpers
- Anthropic SDK
- Asaas
- Upstash Redis / Ratelimit
- Vitest + React Testing Library

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
