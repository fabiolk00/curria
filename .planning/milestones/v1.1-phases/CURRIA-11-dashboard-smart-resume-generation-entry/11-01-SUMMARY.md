# 11-01 Summary

## Outcome

The setup-page sidebar UX now exposes an optional target-job input and explicit mode-aware copy so users can see whether they are generating a general ATS enhancement or a target-job adaptation before spending a credit.

## Evidence

- Added dynamic generation copy and feature lists in `src/components/resume/user-data-page.tsx`
- Added target-job textarea, mode switch behavior, and updated CTA/modal messaging
- Covered default ATS mode and target-job mode UI in `src/components/resume/user-data-page.test.tsx`

## Verification

- `pnpm vitest run src/components/resume/user-data-page.test.tsx`
