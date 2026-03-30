import { NextRequest, NextResponse } from 'next/server'

import {
  getHttpStatusForToolError,
  getToolErrorMessage,
  resolveToolErrorCode,
  TOOL_ERROR_CODES,
  toolFailure,
} from '@/lib/agent/tool-errors'
import {
  handlePaymentReceived,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRenewed,
} from '@/lib/asaas/event-handlers'
import { computeEventFingerprint, getProcessedEvent } from '@/lib/asaas/idempotency'
import { parseAsaasWebhookEvent, type AsaasWebhookEvent } from '@/lib/asaas/webhook'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

export const runtime = 'nodejs'

type BillingApplyResult = 'processed' | 'duplicate'

function getExpectedWebhookToken(): string | undefined {
  return process.env.ASAAS_WEBHOOK_TOKEN ?? process.env.ASAAS_ACCESS_TOKEN
}

async function processAsaasEvent(
  event: AsaasWebhookEvent,
  eventFingerprint: string,
): Promise<BillingApplyResult> {
  switch (event.event) {
    case 'PAYMENT_RECEIVED':
      return handlePaymentReceived(event, eventFingerprint)
    case 'SUBSCRIPTION_CREATED':
      return handleSubscriptionCreated(event, eventFingerprint)
    case 'SUBSCRIPTION_RENEWED':
      return handleSubscriptionRenewed(event, eventFingerprint)
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_CANCELED':
      return handleSubscriptionCanceled(event, eventFingerprint)
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('asaas-access-token')
  const expectedToken = getExpectedWebhookToken()

  if (!expectedToken || token !== expectedToken) {
    const failure = toolFailure(TOOL_ERROR_CODES.UNAUTHORIZED, 'Unauthorized')

    logWarn('asaas.webhook.unauthorized', {
      success: false,
      errorCode: failure.code,
      errorMessage: failure.error,
    })

    return NextResponse.json(failure, {
      status: getHttpStatusForToolError(failure.code),
    })
  }

  let event: AsaasWebhookEvent
  let eventFingerprint: string

  try {
    event = parseAsaasWebhookEvent(await req.json())
    eventFingerprint = computeEventFingerprint(event)
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

  try {
    const alreadyProcessed = await getProcessedEvent(eventFingerprint)
    if (alreadyProcessed) {
      logInfo('asaas.webhook.duplicate_skipped', {
        eventType: event.event,
        eventFingerprint,
        paymentId: event.payment?.id,
        subscriptionId: event.subscription?.id,
        success: true,
        processedStatus: 'skipped_duplicate',
      })

      return NextResponse.json({ success: true, cached: true })
    }

    const result = await processAsaasEvent(event, eventFingerprint)

    if (result === 'duplicate') {
      logInfo('asaas.webhook.duplicate_skipped', {
        eventType: event.event,
        eventFingerprint,
        paymentId: event.payment?.id,
        subscriptionId: event.subscription?.id,
        success: true,
        processedStatus: 'skipped_duplicate',
      })

      return NextResponse.json({ success: true, cached: true })
    }

    logInfo('asaas.webhook.processed', {
      eventType: event.event,
      eventFingerprint,
      paymentId: event.payment?.id,
      subscriptionId: event.subscription?.id,
      success: true,
      processedStatus: 'processed',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorCode = resolveToolErrorCode(error, TOOL_ERROR_CODES.INTERNAL_ERROR)
    const errorMessage = getToolErrorMessage(error) ?? 'Failed to process webhook event.'

    logError('asaas.webhook.failed', {
      eventType: event.event,
      eventFingerprint,
      paymentId: event.payment?.id,
      subscriptionId: event.subscription?.id,
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
