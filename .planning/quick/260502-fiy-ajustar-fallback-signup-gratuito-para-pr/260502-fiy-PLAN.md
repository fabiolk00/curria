# Quick Task 260502-fiy: Ajustar fallback signup gratuito para profile-setup

**Date:** 2026-05-02
**Status:** Completed

## Goal

- Make signup without `redirect_to` land on `/profile-setup`.
- Preserve safe internal `redirect_to` for paid checkout and other intended flows.
- Align public CTA copy with the free product-first journey.

## Tasks

1. Update signup fallback and tests so default email/Google signup goes to `/profile-setup`.
2. Preserve `redirect_to` when switching between login and signup screens.
3. Update landing/pricing CTA copy while keeping paid plan links pointed at checkout.

## Verification

- `npx vitest run src/components/auth/signup-form.test.tsx src/components/auth/login-form.test.tsx src/components/landing/hero-section.test.tsx src/components/landing/pricing-section.test.tsx`
- `npm run typecheck`
