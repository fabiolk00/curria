# Quick Task 260429-oak: Harden Asaas Webhook Token Comparison and Safe Auth Diagnostics

**Date:** 2026-04-29
**Status:** Completed

## Changed

- Trimmed the incoming `asaas-access-token` header before comparing it with `ASAAS_WEBHOOK_TOKEN`.
- Added safe unauthorized diagnostics to `asaas.webhook.unauthorized`:
  - token presence
  - raw and trimmed token lengths
  - short SHA-256 fingerprints for received and expected tokens
- Added route tests covering invalid-token diagnostics and whitespace-tolerant token handling.

## Verification

- `npm test -- src/app/api/webhook/asaas/route.test.ts` - passed
- `npm run typecheck` - passed
- `npm run lint` - passed

## Notes

The route still does not log raw webhook tokens. The new fingerprints are only for comparing whether the provider sent the same logical value as the production environment.
