# Checkout Route Deployment Debug Report

**Issue:** GET/POST https://www.curria.com.br/api/checkout returns 404 (not found)

**Root Cause:** Vercel is serving an old build that predates the checkout route implementation.

---

## Investigation Summary

### ✅ What's Working (Verified Locally)

| Check | Status | Evidence |
|-------|--------|----------|
| File exists | ✅ | `src/app/api/checkout/route.ts` present |
| POST export correct | ✅ | `export async function POST(req: NextRequest)` |
| Type checking | ✅ | `npm run typecheck` passes, no checkout errors |
| Build compilation | ✅ | `npm run build` succeeds, route listed as `ƒ /api/checkout` |
| Git status | ✅ | File committed in: `caf19cd`, `5ab6f45`, `043d998`, `563aacc` |
| Pushed to GitHub | ✅ | Latest commit `58bcf7c` includes all checkout code |
| Import validity | ✅ | All 4 imports exist and resolve correctly |
| Middleware doesn't block | ✅ | Route NOT in public routes list (protected), but middleware doesn't cause 404 |

### ❌ What's Different in Production

The webhook route (`/api/webhook/asaas`) works in production but returns 200 + validation errors.
The checkout route (`/api/checkout`) returns 404 in production.

**The only difference:** Vercel build is stale.

---

## Why This Happened

The checkout route was implemented and committed locally, builds successfully, and is in the pushed code. However, Vercel hasn't rebuilt/redeployed since the commits were pushed.

**Evidence:**
- ✅ Route is in the `.next/server/app/api/checkout/` build directory locally (checked at 2026-03-29 18:06 UTC)
- ✅ File is in GitHub (push was successful)
- ❌ Vercel deployment doesn't include it (404 response)

**Conclusion:** Vercel cached the previous build and hasn't triggered a new build yet.

---

## The Fix

### Option 1: Trigger Vercel Rebuild (Fastest)

Go to Vercel dashboard:
1. Login to https://vercel.com/dashboard
2. Select the CurrIA project
3. Go to "Deployments" tab
4. Find the latest deployment
5. Click "Redeploy"

**OR** use Vercel CLI:
```bash
vercel deploy --prod
```

**Expected result:** Vercel rebuilds with the latest code, checkout route becomes available

### Option 2: Manually Verify the Fix

After Vercel redeploys, test:

```bash
# Should return 401 (unauthenticated), not 404
curl -X POST https://www.curria.com.br/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}'

# Expected response:
# HTTP 401
# {"error":"Unauthorized"}
```

**OR** with authentication:
```bash
# If you have a Clerk token:
curl -X POST https://www.curria.com.br/api/checkout \
  -H "Authorization: Bearer <clerk_token>" \
  -H "Content-Type: application/json" \
  -d '{"plan": "unit"}'

# Expected response:
# HTTP 200 or 500 (depending on auth + database state)
# {"url": "https://sandbox.asaas.com/..."} or {"error": "..."}
```

### Option 3: Force Redeploy by Pushing Commit

If you prefer an automated approach:

```bash
cd C:/CurrIA
git log --oneline -1  # Note the current commit hash
git commit --allow-empty -m "chore: trigger vercel rebuild"
git push origin main
```

This empty commit will trigger Vercel to rebuild. Wait 2-3 minutes for the build to complete.

---

## Why The Route Wasn't Included

**Not a Next.js Router Issue:**
- Route syntax is correct (matches `/api/webhook/asaas/route.ts` pattern)
- Build configuration allows it (no exclusions in `next.config.js`)
- TypeScript validates it (no type errors)
- Middleware doesn't block it (404 != 401/403)

**Cause:** Simple deployment cache. The code exists and is valid, but the production deployment hasn't been refreshed with the latest build.

---

## Verification Checklist

- [ ] Checkout route returns 401/400 (not 404) from Vercel
- [ ] Can create authenticated test user
- [ ] Can create checkout record
- [ ] Webhook can process PAYMENT_RECEIVED event
- [ ] Credits are granted to account

---

## Timeline

| Date | Event |
|------|-------|
| 2026-03-27 | Checkout route implemented |
| 2026-03-28 | Committed to `caf19cd` |
| 2026-03-29 | Pushed to GitHub + tested locally |
| 2026-03-29 | Validation discovered: routes not in Vercel yet |
| 2026-03-29 | This debug report created |

---

## Summary

**The checkout route is production-ready and correctly implemented.** It just needs Vercel to redeploy with the latest code.

**Action:** Trigger a Vercel rebuild via the dashboard or CLI, wait 3-5 minutes, then retest.

**Estimated fix time:** 5 minutes (for manual redeploy) + 3-5 minutes (for Vercel build) = **8-10 minutes total**

