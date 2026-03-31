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

export const runtime = 'nodejs'

const BodySchema = z.object({
  plan: z.enum(['unit', 'monthly', 'pro']),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let checkoutReference: string | null = null

  try {
    const appUser = await getCurrentAppUser()
    if (!appUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    if (!plan || plan.price <= 0) {
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
    const checkout = await createCheckoutRecordPending(appUser.id, plan.slug, plan.price)
    checkoutReference = checkout.checkoutReference
    const externalReference = formatExternalReference(appUser.id, checkout.checkoutReference)

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

    await markCheckoutCreated(checkout.checkoutReference, url)

    return NextResponse.json({ url })
  } catch (err) {
    if (checkoutReference) {
      try {
        await markCheckoutFailed(
          checkoutReference,
          err instanceof Error ? err.message : 'Unknown checkout error',
        )
      } catch (markCheckoutFailedError) {
        console.error('[api/checkout] failed to mark checkout failed', markCheckoutFailedError)
      }
    }

    console.error('[api/checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
