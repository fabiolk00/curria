# 16-02 Summary

Closed the Clerk webhook verification gap by moving duplicate detection after Svix verification, so duplicate handling no longer bypasses signature validation.

Strengthened negative-path proof for both webhook surfaces:

- Clerk route now rejects missing Svix headers, malformed timestamps, and invalid signatures with explicit tests in `src/app/api/webhook/clerk/route.test.ts`
- Asaas route now proves fail-closed behavior for missing auth-token headers and malformed handled-event payloads in `src/app/api/webhook/asaas/route.test.ts`

Verification:

- `pnpm tsc --noEmit`
- `pnpm vitest run src/app/api/webhook/clerk/route.test.ts src/app/api/webhook/asaas/route.test.ts src/lib/asaas/webhook.test.ts src/lib/asaas/idempotency.test.ts`
