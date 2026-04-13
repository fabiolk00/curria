# Quick Task 260413-dh7 Summary

## What changed

- Updated the shared Clerk auth appearance so the border, radius, and background are applied to `formFieldInputGroup`.
- Kept `formFieldInput` transparent and full-width to avoid clipped borders inside grouped Clerk fields such as password inputs and the signup name row.
- Added a regression test for the appearance config.

## Verification

- `npx vitest run src/components/auth/clerk-appearance.test.ts src/components/auth/login-form.test.tsx src/components/auth/signup-form.test.tsx`
- Result: 3 test files passed, 7 tests passed.
