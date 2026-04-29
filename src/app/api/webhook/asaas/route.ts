import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import {
  getHttpStatusForToolError,
  getToolErrorMessage,
  resolveToolErrorCode,
  TOOL_ERROR_CODES,
  toolFailure,
} from '@/lib/agent/tool-errors'
import { webhookLimiter } from '@/lib/rate-limit'
import {
  handlePaymentSettlement,
  reconcileProcessedEventState,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRenewed,
  handleSubscriptionUpdated,
} from '@/lib/asaas/event-handlers'
import { computeEventFingerprint, getProcessedEvent } from '@/lib/asaas/idempotency'
import {
  isHandledAsaasBillingEvent,
  parseAsaasWebhookEvent,
  type AsaasWebhookEvent,
  type HandledAsaasBillingEventType,
} from '@/lib/asaas/webhook'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

export const runtime = 'nodejs'

type BillingApplyResult = 'processed' | 'duplicate' | 'ignored'
type HandledAsaasWebhookEvent = AsaasWebhookEvent & { event: HandledAsaasBillingEventType }

function getExpectedWebhookToken(): string {
  const trimmed = process.env.ASAAS_WEBHOOK_TOKEN?.trim()

  if (!trimmed) {
    throw new Error('Missing required environment variable ASAAS_WEBHOOK_TOKEN for Asaas webhook.')
  }

  return trimmed
}

function getSafeTokenFingerprint(token: string | null | undefined): string | undefined {
  const trimmed = token?.trim()

  if (!trimmed) {
    return undefined
  }

  return createHash('sha256').update(trimmed).digest('hex').slice(0, 12)
}

async function processAsaasEvent(
  event: HandledAsaasWebhookEvent,
  eventFingerprint: string,
): Promise<BillingApplyResult> {
  switch (event.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return handlePaymentSettlement(event, eventFingerprint)
    case 'SUBSCRIPTION_CREATED':
      return handleSubscriptionCreated(event, eventFingerprint)
    case 'SUBSCRIPTION_UPDATED':
      return handleSubscriptionUpdated(event, eventFingerprint)
    case 'SUBSCRIPTION_RENEWED':
      return handleSubscriptionRenewed(event, eventFingerprint)
    case 'SUBSCRIPTION_INACTIVATED':
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_CANCELED':
      return handleSubscriptionCanceled(event, eventFingerprint)
  }
}

