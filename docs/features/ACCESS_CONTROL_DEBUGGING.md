---
title: Feature Access Control Debugging Guide
audience: [developers, support]
related: [FEATURE_ACCESS_CONTROL.md, IMPLEMENTING_GATED_FEATURES.md]
status: current
updated: 2026-04-02
---

# Feature Access Control Debugging Guide

Systematic approach to diagnosing why a user can or cannot access a gated feature.

---

## Quick Diagnosis Flowchart

```
User reports: "I can't access [feature]"
           ↓
    ┌─────────────────────────────────────────┐
    │ 1. Check user's plan tier in database    │
    │    SELECT plan_tier FROM user_quotas     │
    │    WHERE app_user_id = 'user_xyz'        │
    └─────────────────────────────────────────┘
           ↓
    Is plan_tier in FEATURE_TIERS[feature]?
    ├─ NO → User doesn't have correct plan ✓ (expected)
    └─ YES → Continue...
           ↓
    ┌─────────────────────────────────────────┐
    │ 2. Check FEATURE_TIERS definition       │
    │    Does 'feature' include this tier?     │
    └─────────────────────────────────────────┘
           ↓
    Is feature defined in FEATURE_TIERS?
    ├─ NO → Feature not implemented yet
    └─ YES → Continue...
           ↓
    ┌─────────────────────────────────────────┐
    │ 3. Check page gate implementation        │
    │    Does page call checkUserFeatureAccess?│
    └─────────────────────────────────────────┘
           ↓
    Does page gate correctly?
    ├─ NO → Frontend gate not implemented
    └─ YES → Continue...
           ↓
    ┌─────────────────────────────────────────┐
    │ 4. Check server action implementation    │
    │    Do server actions validate access?    │
    └─────────────────────────────────────────┘
           ↓
    Does server action gate correctly?
    ├─ NO → Backend gate not implemented
    └─ YES → Trace logs for other issues
```

---

## Diagnosis Steps (Detailed)

### Step 1: Verify User and Plan in Database

**Check if user exists and what plan they're on:**

```sql
-- Find user by Clerk ID
SELECT 
  u.id as app_user_id,
  u.clerk_id,
  u.created_at,
  uq.plan_tier,
  uq.credits_remaining,
  uq.asaas_customer_id,
  uq.updated_at
FROM users u
LEFT JOIN user_quotas uq ON uq.app_user_id = u.id
WHERE u.clerk_id = 'user_example@example.com'
ORDER BY uq.updated_at DESC
LIMIT 1;
```

**Expected Results:**
- User should exist in `users` table
- `user_quotas.plan_tier` should be one of: `'free'`, `'starter'`, `'pro'`
- `updated_at` should be recent (today or within last 7 days)

**What to look for:**
- ❌ No user found → User not bootstrapped yet (run `get_or_create_app_user`)
- ❌ `plan_tier` is NULL → Quota not initialized after signup
- ❌ `plan_tier` is outdated → Recent plan change not synced

---

### Step 2: Verify Feature Definition

**Check `FEATURE_TIERS` in code:**

```typescript
// src/lib/billing/feature-access.ts
import { FEATURE_TIERS } from '@/lib/billing/feature-access'

console.log(FEATURE_TIERS)
// Output:
// {
//   job_applications: ['starter', 'pro'],
//   interview_prep: ['pro'],
//   networking: ['pro'],
// }
```

**Checklist:**
- ✅ Feature name matches exactly (case-sensitive)
- ✅ User's plan tier is in the allowed list
- ✅ No typos in tier names

**Example Issues:**
```typescript
// ❌ WRONG: Feature not defined
FEATURE_TIERS = {
  job_applications: ['starter', 'pro']
  // interview_prep missing
}

// ❌ WRONG: Tier name mismatch
FEATURE_TIERS = {
  interview_prep: ['Pro']  // Capitalized, should be 'pro'
}

// ❌ WRONG: User's plan not in list
FEATURE_TIERS = {
  interview_prep: ['pro']
}
// But user has plan_tier = 'starter'
```

