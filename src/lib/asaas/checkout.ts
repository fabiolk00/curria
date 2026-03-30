import { asaas } from '@/lib/asaas/client'
import { PLANS, type PlanSlug } from '@/lib/plans'
import { getOrCreateCustomer } from '@/lib/asaas/customers'

type CreateCheckoutLinkInput = {
  appUserId: string
  userName: string
  userEmail: string
  plan: PlanSlug
  checkoutReference: string
  externalReference: string
  successUrl: string
}

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
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
  const customerId = await getOrCreateCustomer({ appUserId, name: userName, email: userEmail })

  void checkoutReference

  if (planConfig.billing === 'once') {
    const result = await asaas.post<{ url: string }>('/paymentLinks', {
      name: `CurrIA â€” ${planConfig.name}`,
      billingType: 'UNDEFINED',
      chargeType: 'DETACHED',
      value: planConfig.price / 100,
      customer: customerId,
      externalReference,
      successUrl,
    })
    return result.url
  }

  const result = await asaas.post<{ invoiceUrl: string }>('/subscriptions', {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    cycle: 'MONTHLY',
    value: planConfig.price / 100,
    nextDueDate: tomorrow(),
    externalReference,
  })

  return result.invoiceUrl
}
