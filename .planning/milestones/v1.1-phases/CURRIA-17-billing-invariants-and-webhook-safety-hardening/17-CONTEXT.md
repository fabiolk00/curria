# Phase 17: Billing Invariants and Webhook Safety Hardening - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** Roadmap phase definition plus inspection of checkout, webhook, idempotency, credit-grant, and billable-generation seams

<domain>
## Phase Boundary

This phase hardens the billing trust model now that Phase 16 proved the outer route boundaries. The focus here is not generic webhook auth anymore; it is the correctness of billing-side invariants after a trusted event or paid action reaches the domain layer.

In scope:
- prove credit grants only happen from the intended trust anchors
- prove duplicate or replayed webhook deliveries cannot over-credit or drift paid state
- verify checkout and provider boundaries remain server-only and explicit
- prove billable resume generation stays idempotent and does not expose paid artifacts incorrectly
- document the authoritative invariant set operators and developers should trust

Out of scope:
- pricing or product-plan redesign
- general auth or middleware changes already covered in Phase 16
- storage or RLS redesign
- broad checkout UX changes
</domain>

<implementation_state>
## Current Implementation Observations

- `src/app/api/webhook/asaas/route.ts` now has better fail-closed boundary proof from Phase 16, but the deeper credit mutation guarantees live in `src/lib/asaas/event-handlers.ts`, `src/lib/asaas/credit-grants.ts`, and the billing RPC migrations.
- `docs/CONCEPTS.md` and `docs/billing/IMPLEMENTATION.md` already state that `credit_accounts` is the runtime source of truth and Asaas webhooks are the only place that grant credits.
- `src/lib/asaas/idempotency.ts` and the billing SQL migrations already model processed-event dedupe plus RPC-side duplicate protection.
- `src/app/api/checkout/route.ts`, `src/lib/asaas/billing-checkouts.ts`, and `src/lib/asaas/checkout.ts` define the paid checkout bootstrap and provider-link creation seam.
- `src/lib/resume-generation/generate-billable-resume.ts` plus `src/app/api/session/[id]/generate/route.ts` already handle billable artifact generation and idempotent replay behavior.
- `src/app/api/file/[sessionId]/route.ts` proves ownership and transient signed URLs, but the “paid artifact authorization” invariant still needs explicit linkage to billing and generation state rather than ownership alone.
- `src/lib/asaas/client.ts` is already marked `server-only`, but this phase still needs a tighter proof and documentation story around which billing/provider mutation seams are allowed to talk to Asaas and why.
- Phase 16 intentionally did not claim billing settlement correctness; it only proved boundary verification. This phase closes that gap.
</implementation_state>

<decisions>
## Implementation Decisions

### Trust Anchor Discipline
- Treat `billing_checkouts`, `processed_events`, and `credit_accounts` as the authoritative billing invariant surfaces.
- Prove route plus handler plus persistence behavior together where a single layer alone would give false confidence.

### Duplicate Safety
- Duplicate delivery handling must be proven at both:
  - fast route or helper dedupe paths
  - final authoritative grant or mutation path
- The phase must distinguish “duplicate but safe” from “verification failed” and from “retryable temporary failure.”

### Billable Generation Scope
- Include idempotent paid-generation behavior in this phase because duplicate charging or duplicate paid artifact exposure is part of billing correctness, not just resume-generation UX.
- Keep file ownership proof in Phase 16; use this phase only to prove billing-linked generation invariants and paid artifact safety.

### Server-Only Provider Boundary
- Reconfirm that billing-provider clients and mutation helpers remain server-only and do not spread implicit env access into shared code.
- Prefer documentation tied to concrete modules instead of broad security claims.

### Brownfield Constraint
- Preserve the current checkout and settlement architecture unless a narrow invariant fix is needed.
- Favor committed invariant docs and focused regression coverage over broad refactors.
</decisions>

<canonical_refs>
## Canonical References

- `src/app/api/checkout/route.ts`
- `src/app/api/checkout/route.test.ts`
- `src/app/api/webhook/asaas/route.ts`
- `src/app/api/webhook/asaas/route.test.ts`
- `src/lib/asaas/event-handlers.ts`
- `src/lib/asaas/event-handlers.test.ts`
- `src/lib/asaas/credit-grants.ts`
- `src/lib/asaas/credit-grants.test.ts`
- `src/lib/asaas/idempotency.ts`
- `src/lib/asaas/idempotency.test.ts`
- `src/lib/asaas/billing-checkouts.ts`
- `src/lib/asaas/billing-checkouts.test.ts`
- `src/lib/asaas/client.ts`
- `src/lib/asaas/client.test.ts`
- `src/lib/resume-generation/generate-billable-resume.ts`
- `src/lib/resume-generation/generate-billable-resume.test.ts`
- `src/app/api/session/[id]/generate/route.ts`
- `src/app/api/session/[id]/generate/route.test.ts`
- `src/app/api/file/[sessionId]/route.ts`
- `docs/billing/IMPLEMENTATION.md`
- `docs/billing/OPS_RUNBOOK.md`
- `docs/operations/security-boundary-audit.md`
- `prisma/migrations/billing_webhook_hardening.sql`
- `prisma/migrations/20260406_align_asaas_webhook_contract.sql`
- `prisma/migrations/20260412_resume_generation_billing.sql`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `AGENTS.md`
</canonical_refs>

<specifics>
## Specific Ideas

- add an invariant matrix doc or section to billing docs rather than scattering new claims
- verify `checkoutSession` fallback and v1 `externalReference` trust anchors side by side
- prove resume-generation idempotency still yields `creditsUsed: 0` on replay and does not create duplicate billable work
- include one explicit operator-facing artifact showing which logs, tables, and tests back each billing invariant
</specifics>

---

*Phase: CURRIA-17-billing-invariants-and-webhook-safety-hardening*
*Context gathered: 2026-04-14 from current billing, webhook, and billable-generation seams*
