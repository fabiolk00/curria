import { asaas } from '@/lib/asaas/client'
import { PLANS, type PlanSlug } from '@/lib/plans'

type CreateCheckoutLinkInput = {
  appUserId: string
  userName: string
  userEmail?: string | null
  plan: PlanSlug
  checkoutReference: string
  externalReference: string
  successUrl: string
}

function buildPaymentLinkName(planName: string): string {
  return `CurrIA - ${planName}`
}

function buildCallback(successUrl: string) {
  return {
    successUrl,
    autoRedirect: false,
  }
}

export async function createCheckoutLink({
  appUserId,
  userName,
  userEmail,
  plan,
  checkoutReference,
  externalReference,
  successUrl,
}: CreateCheckoutLinkInput): Promise<string> {
  const planConfig = PLANS[plan]

  // Hosted payment links capture the payer's data directly in Asaas.
  void appUserId
  void userName
  void userEmail
  void checkoutReference

  if (planConfig.billing === 'once') {
    const result = await asaas.post<{ url: string }>('/paymentLinks', {
      name: buildPaymentLinkName(planConfig.name),
      description: planConfig.description,
      billingType: 'UNDEFINED',
      chargeType: 'DETACHED',
      value: planConfig.price / 100,
      externalReference,
      callback: buildCallback(successUrl),
    })

    return result.url
  }

  const result = await asaas.post<{ url: string }>('/paymentLinks', {
    name: buildPaymentLinkName(planConfig.name),
    description: planConfig.description,
    billingType: 'CREDIT_CARD',
    chargeType: 'RECURRENT',
    subscriptionCycle: 'MONTHLY',
    value: planConfig.price / 100,
    externalReference,
    callback: buildCallback(successUrl),
  })

  return result.url
}