---

### Step 3: Check Frontend Gate (Page Component)

**Trace the page component:**

```typescript
// src/app/(auth)/interview/page.tsx

export default async function InterviewPrepPage() {
  const appUser = await getCurrentAppUser()
  
  // Step 3a: Verify getCurrentAppUser() returns user
  console.log('[page] appUser:', appUser)
  if (!appUser) {
    return <Unauthorized />  // Are we hitting this?
  }
  
  // Step 3b: Call checkUserFeatureAccess
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  console.log('[page] hasAccess:', hasAccess)
  
  // Step 3c: Check if gate is working
  if (!hasAccess) {
    return <FeatureUnavailable />  // Are we hitting this instead?
  }
  
  // Step 3d: Only load data if authorized
  const data = await loadExpensiveData(appUser.id)
  return <FeatureContent data={data} />
}
```

**How to test:**
1. Add `console.log` statements
2. Check browser console in DevTools
3. Check server logs (deployment logs)
4. Verify the flow reaches expected branches

**Common Issues:**
- ❌ `getCurrentAppUser()` returns null → Check Clerk auth session
- ❌ `checkUserFeatureAccess()` not called → Code has bug in gate logic
- ❌ `hasAccess` is true but user sees unavailable → Component rendering wrong state

---

### Step 4: Check Server Action Gate

**Verify server action has permission check:**

```typescript
// src/app/(auth)/interview/actions.ts

export async function saveInterviewResponse(questionId: string, response: string) {
  // Step 4a: Auth check
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    throw new Error('Unauthorized')
  }
  console.log('[action] appUser:', appUser.id)
  
  // Step 4b: Feature gate (REQUIRED)
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  console.log('[action] hasAccess:', hasAccess)
  
  if (!hasAccess) {
    throw new Error('Feature not available on your plan')  // ← This error message appears to user
  }
  
  // Step 4c: Ownership check (if applicable)
  const question = await db.interviewQuestion.findUnique({
    where: { id: questionId },
  })
  if (question?.ownedBy !== appUser.id) {
    throw new Error('Forbidden')  // ← Not your question
  }
  
  // Step 4d: Safe to mutate
  const saved = await db.interviewResponse.create({
    data: { questionId, response },
  })
  return saved
}
```

**How to test:**
1. Call the action from browser DevTools: `window.__ACTIONS['saveInterviewResponse'](...)`
2. Catch the error: `catch(e => console.error(e.message))`
3. Expected error message: "Feature not available on your plan" (not some generic DB error)

**Common Issues:**
- ❌ No feature gate in action → User can mutate data even without access
- ❌ Gate comes after DB call → Wasted queries, slower experience
- ❌ Wrong error message → User doesn't understand why action failed

---

### Step 5: Check Logs

**Look for access check events:**

```bash
# Find access check logs for a user
grep -r "feature.access_check" /var/log/app/
grep -r "interview_prep" /var/log/app/ | grep "appUserId: user_xyz"

# Expected output:
# [INFO] feature.access_check featureName=interview_prep appUserId=user_xyz hasAccess=true planTier=pro
# [WARN] feature.access_denied featureName=interview_prep appUserId=user_xyz planTier=starter reason=insufficient_tier
```

**Structured logging query (if using centralized logs):**

```sql
SELECT 
  timestamp,
  event_type,
  feature_name,
  app_user_id,
  has_access,
  plan_tier,
  reason
FROM logs
WHERE app_user_id = 'user_xyz'
  AND feature_name = 'interview_prep'
ORDER BY timestamp DESC
LIMIT 20;
```

**What to look for:**
- Timestamp when user attempted access
- `has_access: false` → Check plan_tier
- `has_access: true` → Gate passed, check component rendering
- Error messages → Exact reason for denial

---

## Real-World Debugging Scenarios

### Scenario 1: User Says "I Upgraded But Still Can't Access"

**Likely Cause:** Plan sync delay

