import {
  getHttpStatusForToolError,
  TOOL_ERROR_CODES,
  type ToolErrorCode,
} from '@/lib/agent/tool-errors'
import type { AsaasWebhookEvent } from '@/lib/asaas/webhook'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import { getPlan, type PlanSlug } from '@/lib/plans'

type BillingApplyResult = 'processed' | 'duplicate'
export type BillingStatus = 'active' | 'canceled' | 'past_due'
type BillingCreditGrantEventType =
  | 'PAYMENT_SETTLED'
  | 'SUBSCRIPTION_STARTED'
  | 'SUBSCRIPTION_RENEWED'
type BillingSubscriptionMetadataEventType =
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELED'

type PersistedPlanRow = {
  plan: string
}

type PersistedSubscriptionRow = {
  user_id: string | null
  plan: string | null
  asaas_subscription_id: string | null
  renews_at: string | null
  status: string | null
}

type BillingError = Error & {
  code: ToolErrorCode
  status: number
}

type PersistedSubscriptionMetadata = {
  appUserId: string
  plan: PlanSlug
  asaasSubscriptionId: string
  renewsAt: string | null
  status: string
}

type CreditGrantRequest = {
  appUserId: string
  eventFingerprint: string
  eventPayload: AsaasWebhookEvent
  billingEventType: BillingCreditGrantEventType
  plan: PlanSlug
  amountMinor?: number | null
  checkoutReference?: string | null
  asaasSubscriptionId?: string
  renewsAt?: string | null
  isRenewal?: boolean
  reason:
    | 'payment_confirmed'
    | 'payment_received'
    | 'subscription_started'
    | 'subscription_renewed'
}

type SubscriptionMetadataUpdateRequest = {
  appUserId: string
  eventFingerprint: string
  eventPayload: AsaasWebhookEvent
  billingEventType: BillingSubscriptionMetadataEventType
  plan: PlanSlug
  checkoutReference?: string | null
  asaasSubscriptionId?: string
  renewsAt?: string | null
  status: BillingStatus
  reason:
    | 'subscription_deleted'
    | 'subscription_canceled'
    | 'subscription_inactivated'
    | 'subscription_updated'
}

function createBillingError(code: ToolErrorCode, message: string): BillingError {
  const error = new Error(message) as BillingError
  error.code = code
  error.status = getHttpStatusForToolError(code)
  return error
}

function assertBillingApplyResult(value: unknown, context: string): BillingApplyResult {
  if (value === 'processed' || value === 'duplicate') {
    return value
  }

  throw new Error(`Unexpected billing rpc result for ${context}.`)
}

export async function getPersistedPlan(appUserId: string): Promise<PlanSlug | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('user_quotas')
    .select('plan')
    .eq('user_id', appUserId)
    .maybeSingle<PersistedPlanRow>()

  if (error) {
    throw new Error(`Failed to load billing metadata: ${error.message}`)
  }

  if (!data?.plan) {
    return null
  }

  const plan = getPlan(data.plan)
  return plan?.slug ?? null
}

export async function getPersistedSubscriptionMetadata(
  asaasSubscriptionId: string,
): Promise<PersistedSubscriptionMetadata | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('user_quotas')
    .select('user_id, plan, asaas_subscription_id, renews_at, status')
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .maybeSingle<PersistedSubscriptionRow>()

  if (error) {
    throw new Error(`Failed to load persisted subscription metadata: ${error.message}`)
  }

  if (!data || !data.plan || !data.asaas_subscription_id || !data.user_id) {
    logWarn('billing.pre_cutover_missing_metadata', {
      asaasSubscriptionId,
      hasRow: Boolean(data),
      hasPlan: Boolean(data?.plan),
      hasSubscriptionId: Boolean(data?.asaas_subscription_id),
      hasUserId: Boolean(data?.user_id),
      success: false,
    })
    return null
  }

  const plan = getPlan(data.plan)
  if (!plan) {
    logWarn('billing.pre_cutover_invalid_plan_metadata', {
      asaasSubscriptionId,
      plan: data.plan,
      success: false,
    })
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `Plan not found: ${data.plan}`,
    )
  }

  return {
    appUserId: data.user_id,
    plan: plan.slug,
    asaasSubscriptionId: data.asaas_subscription_id,
    renewsAt: data.renews_at,
    status: data.status ?? 'active',
  }
}

export async function grantCreditsForEvent(request: CreditGrantRequest): Promise<BillingApplyResult> {
  const plan = getPlan(request.plan)

  if (!plan) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `Plan not found: ${request.plan}`,
    )
  }

  const supabase = getSupabaseAdminClient()
  const isRenewal = request.isRenewal ?? false

  const { data, error } = await supabase.rpc('apply_billing_credit_grant_event', {
    p_app_user_id: request.appUserId,
    p_plan: request.plan,
    p_credits: plan.credits,
    p_amount_minor: request.amountMinor ?? plan.price,
    p_checkout_reference: request.checkoutReference ?? null,
    p_asaas_subscription_id: request.asaasSubscriptionId ?? null,
    p_renews_at: request.renewsAt ?? null,
    p_status: 'active',
    p_event_fingerprint: request.eventFingerprint,
    p_event_type: request.billingEventType,
    p_event_payload: request.eventPayload,
    p_is_renewal: isRenewal,
  })

  if (error) {
    throw new Error(`Failed to grant credits: ${error.message}`)
  }

  const result = assertBillingApplyResult(data, 'credit grant')

  if (result === 'processed') {
    logInfo('billing.credits_granted', {
      appUserId: request.appUserId,
      plan: request.plan,
      credits: plan.credits,
      rawEventType: request.eventPayload.event,
      billingEventType: request.billingEventType,
      isRenewal,
      reason: request.reason,
      checkoutReference: request.checkoutReference,
      asaasSubscriptionId: request.asaasSubscriptionId,
    })
  }

  return result
}

export async function updateSubscriptionMetadataForEvent(
  request: SubscriptionMetadataUpdateRequest,
): Promise<BillingApplyResult> {
  const plan = getPlan(request.plan)

  if (!plan) {
    throw createBillingError(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
      `Plan not found: ${request.plan}`,
    )
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.rpc('apply_billing_subscription_metadata_event', {
    p_app_user_id: request.appUserId,
    p_plan: request.plan,
    p_checkout_reference: request.checkoutReference ?? null,
    p_asaas_subscription_id: request.asaasSubscriptionId ?? null,
    p_renews_at: request.renewsAt ?? null,
    p_status: request.status,
    p_event_fingerprint: request.eventFingerprint,
    p_event_type: request.billingEventType,
    p_event_payload: request.eventPayload,
  })

  if (error) {
    throw new Error(`Failed to update subscription metadata: ${error.message}`)
  }

  const result = assertBillingApplyResult(data, 'subscription metadata')

  if (result === 'processed') {
    logInfo('billing.subscription_metadata_updated', {
      appUserId: request.appUserId,
      plan: request.plan,
      rawEventType: request.eventPayload.event,
      billingEventType: request.billingEventType,
      reason: request.reason,
      status: request.status,
      checkoutReference: request.checkoutReference,
      asaasSubscriptionId: request.asaasSubscriptionId,
    })
  }

  return result
}
