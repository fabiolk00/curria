# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**AI Runtime:**
- OpenAI - chat, streaming, and OCR provider for the resume agent.
  - SDK/Client: `openai`
  - Auth: `OPENAI_API_KEY`
  - Key entry points: `src/lib/openai/client.ts`, `src/lib/openai/chat.ts`, `src/lib/agent/agent-loop.ts`, `src/lib/agent/tools/parse-file.ts`

**Authentication:**
- Clerk - user auth, session context, hosted auth UI, and webhook identity sync.
  - SDK/Client: `@clerk/nextjs`
  - Auth: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
  - Entry points: `src/app/layout.tsx`, `src/middleware.ts`, `src/lib/auth/app-user.ts`, `src/app/api/webhook/clerk/route.ts`

**Billing:**
- Asaas - hosted checkout and billing webhooks.
  - SDK/Client: custom fetch wrapper in `src/lib/asaas/client.ts`
  - Auth: `ASAAS_ACCESS_TOKEN`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_SANDBOX`
  - Entry points: `src/app/api/checkout/route.ts`, `src/lib/asaas/checkout.ts`, `src/app/api/webhook/asaas/route.ts`, `src/lib/asaas/event-handlers.ts`

**Rate Limiting / Dedupe:**
- Upstash Redis - agent rate limiting and Clerk webhook idempotency.
  - SDK/Client: `@upstash/redis`, `@upstash/ratelimit`
  - Auth: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Entry points: `src/lib/rate-limit.ts`, `src/app/api/webhook/clerk/route.ts`

**Profile Import:**
- LinkdAPI - LinkedIn profile fetch for seeded resume data.
  - SDK/Client: direct `fetch` in `src/lib/linkedin/linkdapi.ts`
  - Auth: `LINKDAPI_API_KEY`
  - Entry points: `src/app/api/profile/extract/route.ts`, `src/app/api/profile/status/[jobId]/route.ts`, `src/lib/linkedin/extract-profile.ts`

**Job Posting Fetch:**
- Allowed third-party job sites - job-description scraping via direct `fetch`.
  - SDK/Client: built-in `fetch`
  - Auth: none detected
  - Entry point: `src/lib/agent/scraper.ts`

## Data Storage

**Databases:**
- PostgreSQL via Supabase.
  - Connection: `DATABASE_URL`, `DIRECT_URL` for Prisma tooling; `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for runtime admin access.
  - Client: Prisma schema reference in `prisma/schema.prisma`; runtime reads/writes via Supabase JS in `src/lib/db/**/*.ts`.

**File Storage:**
- Supabase Storage bucket `resumes`.
  - Uploads and signed URLs handled in `src/lib/agent/tools/generate-file.ts`.

**Caching:**
- Upstash Redis.
  - Used by `src/lib/rate-limit.ts` and `src/app/api/webhook/clerk/route.ts`.

## Authentication & Identity

**Auth Provider:**
- Clerk externally, internal app-user mapping internally.
  - Implementation: `src/lib/auth/app-user.ts` maps Clerk user ids into `users` and `user_auth_identities`, then all domain logic uses internal app-user ids.

## Monitoring & Observability

**Error Tracking:**
- No hosted error tracker detected.

**Logs:**
- Structured JSON logs through `src/lib/observability/structured-log.ts`.
- Older routes and some UI flows still use direct `console.error` / `console.warn`, for example `src/app/api/session/route.ts` and `src/app/api/file/[sessionId]/route.ts`.

## CI/CD & Deployment

**Hosting:**
- Vercel.
  - Runtime hints in `vercel.json`, including cron scheduling and a max duration override for `src/app/api/agent/route.ts`.

**CI Pipeline:**
- GitHub Actions.
  - Workflow: `.github/workflows/ci.yml`
  - Checks: `npm run typecheck`, `npm run audit:db-conventions`, `npm run lint`, `npm test`

## Environment Configuration

**Required env vars:**
- App URL / canonical host: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
- Supabase / Postgres: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`
- OpenAI: `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_MODEL_COMBO`, `OPENAI_AGENT_MODEL`, `OPENAI_STRUCTURED_MODEL`, `OPENAI_VISION_MODEL`
- Asaas: `ASAAS_ACCESS_TOKEN`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_SANDBOX`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- LinkedIn import: `LINKDAPI_API_KEY`
- Cron: `CRON_SECRET`

**Secrets location:**
- Local development expects `.env`.
- Staging / production secrets are expected in Vercel and GitHub secret stores, as referenced by `docs/ENVIRONMENT_SETUP.md`, `docs/staging/SETUP_GUIDE.md`, and `.github/workflows/ci.yml`.

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhook/asaas` - billing settlement and subscription updates in `src/app/api/webhook/asaas/route.ts`
- `POST /api/webhook/clerk` - user bootstrap/sync/delete events in `src/app/api/webhook/clerk/route.ts`

**Outgoing:**
- Asaas checkout success/cancel/expired callbacks configured by `src/lib/asaas/checkout.ts`
- Direct outbound HTTP calls to OpenAI, Asaas, LinkdAPI, Supabase, Upstash, and allowlisted job-posting pages from `src/lib/openai/client.ts`, `src/lib/asaas/client.ts`, `src/lib/linkedin/linkdapi.ts`, `src/lib/agent/scraper.ts`, and `src/lib/db/supabase-admin.ts`

---

*Integration audit: 2026-04-09*
