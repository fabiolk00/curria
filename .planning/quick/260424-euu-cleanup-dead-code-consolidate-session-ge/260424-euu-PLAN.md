# Quick Task 260424-euu: cleanup dead code: consolidate session-generate helpers, remove orphan parse and tracker showcase

**Gathered:** 2026-04-24
**Status:** Completed

## Scope

Remove proven dead code and duplicate helpers without changing the active product surface.

## Tasks

1. Consolidate `session-generate` idempotency helpers into one canonical module and delete the orphan `parse.ts`.
2. Remove orphan UI/code artifacts with no repo consumers: `tracker-showcase.tsx` and unused local font files.
3. Remove dead zip/cache leftovers that should not stay in the repo or workspace, then validate with typecheck and reference checks.
