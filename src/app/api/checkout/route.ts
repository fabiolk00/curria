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
import { formatExternalReference } from '@/lib/asaas/external-reference'
import { getPlan } from '@/lib/plans'

const BodySchema = z.object({
  plan: z.enum(['unit', 'monthly', 'pro']),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  let checkoutReference: string | null = null

  try {
    const plan = getPlan(body.data.plan)
    if (!plan || plan.price <= 0) {
      return NextResponse.json({ error: 'Invalid paid plan' }, { status: 400 })
    }

    const user = await currentUser()
    const userName = user?.fullName ?? user?.firstName ?? 'Usuário'
    const userEmail = user?.emailAddresses[0]?.emailAddress ?? ''
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const successUrl = `${origin}/dashboard`
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
    })

    await markCheckoutCreated(checkout.checkoutReference, url)

    return NextResponse.json({ url })
  } catch (err) {
    if (checkoutReference) {
      await markCheckoutFailed(
        checkoutReference,
        err instanceof Error ? err.message : 'Unknown checkout error',
      )
    }

    console.error('[api/checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
