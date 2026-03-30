import { z } from 'zod'

export const ASAAS_BILLING_EVENTS = [
  'PAYMENT_RECEIVED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_CANCELED',
] as const

export type AsaasBillingEventType = (typeof ASAAS_BILLING_EVENTS)[number]

const AsaasPaymentSchema = z.object({
  id: z.string(),
  externalReference: z.string().optional(),
  subscription: z.string().nullable().optional(),
  amount: z.number().optional(),
})

const AsaasSubscriptionSchema = z.object({
  id: z.string(),
  externalReference: z.string().optional(),
  status: z.string().optional(),
  nextDueDate: z.string().optional(),
})

export const AsaasWebhookEventSchema = z.object({
  event: z.enum(ASAAS_BILLING_EVENTS),
  payment: AsaasPaymentSchema.optional(),
  subscription: AsaasSubscriptionSchema.optional(),
  amount: z.number().optional(),
}).superRefine((value, ctx) => {
  if (value.event === 'PAYMENT_RECEIVED' && !value.payment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['payment'],
      message: 'PAYMENT_RECEIVED events require a payment object.',
    })
  }

  if (
    (value.event === 'SUBSCRIPTION_CREATED'
      || value.event === 'SUBSCRIPTION_RENEWED'
      || value.event === 'SUBSCRIPTION_DELETED'
      || value.event === 'SUBSCRIPTION_CANCELED')
    && !value.subscription
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subscription'],
      message: `${value.event} events require a subscription object.`,
    })
  }
})

export type AsaasPayment = z.infer<typeof AsaasPaymentSchema>
export type AsaasSubscription = z.infer<typeof AsaasSubscriptionSchema>
export type AsaasWebhookEvent = z.infer<typeof AsaasWebhookEventSchema>

function formatWebhookValidationError(error: z.ZodError<AsaasWebhookEvent>): string {
  const [firstIssue] = error.issues

  if (!firstIssue) {
    return 'Invalid webhook event.'
  }

  return firstIssue.message
}

export function parseAsaasWebhookEvent(value: unknown): AsaasWebhookEvent {
  const parsed = AsaasWebhookEventSchema.safeParse(value)

  if (!parsed.success) {
    throw new Error(formatWebhookValidationError(parsed.error))
  }

  return parsed.data
}

export function getWebhookAmount(event: AsaasWebhookEvent): number | undefined {
  return event.amount ?? event.payment?.amount
}
