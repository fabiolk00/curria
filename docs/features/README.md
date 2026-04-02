---
title: Features Documentation Directory
audience: [developers, architects]
related: [../FEATURES.md]
status: current
updated: 2026-04-02
---

# Features Documentation

This directory contains documentation about CurrIA's feature set and how to implement new features with proper access control.

## For Different Audiences

### I want to understand feature gating (Architects/Tech Leads)
Start here: **[FEATURE_ACCESS_CONTROL.md](./FEATURE_ACCESS_CONTROL.md)**

Covers:
- Why dual-layer gating exists (frontend + backend)
- Current implementation patterns
- Error handling and messaging
- Testing strategy
- How features map to plan tiers

### I'm adding a new gated feature (Developers)
Start here: **[IMPLEMENTING_GATED_FEATURES.md](./IMPLEMENTING_GATED_FEATURES.md)**

This is a step-by-step runbook covering:
- Phase 1: Define feature tier
- Phase 2: Frontend gate (page component)
- Phase 3: Backend gate (server actions)
- Phase 4: Testing
- Phase 5: Documentation & rollout
- Common pitfalls and how to avoid them

### My feature isn't working / User can't access (Developers/Support)
Start here: **[ACCESS_CONTROL_DEBUGGING.md](./ACCESS_CONTROL_DEBUGGING.md)**

Covers:
- Quick diagnosis flowchart
- Step-by-step database queries
- Real-world debugging scenarios
- How to test locally
- Monitoring & alerts
- Common fixes

---

## Quick Navigation

| Situation | Document | Key Sections |
|---|---|---|
| Understanding the system | FEATURE_ACCESS_CONTROL.md | Overview, Current Features, Error Handling |
| Building a new feature | IMPLEMENTING_GATED_FEATURES.md | All 5 phases + Checklist |
| Feature not working | ACCESS_CONTROL_DEBUGGING.md | Flowchart + Scenarios |
| User permission issue | ACCESS_CONTROL_DEBUGGING.md | Database checks + Logs |
| How to test | IMPLEMENTING_GATED_FEATURES.md | Phase 4: Testing |
| Adding to docs | IMPLEMENTING_GATED_FEATURES.md | Phase 5: Documentation |

---

## Key Concepts

### Dual-Layer Verification

Features requiring paid plans are protected at:

1. **Frontend Layer:** Page component checks access before rendering
2. **Backend Layer:** Server actions reject mutations if user lacks access

Both layers are **required**. Neither alone is sufficient.

### Feature Tiers

```typescript
export const FEATURE_TIERS = {
  job_applications: ['starter', 'pro'],
  interview_prep: ['pro'],
  networking: ['pro'],
}
```

Free users get: basic resume optimization, ATS scoring, file generation
Paid users unlock: job tracking, interview prep, networking tools, etc.

### Error Handling

**User-facing messages:**
```
"This feature is available on Pro plans. Upgrade to get started."
```

**Server-side validation:**
- Feature gate throws meaningful error before mutation
- Logged for observability
- No data is leaked or partially modified

---

## Current Gated Features

| Feature | Min Plan | Implemented By | Location |
|---|---|---|---|
| Job Applications | Starter | [User] | `src/app/(auth)/resumes/` |
| Interview Prep | Pro | [Not yet] | Future |
| Networking Tools | Pro | [Not yet] | Future |

---

## Implementation Checklist

When you're done implementing a gated feature:

- [ ] Feature added to `FEATURE_TIERS` in `src/lib/billing/feature-access.ts`
- [ ] Page component gates before rendering (prevents data load)
- [ ] All server actions validate permission at start
- [ ] Ownership checks included (if data is user-specific)
- [ ] Tests written and passing (4 types: tiers, frontend, backend, edge cases)
- [ ] Error messages are user-facing (not stack traces)
- [ ] Logging/observability added
- [ ] Documented in `docs/FEATURES.md`
- [ ] Changelog entry added
- [ ] Peer reviewed and approved

---

## Common Mistakes

❌ **Only gating UI:** User bypasses via DevTools → Server action must also validate
❌ **Loading data before checking:** Free users trigger expensive queries → Check access first
❌ **No ownership check:** User can access/delete other users' data → Always verify ownership
❌ **Non-user-facing errors:** Stack traces confuse users → Use meaningful, polite messages
❌ **Forgetting to test:** Catches bugs during code review instead of QA → Write 4 test types

---

## Examples from Codebase

### Job Applications (Working Example)

**Frontend Gate:**
```typescript
// src/app/(auth)/resumes/page.tsx
const hasAccess = await checkUserFeatureAccess(appUser.id, 'job_applications')
if (!hasAccess) {
  return <JobApplicationsUnavailable planTier={userPlan} />
}
```

**Backend Gate:**
```typescript
// src/app/(auth)/resumes/actions.ts
export async function createJobApplicationAction(data: any) {
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'job_applications')
  if (!hasAccess) {
    throw new Error('Job applications are only available on paid plans.')
  }
  // Safe to proceed
}
```

---

## File References

**Core Files:**
- `src/lib/billing/feature-access.ts` - Feature tier definitions
- `src/app/(auth)/resumes/page.tsx` - Frontend gate example
- `src/app/(auth)/resumes/actions.ts` - Server action gate example

**Tests:**
- `src/app/(auth)/resumes/page.test.tsx` - Frontend gate tests
- `src/app/(auth)/resumes/actions.test.ts` - Server action gate tests
- `src/lib/billing/feature-access.test.ts` - Tier definition tests

---

## Related Documentation

- [../FEATURES.md](../FEATURES.md) - Product feature overview
- [../billing/IMPLEMENTATION.md](../billing/IMPLEMENTATION.md) - How plans and credits work
- [../ERROR_HANDLING.md](../developer-rules/ERROR_HANDLING.md) - Error handling patterns
- [../TESTING.md](../developer-rules/TESTING.md) - Testing best practices
