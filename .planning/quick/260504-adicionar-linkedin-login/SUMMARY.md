# Summary

Added LinkedIn OIDC social login/signup above Google in the auth screens.

## Files changed
- src/components/auth/auth-form-ui.tsx
- src/components/auth/login-form.tsx
- src/components/auth/signup-form.tsx
- src/components/auth/login-form.test.tsx
- src/components/auth/signup-form.test.tsx

## Validation
- npm run typecheck: passed
- npx vitest run src/components/auth/login-form.test.tsx src/components/auth/signup-form.test.tsx: passed
- npm run lint: passed
