import { createHash } from 'node:crypto'

import { parseExternalReference } from '@/lib/asaas/external-reference'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type { AsaasWebhookEvent } from '@/lib/asaas/webhook'

type ProcessedEventLookupRow = {
  id: string
}

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue)
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).map(([key, nestedValue]) => [key, toJsonValue(nestedValue)] as const)
    return Object.fromEntries(entries)
  }

  throw new Error('Asaas webhook payload contains an unsupported value.')
}

function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  const sortedKeys = Object.keys(value).sort()
  const serializedEntries = sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
  return `{${serializedEntries.join(',')}}`
}

function normalizeExternalReference(value: string | undefined): JsonValue {
  if (!value) {
    return null
  }

  const parsed = parseExternalReference(value)
  if (!parsed) {
    return {
      raw: value,
      version: null,
      appUserId: null,
      checkoutReference: null,
    }
  }

  return {
    raw: null,
    version: parsed.version,
    appUserId: parsed.appUserId,
    checkoutReference: parsed.checkoutReference ?? null,
  }
}

export function computeEventFingerprint(event: AsaasWebhookEvent): string {
  const payload = {
    event: event.event,
    amount: event.amount ?? event.payment?.amount ?? null,
    payment: event.payment
      ? {
          id: event.payment.id,
          externalReference: normalizeExternalReference(event.payment.externalReference),
          subscription: event.payment.subscription ?? null,
          amount: event.payment.amount ?? null,
        }
      : null,
    subscription: event.subscription
      ? {
          id: event.subscription.id,
          externalReference: normalizeExternalReference(event.subscription.externalReference),
          status: event.subscription.status ?? null,
          nextDueDate: event.subscription.nextDueDate ?? null,
        }
      : null,
  } satisfies JsonValue

  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

export async function getProcessedEvent(fingerprint: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('processed_events')
    .select('id')
    .eq('event_fingerprint', fingerprint)
    .maybeSingle<ProcessedEventLookupRow>()

  if (error) {
    throw new Error(`Failed to check processed events: ${error.message}`)
  }

  return Boolean(data?.id)
}

export async function recordProcessedEvent(
  fingerprint: string,
  event: AsaasWebhookEvent,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('processed_events')
    .insert({
      event_id: fingerprint,
      event_fingerprint: fingerprint,
      event_type: event.event,
      event_payload: event,
      processed_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(`Failed to record processed event: ${error.message}`)
  }
}
