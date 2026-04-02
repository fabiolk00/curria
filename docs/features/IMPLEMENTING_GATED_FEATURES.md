---
title: How to Implement a Gated Feature (Step-by-Step)
audience: [developers]
related: [FEATURE_ACCESS_CONTROL.md, ../FEATURES.md, ../tool-development.md]
status: current
updated: 2026-04-02
---

# How to Implement a Gated Feature (Step-by-Step)

This is a practical runbook for adding a new feature that's available only to paid users.

## Prerequisites

Before starting, have:
- Feature name and plan tier requirements defined (e.g., "interview_prep" for "pro" users)
- Database schema ready (if needed)
- UI design/mockups approved
- Test cases written

---

## Phase 1: Define Feature Tier

### Step 1.1: Add to Feature Tier Map

```typescript
// src/lib/billing/feature-access.ts

export type FeatureName = 
  | 'job_applications' 
  | 'interview_prep'      // ← NEW
  | 'networking'

export const FEATURE_TIERS: Record<FeatureName, PlanTier[]> = {
  job_applications: ['starter', 'pro'],
  interview_prep: ['pro'],      // ← NEW: Only pro users
  networking: ['pro'],
}
```

### Step 1.2: Create Helper for Your Feature (Optional)

```typescript
// src/lib/billing/feature-access.ts

export async function userHasInterviewPrepAccess(appUserId: string): Promise<boolean> {
  return checkUserFeatureAccess(appUserId, 'interview_prep')
}
```

**Why?** Makes it easier to use in multiple places and provides single point of change.

---

## Phase 2: Frontend Gate (Page/Layout)

### Step 2.1: Check Access in Page Component

```typescript
// src/app/(auth)/interview/page.tsx

import { checkUserFeatureAccess } from '@/lib/billing/feature-access'
import { getCurrentAppUser } from '@/lib/auth/app-user'

export default async function InterviewPrepPage() {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return redirect('/sign-in')
  }

  // Gate: Check access BEFORE loading data
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')

  if (!hasAccess) {
    return (
      <Dashboard>
        <FeatureUnavailableCard
          featureName="Interview Prep"
          requiredTier="Pro"
          onUpgradeClick={() => redirect('/plans')}
        />
      </Dashboard>
    )
  }

  // User has access: safe to load data
  const questions = await loadInterviewQuestions(appUser.id)

  return (
    <Dashboard>
      <InterviewPrepSection questions={questions} />
    </Dashboard>
  )
}
```

### Step 2.2: Create Unavailable Component

```typescript
// src/components/features/feature-unavailable-card.tsx

'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

type FeatureUnavailableCardProps = {
  featureName: string
  requiredTier: string
  onUpgradeClick: () => void
}

export function FeatureUnavailableCard({
  featureName,
  requiredTier,
  onUpgradeClick,
}: FeatureUnavailableCardProps) {
  return (
    <Card className="border-amber-500/20 bg-amber-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-amber-900">{featureName}</CardTitle>
        </div>
        <CardDescription className="text-amber-800">
          This feature is available on {requiredTier} plans
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={onUpgradeClick}
          className="bg-amber-600 hover:bg-amber-700"
        >
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 3: Backend Gate (Server Actions)

### Step 3.1: Create Server Actions with Gate

```typescript
// src/app/(auth)/interview/actions.ts

'use server'

import { checkUserFeatureAccess } from '@/lib/billing/feature-access'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { db } from '@/lib/db'

export async function saveInterviewResponse(
  questionId: string,
  response: string
) {
  // Auth check
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    throw new Error('Unauthorized')
  }

  // Feature gate: CRITICAL
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) {
    throw new Error(
      'Interview prep is available on Pro plans. Upgrade to get started.'
    )
  }

  // Ownership check
  const question = await db.interviewQuestion.findUnique({
    where: { id: questionId },
  })

  if (question?.sessionId) {
    const session = await db.session.findUnique({
      where: { id: question.sessionId },
    })
    if (session?.appUserId !== appUser.id) {
      throw new Error('Forbidden')
    }
  }

  // Mutation: Now we're safe to write
  const saved = await db.interviewResponse.create({
    data: {
      questionId,
      response,
      savedAt: new Date(),
    },
  })

  return saved
}

export async function deleteInterviewResponse(responseId: string) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    throw new Error('Unauthorized')
  }

  // Feature gate
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) {
    throw new Error('Feature not available on your plan')
  }

  // Ownership check
  const response = await db.interviewResponse.findUnique({
    where: { id: responseId },
  })

  if (!response) {
    throw new Error('Not found')
  }

  // Verify ownership through question → session
  const question = await db.interviewQuestion.findUnique({
    where: { id: response.questionId },
    include: { session: true },
  })

  if (question?.session?.appUserId !== appUser.id) {
    throw new Error('Forbidden')
  }

  // Delete
  await db.interviewResponse.delete({
    where: { id: responseId },
  })
}
```

### Step 3.2: Use in Client Components

```typescript
// src/components/interview/interview-response-form.tsx

