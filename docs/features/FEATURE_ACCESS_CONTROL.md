---
title: Feature Access Control (Plan-Based Gating)
audience: [developers, architects, product-managers]
related: [../FEATURES.md, ../billing/IMPLEMENTATION.md, ../architecture-overview.md]
status: current
updated: 2026-04-02
---

# Feature Access Control (Plan-Based Gating)

This document describes how CurrIA gates advanced features behind plan tiers (free, starter, pro, etc.) using a dual-layer verification model.

## Overview

Features requiring paid plans are protected at two critical layers:

1. **Frontend Gate** - Prevents UI rendering and interactions for unauthorized users
2. **Backend Gate** - Server actions and API endpoints reject unauthorized mutations regardless of frontend state

This dual-layer approach prevents:
- Users bypassing UI restrictions via browser DevTools
- Accidental permission leaks from frontend assumptions
- State inconsistency between client and server

## Core Principle

> A feature is only truly gated if **both** the UI and the server enforce the permission check.

---

## Implementation Pattern

### Frontend Gate (UI Layer)

**Where:** Page or layout component that owns the feature section

**Pattern:**
```typescript
// src/app/(auth)/resumes/page.tsx

export default async function ResumesPage() {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return <Unauthorized />
  }

  // Gate the entire feature
  const userHasJobApplicationAccess = await checkUserFeatureAccess(
    appUser.id,
    'job_applications'
  )

  if (!userHasJobApplicationAccess) {
    return (
      <Dashboard>
        <JobApplicationsUnavailable planTier={userPlan} />
      </Dashboard>
    )
  }

  // User has access: render full feature
  const applicationsResult = await getJobApplicationsForUser(appUser.id)
  return <Dashboard><JobApplicationsTracker data={applicationsResult} /></Dashboard>
}
```

**Benefits:**
- ✅ No wasted database calls for unauthorized users
- ✅ Clean error UX
- ✅ Reduces server load from permission checks
- ✅ Clear intent in page structure

### Backend Gate (Server Action Layer)

**Where:** Every server action that mutates data

**Pattern:**
```typescript
// src/app/(auth)/resumes/actions.ts

export async function createJobApplicationAction(data: JobApplicationInput) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    throw new Error('Unauthorized')
  }

  // Gate the action: reject if user doesn't have access
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'job_applications')
  if (!hasAccess) {
    throw new Error(
      'Job applications are only available on paid plans. Upgrade to get started.'
    )
  }

  // User is authorized: proceed with mutation
  const result = await db.jobApplication.create({
    data: {
      ...data,
      userId: appUser.id,
    },
  })

  return result
}

export async function updateJobApplicationStatusAction(
  applicationId: string,
  status: JobApplicationStatus
) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    throw new Error('Unauthorized')
  }

  // Gate the action
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'job_applications')
  if (!hasAccess) {
    throw new Error('Feature not available on your plan')
  }

  // Verify ownership
  const application = await db.jobApplication.findUnique({
    where: { id: applicationId },
  })

  if (application?.userId !== appUser.id) {
    throw new Error('Forbidden')
  }

  // Authorize and mutate
  const updated = await db.jobApplication.update({
    where: { id: applicationId },
    data: { status },
  })

  return updated
}
```

**Benefits:**
- ✅ Prevents unauthorized mutations even if UI is bypassed
- ✅ Single source of truth for permission logic
- ✅ Consistent error messages across all mutations
- ✅ Clear audit trail

### Database Read Layer (Graceful Degradation)

**Where:** Query helpers that may encounter missing tables or unavailable schemas

**Pattern:**
```typescript
// src/lib/db/job-applications.ts

export async function getJobApplicationsForUser(
  appUserId: string
): Promise<JobApplication[]> {
  try {
    return await db.jobApplication.findMany({
      where: { userId: appUserId },
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    // Handle missing table (schema cache out of sync)
    if (isMissingJobApplicationsTableError(error)) {
      logWarn('db.missing_table', {
        table: 'job_applications',
        appUserId,
        error: error.message,
      })
      return []  // Return empty instead of failing
    }

    // Unexpected error: propagate
    throw error
  }
}

function isMissingJobApplicationsTableError(error: unknown): boolean {
  const msg = String(error).toLowerCase()
  return (
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('not found')
  )
}
```

