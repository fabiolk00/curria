import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  isValidBrazilStateCode,
  isValidPostalCodeInput,
  normalizePostalCode,
  normalizeProvince,
} from '@/lib/billing/address'
import { getBillingInfo, saveBillingInfo } from '@/lib/billing/customer-info'
import {
  createCheckoutRecordPending,
  markCheckoutCreated,
  markCheckoutFailed,
} from '@/lib/asaas/billing-checkouts'
import { createCheckoutLink } from '@/lib/asaas/checkout'
import {
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  CHECKOUT_BILLING_SETUP_ERROR_MESSAGE,
  RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE,
} from '@/lib/asaas/checkout-errors'
import { formatExternalReference } from '@/lib/asaas/external-reference'
import { getActiveRecurringSubscription } from '@/lib/asaas/quota'
import { logError, logInfo, logWarn } from '@/lib/observability/structured-log'
import { getPlan } from '@/lib/plans'

export const runtime = 'nodejs'

const BodySchema = z.object({
  plan: z.enum(['unit', 'monthly', 'pro']),
  cpfCnpj: z.string().min(1, 'CPF/CNPJ is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
  addressNumber: z.string().min(1, 'Address number is required'),
  postalCode: z.string()
    .trim()
    .refine(isValidPostalCodeInput, 'Postal code must have 7 or 8 digits')
    .transform(normalizePostalCode),
  province: z.string()
    .trim()
    .transform(normalizeProvince)
    .refine(isValidBrazilStateCode, 'Province must be a valid state code'),
})

function sanitizeCheckoutErrorMessage(error: unknown): string {
  let message = 'Unknown checkout error'

  if (typeof error === 'string' && error.trim().length > 0) {
    message = error.trim()
  } else if (error instanceof Error && error.message.trim().length > 0) {
    message = error.message.trim()
  } else if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const parts = [
      typeof record.code === 'string' ? `code=${record.code}` : null,
      typeof record.message === 'string' ? record.message : null,
      typeof record.details === 'string' ? `details=${record.details}` : null,
      typeof record.hint === 'string' ? `hint=${record.hint}` : null,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0))

    if (parts.length > 0) {
      message = parts.join(' | ')
    }
  }

  if (
    message.startsWith('Invalid app user id for externalReference:')
    || message.startsWith('Invalid checkout reference for externalReference:')
  ) {
    return 'Failed to format checkout external reference.'
  }

  return message
}

function getBillingInfoSaveErrorResponse(error: unknown): { logMessage: string; clientMessage: string } {
  const logMessage = sanitizeCheckoutErrorMessage(error)
  const normalized = logMessage.toLowerCase()
  const isMissingBillingTable = (
    normalized.includes('customer_billing_info')
    && (
      normalized.includes('does not exist')
      || normalized.includes('relation')
      || normalized.includes('code=42p01')
    )
  )

  if (isMissingBillingTable) {
    return {
      logMessage: 'customer_billing_info table is missing. Run the customer_billing_info migration. '
        + `Original error: ${logMessage}`,
      clientMessage: CHECKOUT_BILLING_SETUP_ERROR_MESSAGE,
    }
  }

  return {
    logMessage,
    clientMessage: 'Failed to save billing information.',
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let checkoutReference: string | null = null

  try {
    const appUser = await getCurrentAppUser()
    if (!appUser) {
      logWarn('checkout.unauthorized', {
        success: false,
      })

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      logWarn('checkout.invalid_body', {
        success: false,
      })

      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const body = BodySchema.safeParse(rawBody)
    if (!body.success) {
      logWarn('checkout.invalid_body', {
        success: false,
      })

      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const plan = getPlan(body.data.plan)
    if (!plan || plan.price <= 0) {
      logWarn('checkout.invalid_plan', {
        plan: body.data.plan,
        success: false,
      })

      return NextResponse.json({ error: 'Invalid paid plan' }, { status: 400 })
    }

    logInfo('checkout.request_started', {
      plan: plan.slug,
    })

    // Save billing info
    try {
      await saveBillingInfo(appUser.id, {
        cpfCnpj: body.data.cpfCnpj,
        phoneNumber: body.data.phoneNumber,
        address: body.data.address,
        addressNumber: body.data.addressNumber,
        postalCode: body.data.postalCode,
        province: body.data.province,
      })
    } catch (error) {
      const { logMessage, clientMessage } = getBillingInfoSaveErrorResponse(error)

      logError('checkout.save_billing_info_failed', {
        plan: plan.slug,
        errorMessage: logMessage,
        success: false,
      })

      return NextResponse.json(
        {
          error: clientMessage,
        },
        { status: 400 },
      )
    }

    if (plan.billing === 'monthly') {
      let activeRecurringSubscription = null
      try {
        activeRecurringSubscription = await getActiveRecurringSubscription(appUser.id)
      } catch (error) {
        const errorMessage = sanitizeCheckoutErrorMessage(error)

        logError('checkout.subscription_validation_failed', {
          plan: plan.slug,
          errorMessage,
          success: false,
        })

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
    } catch {
      logWarn('checkout.customer_profile_fallback', {
        plan: plan.slug,
        success: true,
      })
    }

    const userName = user?.fullName ?? user?.firstName ?? 'Usuario CurrIA'
    const userEmail = user?.emailAddresses[0]?.emailAddress ?? null
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const successUrl = `${origin}/dashboard`
    const pricingUrl = `${origin}/pricing`
    const checkout = await createCheckoutRecordPending(appUser.id, plan.slug, plan.price)
    checkoutReference = checkout.checkoutReference

    const billingInfo = await getBillingInfo(appUser.id)
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
      billingInfo: billingInfo ?? undefined,
    })

    await markCheckoutCreated(checkout.checkoutReference, url)

    logInfo('checkout.created', {
      checkoutReference,
      plan: plan.slug,
      success: true,
    })

    return NextResponse.json({ url })
  } catch (err) {
    const errorMessage = sanitizeCheckoutErrorMessage(err)

    if (checkoutReference) {
      try {
        await markCheckoutFailed(checkoutReference, errorMessage)
      } catch (markCheckoutFailedError) {
        logError('checkout.mark_failed_error', {
          checkoutReference,
          originalError: errorMessage,
          markFailedError: sanitizeCheckoutErrorMessage(markCheckoutFailedError),
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
