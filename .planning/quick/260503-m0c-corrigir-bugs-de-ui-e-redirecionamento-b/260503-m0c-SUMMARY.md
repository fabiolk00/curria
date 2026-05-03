# Quick Task 260503-m0c: Corrigir bugs de UI e redirecionamento - Summary

**Date:** 2026-05-03
**Status:** Completed
**Code Commit:** 468e44a

## Completed

- Google OAuth now carries the intended safe redirect into `/sso-callback` and the callback explicitly forces/falls back to that destination for sign-in and sign-up.
- History CTA "Melhorar currículo com IA" now routes to `/generate-resume`, and "Voltar ao perfil" buttons on the generation/history surfaces use the requested black treatment.
- Dashboard welcome guide now follows the visual sidebar order: Perfil, Histórico de currículos, Gerar currículo.
- Welcome guide spotlight now measures the target element itself instead of adding oversized padding.
- Dashboard/auth shells now use `100dvh` with internal scrolling to avoid tablet body scrollbars caused by viewport height mismatch.
- A lightweight global route loading indicator plus route-level loading fallbacks now provide immediate feedback during navigation.

## Verification

- `npx vitest run "src/components/auth/login-form.test.tsx" "src/components/auth/signup-form.test.tsx" "src/app/sso-callback/page.test.tsx" "src/lib/auth/redirects.test.ts" "src/components/dashboard/welcome-guide.test.tsx" "src/components/resume/generated-resume-history.test.tsx" "src/components/resume/generated-resume-history-page.test.tsx" "src/components/resume/user-data-page.test.tsx" "src/app/(auth)/layout.test.tsx" "src/components/auth/auth-shell.test.tsx"` - passed, 79 tests.
- `npm run typecheck` - passed.
- `npx next lint --file ...` for changed source and new files - passed.