async function reconcileDuplicateEventState(
  event: HandledAsaasWebhookEvent,
  eventFingerprint: string,
): Promise<void> {
  try {
    await reconcileProcessedEventState(event)
  } catch (error) {
    logWarn('asaas.webhook.duplicate_reconcile_failed', {
      eventType: event.event,
      eventFingerprint,
      paymentId: event.payment?.id,
      subscriptionId: event.subscription?.id,
      success: false,
      ...serializeError(error),
    })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawToken = req.headers.get('asaas-access-token')
  const token = rawToken?.trim()
  let expectedToken: string

  try {
    expectedToken = getExpectedWebhookToken()
  } catch (error) {
    const failure = toolFailure(
      TOOL_ERROR_CODES.INTERNAL_ERROR,
      getToolErrorMessage(error) ?? 'Missing webhook configuration.',
    )

    logError('asaas.webhook.config_missing', {
      success: false,
      errorCode: failure.code,
      errorMessage: failure.error,
      ...serializeError(error),
    })

    return NextResponse.json(failure, {
      status: getHttpStatusForToolError(failure.code),
    })
  }

  if (token !== expectedToken) {
    const failure = toolFailure(TOOL_ERROR_CODES.UNAUTHORIZED, 'Unauthorized')

    logWarn('asaas.webhook.unauthorized', {
      success: false,
      errorCode: failure.code,
      errorMessage: failure.error,
      tokenPresent: Boolean(rawToken),
      tokenTrimmedPresent: Boolean(token),
      tokenLength: rawToken?.length ?? 0,
      tokenTrimmedLength: token?.length ?? 0,
      tokenFingerprint: getSafeTokenFingerprint(rawToken),
      expectedTokenLength: expectedToken.length,
      expectedTokenFingerprint: getSafeTokenFingerprint(expectedToken),
    })

    return NextResponse.json(failure, {
      status: getHttpStatusForToolError(failure.code),
    })
  }

  // Rate limit webhook deliveries by token to prevent brute-force and replay attacks
  const { success: rateLimitPassed } = await webhookLimiter.limit(token)
  if (!rateLimitPassed) {
    const failure = toolFailure(TOOL_ERROR_CODES.RATE_LIMITED, 'Webhook rate limit exceeded.')

    logWarn('asaas.webhook.rate_limited', {
      success: false,
      errorCode: failure.code,
      errorMessage: failure.error,
    })

    return NextResponse.json(failure, {
      status: getHttpStatusForToolError(failure.code),
    })
  }

  let event: AsaasWebhookEvent

  try {
    event = parseAsaasWebhookEvent(await req.json())
  } catch (error) {
    const failure = toolFailure(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      getToolErrorMessage(error) ?? 'Invalid webhook payload.',
    )

    logWarn('asaas.webhook.invalid_payload', {
      success: false,
      errorCode: failure.code,
      errorMessage: failure.error,
      ...serializeError(error),
    })

    return NextResponse.json(failure, {
      status: getHttpStatusForToolError(failure.code),
    })
  }

  if (!isHandledAsaasBillingEvent(event.event)) {
    logInfo('asaas.webhook.ignored', {
      eventType: event.event,
      success: true,
      processedStatus: 'ignored',
    })

    return NextResponse.json({ success: true, ignored: true })
  }

  const handledEvent = event as HandledAsaasWebhookEvent
  const eventFingerprint = computeEventFingerprint(handledEvent)

  try {
    const alreadyProcessed = await getProcessedEvent(eventFingerprint)
    if (alreadyProcessed) {
      await reconcileDuplicateEventState(handledEvent, eventFingerprint)

      logInfo('asaas.webhook.duplicate_skipped', {
        eventType: handledEvent.event,
        eventFingerprint,
        paymentId: handledEvent.payment?.id,
        subscriptionId: handledEvent.subscription?.id,
        success: true,
        processedStatus: 'skipped_duplicate',
      })

      return NextResponse.json({ success: true, cached: true })
    }

    const result = await processAsaasEvent(handledEvent, eventFingerprint)

    if (result === 'duplicate') {
      await reconcileDuplicateEventState(handledEvent, eventFingerprint)

      logInfo('asaas.webhook.duplicate_skipped', {
        eventType: handledEvent.event,
        eventFingerprint,
        paymentId: handledEvent.payment?.id,
        subscriptionId: handledEvent.subscription?.id,
        success: true,
        processedStatus: 'skipped_duplicate',
      })

      return NextResponse.json({ success: true, cached: true })
    }

    if (result === 'ignored') {
      logInfo('asaas.webhook.ignored', {
        eventType: handledEvent.event,
        eventFingerprint,
        paymentId: handledEvent.payment?.id,
        subscriptionId: handledEvent.subscription?.id,
        success: true,
        processedStatus: 'ignored',
      })

      return NextResponse.json({ success: true, ignored: true })
    }

    logInfo('asaas.webhook.processed', {
      eventType: handledEvent.event,
      eventFingerprint,
      paymentId: handledEvent.payment?.id,
      subscriptionId: handledEvent.subscription?.id,
      success: true,
      processedStatus: 'processed',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorCode = resolveToolErrorCode(error, TOOL_ERROR_CODES.INTERNAL_ERROR)
    const errorMessage = getToolErrorMessage(error) ?? 'Failed to process webhook event.'

    logError('asaas.webhook.failed', {
      eventType: handledEvent.event,
      eventFingerprint,
      paymentId: handledEvent.payment?.id,
      subscriptionId: handledEvent.subscription?.id,
      success: false,
      processedStatus: 'failed',
      errorCode,
      errorMessage,
      ...serializeError(error),
    })

    return NextResponse.json(
      toolFailure(errorCode, errorMessage),
      { status: getHttpStatusForToolError(errorCode) },
    )
  }
}