**Diagnosis Steps:**
```bash
# 1. Check if Asaas webhook was received
SELECT event_id, event_type, status, created_at 
FROM processed_events 
WHERE event_type = 'SUBSCRIPTION_CREATED' 
  AND external_reference LIKE '%user_xyz%'
ORDER BY created_at DESC 
LIMIT 5;

# 2. Check if user_quotas was updated
SELECT plan_tier, updated_at 
FROM user_quotas 
WHERE app_user_id = 'user_xyz'
ORDER BY updated_at DESC 
LIMIT 1;

# 3. If updated_at is OLD, webhook hasn't been processed
# Run webhook handler manually:
# POST /api/webhook/asaas with the event payload
```

**Solution:**
- Re-trigger the Asaas webhook manually
- Or update `plan_tier` directly in test/staging:
  ```sql
  UPDATE user_quotas 
  SET plan_tier = 'pro', updated_at = NOW() 
  WHERE app_user_id = 'user_xyz';
  ```

---

### Scenario 2: User Can Bypass Gate via Server Action

**Likely Cause:** Server action doesn't validate permission

**Diagnosis Steps:**
```bash
# 1. Check the server action code
grep -A 20 "export async function saveData" src/app/(auth)/feature/actions.ts

# 2. Look for checkUserFeatureAccess call
grep "checkUserFeatureAccess" src/app/(auth)/feature/actions.ts

# 3. If missing, it's the bug
```

**Solution:**
```typescript
// Add gate to action
export async function saveData(data: any) {
  const appUser = await getCurrentAppUser()
  
  // ADD THIS:
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'my_feature')
  if (!hasAccess) {
    throw new Error('Feature not available on your plan')
  }
  
  // Safe to continue
  await db.save(data)
}
```

---

### Scenario 3: Feature Works for Some Users, Not Others

**Likely Cause:** Plan tier mismatch

**Diagnosis Steps:**
```bash
# 1. Gather user list who have access
SELECT DISTINCT plan_tier 
FROM user_quotas 
WHERE app_user_id IN ('user_a', 'user_b', 'user_c');

# 2. Check FEATURE_TIERS definition
# See: src/lib/billing/feature-access.ts

# 3. Compare:
# If users with 'starter' tier can't access 'feature_x',
# check if 'starter' is in FEATURE_TIERS['feature_x']
```

**Solution:**
- Update `FEATURE_TIERS` if the configuration is wrong
- Or manually update plan_tier for affected users:
  ```sql
  UPDATE user_quotas 
  SET plan_tier = 'pro' 
  WHERE app_user_id IN ('user_a', 'user_b');
  ```

---

### Scenario 4: Feature Unavailable Card Shows But Page Still Loads Data

**Likely Cause:** Gate check happens AFTER data load

**Diagnosis Steps:**
```typescript
// BAD: Loads data first, checks permission after
export default async function Page() {
  const data = await loadExpensiveData()  // ← Happens before check
  const hasAccess = await checkUserFeatureAccess(...)
  
  if (!hasAccess) return <Unavailable />
  
  return <Feature data={data} />  // Data already loaded!
}

// GOOD: Checks permission first
export default async function Page() {
  const hasAccess = await checkUserFeatureAccess(...)  // ← Check first
  
  if (!hasAccess) return <Unavailable />  // No data loaded
  
  const data = await loadExpensiveData()  // ← Only load if authorized
  return <Feature data={data} />
}
```

**Solution:**
Reorder the code:
```typescript
// src/app/(auth)/interview/page.tsx
export default async function InterviewPrepPage() {
  const appUser = await getCurrentAppUser()
  
  // MOVE THIS UP
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) {
    return <FeatureUnavailable />  // Stop here, don't load data
  }
  
  // NOW safe to load expensive data
  const questions = await loadInterviewQuestions(appUser.id)
  return <InterviewPrepSection questions={questions} />
}
```

---

## Testing Permissions Locally

### Test as Free User

