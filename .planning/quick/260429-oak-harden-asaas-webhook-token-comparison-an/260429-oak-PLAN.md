# Quick Task 260429-oak: Harden Asaas Webhook Token Comparison and Safe Auth Diagnostics

**Date:** 2026-04-29
**Status:** In progress

## Tasks

1. Update the Asaas webhook route to normalize the incoming authentication token before comparison.
2. Add safe unauthorized diagnostics using token presence, lengths, and short SHA-256 fingerprints only.
3. Add focused route tests for whitespace-tolerant token handling and safe unauthorized logging.

## Verification

- `npm test -- src/app/api/webhook/asaas/route.test.ts`
- `npm run typecheck`