'use client'

import { saveInterviewResponse } from '@/app/(auth)/interview/actions'
import { useState } from 'react'
import { toast } from 'sonner'

export function InterviewResponseForm({ questionId }: { questionId: string }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(response: string) {
    setIsLoading(true)
    try {
      await saveInterviewResponse(questionId, response)
      toast.success('Response saved')
    } catch (error) {
      // Server action error is user-facing (includes feature gate message)
      const message = error instanceof Error ? error.message : 'Failed to save'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit(e.currentTarget.response.value)
    }}>
      {/* form fields */}
    </form>
  )
}
```

---

## Phase 4: Testing

### Step 4.1: Test Feature Tier Definition

```typescript
// src/lib/billing/feature-access.test.ts

import { checkUserFeatureAccess } from './feature-access'

describe('checkUserFeatureAccess', () => {
  describe('interview_prep', () => {
    it('returns true for pro users', async () => {
      const proUserId = await createTestUser('pro')
      const result = await checkUserFeatureAccess(proUserId, 'interview_prep')
      expect(result).toBe(true)
    })

    it('returns false for starter users', async () => {
      const starterUserId = await createTestUser('starter')
      const result = await checkUserFeatureAccess(starterUserId, 'interview_prep')
      expect(result).toBe(false)
    })

    it('returns false for free users', async () => {
      const freeUserId = await createTestUser('free')
      const result = await checkUserFeatureAccess(freeUserId, 'interview_prep')
      expect(result).toBe(false)
    })
  })
})
```

### Step 4.2: Test Frontend Gate

```typescript
// src/app/(auth)/interview/page.test.tsx

import { render, screen } from '@testing-library/react'
import InterviewPrepPage from './page'

describe('InterviewPrepPage', () => {
  it('renders unavailable message for free users', async () => {
    // Mock: checkUserFeatureAccess returns false
    vi.mock('@/lib/billing/feature-access', () => ({
      checkUserFeatureAccess: vi.fn().mockResolvedValue(false),
    }))

    render(await InterviewPrepPage())

    expect(screen.getByText(/Interview Prep/)).toBeInTheDocument()
    expect(screen.getByText(/available on.*Pro/)).toBeInTheDocument()
    expect(screen.getByText(/Upgrade Now/)).toBeInTheDocument()
  })

  it('renders feature content for pro users', async () => {
    // Mock: checkUserFeatureAccess returns true
    vi.mock('@/lib/billing/feature-access', () => ({
      checkUserFeatureAccess: vi.fn().mockResolvedValue(true),
    }))

    render(await InterviewPrepPage())

    // Should render InterviewPrepSection, not FeatureUnavailable
    expect(screen.getByTestId('interview-prep-section')).toBeInTheDocument()
  })

  it('does not call loadInterviewQuestions for free users', async () => {
    // Verify no unnecessary data fetching
    const loadSpy = vi.fn()
    vi.mock('@/lib/db', () => ({
      loadInterviewQuestions: loadSpy,
    }))

    vi.mock('@/lib/billing/feature-access', () => ({
      checkUserFeatureAccess: vi.fn().mockResolvedValue(false),
    }))

    render(await InterviewPrepPage())

    expect(loadSpy).not.toHaveBeenCalled()
  })
})
```

### Step 4.3: Test Server Action Gate

```typescript
// src/app/(auth)/interview/actions.test.ts

import { saveInterviewResponse } from './actions'

describe('saveInterviewResponse', () => {
  it('saves response for pro users', async () => {
    const proUserId = await createTestUser('pro')
    const questionId = await createTestQuestion(proUserId)

    const result = await saveInterviewResponse(proUserId, questionId, 'My answer')

    expect(result.id).toBeDefined()
    expect(result.response).toBe('My answer')
  })

  it('rejects with permission error for free users', async () => {
    const freeUserId = await createTestUser('free')
    const questionId = await createTestQuestion(freeUserId)

    const promise = saveInterviewResponse(freeUserId, questionId, 'My answer')

    await expect(promise).rejects.toThrow('available on Pro plans')
  })

  it('rejects with ownership error when user owns wrong session', async () => {
    const user1 = await createTestUser('pro')
    const user2 = await createTestUser('pro')
    const question = await createTestQuestion(user1)

    // user2 tries to answer user1's question
    const promise = saveInterviewResponse(user2, question.id, 'Hacked!')

    await expect(promise).rejects.toThrow('Forbidden')
  })

  it('rejects with not found error for missing question', async () => {
    const proUserId = await createTestUser('pro')

    const promise = saveInterviewResponse(proUserId, 'fake_id', 'Answer')

    await expect(promise).rejects.toThrow('Not found')
  })
})
```

---

## Phase 5: Documentation & Rollout

### Step 5.1: Document the Feature

Add to [FEATURES.md](../FEATURES.md):

```markdown
## Interview Prep

