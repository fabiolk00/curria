# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Next.js App Router monolith with thin route adapters, domain-focused service modules, and a Supabase-backed session state machine for the AI workflow.

**Key Characteristics:**
- HTTP entry points live under `src/app/**`, while reusable business logic lives under `src/lib/**`.
- Canonical resume state is centralized in a session bundle typed in `src/types/agent.ts` and persisted through `src/lib/db/sessions.ts`.
- Agent tool execution is funneled through a dispatcher in `src/lib/agent/tools/index.ts` so tool outputs and persisted patches stay consistent.
- Billing, LinkedIn import, and resume-target generation each have dedicated domain modules instead of being implemented inline in route handlers.

## Layers

**UI Layer:**
- Purpose: Render public marketing pages, authenticated workspace pages, and client-side editing/chat surfaces.
- Location: `src/app/(public)/**`, `src/app/(auth)/**`, `src/components/**`, `src/hooks/**`, `src/context/**`
- Contains: App Router pages/layouts, dashboard UI, landing pages, resume editor, tracker UI, preview panel state
- Depends on: `src/lib/dashboard/workspace-client.ts`, route handlers, Clerk session context, shared types
- Used by: End users in the browser

**API / Adapter Layer:**
- Purpose: Authenticate requests, validate payloads, adapt HTTP/SSE to domain services, and serialize JSON responses.
- Location: `src/app/api/**/route.ts`
- Contains: Auth checks, `zod` parsing, ownership checks, SSE setup in `src/app/api/agent/route.ts`
- Depends on: `src/lib/auth/app-user.ts`, `src/lib/db/**`, `src/lib/agent/**`, `src/lib/asaas/**`, `src/lib/linkedin/**`
- Used by: Client components, server components, Vercel cron, third-party webhooks

**Domain Service Layer:**
- Purpose: Hold application-specific logic for agent behavior, billing, imports, and resume transformations.
- Location: `src/lib/agent/**`, `src/lib/asaas/**`, `src/lib/linkedin/**`, `src/lib/billing/**`, `src/lib/resume-targets/**`, `src/lib/cv/**`
- Contains: OpenAI tool loop, file parsing/generation, gap analysis, webhook trust-anchor logic, LinkedIn mapping, target resume creation
- Depends on: Shared types, Supabase admin client, external SDKs
- Used by: API routes and some server components

**Persistence Layer:**
- Purpose: Persist sessions, versions, targets, quotas, jobs, and profiles.
- Location: `src/lib/db/**`, `prisma/schema.prisma`, `prisma/migrations/**`
- Contains: Supabase table accessors, transaction/RPC wrappers, schema guardrails, migration SQL
- Depends on: `src/lib/db/supabase-admin.ts`, Postgres/Supabase
- Used by: Agent tools, routes, billing services, profile import services

**Integration Layer:**
- Purpose: Encapsulate third-party service calls and operational boundaries.
- Location: `src/lib/openai/**`, `src/lib/asaas/client.ts`, `src/lib/linkedin/linkdapi.ts`, `src/lib/rate-limit.ts`
- Contains: OpenAI client/retry wrappers, Asaas REST client, LinkdAPI fetch layer, Upstash ratelimits
- Depends on: Environment variables and external services
- Used by: Agent runtime, billing flows, profile import, middleware/webhook protection

## Data Flow

**Agent Conversation Flow:**

1. `src/app/api/agent/route.ts` authenticates the user, rate limits the request, validates payload shape, and loads or creates a session.
2. The route pre-processes message content with `prepareUserMessage()` and optional `handleFileAttachment()`, then persists target-job context when it confidently detects a job description.
3. `runAgentLoop()` in `src/lib/agent/agent-loop.ts` loads recent message history from `src/lib/db/sessions.ts`, builds a phase-specific system prompt via `src/lib/agent/context-builder.ts`, and starts OpenAI streaming.
4. Tool calls are routed through `dispatchToolWithContext()` in `src/lib/agent/tools/index.ts`, which validates input, runs the tool, persists patches, and optionally creates CV versions.
5. The route streams SSE chunks back to `src/components/dashboard/chat-interface.tsx`, which updates local UI state and refreshes workspace data through `src/lib/dashboard/workspace-client.ts`.

**Billing Flow:**

1. `src/app/api/checkout/route.ts` validates plan and billing data, saves billing info, and creates a pending checkout record.
2. `src/lib/asaas/checkout.ts` creates the hosted Asaas checkout link using a trustable external reference.
3. `src/app/api/webhook/asaas/route.ts` verifies the webhook token, deduplicates events, and delegates to `src/lib/asaas/event-handlers.ts`.
4. Billing handlers update checkout state, subscription metadata, and credits via `src/lib/asaas/credit-grants.ts`, `src/lib/asaas/quota.ts`, and Supabase-backed tables.

