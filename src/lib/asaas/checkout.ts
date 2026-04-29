import { asaas } from '@/lib/asaas/client'
import { PLANS, type PlanSlug } from '@/lib/plans'
import type { BillingInfo } from '@/lib/billing/customer-info'

type CreateCheckoutLinkInput = {
  appUserId: string
  userName: string
  userEmail?: string | null
  plan: PlanSlug
  checkoutReference: string
  externalReference: string
  successUrl: string
  cancelUrl?: string
  expiredUrl?: string
  billingInfo?: BillingInfo
}

function buildPaymentLinkName(planName: string): string {
  return `CurrIA - ${planName}`
}

function getAsaasHostedOrigin(): string {
  return process.env.ASAAS_SANDBOX === 'true'
    ? 'https://sandbox.asaas.com'
    : 'https://www.asaas.com'
}

type AsaasCheckoutResponse = {
  id: string
  link?: string | null
}

function buildCheckoutSessionUrl(checkoutId: string): string {
  return `${getAsaasHostedOrigin()}/checkoutSession/show/${encodeURIComponent(checkoutId)}`
}

function buildCustomerData(
  userName: string,
  userEmail?: string | null,
  billingInfo?: BillingInfo,
) {
  return {
    name: userName,
    email: userEmail ?? undefined,
    ...(billingInfo && {
      cpfCnpj: billingInfo.cpfCnpj,
      phone: billingInfo.phoneNumber,
      address: billingInfo.address,
      addressNumber: billingInfo.addressNumber,
      postalCode: billingInfo.postalCode,
      province: billingInfo.province,
    }),
  }
}

function tomorrowDateTime(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export async function createCheckoutLink({
  appUserId,
  userName,
  userEmail,
  plan,
  checkoutReference,
  externalReference,
  successUrl,
  cancelUrl,
  expiredUrl,
  billingInfo,
}: CreateCheckoutLinkInput): Promise<string> {
  const planConfig = PLANS[plan]
  void appUserId
  void checkoutReference

  if (planConfig.billing === 'once') {
    const detachedCheckout = await asaas.post<AsaasCheckoutResponse>('/checkouts', {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: 60,
      callback: {
        successUrl,
        cancelUrl: cancelUrl ?? successUrl,
        expiredUrl: expiredUrl ?? cancelUrl ?? successUrl,
      },
      customerData: buildCustomerData(userName, userEmail, billingInfo),
      items: [
        {
          name: buildPaymentLinkName(planConfig.name),
          description: planConfig.description,
          quantity: 1,
          value: planConfig.price / 100,
        },
      ],
      externalReference,
    })

    return detachedCheckout.link ?? buildCheckoutSessionUrl(detachedCheckout.id)
  }

  const recurringCheckout = await asaas.post<AsaasCheckoutResponse>('/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 60,
    callback: {
      successUrl,
      cancelUrl: cancelUrl ?? successUrl,
      expiredUrl: expiredUrl ?? cancelUrl ?? successUrl,
    },
    customerData: buildCustomerData(userName, userEmail, billingInfo),
    items: [
      {
        name: buildPaymentLinkName(planConfig.name),
        description: planConfig.description,
        quantity: 1,
        value: planConfig.price / 100,
      },
    ],
    subscription: {
      cycle: 'MONTHLY',
      nextDueDate: tomorrowDateTime(),
    },
    externalReference,
  })

  return recurringCheckout.link ?? buildCheckoutSessionUrl(recurringCheckout.id)
}