What it does: provides AI-powered practice scenarios for common interview questions, with feedback on your responses.

Use cases:
- prepare for technical interviews
- practice behavioral questions
- get feedback from CurrIA on your answers

Plan requirement: Pro

Technical reference: `src/app/(auth)/interview/`
```

### Step 5.2: Add Changelog Entry

```markdown
# Changelog

## Unreleased

### Added
- Interview Prep feature for Pro users: AI-powered interview practice with feedback
- Feature gating infrastructure for plan-based access control

### Changed
- Feature access checks now happen before rendering expensive components

### Fixed
- Free users no longer see "Upgrade" prompts in loading states
```

### Step 5.3: Monitor Rollout

```typescript
// Log every access check for observability
logInfo('feature.access_check', {
  featureName: 'interview_prep',
  appUserId: user.id,
  hasAccess: true,
  planTier: user.planTier,
})

// Alert on unexpected denials
logWarn('feature.access_denied', {
  featureName: 'interview_prep',
  appUserId: user.id,
  planTier: user.planTier,
  reason: 'insufficient_tier',
})
```

---

## Checklist Before Shipping

- [ ] Feature tier added to `FEATURE_TIERS`
- [ ] Page component gates before rendering
- [ ] Page component doesn't call DB if user lacks access
- [ ] All server actions check access at start
- [ ] Ownership checks included (if applicable)
- [ ] Frontend "unavailable" component created
- [ ] All four test suites written and passing
- [ ] Error messages are user-facing (not stack traces)
- [ ] Logging added for observability
- [ ] Documentation updated (FEATURES.md)
- [ ] Changelog entry added
- [ ] Peer review approved
- [ ] Ready to merge

---

## Common Pitfalls

### ❌ Pitfall 1: Gating Only in UI

**Bad:**
```typescript
{hasProAccess && <FeatureUI />}  // Only blocks render
// But if user calls saveData() directly, it works!
```

**Good:**
```typescript
// Frontend blocks render
{hasProAccess && <FeatureUI />}

// Backend validates too
export async function saveData(data: any) {
  if (!hasAccess) throw new Error(...)
  // ... save
}
```

### ❌ Pitfall 2: Forgetting Ownership Checks

**Bad:**
```typescript
export async function deleteQuestion(questionId: string) {
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) throw new Error(...)
  
  // Anyone can delete any question!
  await db.question.delete({ where: { id: questionId } })
}
```

**Good:**
```typescript
export async function deleteQuestion(questionId: string) {
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) throw new Error(...)
  
  // Verify ownership
  const question = await db.question.findUnique({ where: { id: questionId } })
  if (question.ownedBy !== appUser.id) throw new Error('Forbidden')
  
  // Safe to delete
  await db.question.delete({ where: { id: questionId } })
}
```

### ❌ Pitfall 3: Calling DB Before Gate Check

**Bad:**
```typescript
export async function getQuestions(appUser: AppUser) {
  // This loads data for EVERYONE before checking access
  const questions = await db.question.findMany({
    where: { appUserId: appUser.id },
  })
  
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) return []
  
  return questions  // Wasted DB call above
}
```

**Good:**
```typescript
export async function getQuestions(appUser: AppUser) {
  // Gate FIRST
  const hasAccess = await checkUserFeatureAccess(appUser.id, 'interview_prep')
  if (!hasAccess) return []
  
  // Only call DB if authorized
  const questions = await db.question.findMany({
    where: { appUserId: appUser.id },
  })
  
  return questions
}
```

---

## When You Change Plan Requirements

If you need to change which tier can access a feature:

```typescript
// Before (starter users had access)
export const FEATURE_TIERS = {
  interview_prep: ['starter', 'pro'],
}

// After (only pro users)
export const FEATURE_TIERS = {
  interview_prep: ['pro'],
}
```

**Impact:**
- Existing starter users will see "Feature Unavailable" on next visit
- No data is deleted (responses are preserved in DB)
- Users can upgrade to regain access

**Communication:**
- Notify users 2 weeks in advance
- Point them to `/plans` to upgrade
- Consider offering a one-time discount

---

## Related Docs

- [FEATURE_ACCESS_CONTROL.md](./FEATURE_ACCESS_CONTROL.md) - Conceptual overview
- [../billing/IMPLEMENTATION.md](../billing/IMPLEMENTATION.md) - How plans work
- [../FEATURES.md](../FEATURES.md) - Product features list
- [../error-codes.md](../error-codes.md) - Error handling patterns
