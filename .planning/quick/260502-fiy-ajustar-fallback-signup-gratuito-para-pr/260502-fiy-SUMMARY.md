# Quick Task 260502-fiy Summary

**Task:** Ajustar fallback signup gratuito para `/profile-setup` mantendo `redirect_to` pago.
**Date:** 2026-05-02
**Status:** Completed
**Code Commit:** 0947f58

## Changes

- Changed signup without `redirect_to` to land on `/profile-setup`.
- Kept safe internal `redirect_to` as the highest-priority destination for email and Google signup.
- Preserved checkout intent when switching between `/entrar` and `/criar-conta`.
- Updated landing and SEO CTA copy to emphasize free resume analysis.
- Updated pricing card CTA copy to "Começar com este plano" while keeping paid plan links on `/finalizar-compra?plan=...`.
- Removed the unused monthly-checkout onboarding fallback helper.

## Verification

- `npx vitest run src/components/auth/signup-form.test.tsx src/components/auth/login-form.test.tsx src/components/auth/auth-shell.test.tsx src/components/landing/hero-section.test.tsx src/components/landing/pricing-section.test.tsx`
- `npm run typecheck`
