# CurrIA

CurrIA is an AI-powered resume optimization SaaS. The product combines ATS analysis, assisted rewriting, versioned resume history, job-targeted resume variants, and billing through hosted Asaas checkout flows.

## What the project does

- authenticates users with Clerk
- resolves each authenticated session to an internal application user
- analyzes and rewrites resumes with AI
- maintains a canonical resume version plus job-specific variants
- generates output files while persisting only durable output metadata
- manages usage credits
- charges one-time and recurring plans through Asaas

## Core stack

- Next.js 14 + App Router
- React 18 + TypeScript
- Tailwind CSS
- Clerk for authentication
- Supabase + Postgres
- Prisma
- OpenAI for all AI workflows
- Asaas for billing and checkout
- Vitest + Testing Library

## AI model status

- the runtime is fully on OpenAI
- the current default routing is `combo_a`
  - `agent`: `gpt-5-nano`
  - `structured`: `gpt-5-nano`
  - `vision`: `gpt-5-nano`
- all combo names are currently pinned to the same cheapest supported model to keep runtime cost as low as possible
- the active routing can be selected with `OPENAI_MODEL_COMBO`
- the model bakeoff is documented in [openai-model-selection-matrix.md](/c:/CurrIA/docs/openai-model-selection-matrix.md)
- the pt-BR quality gate is documented in [openai-portuguese-quality-gate.md](/c:/CurrIA/docs/openai-portuguese-quality-gate.md)
- the rollout checklist is documented in [openai-migration-checklist.md](/c:/CurrIA/docs/openai-migration-checklist.md)

## Main flows

### Resume and AI

- `cvState` stores the canonical resume
- `agentState` stores the agent's operational context
- `resume_targets` stores job-specific derived resume variants
- `cv_versions` stores immutable resume snapshots

### Identity

- Clerk authenticates the user
- the app maps the authenticated user to an internal record in `users`
- domain logic should always use the `app user id`, not the Clerk id

### Billing

- `credit_accounts` is the source of truth for runtime credits
- one-time purchases use Asaas payment links
- recurring subscriptions use hosted Asaas Checkout
- credits are granted only through webhook processing
- Asaas events are deduplicated through `processed_events`
- paid checkouts are tracked in `billing_checkouts`

## Project structure

```text
src/
  app/                  public, authenticated, and API routes
  components/           UI and forms
  lib/
    asaas/              checkout, webhooks, credits, idempotency
    auth/               internal user resolution
    db/                 database clients and helpers
    templates/          file/template utilities
prisma/
  schema.prisma         Prisma schema
  migrations/           SQL migrations
docs/                   technical, billing, and operational docs
  design-system-migration.md   current Figma migration tracker
  design-system-migration/     archived imported workspace files
scripts/                operational validation and evaluation helpers
```

## Important routes

### UI

- `/`
- `/pricing`
- `/login`
- `/signup`
- `/dashboard`
- `/chat/[sessionId]`
- `/resumes`

### API

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

## Requirements

- Node.js 20+
- npm
- Postgres or Supabase
- valid Clerk credentials
- an OpenAI API key
- an Asaas account

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Copy `.env.example` to `.env` and fill in real values:

```bash
copy .env.example .env
```

Main variables:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=
DIRECT_URL=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL_COMBO=combo_a

# Asaas
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_SANDBOX=true

# Upstash
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron
CRON_SECRET=
```

### 3. Prepare the database

Generate the Prisma client:

```bash
npm run db:generate
```

If you are using the Prisma migration flow:

```bash
npm run db:migrate
```

If you are applying SQL manually, use the files in `prisma/migrations/`. The most relevant ones for the current project state include:

- `internal_user_model.sql`
- `session_state_foundation.sql`
- `session_state_version.sql`
- `billing_webhook_hardening.sql`
- `cv_versioning_and_targets.sql`
- `cv_versioning_atomicity.sql`
- `cv_version_deduplication.sql`
- `target_generated_output.sql`

For rollout and validation details, see [billing-migration-guide.md](/c:/CurrIA/docs/billing-migration-guide.md).

### 4. Run the project

```bash
npm run dev
```

Local app:

- `http://localhost:3000`

## Useful scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

## Operational scripts

The `scripts/` directory contains repo-level helpers that are not part of the Next.js runtime:

