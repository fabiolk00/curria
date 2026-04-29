# Quick Plan: Low-fit evidence copy and modal scroll

## Problem

The job-targeting low-fit warning could present a weak version-control signal such as `Git` as the user's stronger career evidence for an unrelated role, producing misleading copy like "Seu currículo comprova melhor experiência em Git." The validation dialog also allowed long copy to push the action buttons out of reach.

## Scope

- Suppress version-control-only signals from low-fit user-facing career positioning copy.
- Keep stronger adjacent evidence, such as `APIs REST` and `SQL`, when present.
- Make the rewrite validation dialog height-bounded with a scrollable body and reachable footer.
- Add focused regression coverage.

## Verification

- `npm test -- src/lib/agent/job-targeting/recoverable-validation.test.ts src/lib/agent/tools/pipeline.test.ts src/components/resume/user-data-page.test.tsx src/lib/routes/smart-generation/decision.test.ts`
- `npm run typecheck`
- `npm run lint`
