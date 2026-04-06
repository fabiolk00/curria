import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  createCheckoutRecordPending,
  markCheckoutCreated,
  markCheckoutFailed,
} from '@/lib/asaas/billing-checkouts'
import { createCheckoutLink } from '@/lib/asaas/checkout'
import {
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE,
} from '@/lib/asaas/checkout-errors'
import { formatExternalReference } from '@/lib/asaas/external-reference'
import { getActiveRecurringSubscription } from '@/lib/asaas/quota'
import { getPlan } from '@/lib/plans'
import { logError } from '@/lib/observability/structured-log'

export const runtime = 'nodejs'

const BodySchema = z.object({
  plan: z.enum(['unit', 'monthly', 'pro']),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let checkoutReference: string | null = null

  try {
    console.log('[api/checkout] POST request started')
    const appUser = await getCurrentAppUser()
    if (!appUser) {
      console.warn('[api/checkout] no app user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[api/checkout] appUser:', appUser.id)

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const body = BodySchema.safeParse(rawBody)
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const plan = getPlan(body.data.plan)
    console.log('[api/checkout] plan:', body.data.plan, plan)
    if (!plan || plan.price <= 0) {
      console.error('[api/checkout] invalid plan:', body.data.plan)
      return NextResponse.json({ error: 'Invalid paid plan' }, { status: 400 })
    }

    if (plan.billing === 'monthly') {
      let activeRecurringSubscription = null
      try {
        activeRecurringSubscription = await getActiveRecurringSubscription(appUser.id)
      } catch (error) {
        console.error('[api/checkout] failed to validate recurring subscription state', error)
        return NextResponse.json(
          {
            error: RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE,
          },
          { status: 503 },
        )
      }

      if (activeRecurringSubscription) {
        return NextResponse.json(
          {
            error: ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
          },
          { status: 400 },
        )
      }
    }

    let user = null
    try {
      user = await currentUser()
    } catch (currentUserError) {
      console.warn(
        '[api/checkout] unable to load Clerk profile; continuing with fallback customer data',
        currentUserError,
      )
    }

    const userName = user?.fullName ?? user?.firstName ?? 'Usuario CurrIA'
    const userEmail = user?.emailAddresses[0]?.emailAddress ?? null
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const successUrl = `${origin}/dashboard`
    const pricingUrl = `${origin}/pricing`
    console.log('[api/checkout] creating checkout record')
    const checkout = await createCheckoutRecordPending(appUser.id, plan.slug, plan.price)
    checkoutReference = checkout.checkoutReference
    console.log('[api/checkout] checkout record created:', checkoutReference)

    const externalReference = formatExternalReference(appUser.id, checkout.checkoutReference)
    console.log('[api/checkout] externalReference:', externalReference)

    console.log('[api/checkout] calling createCheckoutLink')
    const url = await createCheckoutLink({
      appUserId: appUser.id,
      userName,
      userEmail,
      plan: plan.slug,
      checkoutReference: checkout.checkoutReference,
      externalReference,
      successUrl,
      cancelUrl: pricingUrl,
      expiredUrl: pricingUrl,
    })
    console.log('[api/checkout] createCheckoutLink returned:', url)

    await markCheckoutCreated(checkout.checkoutReference, url)

    console.log('[api/checkout] checkout successful')
    return NextResponse.json({ url })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown checkout error'
    console.error('[api/checkout] error:', errorMessage, err)

    if (checkoutReference) {
      try {
        await markCheckoutFailed(checkoutReference, errorMessage)
      } catch (markCheckoutFailedError) {
        console.error('[api/checkout] failed to mark checkout as failed:', markCheckoutFailedError)
        logError('checkout.mark_failed_error', {
          checkoutReference,
          originalError: errorMessage,
          markFailedError: markCheckoutFailedError instanceof Error ? markCheckoutFailedError.message : String(markCheckoutFailedError),
          success: false,
        })
      }
    }

    logError('checkout.creation_failed', {
      checkoutReference: checkoutReference ?? 'none',
      errorMessage,
      success: false,
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
