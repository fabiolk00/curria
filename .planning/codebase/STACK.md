# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 5.4.5 - Main application and test code in `src/app/**`, `src/components/**`, `src/lib/**`, `src/hooks/**`, `src/context/**`, and `scripts/*.ts`.

**Secondary:**
- SQL (PostgreSQL dialect) - Schema evolution and RPC functions in `prisma/migrations/*.sql`.
- CSS - Global tokens and base styling in `src/app/globals.css`.
- Markdown - Product, ops, and developer docs in `README.md` and `docs/**`.

## Runtime

**Environment:**
- Node.js 20-compatible runtime - implied by `.github/workflows/ci.yml`, `next@14.2.3`, and Prisma 5 tooling.
- Browser runtime for client components marked with `"use client"`, including `src/components/dashboard/chat-interface.tsx`, `src/components/dashboard/resume-workspace.tsx`, and `src/components/resume/visual-resume-editor.tsx`.

**Package Manager:**
- npm - scripts and dependency management defined in `package.json`.
- Lockfile: present in `package-lock.json`.

## Frameworks

**Core:**
- Next.js 14.2.3 - App Router pages, layouts, and route handlers rooted in `src/app/**`.
- React 18.3.1 - Server and client component rendering across `src/components/**`.
- TypeScript strict mode - enforced by `tsconfig.json`.
- Clerk - external auth boundary in `src/app/layout.tsx`, `src/middleware.ts`, and `src/lib/auth/app-user.ts`.
- Supabase JS - runtime DB and storage access in `src/lib/db/supabase-admin.ts` and `src/lib/agent/tools/generate-file.ts`.
- Zod - request and tool validation across routes like `src/app/api/agent/route.ts` and `src/app/api/checkout/route.ts`.

**Testing:**
- Vitest 1.6.0 - configured in `vitest.config.ts`.
- React Testing Library + `@testing-library/jest-dom` - UI and hook coverage in files like `src/components/auth/login-form.test.tsx` and `src/hooks/use-session-cv-state.test.tsx`.

**Build/Dev:**
- Tailwind CSS 3.4.19 + PostCSS - `tailwind.config.js`, `postcss.config.js`, and `src/app/globals.css`.
- shadcn/ui conventions - `components.json` plus wrappers in `src/components/ui/**`.
- `tsx` - operational scripts such as `scripts/run-openai-model-selection-phase1.ts` and `scripts/report-agent-baseline.ts`.
- Vercel - hosting and cron configuration in `vercel.json`.

## Key Dependencies

**Critical:**
- `openai` - agent chat, OCR, and retry wrappers in `src/lib/openai/client.ts`, `src/lib/openai/chat.ts`, and `src/lib/agent/agent-loop.ts`.
- `@supabase/supabase-js` - database and storage operations in `src/lib/db/supabase-admin.ts`, `src/lib/db/*.ts`, and `src/lib/agent/tools/generate-file.ts`.
- `@clerk/nextjs` - auth/session handling in `src/app/layout.tsx`, `src/middleware.ts`, `src/app/(auth)/**`, and `src/app/api/webhook/clerk/route.ts`.
- `zod` - schema validation for routes, tool inputs, and CV state in `src/lib/cv/schema.ts` and multiple `route.ts` files.

**Infrastructure:**
- `@upstash/redis` and `@upstash/ratelimit` - rate limiting and webhook dedupe in `src/lib/rate-limit.ts` and `src/app/api/webhook/clerk/route.ts`.
- `docx`, `pdf-lib`, `mammoth`, and `pdf-parse` - resume generation and parsing in `src/lib/agent/tools/generate-file.ts` and `src/lib/agent/tools/parse-file.ts`.
- `svix` - Clerk webhook verification in `src/app/api/webhook/clerk/route.ts`.
- Radix packages - UI primitives wrapped in `src/components/ui/**`.

## Configuration

**Environment:**
- Local env configuration is expected via `.env`; contents were intentionally not read.
- Runtime env access appears in `src/lib/openai/client.ts`, `src/lib/db/supabase-admin.ts`, `src/lib/asaas/client.ts`, `src/lib/rate-limit.ts`, `src/lib/linkedin/linkdapi.ts`, and `src/lib/config/app-url.ts`.

**Build:**
- `next.config.js` - server action body-size override.
- `tsconfig.json` - `@/*` path alias, strict TS, and Next plugin wiring.
- `tailwind.config.js` and `components.json` - design token and shadcn/ui setup.
- `vitest.config.ts` and `vitest.setup.ts` - jsdom test environment and shared mocks.
- `.eslintrc.json` - `next/core-web-vitals` lint baseline.
- `prisma/schema.prisma` - canonical schema reference for runtime tables.

## Platform Requirements

**Development:**
- Node.js + npm.
- Postgres/Supabase access for runtime persistence and storage.
- Clerk, OpenAI, Asaas, Upstash, and LinkdAPI credentials in environment variables.
- SQL migrations applied from `prisma/migrations/**` before exercising billing, sessions, versions, or LinkedIn import flows.

**Production:**
- Vercel-hosted Next.js app with Node runtime routes such as `src/app/api/checkout/route.ts` and `src/app/api/webhook/asaas/route.ts`.
- Postgres-backed Supabase project plus a `resumes` storage bucket used by `src/lib/agent/tools/generate-file.ts`.

---

*Stack analysis: 2026-04-09*
