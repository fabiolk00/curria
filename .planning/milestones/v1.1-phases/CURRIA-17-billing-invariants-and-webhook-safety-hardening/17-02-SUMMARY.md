# 17-02 Summary

Revalidated the webhook-side billing invariants with the existing settlement and duplicate-delivery suite, and aligned the billing implementation guide with the current contract.

`docs/billing/IMPLEMENTATION.md` now explicitly documents the billable resume replay invariant alongside checkout, webhook, and credit-grant controls, so the committed claims match the test-backed behavior.

The handler and webhook proofs continue to cover:

- trust-anchor-only settlement for one-time and recurring activation
- duplicate and retry safety across `processed_events`
- RPC-level rejection of invalid checkout or subscription mutations

Verification:

- `pnpm tsc --noEmit`
- `pnpm vitest run src/lib/asaas/event-handlers.test.ts src/lib/asaas/credit-grants.test.ts src/app/api/webhook/asaas/route.test.ts`