**Benefits:**
- ✅ Graceful handling of schema sync delays
- ✅ Observability: logged for debugging
- ✅ Doesn't cascade failures to UI
- ✅ Gives time for schema cache to update

---

## Feature Access Definition

### Current Features

```typescript
// src/lib/billing/feature-access.ts

export type FeatureName = 'job_applications' | 'interview_prep' | 'networking'

export const FEATURE_TIERS: Record<FeatureName, PlanTier[]> = {
  job_applications: ['starter', 'pro'],     // Free: NO
  interview_prep: ['pro'],                  // Starter/Free: NO
  networking: ['pro'],                      // Free/Starter: NO
}

export async function checkUserFeatureAccess(
  appUserId: string,
  feature: FeatureName
): Promise<boolean> {
  const userQuota = await getUserQuota(appUserId)
  if (!userQuota) {
    return false  // No quota = free user
  }

  const tier = userQuota.planTier
  const allowedTiers = FEATURE_TIERS[feature]
  return allowedTiers.includes(tier)
}
```

### Adding a New Gated Feature

```typescript
// Step 1: Define in FEATURE_TIERS
export const FEATURE_TIERS = {
  job_applications: ['starter', 'pro'],
  interview_prep: ['pro'],
  networking: ['pro'],
  my_new_feature: ['pro'],  // ← Add here
}

// Step 2: Gate in page component
const hasNewFeatureAccess = await checkUserFeatureAccess(
  appUser.id,
  'my_new_feature'
)
if (!hasNewFeatureAccess) {
  return <FeatureUnavailable />
}

// Step 3: Gate in server actions
export async function doNewFeatureAction(data: any) {
  const appUser = await getCurrentAppUser()
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'my_new_feature')
  if (!hasAccess) {
    throw new Error('Feature not available on your plan')
  }
  // ... proceed
}

// Step 4: Test both layers
describe('my new feature', () => {
  it('renders for pro users', async () => { /* ... */ })
  it('shows unavailable overlay for free users', async () => { /* ... */ })
  it('rejects mutations from free users', async () => { /* ... */ })
})
```

---

## Error Handling

### Frontend Error Messages

**Unavailable Feature:**
```
Candidaturas de Vagas
Esta funcionalidade está disponível em planos pagos.
[Upgrade Now] [Voltar]
```

**Failed to Load Data:**
```
Não conseguimos carregar suas candidaturas neste momento.
Por favor, tente novamente mais tarde.
```

### Backend Error Messages

**Unauthorized Access:**
```
"Job applications are only available on paid plans. Upgrade to get started."
```

**Forbidden (Ownership Check):**
```
"You don't have access to this application."
```

**Unexpected Error:**
```
"Failed to process your request. Please try again."
```

### Logging & Observability

Every access check is logged:

```typescript
logInfo('feature.access_check', {
  featureName: 'job_applications',
  appUserId: 'user_123',
  hasAccess: true,
  planTier: 'pro',
  timestamp: new Date().toISOString(),
})

logWarn('feature.access_denied', {
  featureName: 'interview_prep',
  appUserId: 'user_456',
  planTier: 'free',
  reason: 'feature_not_in_tier',
})
```

Use these logs in production monitoring:
- Alert if deny rate spikes (possible abuse)
- Track adoption of paid features
- Debug permission leaks

---

## Testing Strategy

### Unit Tests

Test the `checkUserFeatureAccess()` function:

```typescript
describe('checkUserFeatureAccess', () => {
  it('returns true for users with feature in their plan', async () => {
    const result = await checkUserFeatureAccess('pro_user_id', 'job_applications')
    expect(result).toBe(true)
  })

  it('returns false for free users', async () => {
    const result = await checkUserFeatureAccess('free_user_id', 'job_applications')
    expect(result).toBe(false)
  })

  it('returns false if user quota missing', async () => {
    const result = await checkUserFeatureAccess('unknown_user', 'job_applications')
    expect(result).toBe(false)
  })
})
```