- [scripts/README.md](/c:/CurrIA/scripts/README.md) documents each operational script and when to use it
- `npm run phase1:model-selection` runs the OpenAI combo bakeoff and writes blind-review artifacts under `docs/openai-model-selection-runs/`
- `scripts/verify-staging.sh` checks staging database, webhook, and API preconditions before manual validation

## Design migration references

- [design-system-migration.md](/c:/CurrIA/docs/design-system-migration.md) tracks page-by-page Figma migration status
- `docs/design-system-migration/workspace/` stores the archived imported design workspace used as the migration reference

## How billing works

### Plans

Defined in [plans.ts](/c:/CurrIA/src/lib/plans.ts):

- `free`
- `unit`
- `monthly`
- `pro`

### Checkout flow

1. the client calls `POST /api/checkout`
2. the API creates a `pending` row in `billing_checkouts`
3. it generates a short `externalReference` in the format `curria:v1:c:<checkoutReference>`
4. it creates the checkout in Asaas
5. it marks the checkout as `created` or `failed`

### Webhook flow

- `PAYMENT_RECEIVED` resolves through `billing_checkouts`
- `SUBSCRIPTION_CREATED` resolves through `billing_checkouts`
- `SUBSCRIPTION_RENEWED` resolves through `user_quotas.asaas_subscription_id`
- `SUBSCRIPTION_CANCELED` updates metadata only and does not revoke credits

### Important rules

- credits are additive
- the frontend must never grant credits directly
- duplicate events must never grant credits twice
- pre-cutover subscriptions remain supported through `asaas_subscription_id`

## Quality and testing

The project includes test coverage for:

- checkout routes
- Asaas webhooks
- event deduplication
- resume versioning
- sessions and targets
- auth and pricing flows

Recommended local checklist:

```bash
npm run typecheck
npm test
npm run lint
```

## Important documentation

### Architecture

- [architecture-overview.md](/c:/CurrIA/docs/architecture-overview.md)
- [state-model.md](/c:/CurrIA/docs/state-model.md)
- [tool-development.md](/c:/CurrIA/docs/tool-development.md)
- [openai-model-selection-matrix.md](/c:/CurrIA/docs/openai-model-selection-matrix.md)
- [openai-portuguese-quality-gate.md](/c:/CurrIA/docs/openai-portuguese-quality-gate.md)
- [openai-migration-checklist.md](/c:/CurrIA/docs/openai-migration-checklist.md)
- [portuguese-quality-test-results.md](/c:/CurrIA/docs/portuguese-quality-test-results.md)
- [openai-migration-monitoring.md](/c:/CurrIA/docs/openai-migration-monitoring.md)
- [openai-migration-rollback.md](/c:/CurrIA/docs/openai-migration-rollback.md)

### Billing and operations

- [billing-implementation.md](/c:/CurrIA/docs/billing-implementation.md)
- [billing-migration-guide.md](/c:/CurrIA/docs/billing-migration-guide.md)
- [billing-ops-runbook.md](/c:/CurrIA/docs/billing-ops-runbook.md)
- [billing-monitoring.md](/c:/CurrIA/docs/billing-monitoring.md)
- [error-codes.md](/c:/CurrIA/docs/error-codes.md)
- [PRODUCTION-READINESS-CHECKLIST.md](/c:/CurrIA/docs/PRODUCTION-READINESS-CHECKLIST.md)

### Staging

- [staging-setup-guide.md](/c:/CurrIA/docs/staging-setup-guide.md)
- [staging-validation-plan.md](/c:/CurrIA/docs/staging-validation-plan.md)
- [staging-validation-agent-prompt.md](/c:/CurrIA/docs/staging-validation-agent-prompt.md)

## Contribution notes

- prefer `app user id` in all domain logic
- do not write credits directly into `user_quotas`; use `credit_accounts`
- do not grant credits outside the webhook flow
- keep `cvState` as the canonical source of truth for the base resume
- new state mutations should preserve versioning and idempotency where applicable

## Current status

The project already includes:

- authentication and internal-user bootstrap
- chat and resume session flows
- job-targeted resume variants
- versioned resume history
- Asaas checkout and billing
- operational documentation for staging and production

## Design System

We are modernizing UI components to match the imported Figma design system. Progress is tracked in [design-system-migration.md](/c:/CurrIA/docs/design-system-migration.md).

If you want to run the project now, the best path is:

1. configure `.env`
2. apply the schema and migrations
3. run `npm run typecheck`
4. run `npm test`
5. run `npm run dev`
