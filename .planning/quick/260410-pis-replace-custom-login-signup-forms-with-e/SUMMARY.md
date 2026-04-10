# Quick Task 260410-pis

## Task

Replace custom login/signup forms with embedded Clerk auth components inside the existing public auth layout, preserving branding and removing the custom continuation fallback complexity.

## Outcome

- `/login` now renders Clerk `SignIn` directly inside the existing CurrIA auth shell.
- `/signup` now renders Clerk `SignUp` directly inside the existing CurrIA auth shell.
- The custom continuation fallback route was removed.
- The custom email/password step orchestration is no longer the primary login path.

## Verification

- `npm test -- src/components/auth/login-form.test.tsx src/components/auth/signup-form.test.tsx 'src/app/(auth)/layout.test.tsx'`
- `npm run build`
- `npm run typecheck`
