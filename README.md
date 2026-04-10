# CurrIA

CurrIA is an AI-powered resume optimization platform for Brazilian job seekers. It combines ATS analysis, guided rewriting, job-targeted resume variants, versioned resume history, DOCX/PDF generation, and credit-based billing powered by Asaas.

## Why this repo exists

CurrIA helps users:

- analyze resumes against job descriptions
- rewrite weak resume sections with AI assistance
- maintain a canonical resume plus job-specific variants
- generate downloadable DOCX and PDF outputs
- manage sessions and usage through a credit-based billing model

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Copy `.env.example` to `.env`, then fill in the required values for:

- `DATABASE_URL` and `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `ASAAS_ACCESS_TOKEN` and `ASAAS_WEBHOOK_TOKEN`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

Optional entries such as `OPENAI_BASE_URL`, `ASAAS_SANDBOX`, and `LINKDAPI_API_KEY` can stay empty unless you actively use them.

```bash
copy .env.example .env
# or: cp .env.example .env
```

### 3. Prepare the database

```bash
npm run db:generate
npm run db:migrate
```

### 4. Start the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

### 5. Run browser verification

Install Chromium once, then run the committed Playwright lane:

```bash
npx playwright install chromium
npm run test:e2e -- --project=chromium
```

This suite uses mocked API providers plus the test-only `E2E_AUTH_ENABLED` and `E2E_AUTH_BYPASS_SECRET` seam wired by the committed Playwright harness. It does not require live Clerk, Supabase, OpenAI, Asaas, or storage credentials.

## Documentation Start Here

- [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) - Audience-based entry point for developers, operations, and product.
- [docs/CONCEPTS.md](docs/CONCEPTS.md) - Core mental model for sessions, tools, billing, and identity.
- [docs/INDEX.md](docs/INDEX.md) - Complete documentation map.
- [docs/FEATURES.md](docs/FEATURES.md) - Product capabilities overview.
- [docs/GLOSSARY.md](docs/GLOSSARY.md) - Shared terminology.

Current OpenAI routing is controlled in `src/lib/agent/config.ts`. The default runtime stays on `gpt-5-nano`, and the bakeoff combos only vary the agent model while keeping structured and vision work on the cheaper baseline unless explicitly overridden.

## Key Documentation Areas

### Architecture

- [CLAUDE.md](CLAUDE.md)
- [docs/architecture-overview.md](docs/architecture-overview.md)
- [docs/state-model.md](docs/state-model.md)
- [docs/tool-development.md](docs/tool-development.md)

### Billing

- [docs/billing/README.md](docs/billing/README.md)
- [docs/billing/IMPLEMENTATION.md](docs/billing/IMPLEMENTATION.md)
- [docs/billing/OPS_RUNBOOK.md](docs/billing/OPS_RUNBOOK.md)
- [docs/billing/MONITORING.md](docs/billing/MONITORING.md)

### OpenAI and Model Strategy

- [docs/openai/README.md](docs/openai/README.md)
- [docs/openai/MODEL_SELECTION_MATRIX.md](docs/openai/MODEL_SELECTION_MATRIX.md)
- [docs/openai/PORTUGUESE_QUALITY_GATE.md](docs/openai/PORTUGUESE_QUALITY_GATE.md)
- [docs/openai/PORTUGUESE_TEST_RESULTS.md](docs/openai/PORTUGUESE_TEST_RESULTS.md)
- [docs/openai/PT_BR_WEBSITE_PROOFREADER_AGENT_PROMPT.md](docs/openai/PT_BR_WEBSITE_PROOFREADER_AGENT_PROMPT.md)

### Staging and Release Validation

- [docs/staging/README.md](docs/staging/README.md)
- [docs/staging/SETUP_GUIDE.md](docs/staging/SETUP_GUIDE.md)
- [docs/staging/VALIDATION_PLAN.md](docs/staging/VALIDATION_PLAN.md)
- [docs/PRODUCTION-READINESS-CHECKLIST.md](docs/PRODUCTION-READINESS-CHECKLIST.md)

### Developer Rules

- [docs/developer-rules/README.md](docs/developer-rules/README.md)
- [docs/developer-rules/API_CONVENTIONS.md](docs/developer-rules/API_CONVENTIONS.md)
- [docs/developer-rules/CODE_STYLE.md](docs/developer-rules/CODE_STYLE.md)
- [docs/developer-rules/ERROR_HANDLING.md](docs/developer-rules/ERROR_HANDLING.md)
- [docs/developer-rules/TESTING.md](docs/developer-rules/TESTING.md)

## Core Stack

- Next.js 14 App Router
- React 18 and TypeScript
- Tailwind CSS
- Clerk authentication
- Supabase and Postgres
- Prisma
- OpenAI
- Asaas billing
- Vitest and Testing Library
- Playwright (Chromium browser verification)

## Project Structure

```text
src/
  app/                  Public, authenticated, and API routes
  components/           Product UI, dashboard UI, shared sections
  lib/
    agent/              AI runtime and tool loop
    asaas/              Billing, webhooks, checkout, and quota logic
    auth/               Internal app-user resolution
    db/                 Session, version, and target persistence
    templates/          Resume generation helpers
docs/                   Technical, billing, OpenAI, staging, and ops docs
prisma/                 Prisma schema and SQL migrations
scripts/                Operational validation and engineering helpers
.claude/                Internal rules, commands, agents, and archived notes
```

## Important Routes

### UI routes

- `/`
- `/pricing`
- `/login`
- `/signup`
- `/dashboard`
- `/dashboard/resumes`
- `/dashboard/sessions`
- `/settings`
- `/chat/[sessionId]`

### API routes

- `POST /api/agent`
- `GET /api/session`
- `GET /api/session/[id]/messages`
- `GET /api/session/[id]/versions`
- `GET /api/session/[id]/targets`
- `POST /api/session/[id]/targets`
- `POST /api/session/[id]/manual-edit`
- `GET /api/file/[sessionId]`
- `POST /api/checkout`
- `POST /api/webhook/asaas`
- `POST /api/webhook/clerk`
- `GET /api/cron/cleanup`

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --project=chromium
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

## Operational Scripts

- [scripts/README.md](scripts/README.md)
- `npm run phase1:model-selection`
- `bash scripts/verify-staging.sh`

## Contribution Notes

- Use internal app user IDs in domain logic, not Clerk IDs.
- Treat `cvState` as the canonical resume truth.
- Treat `agentState` as operational context only.
- Grant credits only through trusted billing flows.
- Keep AI tool state changes inside `ToolPatch` and dispatcher-managed persistence.

## Next Reads

- [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)
- [docs/CONCEPTS.md](docs/CONCEPTS.md)
- [docs/INDEX.md](docs/INDEX.md)
