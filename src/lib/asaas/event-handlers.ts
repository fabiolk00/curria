import { getHttpStatusForToolError, TOOL_ERROR_CODES, type ToolErrorCode } from '@/lib/agent/tool-errors'
import {
  getPersistedSubscriptionMetadata,
  grantCreditsForEvent,
  updateSubscriptionMetadataForEvent,
} from '@/lib/asaas/credit-grants'
import {
  getCheckoutRecord,
  markCheckoutCanceledBySubscriptionId,
  markCheckoutPaid,
  markCheckoutSubscriptionActive,
  type BillingCheckout,
} from '@/lib/asaas/billing-checkouts'
import {
  parseExternalReference,
  type ParsedExternalReference,
} from '@/lib/asaas/external-reference'
import { getWebhookAmount, type AsaasWebhookEvent } from '@/lib/asaas/webhook'
import { logInfo, logWarn } from '@/lib/observability/structured-log'

type BillingApplyResult = 'processed' | 'duplicate'
type BillingError = Error & {
  code: ToolErrorCode
  status: number
}

function createBillingError(code: ToolErrorCode, message: string): BillingError {
  const error = new Error(message) as BillingError
  error.code = code
  error.status = getHttpStatusForToolError(code)
  return error
}

function requireExternalReference(
  value: string | undefined,
  entityLabel: 'Payment' | 'Subscription',
): string {
  if (!value) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `${entityLabel} is missing externalReference.`,
    )
  }

  return value
}

function requireAmount(event: AsaasWebhookEvent, context: string): number {
  const amount = getWebhookAmount(event)

  if (typeof amount !== 'number') {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `${context} is missing amount.`,
    )
  }

  return amount
}

function requireFutureRenewalDate(value: string | undefined, context: string): string {
  if (!value) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `${context} is missing nextDueDate.`,
    )
  }

  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `${context} must be a future renewal date.`,
    )
  }

  return value
}

function parseExternalReferenceStrict(
  value: string,
  eventType: AsaasWebhookEvent['event'],
): ParsedExternalReference {
  const parsed = parseExternalReference(value)
  if (!parsed) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Invalid externalReference format.',
    )
  }

  if (parsed.version === 'legacy') {
    logWarn('billing.legacy_webhook_path', {
      eventType,
      appUserId: parsed.appUserId,
      success: false,
    })
  }

  return parsed
}

function assertInitialCheckout(
  checkout: BillingCheckout | null,
  parsedReference: ParsedExternalReference,
  expectedStatus: 'created',
  expectedBilling: 'once' | 'monthly',
  amountMinor: number,
): BillingCheckout {
  if (!checkout) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Billing checkout record not found for externalReference.',
    )
  }

  if (parsedReference.version !== 'v1') {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Legacy externalReference is not accepted for this event type.',
    )
  }

  if (checkout.userId !== parsedReference.appUserId) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Billing checkout does not match the referenced user.',
    )
  }

  if (checkout.checkoutReference !== parsedReference.checkoutReference) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Billing checkout does not match the referenced checkout.',
    )
  }

  if (checkout.status !== expectedStatus) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `Billing checkout must be in ${expectedStatus} status.`,
    )
  }

  if (checkout.amountMinor !== amountMinor) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Webhook amount does not match the billing checkout amount.',
    )
  }

  if (expectedBilling === 'once' && checkout.plan !== 'unit') {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'One-time payments must resolve to the unit plan.',
    )
  }

  if (expectedBilling === 'monthly' && checkout.plan !== 'monthly' && checkout.plan !== 'pro') {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'Recurring subscriptions must resolve to a monthly billing plan.',
    )
  }

  return checkout
}

