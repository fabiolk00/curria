# Quick Task Summary: UX + Core Requirement Hardening

## Status

Validated.

## Changes

- Removed domain-specific display hardcodes from core requirement coverage.
- Replaced label priority ordering with generic scoring based on importance, unsupported status, action verbs, semantic objects, and weak-signal penalties.
- Added safe conjunction splitting so standalone modifiers stay attached to their noun phrases while independent requirements still split.
- Preserved complete `unsupportedSignals` for debug while cleaning `topUnsupportedSignalsForDisplay` for UI.
- Added cross-domain tests for backend, legal, finance, operations, HR, and sales-style vacancies.
- Updated the override review banner to say "itens abaixo" when no inline highlights exist and "trechos marcados" only when ranges exist.

## Verification

- `npm run test -- src/lib/agent/job-targeting/core-requirement-coverage.test.ts`
- `npm run test -- src/components/resume/resume-comparison-view.test.tsx`
- `npm run typecheck`

## Notes

- Existing `.codex/config.toml` local changes were left untouched.
- The focused resume comparison suite still prints pre-existing React `act(...)` warnings from async download-state updates.
