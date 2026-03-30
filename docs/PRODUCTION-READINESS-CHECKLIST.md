# Production Readiness Checklist - Asaas Billing System

**Status:** Code Complete & Documented | Awaiting Staging Validation

**Last Updated:** 2026-03-29

---

## Executive Summary

The Asaas billing system is **code-complete, tested, and fully documented**. All that remains is:

1. ✅ **Code:** Implementation complete, 41 tests passing
2. ✅ **Tests:** Comprehensive coverage (unit + integration)
3. ✅ **Documentation:** Ops runbooks, monitoring setup, staging validation plan created
4. ⏳ **Staging Validation:** Blocked - requires staging environment setup
5. ⏳ **Production Deployment:** Ready to proceed after staging validation passes

---

## Code Status: COMPLETE ✅

### Tests
- ✅ 41 tests passing (billing suite)
- ✅ RPC rejection scenarios tested (overflow, negative balance, invalid anchors)
- ✅ Partial-success exception handling tested
- ✅ Webhook retry cycles tested
- ✅ Duplicate webhook deduplication tested
- ✅ Pre-cutover recurring path tested

**Verification:**
```bash
npm test -- src/lib/asaas
# Result: 41 tests pass
```

### Code Quality
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes
- ✅ No security vulnerabilities in review
- ✅ Error handling hardened with structured codes
- ✅ Logging includes anomaly detection (pre_cutover_missing_metadata, etc.)

### Implementation Coverage
| Component | Status | Files |
|-----------|--------|-------|
| externalReference versioning | ✅ | `src/lib/asaas/external-reference.ts` |
| Checkout lifecycle | ✅ | `src/lib/asaas/billing-checkouts.ts` |
| Event routing | ✅ | `src/lib/asaas/event-handlers.ts` |
| RPC validation | ✅ | `prisma/migrations/billing_webhook_hardening.sql` |
| Idempotency | ✅ | `src/lib/asaas/idempotency.ts` |
| Webhook route | ✅ | `src/app/api/webhook/asaas/route.ts` |
| Checkout flow | ✅ | `src/app/api/checkout/route.ts` |

---

## Documentation Status: COMPLETE ✅

### Operational Documentation
- ✅ **`docs/staging-validation-plan.md`** (615 lines)
  - 7 concrete validation scenarios
  - Before/after DB state for each step
  - Failure branches and expected errors
  - Pre-production sign-off checklist

- ✅ **`docs/billing-ops-runbook.md`** (639 lines)
  - 6 common issue diagnosis procedures
  - Manual recovery workflows (refunds, reprocessing)
  - Pre-cutover subscription handling
  - Escalation procedures

- ✅ **`docs/billing-monitoring.md`** (356 lines)
  - 5 essential metrics with thresholds
  - SQL queries for each metric
  - Alert severity and response procedures
  - Pre-cutover legacy parsing sunset guide

### Implementation Documentation
- ✅ **`docs/billing-implementation.md`**
  - Architecture overview
  - Control matrix (what enforces each rule)
  - Trust anchor separation explained
  - Pre-cutover migration strategy

- ✅ **`docs/billing-migration-guide.md`**
  - Apply migration steps
  - Schema verification queries
  - Pre-cutover audit procedures
  - Monitoring setup

- ✅ **`CLAUDE.md`**
  - Updated with billing architecture section
  - Link to all billing documentation

### Staging Setup Documentation
- ✅ **`docs/staging-setup-guide.md`** (NEW)
  - Step-by-step staging provisioning
  - Database setup (Supabase, self-hosted, Docker)
  - Code deployment to staging
  - Migration application
  - Credential configuration
  - Verification procedures
  - Troubleshooting guide

- ✅ **`.env.staging.example`** (NEW)
  - Template for staging credentials
  - Clearly marked placeholders
  - Comments for each section
  - Usage instructions

- ✅ **`scripts/verify-staging.sh`** (NEW)
  - Automated verification script
  - Checks all 6 preconditions
  - Clear error messages with remediation steps
  - Green/red indicator for each check

### Agent Prompts
- ✅ **`docs/staging-validation-agent-prompt.md`**
  - Ready-to-execute agent instructions
  - Hardened against plan/schema drift
  - Handles partial-success scenarios
  - Structured go/no-go reporting

---

## What's Blocking Production Deployment

**CRITICAL BLOCKER RESOLVED:** Webhook system validated in production ✅

The validation agent tested against live production environment and found:
- ✅ Code is production-ready (254 tests passing, all linting passed)
- ✅ Webhook endpoint fully functional and hardened
- ✅ Authentication working (invalid token → 401)
- ✅ Validation strict (malformed payloads → 400 with specific errors)
- ✅ Idempotency working (duplicate webhooks handled safely)
- ❌ Checkout endpoint not deployed (404 error) - NEW BLOCKER

**New Finding:** Checkout endpoint (`/api/checkout`) exists in code but is not deployed to production.

**Impact:**
- Webhook system can receive events from Asaas immediately
- Cannot test full E2E (checkout → webhook → credit grant) until checkout endpoint deployed
- All webhook auth, validation, and security checks verified working

---

## Steps to Unblock: Deploy Checkout Endpoint

### Required Actions (in order)

#### 1. Deploy Checkout Endpoint (Est. 15 min) - CRITICAL
- Verify `src/app/api/checkout/route.ts` is included in Vercel build
- Check Vercel deployment logs
- Test endpoint returns 401 (unauthorized), not 404 (not found)
- Command: `curl https://www.curria.com.br/api/checkout -X POST -H "Content-Type: application/json" -d '{"plan":"unit"}'`

**Status:** Route implementation is complete and tested locally. Deployment appears incomplete.

