# Quick Task 260503-qzm: Redesign Authenticated Settings Page

**Date:** 2026-05-03
**Mode:** quick

## Scope

Redesign `/settings` into a settings-first account surface for CurrIA while preserving current account, billing, session, credit, and route behavior.

## Tasks

1. Refactor `src/app/(auth)/settings/page.tsx`
   - Replace dashboard-style hero/KPI layout with compact section rows.
   - Keep existing data sources: `getCurrentAppUser`, Clerk `currentUser`, `loadOptionalBillingInfo`, `db.getUserSessions`, and ATS readiness resolution.
   - Use real routes only: profile setup, generate resume, resume history, pricing, and operations when allowed.
   - Add safe informational danger zone with no fake deletion behavior.

2. Tune reused components where needed
   - Keep `PlanUpdateSection` behavior intact.
   - Keep `BillingActivityCard` business logic intact while making it fit a settings surface.
   - Preserve `SessionList` links and ATS readiness display, optionally adding a compact variant for settings.

3. Verify behavior
   - Add/update focused tests for settings content and no-billing/no-session states.
   - Run typecheck, lint, and tests.
