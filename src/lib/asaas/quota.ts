import { PLANS, type PlanSlug } from '@/lib/plans'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'

type CreditAccountRow = {
  credits_remaining: number
}

type UserQuotaOwnerRow = {
  user_id: string
}

type UserQuotaBillingRow = {
  plan: string | null
  credits_remaining: number | null
  renews_at: string | null
  status: string | null
  asaas_subscription_id: string | null
}

export type BillingStatus = 'active' | 'canceled' | 'past_due'

export type UserBillingInfo = {
  plan: PlanSlug
  creditsRemaining: number
  maxCredits: number
  renewsAt: string | null
  status: BillingStatus | null
  asaasSubscriptionId: string | null
  hasActiveRecurringSubscription: boolean
}

export type ActiveRecurringSubscription = {
  plan: 'monthly' | 'pro'
  asaasSubscriptionId: string
  renewsAt: string | null
}

function buildCreditAccountId(appUserId: string): string {
  return `cred_${appUserId}`
}

function resolvePlanSlug(value: string | null): PlanSlug | null {
  if (!value) {
    return null
  }

  return value in PLANS ? (value as PlanSlug) : null
}

function normalizeBillingStatus(value: string | null): BillingStatus | null {
  if (value === 'active' || value === 'canceled' || value === 'past_due') {
    return value
  }

  return null
}

async function setCreditBalance(appUserId: string, creditsRemaining: number): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('credit_accounts').upsert(
    {
      id: buildCreditAccountId(appUserId),
      user_id: appUserId,
      credits_remaining: creditsRemaining,
      ...createUpdatedAtTimestamp(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    throw new Error(`Failed to persist credit balance: ${error.message}`)
  }
}

export async function grantCredits(
  appUserId: string,
  plan: PlanSlug,
  asaasSubscriptionId?: string,
): Promise<void> {
  const planConfig = PLANS[plan]
  const renewsAt = planConfig.billing === 'monthly'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  await setCreditBalance(appUserId, planConfig.credits)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('user_quotas').upsert(
    {
      user_id: appUserId,
      plan,
      credits_remaining: planConfig.credits,
      asaas_subscription_id: asaasSubscriptionId ?? null,
      renews_at: renewsAt,
      status: 'active',
      ...createUpdatedAtTimestamp(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    throw new Error(`Failed to grant credits: ${error.message}`)
  }
}

export async function consumeCredit(appUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  // Primary path: use the Postgres RPC for atomic single-row consumption.
  // Fallback path keeps optimistic locking semantics if the RPC is unavailable.

  const { data: rpcResult, error: rpcError } = await supabase.rpc('consume_credit_atomic', {
    p_user_id: appUserId,
  })

  // Fallback if RPC function doesn't exist: use optimistic locking
  // This is not perfectly atomic but much better than the previous implementation
  if (rpcError && rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
    // Read current credits
    const { data: quotaData } = await supabase
      .from('credit_accounts')
      .select('credits_remaining')
      .eq('user_id', appUserId)
      .single<CreditAccountRow>()

    if (!quotaData || quotaData.credits_remaining <= 0) return false

    // Attempt atomic decrement using WHERE clause with optimistic locking
    // UPDATE credit_accounts SET credits_remaining = credits_remaining - 1
    // WHERE user_id = X AND credits_remaining = Y (current value)
    const { data: updateData, error: updateError } = await supabase
      .from('credit_accounts')
      .update({
        credits_remaining: quotaData.credits_remaining - 1,
        ...createUpdatedAtTimestamp(),
      })
      .eq('user_id', appUserId)
      .eq('credits_remaining', quotaData.credits_remaining)
      .select('credits_remaining')

    // If no data returned, credits changed between read and write (race condition detected)
    // The update failed because another request modified credits_remaining
    return !updateError && updateData !== null && updateData.length > 0
  }

  if (rpcError) return false
  return rpcResult === true
}

export async function revokeSubscription(asaasSubscriptionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('user_quotas')
    .update({
      renews_at: null,
      status: 'canceled',
      ...createUpdatedAtTimestamp(),
    })
    .eq('asaas_subscription_id', asaasSubscriptionId)

  if (error) {
    throw new Error(`Failed to revoke subscription: ${error.message}`)
  }
}

export async function getUserIdByCustomer(asaasCustomerId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('user_quotas')
    .select('user_id')
    .eq('asaas_customer_id', asaasCustomerId)
    .single<UserQuotaOwnerRow>()

  return data?.user_id ?? null
}

export async function checkUserQuota(appUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('credit_accounts')
    .select('credits_remaining')
    .eq('user_id', appUserId)
    .single<CreditAccountRow>()

  if (!data) return false
  return data.credits_remaining > 0
}

export async function getActiveRecurringSubscription(
  appUserId: string,
): Promise<ActiveRecurringSubscription | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('user_quotas')
    .select('plan, renews_at, status, asaas_subscription_id')
    .eq('user_id', appUserId)
    .maybeSingle<UserQuotaBillingRow>()

  if (error) {
    throw new Error(`Failed to load recurring subscription state: ${error.message}`)
  }

  const plan = resolvePlanSlug(data?.plan ?? null)
  const status = normalizeBillingStatus(data?.status ?? null)

  if (!plan || PLANS[plan].billing !== 'monthly' || status !== 'active' || !data?.asaas_subscription_id) {
    return null
  }

  if (plan !== 'monthly' && plan !== 'pro') {
    return null
  }

  return {
    plan,
    asaasSubscriptionId: data.asaas_subscription_id,
    renewsAt: data.renews_at,
  }
}

export async function getUserBillingInfo(appUserId: string): Promise<UserBillingInfo | null> {
  const supabase = getSupabaseAdminClient()
  const [quotaResult, creditResult] = await Promise.all([
    supabase
      .from('user_quotas')
      .select('plan, credits_remaining, renews_at, status, asaas_subscription_id')
      .eq('user_id', appUserId)
      .maybeSingle<UserQuotaBillingRow>(),
    supabase
      .from('credit_accounts')
      .select('credits_remaining')
      .eq('user_id', appUserId)
      .maybeSingle<CreditAccountRow>(),
  ])

  if (quotaResult.error) {
    throw new Error(`Failed to load billing metadata: ${quotaResult.error.message}`)
  }

  if (creditResult.error) {
    throw new Error(`Failed to load credit balance: ${creditResult.error.message}`)
  }

  const quotaData = quotaResult.data
  const creditData = creditResult.data
  const plan = resolvePlanSlug(quotaData?.plan ?? null)

  if (!plan || !quotaData || !creditData) {
    return null
  }

  const status = normalizeBillingStatus(quotaData.status)
  const hasActiveRecurringSubscription =
    PLANS[plan].billing === 'monthly' &&
    status === 'active' &&
    typeof quotaData.asaas_subscription_id === 'string' &&
    quotaData.asaas_subscription_id.length > 0
  const maxCredits = Math.max(
    quotaData.credits_remaining ?? 0,
    creditData.credits_remaining,
    PLANS[plan].credits,
  )

  return {
    plan,
    creditsRemaining: creditData.credits_remaining,
    maxCredits,
    renewsAt: quotaData.renews_at,
    status,
    asaasSubscriptionId: quotaData.asaas_subscription_id,
    hasActiveRecurringSubscription,
  }
}