### Integration Tests (Frontend)

Test the page gate:

```typescript
describe('ResumesPage', () => {
  it('renders JobApplicationsTracker for paid users', async () => {
    // Mock checkUserFeatureAccess to return true
    const { render } = await renderPage({ userTier: 'pro' })
    expect(screen.getByText('Candidaturas de Vagas')).toBeInTheDocument()
  })

  it('shows FeatureUnavailable overlay for free users', async () => {
    const { render } = await renderPage({ userTier: 'free' })
    expect(screen.getByText('Esta funcionalidade está disponível em planos pagos')).toBeInTheDocument()
  })
})
```

### Integration Tests (Backend)

Test the server action gate:

```typescript
describe('createJobApplicationAction', () => {
  it('creates application for pro users', async () => {
    const result = await createJobApplicationAction(validData, { userId: 'pro_user' })
    expect(result.id).toBeDefined()
  })

  it('throws error for free users', async () => {
    const promise = createJobApplicationAction(validData, { userId: 'free_user' })
    await expect(promise).rejects.toThrow('only available on paid plans')
  })

  it('rejects if ownership check fails', async () => {
    // User tries to update someone else's application
    const promise = updateJobApplicationStatusAction('app_id_from_other_user', 'archived')
    await expect(promise).rejects.toThrow('Forbidden')
  })
})
```

---

## Debugging Permission Issues

### Checklist

If a user can't access a feature:

- [ ] Check `user_quotas.plan_tier` in database (is it correct?)
- [ ] Verify `FEATURE_TIERS` includes the plan tier
- [ ] Check page renders `checkUserFeatureAccess()` before rendering component
- [ ] Check server action validates permission at the start
- [ ] Test with bypass: temporarily set user plan to 'pro' and retry
- [ ] Check logs for `feature.access_denied` events
- [ ] Verify Clerk user is mapped to internal app user correctly

### Example Debug Query

```sql
-- Verify user quota and feature access
SELECT 
  u.id as app_user_id,
  u.clerk_id,
  uq.plan_tier,
  uq.credits_remaining,
  uq.created_at,
  uq.updated_at
FROM users u
LEFT JOIN user_quotas uq ON uq.app_user_id = u.id
WHERE u.clerk_id = 'user_xyz@example.com'
ORDER BY uq.updated_at DESC;
```

---

## Migration Path: Adding Features to Existing Users

When rolling out a gated feature to existing paid users:

```typescript
// Step 1: Deploy code with gating in place
// Step 2: Monitor access_check logs
// Step 3: Verify users hitting the new feature render correctly
// Step 4: A/B test with subset of users (optional)
// Step 5: Full rollout

// If you need to grant access retroactively:
UPDATE user_quotas
SET plan_tier = 'pro'
WHERE app_user_id IN (...)
AND created_at < '2026-03-01'  // Early adopters
RETURNING app_user_id, plan_tier;
```

---

## Related

- [FEATURES.md](../FEATURES.md) - Feature overview and capabilities
- [billing/IMPLEMENTATION.md](../billing/IMPLEMENTATION.md) - How plans and credits work
- [ERROR_HANDLING.md](../developer-rules/ERROR_HANDLING.md) - Error codes and patterns
- [TESTING.md](../developer-rules/TESTING.md) - Testing strategy and patterns

## Files to Reference

**Core Implementation:**
- `src/lib/billing/feature-access.ts` - Feature tier definitions and checks
- `src/app/(auth)/resumes/page.tsx` - Frontend gate example
- `src/app/(auth)/resumes/actions.ts` - Server action gate example
- `src/lib/db/job-applications.ts` - Database read layer with graceful degradation

**Tests:**
- `src/app/(auth)/resumes/page.test.tsx`
- `src/app/(auth)/resumes/actions.test.ts`
- `src/lib/db/job-applications.test.ts`