export async function handlePaymentReceived(
  event: AsaasWebhookEvent,
  eventFingerprint: string,
): Promise<BillingApplyResult> {
  const payment = event.payment

  if (!payment) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'PAYMENT_RECEIVED event is missing payment.',
    )
  }

  const externalReference = requireExternalReference(payment.externalReference, 'Payment')
  const parsedReference = parseExternalReferenceStrict(externalReference, event.event)
  const amountMinor = requireAmount(event, 'Payment event')
  const checkout = assertInitialCheckout(
    await getCheckoutRecord(parsedReference.checkoutReference ?? ''),
    parsedReference,
    'created',
    'once',
    amountMinor,
  )

  const result = await grantCreditsForEvent({
    appUserId: checkout.userId,
    eventFingerprint,
    eventPayload: event,
    plan: checkout.plan,
    amountMinor: checkout.amountMinor,
    checkoutReference: checkout.checkoutReference,
    reason: 'payment_received',
  })

  if (result === 'processed') {
    await markCheckoutPaid(checkout.checkoutReference, payment.id)
  }

  return result
}

export async function handleSubscriptionCreated(
  event: AsaasWebhookEvent,
  eventFingerprint: string,
): Promise<BillingApplyResult> {
  const subscription = event.subscription

  if (!subscription) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'SUBSCRIPTION_CREATED event is missing subscription.',
    )
  }

  const externalReference = requireExternalReference(subscription.externalReference, 'Subscription')
  const parsedReference = parseExternalReferenceStrict(externalReference, event.event)
  const amountMinor = requireAmount(event, 'Subscription event')
  const renewsAt = requireFutureRenewalDate(subscription.nextDueDate, 'Subscription event')
  const checkout = assertInitialCheckout(
    await getCheckoutRecord(parsedReference.checkoutReference ?? ''),
    parsedReference,
    'created',
    'monthly',
    amountMinor,
  )

  const result = await grantCreditsForEvent({
    appUserId: checkout.userId,
    eventFingerprint,
    eventPayload: event,
    plan: checkout.plan,
    amountMinor: checkout.amountMinor,
    checkoutReference: checkout.checkoutReference,
    asaasSubscriptionId: subscription.id,
    renewsAt,
    reason: 'subscription_created',
  })

  if (result === 'processed') {
    await markCheckoutSubscriptionActive(checkout.checkoutReference, subscription.id)
  }

  return result
}

export async function handleSubscriptionRenewed(
  event: AsaasWebhookEvent,
  eventFingerprint: string,
): Promise<BillingApplyResult> {
  const subscription = event.subscription

  if (!subscription) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      'SUBSCRIPTION_RENEWED event is missing subscription.',
    )
  }

  const renewsAt = requireFutureRenewalDate(subscription.nextDueDate, 'Subscription renewal event')
  const persisted = await getPersistedSubscriptionMetadata(subscription.id)

  if (!persisted) {
    throw createBillingError(
      TOOL_ERROR_CODES.NOT_FOUND,
      `No persisted subscription metadata was found for subscription ${subscription.id}.`,
    )
  }

  logInfo('billing.subscription_renewal.resolved', {
    asaasSubscriptionId: subscription.id,
    appUserId: persisted.appUserId,
    plan: persisted.plan,
    success: true,
  })

  return grantCreditsForEvent({
    appUserId: persisted.appUserId,
    eventFingerprint,
    eventPayload: event,
    plan: persisted.plan,
    asaasSubscriptionId: subscription.id,
    renewsAt,
    reason: 'subscription_renewed',
  })
}

export async function handleSubscriptionCanceled(
  event: AsaasWebhookEvent,
  eventFingerprint: string,
): Promise<BillingApplyResult> {
  const subscription = event.subscription

  if (!subscription) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `${event.event} event is missing subscription.`,
    )
  }

  const persisted = await getPersistedSubscriptionMetadata(subscription.id)

  if (!persisted) {
    throw createBillingError(
      TOOL_ERROR_CODES.NOT_FOUND,
      `No persisted subscription metadata was found for subscription ${subscription.id}.`,
    )
  }

  const result = await updateSubscriptionMetadataForEvent({
    appUserId: persisted.appUserId,
    eventFingerprint,
    eventPayload: event,
    plan: persisted.plan,
    asaasSubscriptionId: subscription.id,
    renewsAt: null,
    status: 'canceled',
    reason: event.event === 'SUBSCRIPTION_DELETED'
      ? 'subscription_deleted'
      : 'subscription_canceled',
  })

  if (result === 'processed') {
    await markCheckoutCanceledBySubscriptionId(subscription.id)
  }

  return result
}
