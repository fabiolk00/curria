---
title: BullMQ on Vercel — Architecture Decision Required
date: 2026-04-07
status: Blocking Production Deployment
---

# BullMQ on Vercel: Architecture Decision

## The Problem

BullMQ is designed for **persistent worker processes**, but Vercel is **serverless and ephemeral**.

Current code:
```typescript
// src/lib/linkedin/queue.ts (line 8)
export const linkedinQueue = new Queue<LinkedInProfileJob>(...)

// src/lib/linkedin/queue.ts (line 60)
export const linkedinWorker = new Worker<LinkedInProfileJob>(...)
```

What happens in production:
1. User submits LinkedIn URL → `POST /api/profile/extract`
2. Route queues job: `await linkedinQueue.add('extract', { ... })`
3. Job persisted to Upstash Redis ✅
4. Worker instantiated in the request context
5. Request ends → Lambda context terminates → Worker dies ❌
6. Job sits in Redis queue forever, never processed
7. Status polling returns "waiting" indefinitely
8. User sees infinite spinner, then gives up
9. Feature silently broken in production

---

## Why It Matters

- **User Experience:** Feature appears to work but doesn't. No feedback. Silent failure.
- **Data Integrity:** Profile saved to database only if job completes. Currently never completes.
- **Trust:** Feature promotes "one-click LinkedIn import" but doesn't deliver.
- **Business:** LinkedIn import is a key onboarding feature. It needs to work.

---

## Three Options

### Option A: On-Demand Extraction (Recommended for Vercel)

**Concept:** Extract on demand when user polls `/api/profile/status/:jobId`

**How it works:**
```typescript
// status/[jobId]/route.ts
export async function GET(req, { params: { jobId } }) {
  const job = await linkedinQueue.getJob(jobId)
  if (!job) return 404
  
  const state = await job.getState()
  
  // If job still waiting and >1 second old, process now (synchronously)
  if (state === 'waiting' && Date.now() - job.createdAt > 1000) {
    try {
      // Process extraction inline
      const profileData = await fetchLinkedInProfile(job.data.linkedinUrl)
      const cvState = mapLinkdAPIToCvState(profileData)
      
      // Save to database
      await supabase.from('user_profiles').upsert({
        user_id: job.data.appUserId,
        cv_state: cvState,
        source: 'linkedin',
        linkedin_url: job.data.linkedinUrl,
        extracted_at: new Date().toISOString(),
      })
      
      await job.complete({ success: true })
    } catch (error) {
      await job.failed(error)
    }
  }
  
  return { jobId, status: await job.getState() }
}
```

**Pros:**
- ✅ Works on Vercel (no persistent process needed)
- ✅ No infrastructure changes
- ✅ User gets result on next poll
- ✅ Extraction happens synchronously in request context
- ✅ Can handle timeouts gracefully (client keeps polling)

**Cons:**
- ❌ Extraction happens on polling request (adds latency to status check)
- ❌ If extraction is slow (>10s), request may timeout
- ❌ User sees slightly longer wait time
- ⚠️ Requires timeout handling in frontend

**Implementation Time:** 4-6 hours

**Risk:** Low (on-demand extraction is simple, well-tested pattern)

---

### Option B: Move to Persistent Platform

**Concept:** Deploy to platform with long-lived processes (Railway, Fly.io, Render)

**Pros:**
- ✅ BullMQ works as designed
- ✅ Background job processing is native
- ✅ Can handle large extraction jobs without timeouts
- ✅ Professional infrastructure for scaling

**Cons:**
- ❌ Migration effort (rearchitecture deployment)
- ❌ Ongoing infrastructure costs
- ❌ DevOps complexity increases
- ❌ Different environment than current Vercel setup

**Implementation Time:** 24-40 hours

**Risk:** High (deployment, environment differences, operational burden)

---

### Option C: Use Upstash REST API (If Available)

**Concept:** Use Upstash's REST-based job queue instead of BullMQ

**Status:** Requires research — Upstash may not expose job queue management via REST

**Pros:**
- ✅ No infrastructure change
- ✅ REST-native (works on serverless)

**Cons:**
- ❌ Unknown if Upstash supports this
- ❌ May have different API than BullMQ
- ❌ Requires significant refactoring

**Implementation Time:** 12-20 hours

**Risk:** Very high (untested approach, requires API research)

---

## Recommendation

**Use Option A: On-Demand Extraction**

**Reasoning:**
1. **Vercel-native:** Works with existing serverless deployment
2. **Simple:** No infrastructure changes, straightforward code
3. **Fast:** 4-6 hours to implement
4. **Safe:** Extraction still happens, just on poll instead of background
5. **User-friendly:** Extraction completes by next poll (2-10 seconds)
6. **Future-proof:** If you migrate platforms later, switch to BullMQ then

**Implementation Steps:**
1. Modify `/api/profile/status/[jobId]` to extract on-demand if job still waiting
2. Remove `linkedinWorker` (never used on Vercel)
3. Keep `linkedinQueue` for job tracking/history
4. Update tests to cover on-demand extraction
5. Test manually: submit URL → poll → get result

---

## Decision Matrix

| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Works on Vercel | ✅ Yes | ❌ No | ? Unknown |
| Implementation time | 4-6h | 24-40h | 12-20h |
| Infrastructure cost | $0 | +$30-50/mo | $0 |
| Operational burden | Low | High | Medium |
| Risk level | Low | High | Very High |
| BullMQ expertise needed | Low | High | Medium |

---

## Required Commits

Once decision is made:

**If Option A:**
```bash
# Modify status endpoint for on-demand extraction
# Remove linkedinWorker from queue.ts
# Update tests
```

**If Option B:**
```bash
# Create Railway/Fly.io deployment config
# Update environment variables
# Migrate CI/CD pipeline
```

**If Option C:**
```bash
# Research Upstash API capabilities
# Refactor queue implementation
# Test extensively
```

---

## Current State

- [x] Fixes applied: JSON parsing, gap analysis latency, queue cleanup
- [x] Queue configuration ready: removeOnComplete: false
- [ ] **DECISION NEEDED:** Which option for BullMQ?
- [ ] Implementation of chosen option
- [ ] End-to-end testing
- [ ] Deployment to production

---

## Next Action

**Decide on Option A, B, or C, then:**
1. Implement chosen approach
2. Test end-to-end: submit URL → poll → verify profile saved
3. Deploy to staging
4. Monitor for 24 hours
5. Production rollout

**Recommendation:** Proceed with **Option A** for immediate production readiness.

---

**Blocking:** Yes — do not deploy to production with current BullMQ worker model on Vercel.

**Priority:** Critical — LinkedIn import is a core feature.

**Timeline:** Decision needed immediately. Implementation feasible within 24 hours.