```typescript
// src/lib/billing/feature-access.test.ts

it('free user cannot access pro features', async () => {
  // Create or select a test user with plan_tier = 'free'
  const freeUser = await db.user.findUnique({
    where: { id: 'test_free_user_id' },
  })
  
  const hasAccess = await checkUserFeatureAccess(
    freeUser.id,
    'interview_prep'  // Pro feature
  )
  
  expect(hasAccess).toBe(false)
})
```

### Test Page Gate

```typescript
// src/app/(auth)/interview/page.test.tsx

it('shows unavailable for free users', async () => {
  // Mock checkUserFeatureAccess to return false
  vi.mock('@/lib/billing/feature-access', () => ({
    checkUserFeatureAccess: vi.fn().mockResolvedValue(false),
  }))

  render(await InterviewPrepPage())

  expect(screen.getByText(/available on.*Pro/)).toBeInTheDocument()
})
```

### Test Server Action Gate

```typescript
// src/app/(auth)/interview/actions.test.ts

it('rejects action for free users', async () => {
  const freeUserId = 'test_free_user_id'
  
  const promise = saveInterviewResponse(freeUserId, 'question_1', 'My answer')
  
  await expect(promise).rejects.toThrow('available on Pro plans')
})
```

---

## Monitoring & Alerts

### What to Monitor

```typescript
// 1. Denial rate by feature
// Alert if interview_prep denials spike unexpectedly
SELECT 
  feature_name,
  COUNT(*) as denial_count,
  COUNT(DISTINCT app_user_id) as unique_users
FROM logs
WHERE event_type = 'feature.access_denied'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY feature_name
HAVING COUNT(*) > 100;  -- Alert threshold

// 2. Successful access rate
// Verify gating is working (some denials expected)
SELECT 
  feature_name,
  SUM(CASE WHEN has_access THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN NOT has_access THEN 1 ELSE 0 END) as denials,
  ROUND(100.0 * SUM(CASE WHEN has_access THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM logs
WHERE event_type = 'feature.access_check'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY feature_name;

// 3. Server action errors
// Catch permission-related errors
SELECT 
  action_name,
  error_message,
  COUNT(*) as error_count
FROM logs
WHERE event_type = 'action.error'
  AND error_message LIKE '%not available on your plan%'
GROUP BY action_name, error_message
ORDER BY error_count DESC;
```

### Dashboard Queries

**Status: Are gates working?**
```
[✓] interview_prep: 2,450 checks, 1,850 allowed (75%), 600 denied (25%)
[✓] networking: 890 checks, 445 allowed (50%), 445 denied (50%)
[✓] job_applications: 5,200 checks, 3,900 allowed (75%), 1,300 denied (25%)
```

**Alerts: Anything broken?**
```
[!] interview_prep denials spiked from 2% to 45% in last hour
[!] networking server action failing with permission errors
```

---

## Quick Reference: Common Fixes

| Problem | Fix | Location |
|---|---|---|
| Feature not defined | Add to `FEATURE_TIERS` | `src/lib/billing/feature-access.ts` |
| Page still loads data for denied users | Move gate check before data load | `src/app/(auth)/*/page.tsx` |
| Server action has no gate | Add `checkUserFeatureAccess` at start | `src/app/(auth)/*/actions.ts` |
| Wrong error message | Update error text to be user-facing | Server action throw statement |
| Gate not working after code change | Restart dev server / redeploy | Depends on environment |
| User can bypass via direct API call | Add gate to route handler too | `src/app/api/*/route.ts` |

---

## Getting Help

If you're still stuck:

1. **Check logs first:** Search for `feature.access` events and error messages
2. **Verify database state:** Run the SQL queries above
3. **Trace the code:** Add console.log statements in both frontend and backend
4. **Check feature definition:** Confirm feature is in `FEATURE_TIERS`
5. **Look for test failures:** Run the test suite to see what's broken
6. **Ask for context:** Include plan tier, app user ID, and feature name in questions
