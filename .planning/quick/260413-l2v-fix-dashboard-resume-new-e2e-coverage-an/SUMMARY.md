# Quick Task Summary

## Task
Fix `/dashboard/resume/new` E2E coverage and align browser expectations with the current profile setup flow.

## Changes
- Added an explicit route alias at `src/app/(auth)/dashboard/resume/new/page.tsx` that forwards all exports to the canonical `dashboard/resumes/new` page.
- Rewrote `tests/e2e/profile-setup.spec.ts` to cover:
  - guest redirect for `/dashboard/resumes/new`
  - guest redirect for `/dashboard/resume/new`
  - manual save staying on `/dashboard/resume/new`
  - cancel returning to `/dashboard`
  - import modal open/close
  - PDF import success
  - LinkedIn import success
  - ATS button disabled when the user has no credits
  - ATS enhancement happy path redirect to `/dashboard?session=...`

## Verification
- `npx playwright test tests/e2e/profile-setup.spec.ts --project=chromium`
- `npx playwright test --project=chromium`

## Review Loop
- Confucius review: no blocking findings after the added alias and expanded coverage.
- Goodall follow-up: no further fix needed.
