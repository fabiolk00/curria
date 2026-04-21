# Phase 61 Context

## Goal

Fix the `resume_generations` create path so `updated_at` is always persisted explicitly and remains aligned with the DB/model timestamp contract.

## Starting Point

- Phase 60 narrowed the pending-generation persistence hotspot and showed the create branch is still a direct Supabase insert.
- The Prisma model marks `updatedAt` with `@updatedAt`.
- The SQL table contract already defines `updated_at timestamptz not null default now()`.

## Focus

- Keep billing, idempotency, and reuse semantics unchanged.
- Make the create branch explicit instead of relying on an implicit default for `updated_at`.
- Add a direct regression proving the insert payload carries `updated_at`.
