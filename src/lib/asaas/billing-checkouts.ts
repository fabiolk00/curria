import { randomUUID } from 'node:crypto'

import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { getPlan, type PlanSlug } from '@/lib/plans'
import { logError, logWarn } from '@/lib/observability/structured-log'

export type BillingCheckoutStatus =
  | 'pending'
  | 'created'
  | 'failed'
  | 'paid'
  | 'subscription_active'
  | 'canceled'

type BillingCheckoutRow = {
  id: string
  user_id: string
  checkout_reference: string
  plan: string
  amount_minor: number
  currency: string
  status: string
  asaas_link: string | null
  asaas_payment_id: string | null
  asaas_subscription_id: string | null
  created_at: string
  updated_at: string
}

export type BillingCheckout = {
  id: string
  userId: string
  checkoutReference: string
  plan: PlanSlug
  amountMinor: number
  currency: string
  status: BillingCheckoutStatus
  asaasLink: string | null
  asaasPaymentId: string | null
  asaasSubscriptionId: string | null
  createdAt: string
  updatedAt: string
}

function toBillingCheckout(row: BillingCheckoutRow): BillingCheckout {
  return {
    id: row.id,
    userId: row.user_id,
    checkoutReference: row.checkout_reference,
    plan: row.plan as PlanSlug,
    amountMinor: row.amount_minor,
    currency: row.currency,
    status: row.status as BillingCheckoutStatus,
    asaasLink: row.asaas_link,
    asaasPaymentId: row.asaas_payment_id,
    asaasSubscriptionId: row.asaas_subscription_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function assertPaidPlan(plan: PlanSlug, amountMinor: number): void {
  const planConfig = getPlan(plan)

  if (!planConfig) {
    throw new Error(`Unknown billing plan: ${plan}`)
  }

  if (planConfig.price <= 0 || amountMinor <= 0) {
    throw new Error(`billing_checkouts only supports paid Asaas plans: ${plan}`)
  }
}

async function updateCheckout(
  checkoutReference: string,
  patch: Partial<Pick<BillingCheckoutRow, 'status' | 'asaas_link' | 'asaas_payment_id' | 'asaas_subscription_id' | 'updated_at'>>,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('billing_checkouts')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('checkout_reference', checkoutReference)

  if (error) {
    throw new Error(`Failed to update billing checkout ${checkoutReference}: ${error.message}`)
  }
}

function generateCheckoutReference(): string {
  return randomUUID()
}

export async function createCheckoutRecordPending(
  userId: string,
  plan: PlanSlug,
  amountMinor: number,
): Promise<BillingCheckout> {
  assertPaidPlan(plan, amountMinor)

  const checkoutReference = generateCheckoutReference()
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const payload = {
    id: createDatabaseId(),
    user_id: userId,
    checkout_reference: checkoutReference,
    plan,
    amount_minor: amountMinor,
    currency: 'BRL',
    status: 'pending',
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('billing_checkouts')
    .insert(payload)
    .select(`
      id,
      user_id,
      checkout_reference,
      plan,
      amount_minor,
      currency,
      status,
      asaas_link,
      asaas_payment_id,
      asaas_subscription_id,
      created_at,
      updated_at
    `)
    .single<BillingCheckoutRow>()

  if (error || !data) {
    throw new Error(`Failed to create pending billing checkout: ${error?.message ?? 'unknown error'}`)
  }

  return toBillingCheckout(data)
}

export async function markCheckoutCreated(
  checkoutReference: string,
  asaasLink: string,
): Promise<void> {
  await updateCheckout(checkoutReference, {
    status: 'created',
    asaas_link: asaasLink,
  })
}

export async function markCheckoutFailed(
  checkoutReference: string,
  reason?: string,
): Promise<void> {
  logWarn('billing.checkout.failed', {
    checkoutReference,
    reason,
    success: false,
  })

  await updateCheckout(checkoutReference, {
    status: 'failed',
  })
}

export async function markCheckoutPaid(
  checkoutReference: string,
  asaasPaymentId: string,
): Promise<void> {
  await updateCheckout(checkoutReference, {
    status: 'paid',
    asaas_payment_id: asaasPaymentId,
  })
}

export async function markCheckoutSubscriptionActive(
  checkoutReference: string,
  asaasSubscriptionId: string,
): Promise<void> {
  await updateCheckout(checkoutReference, {
    status: 'subscription_active',
    asaas_subscription_id: asaasSubscriptionId,
  })
}

export async function markCheckoutCanceled(checkoutReference: string): Promise<void> {
  try {
    await updateCheckout(checkoutReference, {
      status: 'canceled',
    })
  } catch (error) {
    logError('billing.checkout.cancel_mark_failed', {
      checkoutReference,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

export async function markCheckoutCanceledBySubscriptionId(
  asaasSubscriptionId: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('billing_checkouts')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('asaas_subscription_id', asaasSubscriptionId)

  if (error) {
    throw new Error(`Failed to mark billing checkout canceled for subscription ${asaasSubscriptionId}: ${error.message}`)
  }
}

export async function getCheckoutRecord(
  checkoutReference: string,
): Promise<BillingCheckout | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('billing_checkouts')
    .select(`
      id,
      user_id,
      checkout_reference,
      plan,
      amount_minor,
      currency,
      status,
      asaas_link,
      asaas_payment_id,
      asaas_subscription_id,
      created_at,
      updated_at
    `)
    .eq('checkout_reference', checkoutReference)
    .maybeSingle<BillingCheckoutRow>()

  if (error) {
    throw new Error(`Failed to load billing checkout ${checkoutReference}: ${error.message}`)
  }

  return data ? toBillingCheckout(data) : null
}

export async function getCheckoutBySubscriptionId(
  asaasSubscriptionId: string,
): Promise<BillingCheckout | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('billing_checkouts')
    .select(`
      id,
      user_id,
      checkout_reference,
      plan,
      amount_minor,
      currency,
      status,
      asaas_link,
      asaas_payment_id,
      asaas_subscription_id,
      created_at,
      updated_at
    `)
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .maybeSingle<BillingCheckoutRow>()

  if (error) {
    throw new Error(`Failed to load billing checkout for subscription ${asaasSubscriptionId}: ${error.message}`)
  }

  return data ? toBillingCheckout(data) : null
}

export async function getCheckoutByAsaasSessionId(
  asaasSessionId: string,
): Promise<BillingCheckout | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('billing_checkouts')
    .select(`
      id,
      user_id,
      checkout_reference,
      plan,
      amount_minor,
      currency,
      status,
      asaas_link,
      asaas_payment_id,
      asaas_subscription_id,
      created_at,
      updated_at
    `)
    .ilike('asaas_link', `%${asaasSessionId}%`)
    .maybeSingle<BillingCheckoutRow>()

  if (error) {
    throw new Error(`Failed to load billing checkout for Asaas session ${asaasSessionId}: ${error.message}`)
  }

  return data ? toBillingCheckout(data) : null
}
