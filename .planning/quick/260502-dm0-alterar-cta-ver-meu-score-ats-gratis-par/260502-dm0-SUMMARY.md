# Quick Task 260502-dm0 Summary

**Task:** Alterar CTA "Ver meu score ATS gratis" para `/criar-conta` e persistir metodo de signup.
**Date:** 2026-05-02
**Status:** Completed

## Changes

- Updated the landing hero primary CTA to link to `/criar-conta`.
- Added `signup_method` to `user_auth_identities` with allowed values `email`, `google`, and `unknown`.
- Updated the Clerk `user.created` webhook to create the app user, sync profile metadata, and persist signup method from `external_accounts`.
- Kept `user.updated` profile sync from overwriting signup method.
- Added focused regression coverage for the hero CTA and Google signup method detection.

## Verification

- `npx vitest run src/components/landing/hero-section.test.tsx src/app/api/webhook/clerk/route.test.ts`
- `npm run audit:db-conventions`
- `npm run typecheck`