#### 2. Verify Webhook Endpoint (Already Done ✓)
- ✅ Webhook endpoint tested and working
- ✅ Authentication validated
- ✅ Validation strict and comprehensive
- ✅ Idempotency verified

**See:** `docs/BILLING_VALIDATION_RESULTS.md` for complete test results

#### 3. Run Full E2E Scenarios (Est. 30 min) - After checkout deployed
Once checkout endpoint is deployed:
- Create test user with initial credits
- Create checkout via API
- Simulate PAYMENT_RECEIVED webhook
- Verify credit_accounts updated
- Verify billing_checkouts status changed

**See:** `docs/BILLING_VALIDATION_RESULTS.md` → "Next Steps: Run Full E2E Scenario"

#### 4. Test Subscription Path (Est. 20 min) - After checkout deployed
- Create subscription checkout
- Simulate SUBSCRIPTION_CREATED webhook
- Simulate SUBSCRIPTION_RENEWED webhook
- Verify user_quotas updated with subscription metadata

#### 5. Review Results & Proceed (Est. 10 min)
- If all tests PASS: Ready for production
- If any test FAIL: Fix and re-validate

---

## Timeline Estimate

| Task | Effort | Duration | Status |
|------|--------|----------|--------|
| Deploy checkout endpoint | Low | 5-15 min | BLOCKING |
| Verify deployment | Low | 5 min | Pending |
| Run E2E scenarios | Medium | 30 min | Pending (checkout) |
| Test subscription path | Medium | 20 min | Pending (checkout) |
| Review & sign off | Low | 10 min | Pending |
| **TOTAL** | | **70-90 min** | On track |

---

## Artifact Summary

**Complete deliverable for production deployment:**

```
docs/
├── staging-setup-guide.md              ← How to set up staging
├── staging-validation-plan.md          ← What to validate (7 scenarios)
├── staging-validation-agent-prompt.md  ← Ready-to-execute agent prompt
├── billing-ops-runbook.md              ← Ops procedures after launch
├── billing-monitoring.md               ← Monitoring & alerts setup
├── billing-implementation.md           ← Architecture reference
├── billing-migration-guide.md          ← Migration steps (already applied)
└── PRODUCTION-READINESS-CHECKLIST.md   ← This file

scripts/
└── verify-staging.sh                   ← Verification script (automated)

.env.staging.example                     ← Staging credentials template

CLAUDE.md                               ← Updated with billing section
```

---

## Go/No-Go Criteria for Production

### PROCEED if:
- ✅ All 7 staging validation scenarios PASS
- ✅ No critical blockers identified
- ✅ DB state matches expected values
- ✅ Duplicate protection works (fingerprint + RPC)
- ✅ Error handling is correct (4xx/5xx as expected)
- ✅ Ops team confirms monitoring is set up
- ✅ Ops team confirms runbook is understood

### STOP if:
- ❌ Any scenario FAILS (unless non-blocking)
- ❌ Duplicate webhook grants credits twice
- ❌ Overflow is not enforced
- ❌ Cancellation revokes credits
- ❌ Renewal depends on checkout lookup
- ❌ RPC errors not propagated correctly
- ❌ Staging environment becomes unstable

---

## Production Deployment Checklist (After Staging PASS)

Once staging validation is complete and PROCEED is recommended:

### Pre-Deployment
- [ ] Code review approved
- [ ] All tests passing
- [ ] Staging validation passed
- [ ] Ops team trained on runbook
- [ ] Monitoring alerts configured
- [ ] Escalation procedures documented
- [ ] Rollback plan documented

### Deployment
- [ ] Create production backup
- [ ] Deploy code to production
- [ ] Run migration: `billing_webhook_hardening.sql`
- [ ] Verify RPC functions created
- [ ] Configure production Asaas webhook token
- [ ] Test first payment end-to-end
- [ ] Monitor logs for errors (first 1 hour)

### Post-Deployment
- [ ] Monitoring dashboards live
- [ ] Alerts functioning
- [ ] Ops on-call trained
- [ ] Support team briefed
- [ ] Feature flag enabled (if applicable)
- [ ] Monitor for 24 hours
- [ ] Release notes published

---

## Key Contacts

| Role | Responsibility |
|------|-----------------|
| Engineering | Staging setup, code deployment, troubleshooting |
| Ops | Monitoring configuration, runbook validation, on-call readiness |
| DevOps/Infra | Database provisioning, DNS/firewall, environment setup |
| Product | Feature announcement, customer communication |
| Finance | Asaas account verification, pricing verification |

---

## Success Metrics (Post-Launch)

Monitor these metrics for the first week:

```
Daily Metrics:
- Webhook events processed: > 10 (if expecting volume)
- Failed checkouts: 0 or minimal
- Stale pending checkouts: 0
- RPC rejections: 0
- Pre-cutover metadata gaps: 0

Weekly Metrics:
- Duplicate protection success rate: > 99%
- Error handling correctness: 100%
- Data consistency: 100%
- Legacy path frequency: trending down
```

---

## Sign-Off

**Code Status:** ✅ COMPLETE
**Documentation Status:** ✅ COMPLETE
**Staging Status:** ⏳ AWAITING SETUP
**Ready for Production:** ⏳ PENDING STAGING VALIDATION

---

**Next Action:** Follow `docs/staging-setup-guide.md` to provision staging environment.

**Questions?** Refer to:
- **Setup:** `docs/staging-setup-guide.md`
- **Validation:** `docs/staging-validation-plan.md`
- **Operations:** `docs/billing-ops-runbook.md`
- **Monitoring:** `docs/billing-monitoring.md`
