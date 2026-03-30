import { PLANS, type PlanSlug } from '@/lib/plans'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

type CreditAccountRow = {
  credits_remaining: number
}

type UserQuotaOwnerRow = {
  user_id: string
}

function buildCreditAccountId(appUserId: string): string {
  return `cred_${appUserId}`
}

async function setCreditBalance(appUserId: string, creditsRemaining: number): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('credit_accounts').upsert(
    {
      id: buildCreditAccountId(appUserId),
      user_id: appUserId,
      credits_remaining: creditsRemaining,
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
      asaas_subscription_id: asaasSubscriptionId ?? null,
      renews_at: renewsAt,
      status: 'active',
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
      })
      .eq('user_id', appUserId)
      .eq('credits_remaining', quotaData.credits_remaining)  // Optimistic lock: only update if value hasn't changed
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
