import { z } from 'zod'

const HANDLED_PAYMENT_EVENTS = [
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
] as const

const HANDLED_SUBSCRIPTION_EVENTS = [
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_CANCELED',
] as const

export const HANDLED_ASAAS_BILLING_EVENTS = [
  ...HANDLED_PAYMENT_EVENTS,
  ...HANDLED_SUBSCRIPTION_EVENTS,
] as const

export type HandledAsaasBillingEventType = (typeof HANDLED_ASAAS_BILLING_EVENTS)[number]

const handledAsaasBillingEventSet = new Set<string>(HANDLED_ASAAS_BILLING_EVENTS)
const handledPaymentEventSet = new Set<string>(HANDLED_PAYMENT_EVENTS)
const handledSubscriptionEventSet = new Set<string>(HANDLED_SUBSCRIPTION_EVENTS)

const AsaasPaymentSchema = z.object({
  id: z.string(),
  externalReference: z.string().nullable().optional(),
  checkoutSession: z.string().nullable().optional(),
  subscription: z.string().nullable().optional(),
  amount: z.number().optional(),
  value: z.number().optional(),
  dueDate: z.string().optional(),
  billingType: z.string().optional(),
  status: z.string().optional(),
  confirmedDate: z.string().optional(),
})

const AsaasSubscriptionSchema = z.object({
  id: z.string(),
  externalReference: z.string().nullable().optional(),
  status: z.string().optional(),
  nextDueDate: z.string().optional(),
  value: z.number().optional(),
  deleted: z.boolean().optional(),
})

export const AsaasWebhookEventSchema = z.object({
  event: z.string().min(1, 'Webhook event is required.'),
  payment: AsaasPaymentSchema.optional(),
  subscription: AsaasSubscriptionSchema.optional(),
  amount: z.number().optional(),
}).superRefine((value, ctx) => {
  if (handledPaymentEventSet.has(value.event) && !value.payment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['payment'],
      message: `${value.event} events require a payment object.`,
    })
  }

  if (handledSubscriptionEventSet.has(value.event) && !value.subscription) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subscription'],
      message: `${value.event} events require a subscription object.`,
    })
  }
})

export type AsaasPayment = z.infer<typeof AsaasPaymentSchema>
type AsaasSubscription = z.infer<typeof AsaasSubscriptionSchema>
export type AsaasWebhookEvent = z.infer<typeof AsaasWebhookEventSchema>

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
const BR_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/

function formatWebhookValidationError(error: z.ZodError<AsaasWebhookEvent>): string {
  const [firstIssue] = error.issues

  if (!firstIssue) {
    return 'Invalid webhook event.'
  }

  return firstIssue.message
}

export function isHandledAsaasBillingEvent(value: string): value is HandledAsaasBillingEventType {
  return handledAsaasBillingEventSet.has(value)
}

export function parseAsaasWebhookEvent(value: unknown): AsaasWebhookEvent {
  const parsed = AsaasWebhookEventSchema.safeParse(value)

  if (!parsed.success) {
    throw new Error(formatWebhookValidationError(parsed.error))
  }

  return parsed.data
}

export function parseAsaasDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  const brDate = BR_DATE_REGEX.exec(normalized)
  if (brDate) {
    const [, day, month, year] = brDate
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  }

  const isoDate = ISO_DATE_REGEX.exec(normalized)
  if (isoDate) {
    const [, year, month, day] = isoDate
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  }

  const isoDateTime = ISO_DATETIME_REGEX.exec(normalized)
  if (isoDateTime) {
    const [, year, month, day, hours, minutes, seconds] = isoDateTime
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    ))
  }

  const parsed = new Date(normalized)
  return Number.isFinite(parsed.getTime()) ? parsed : undefined
}

export function normalizeAsaasDateToIso(value: string | null | undefined): string | undefined {
  return parseAsaasDate(value)?.toISOString()
}

export function getWebhookAmount(event: AsaasWebhookEvent): number | undefined {
  if (typeof event.amount === 'number') {
    return event.amount
  }

  if (typeof event.payment?.amount === 'number') {
    return event.payment.amount
  }

  if (typeof event.payment?.value === 'number') {
    return Math.round(event.payment.value * 100)
  }

  if (typeof event.subscription?.value === 'number') {
    return Math.round(event.subscription.value * 100)
  }

  return undefined
}