**LinkedIn Import Flow:**

1. `src/app/api/profile/extract/route.ts` creates a `linkedin_import_jobs` row through `src/lib/linkedin/import-jobs.ts`.
2. `src/app/api/profile/status/[jobId]/route.ts` claims pending work on demand in the polling request.
3. `src/lib/linkedin/extract-profile.ts` fetches remote profile data from `src/lib/linkedin/linkdapi.ts`, maps it into `CVState`, and upserts `user_profiles`.

**State Management:**
- Server-authoritative state lives in `sessions`, `cv_versions`, `resume_targets`, `user_profiles`, `credit_accounts`, and related tables.
- Client state is intentionally shallow: `src/components/dashboard/resume-workspace.tsx` stores the current `sessionId`, modal state, and refresh triggers; `src/context/preview-panel-context.tsx` caches signed preview URLs.
- Conversation phase is explicit (`intake`, `analysis`, `dialog`, `confirm`, `generation`) and travels through `Session.phase` in `src/types/cv.ts`.

## Key Abstractions

**Session Bundle:**
- Purpose: Keep canonical resume state, operational AI state, artifact metadata, and ATS score in one typed unit.
- Examples: `src/types/agent.ts`, `src/lib/db/sessions.ts`
- Pattern: Centralized session aggregate with patch-based mutation

**ToolPatch:**
- Purpose: Let tools describe allowed state changes without mutating persistence inline.
- Examples: `src/types/agent.ts`, `src/lib/agent/tools/index.ts`, `src/lib/db/sessions.ts`
- Pattern: Dispatcher-mediated patch application

**Resume Targets and Versions:**
- Purpose: Separate immutable history and target-derived variants from the canonical base resume.
- Examples: `src/lib/db/cv-versions.ts`, `src/lib/db/resume-targets.ts`, `src/lib/resume-targets/create-target-resume.ts`
- Pattern: Base/derived split with transactional persistence

**Structured Logging:**
- Purpose: Keep backend logs machine-readable and consistent.
- Examples: `src/lib/observability/structured-log.ts`, `src/lib/agent/agent-loop.ts`, `src/lib/asaas/event-handlers.ts`
- Pattern: JSON event logging with shared helpers

## Entry Points

**Root App Shell:**
- Location: `src/app/layout.tsx`
- Triggers: All page requests
- Responsibilities: Attach Clerk provider, theme/tooltip providers, metadata, and global CSS

**Public Landing Surface:**
- Location: `src/app/(public)/page.tsx`
- Triggers: `/`
- Responsibilities: Compose landing sections and SEO schema components

**Authenticated Dashboard Shell:**
- Location: `src/app/(auth)/layout.tsx`
- Triggers: All protected dashboard routes
- Responsibilities: Resolve internal app user, load billing info, wrap children in sidebar and preview contexts

**Agent HTTP/SSE Adapter:**
- Location: `src/app/api/agent/route.ts`
- Triggers: Chat sends from `src/components/dashboard/chat-interface.tsx`
- Responsibilities: Auth, rate limit, session creation, preprocessing, streaming, and error translation

**Billing Webhook Adapter:**
- Location: `src/app/api/webhook/asaas/route.ts`
- Triggers: Asaas webhook deliveries
- Responsibilities: Verify token, dedupe, apply billing side effects, return stable JSON outcomes

## Error Handling

**Strategy:** Validate early, return structured JSON errors from routes, and centralize tool-failure codes.

**Patterns:**
- Routes use `NextResponse.json({ error }, { status })` after `safeParse()` validation, as seen in `src/app/api/checkout/route.ts` and `src/app/api/session/[id]/manual-edit/route.ts`.
- Tools use `toolFailure()` / `toolFailureFromUnknown()` in `src/lib/agent/tool-errors.ts` and are persisted through the dispatcher in `src/lib/agent/tools/index.ts`.
- Some older endpoints still log through `console.error` instead of `src/lib/observability/structured-log.ts`, especially in `src/app/api/session/route.ts` and `src/app/api/file/[sessionId]/route.ts`.

## Cross-Cutting Concerns

**Logging:** Structured JSON logging in `src/lib/observability/structured-log.ts`, with partial legacy `console.*` holdouts.
**Validation:** `zod` on routes, manual edit inputs, CV state, and tool schemas across `src/lib/cv/schema.ts` and `src/lib/agent/tools/schemas.ts`.
**Authentication:** Clerk external auth plus internal app-user resolution in `src/lib/auth/app-user.ts`.
**Security:** Host canonicalization, CSP, HSTS, and frame protections in `src/middleware.ts`; webhook verification in `src/app/api/webhook/asaas/route.ts` and `src/app/api/webhook/clerk/route.ts`.

---

*Architecture analysis: 2026-04-09*
