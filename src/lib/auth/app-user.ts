import { auth, getAuth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

import { E2E_AUTH_COOKIE_NAME, resolveE2EAppUser } from '@/lib/auth/e2e-auth'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type { AppUser, AuthProvider, UserStatus } from '@/types/user'

const CLERK_PROVIDER: AuthProvider = 'clerk'

type BootstrapAppUserRow = {
  user_id: string
  user_status: string
  user_created_at: string
  user_updated_at: string
  identity_id: string
  identity_provider: string
  identity_provider_subject: string
  credit_account_id: string
  credit_account_credits_remaining: number
  credit_account_created_at: string
  credit_account_updated_at: string
}

type UserIdentityLookupRow = {
  user_id: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getCookieFromHeader(headerValue: string | null, cookieName: string): string | undefined {
  if (!headerValue) {
    return undefined
  }

  return headerValue
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
}

function readE2EAuthCookieValue(req?: Parameters<typeof getAuth>[0]): string | undefined {
  if (req && 'cookies' in req && typeof req.cookies?.get === 'function') {
    return req.cookies.get(E2E_AUTH_COOKIE_NAME)?.value
  }

  if (req && 'headers' in req && typeof req.headers?.get === 'function') {
    return getCookieFromHeader(req.headers.get('cookie'), E2E_AUTH_COOKIE_NAME)
  }

  try {
    return cookies().get(E2E_AUTH_COOKIE_NAME)?.value
  } catch {
    return undefined
  }
}

function isBootstrapAppUserRow(value: unknown): value is BootstrapAppUserRow {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.user_id === 'string' &&
    typeof value.user_status === 'string' &&
    typeof value.user_created_at === 'string' &&
    typeof value.user_updated_at === 'string' &&
    typeof value.identity_id === 'string' &&
    typeof value.identity_provider === 'string' &&
    typeof value.identity_provider_subject === 'string' &&
    typeof value.credit_account_id === 'string' &&
    typeof value.credit_account_credits_remaining === 'number' &&
    typeof value.credit_account_created_at === 'string' &&
    typeof value.credit_account_updated_at === 'string'
  )
}

function parseUserStatus(status: string): UserStatus {
  if (status === 'active' || status === 'disabled') {
    return status
  }

  throw new Error(`Unsupported user status: ${status}`)
}

function parseAuthProvider(provider: string): AuthProvider {
  if (provider === CLERK_PROVIDER) {
    return provider
  }

  throw new Error(`Unsupported auth provider: ${provider}`)
}

function parseBootstrapAppUser(data: unknown): BootstrapAppUserRow {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('App user bootstrap returned no rows.')
  }

  const [firstRow] = data
  if (!isBootstrapAppUserRow(firstRow)) {
    throw new Error('App user bootstrap returned an invalid payload.')
  }

  return firstRow
}

function mapBootstrapRowToAppUser(row: BootstrapAppUserRow): AppUser {
  const provider = parseAuthProvider(row.identity_provider)

  return {
    id: row.user_id,
    status: parseUserStatus(row.user_status),
    createdAt: new Date(row.user_created_at),
    updatedAt: new Date(row.user_updated_at),
    authIdentity: {
      id: row.identity_id,
      userId: row.user_id,
      provider,
      providerSubject: row.identity_provider_subject,
      createdAt: new Date(row.user_created_at),
      updatedAt: new Date(row.user_updated_at),
    },
    creditAccount: {
      id: row.credit_account_id,
      userId: row.user_id,
      creditsRemaining: row.credit_account_credits_remaining,
      createdAt: new Date(row.credit_account_created_at),
      updatedAt: new Date(row.credit_account_updated_at),
    },
  }
}

export async function getOrCreateAppUserByClerkUserId(clerkUserId: string): Promise<AppUser> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_or_create_app_user', {
    p_provider: CLERK_PROVIDER,
    p_provider_subject: clerkUserId,
  })

  if (error) {
    throw new Error(`Failed to resolve app user: ${error.message}`)
  }

  return mapBootstrapRowToAppUser(parseBootstrapAppUser(data))
}

export async function getCurrentAppUser(req?: Parameters<typeof getAuth>[0]): Promise<AppUser | null> {
  const syntheticE2EUser = await resolveE2EAppUser(readE2EAuthCookieValue(req))
  if (syntheticE2EUser) {
    return syntheticE2EUser
  }

  const { userId: clerkUserId } = req ? getAuth(req) : await auth()
  if (!clerkUserId) {
    return null
  }

  const appUser = await getOrCreateAppUserByClerkUserId(clerkUserId)
  return appUser.status === 'active' ? appUser : null
}

async function findAppUserIdByClerkUserId(clerkUserId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('user_auth_identities')
    .select('user_id')
    .eq('provider', CLERK_PROVIDER)
    .eq('provider_subject', clerkUserId)
    .maybeSingle<UserIdentityLookupRow>()

  if (error) {
    throw new Error(`Failed to find app user identity: ${error.message}`)
  }

  return data?.user_id ?? null
}

async function resolveAppUserIdFromReference(referenceUserId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient()

  const { data: directUser, error: directUserError } = await supabase
    .from('users')
    .select('id')
    .eq('id', referenceUserId)
    .maybeSingle<{ id: string }>()

  if (directUserError) {
    throw new Error(`Failed to resolve app user from reference: ${directUserError.message}`)
  }

  if (directUser?.id) {
    return directUser.id
  }

  return findAppUserIdByClerkUserId(referenceUserId)
}

export async function syncClerkUserProfile(input: {
  clerkUserId: string
  email: string | null
  displayName: string | null
  emailVerifiedAt?: string | null
}): Promise<void> {
  const appUserId = await findAppUserIdByClerkUserId(input.clerkUserId)
  if (!appUserId) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { error: userError } = await supabase
    .from('users')
    .update({
      display_name: input.displayName,
      primary_email: input.email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appUserId)

  if (userError) {
    throw new Error(`Failed to sync app user profile: ${userError.message}`)
  }

  const { error: identityError } = await supabase
    .from('user_auth_identities')
    .update({
      email: input.email,
      email_verified_at: input.emailVerifiedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('provider', CLERK_PROVIDER)
    .eq('provider_subject', input.clerkUserId)

  if (identityError) {
    throw new Error(`Failed to sync app user identity: ${identityError.message}`)
  }
}

export async function disableAppUserByClerkUserId(clerkUserId: string): Promise<void> {
  const appUserId = await findAppUserIdByClerkUserId(clerkUserId)
  if (!appUserId) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('users')
    .update({
      status: 'disabled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appUserId)

  if (error) {
    throw new Error(`Failed to disable app user: ${error.message}`)
  }
}
