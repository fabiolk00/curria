# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```text
curria/
|- src/                     # Next.js app, UI, hooks, domain logic, and shared types
|  |- app/                  # App Router pages, layouts, and API routes
|  |- components/           # UI building blocks and feature components
|  |- context/              # React context providers
|  |- hooks/                # Client-side hooks
|  |- lib/                  # Domain services, integrations, and persistence helpers
|  `- types/                # Shared TS types for agent, CV, dashboard, and user data
|- prisma/                  # Prisma schema reference plus SQL migrations
|  `- migrations/           # Hand-authored migration and RPC SQL
|- public/                  # Static assets such as `robots.txt`, `sitemap.xml`, and OG image
|- docs/                    # Product, architecture, billing, staging, and developer docs
|- scripts/                 # Operator and engineering helper scripts
|- .github/                 # CI workflow and issue templates
|- .planning/codebase/      # Generated codebase map for GSD workflows
|- .next/                   # Generated Next.js build output
`- node_modules/            # Installed dependencies
```

## Directory Purposes

**`src/app`:**
- Purpose: Own route groups, page entry points, layouts, and JSON/SSE route handlers.
- Contains: `page.tsx`, `layout.tsx`, `route.ts`, grouped folders like `src/app/(auth)` and dynamic segments like `src/app/api/session/[id]`.
- Key files: `src/app/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/api/agent/route.ts`

**`src/components`:**
- Purpose: Hold feature UIs and reusable primitives.
- Contains: Dashboard components in `src/components/dashboard/**`, marketing sections in `src/components/landing/**`, editor UI in `src/components/resume/**`, and primitive wrappers in `src/components/ui/**`.
- Key files: `src/components/dashboard/resume-workspace.tsx`, `src/components/dashboard/chat-interface.tsx`, `src/components/ui/button.tsx`

**`src/lib`:**
- Purpose: Keep non-UI logic out of route handlers and components.
- Contains: Agent runtime, billing integrations, auth mapping, DB access, LinkedIn import, template generation, observability, and config helpers.
- Key files: `src/lib/agent/agent-loop.ts`, `src/lib/db/sessions.ts`, `src/lib/asaas/event-handlers.ts`, `src/lib/linkedin/import-jobs.ts`

**`prisma`:**
- Purpose: Store schema reference and database mutation history.
- Contains: `prisma/schema.prisma` and migration SQL such as `prisma/migrations/cv_versioning_and_targets.sql`.
- Key files: `prisma/schema.prisma`, `prisma/migrations/consume_credit_and_create_session.sql`

**`docs`:**
- Purpose: Capture current architecture, rules, runbooks, and rollout notes.
- Contains: onboarding docs, billing runbooks, OpenAI rollout material, staging guides, and developer rules.
- Key files: `docs/architecture-overview.md`, `docs/ENVIRONMENT_SETUP.md`, `docs/developer-rules/CODE_STYLE.md`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: global app shell
- `src/app/(public)/page.tsx`: landing page
- `src/app/(auth)/dashboard/page.tsx`: authenticated workspace entry
- `src/app/api/agent/route.ts`: chat + SSE backend

**Configuration:**
- `package.json`: scripts and dependency versions
- `tsconfig.json`: TS and alias configuration
- `tailwind.config.js`: Tailwind source globs and token extension
- `vitest.config.ts`: test runner setup
- `vercel.json`: cron and function runtime hints

**Core Logic:**
- `src/lib/agent/**`: AI loop, prompts, tools, usage tracking
- `src/lib/db/**`: session/version/target/job persistence
- `src/lib/asaas/**`: billing, webhook handling, quota logic
- `src/lib/linkedin/**`: profile import jobs and LinkedIn mapping

**Testing:**
- Co-located test files such as `src/lib/db/sessions.test.ts`, `src/app/api/checkout/route.test.ts`, and `src/components/auth/login-form.test.tsx`

## Naming Conventions

**Files:**
- Kebab-case for most feature modules: `create-target-resume.ts`, `chat-interface.tsx`, `billing-checkouts.ts`
- Fixed App Router names for framework entry points: `page.tsx`, `layout.tsx`, `route.ts`
- Test suffixes are co-located: `*.test.ts` and `*.test.tsx`

**Directories:**
- Domain folders are lowercase nouns: `src/lib/agent`, `src/lib/asaas`, `src/lib/db`
- App Router groups use parentheses for route grouping: `src/app/(auth)` and `src/app/(public)`
- Dynamic segments use bracket notation: `src/app/api/session/[id]`, `src/app/api/profile/status/[jobId]`

## Where to Add New Code

**New Feature:**
- Primary route/UI entry: add pages or route handlers under `src/app/(auth)/**`, `src/app/(public)/**`, or `src/app/api/**`
- Tests: add co-located `*.test.ts(x)` files next to the touched module

**New Component/Module:**
- Feature UI: `src/components/<area>/`
- Shared primitive or wrapper: `src/components/ui/`
- Client hooks and local UI state helpers: `src/hooks/` or `src/context/`

**Utilities:**
- Domain-specific helpers: `src/lib/<domain>/`
- Persistence helpers: `src/lib/db/`
- Shared type contracts: `src/types/`

## Special Directories

**`.next`:**
- Purpose: Next.js generated build output
- Generated: Yes
- Committed: No

**`node_modules`:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No

**`.planning/codebase`:**
- Purpose: GSD codebase map used by planning and execution workflows
- Generated: Yes
- Committed: Yes

**`prisma/migrations`:**
- Purpose: Canonical SQL history for schema and RPC changes
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-09*
