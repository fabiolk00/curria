# CurrIA

CurrIA is an AI-powered resume optimization platform for Brazilian job seekers. It combines ATS analysis, guided rewriting, job-targeted resume variants, versioned resume history, DOCX/PDF generation, and credit-based billing powered by Asaas.

This repository is actively maintained and validated through automated quality gates and release-critical E2E coverage.

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

- [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) - Audience-based entry point for local setup and day-one tasks.
- [docs/INDEX.md](docs/INDEX.md) - Full documentation map when you need deeper references.
- [docs/CONCEPTS.md](docs/CONCEPTS.md) - Core mental model for sessions, tools, billing, and identity.
- [docs/GLOSSARY.md](docs/GLOSSARY.md) - Shared terminology used across product and code.

Current OpenAI routing is controlled in `src/lib/agent/config.ts`. The default runtime stays on `gpt-5-nano`, and the bakeoff combos only vary the agent model while keeping structured and vision work on the cheaper baseline unless explicitly overridden.

## Architecture Entry Points

- [CLAUDE.md](CLAUDE.md) - Current architecture and engineering invariants.
- [docs/architecture/README.md](docs/architecture/README.md) - Curated index for the current architecture source-of-truth docs.
- [docs/architecture-overview.md](docs/architecture-overview.md) - System-level map of the monolith.
- [docs/architecture/route-policy-boundaries.md](docs/architecture/route-policy-boundaries.md) - When critical routes should use `context` / `policy` / `decision` / `response`.
- [docs/architecture/components-boundaries.md](docs/architecture/components-boundaries.md) - Feature-local versus shared component placement rules.
- [docs/architecture/architecture-scorecard.md](docs/architecture/architecture-scorecard.md) - Current governance status for route thinness, hotspots, and chokepoints.

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
  app/                  App Router pages plus route adapters
  components/           UI surface; keep feature UI local before promoting shared pieces
  lib/
    agent/              AI runtime and tool loop
    asaas/              Billing, webhooks, checkout, and quota logic
    auth/               Internal app-user resolution
    db/                 Session, version, and target persistence
    routes/             Thin critical-route seams for semantically dense handlers
    templates/          Resume generation helpers
docs/                   Technical, billing, OpenAI, staging, and ops docs
prisma/                 Prisma schema and SQL migrations
scripts/                Operational validation and engineering helpers
.claude/                Internal rules, commands, agents, and archived notes
```

## Route Topology

- Keep most routes simple: thin validation plus direct domain calls is enough for ordinary CRUD and settings paths.
- Use `src/lib/routes/*` only for semantically dense routes where auth, preview access, billing safety, replay behavior, or sensitive availability rules can drift.
- `POST /api/session/[id]/compare` is the canonical compare seam.
- `GET /api/session/[id]/comparison` remains a compatibility/dashboard surface with its own thin route-layer extraction; do not repoint consumers casually.
- See [docs/architecture/route-policy-boundaries.md](docs/architecture/route-policy-boundaries.md) for the contract and [docs/architecture/approved-chokepoints.md](docs/architecture/approved-chokepoints.md) for the small set of monitored route decision seams.

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
pnpm lint:types
pnpm lint:types:fix
pnpm hygiene:inventory
pnpm unused
pnpm depcheck
pnpm orphans
pnpm format:check
npm test
npm run test:e2e -- --project=chromium
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

## Dead-Code Hygiene Baseline

CurrIA now has a staged dead-code discovery baseline for `v1.2`.

Recommended order:

1. `pnpm lint:types:fix` to safely auto-remove unused imports in the currently approved brownfield scope.
2. `pnpm unused` to inventory candidate dead exports.
3. `pnpm depcheck` to inventory candidate unused dependencies.
4. `pnpm orphans` to inventory orphan files under `src/`.

Do not bulk-delete findings in one pass. Review false-positive classes first in [docs/operations/dead-code-cleanup-workflow.md](docs/operations/dead-code-cleanup-workflow.md), especially for Next.js routes, dynamic imports, string-driven handlers, and background-job style flows.

Dependency findings are also reviewed through [docs/operations/dependency-hygiene-inventory.md](docs/operations/dependency-hygiene-inventory.md), which records which packages were kept, ignored, added explicitly, or removed.

## Operational Scripts

- [scripts/README.md](scripts/README.md)
- `npm run phase1:model-selection`
- `npm run agent:parity`
- `npm run agent:replay-dialog`
- `npm run agent:stress-route`
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
