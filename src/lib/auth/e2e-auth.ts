import type { AppUser } from '@/types/user'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export const E2E_AUTH_COOKIE_NAME = 'curria_e2e_auth'

const DEFAULT_CREDITS_REMAINING = 5
const E2E_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8

export type E2EAuthPayload = {
  appUserId: string
  displayName?: string
  primaryEmail?: string
  creditsRemaining: number
  issuedAt: string
}

type E2EAuthBootstrapInput = {
  appUserId: string
  displayName?: string | null
  primaryEmail?: string | null
  creditsRemaining?: number
  issuedAt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function base64Encode(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    return btoa(binary)
  }

  return Buffer.from(bytes).toString('base64')
}

function base64Decode(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  }

  return new Uint8Array(Buffer.from(value, 'base64'))
}

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : value
  return base64Encode(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const remainder = value.length % 4
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(remainder === 0 ? value.length : value.length + (4 - remainder), '=')

  return base64Decode(normalized)
}

function normalizeIssuedAt(value?: string): string {
  if (!value) {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

function normalizeCreditsRemaining(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CREDITS_REMAINING
  }

  return Math.max(0, Math.trunc(value))
}

function normalizePayload(input: E2EAuthBootstrapInput): E2EAuthPayload {
  const appUserId = input.appUserId.trim()
  if (!appUserId) {
    throw new Error('E2E auth payload requires a non-empty appUserId.')
  }

  return {
    appUserId,
    displayName: input.displayName?.trim() || undefined,
    primaryEmail: input.primaryEmail?.trim() || undefined,
    creditsRemaining: normalizeCreditsRemaining(input.creditsRemaining),
    issuedAt: normalizeIssuedAt(input.issuedAt),
  }
}

function isE2EAuthPayload(value: unknown): value is E2EAuthPayload {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.appUserId === 'string'
    && value.appUserId.length > 0
    && typeof value.creditsRemaining === 'number'
    && Number.isFinite(value.creditsRemaining)
    && typeof value.issuedAt === 'string'
    && (value.displayName === undefined || typeof value.displayName === 'string')
    && (value.primaryEmail === undefined || typeof value.primaryEmail === 'string')
  )
}

function createSyntheticAppUser(payload: E2EAuthPayload): AppUser {
  const timestamp = new Date(payload.issuedAt)

  return {
    id: payload.appUserId,
    status: 'active',
    displayName: payload.displayName,
    primaryEmail: payload.primaryEmail,
    createdAt: timestamp,
    updatedAt: timestamp,
    authIdentity: {
      id: `identity_${payload.appUserId}`,
      userId: payload.appUserId,
      provider: 'clerk',
      providerSubject: payload.appUserId,
      email: payload.primaryEmail,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    creditAccount: {
      id: `cred_${payload.appUserId}`,
      userId: payload.appUserId,
      creditsRemaining: payload.creditsRemaining,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export function isE2EAuthEnabled(envValue = process.env.E2E_AUTH_ENABLED): boolean {
  return envValue?.trim().toLowerCase() === 'true'
}

export function getRequiredE2EAuthSecret(envValue = process.env.E2E_AUTH_BYPASS_SECRET): string {
  const trimmed = envValue?.trim()

  if (!trimmed) {
    throw new Error(
      'Missing required environment variable E2E_AUTH_BYPASS_SECRET when E2E auth is enabled.',
    )
  }

  return trimmed
}

export function assertE2EAuthConfigured(
  enabledEnvValue = process.env.E2E_AUTH_ENABLED,
  secretEnvValue = process.env.E2E_AUTH_BYPASS_SECRET,
): void {
  if (!isE2EAuthEnabled(enabledEnvValue)) {
    return
  }

  getRequiredE2EAuthSecret(secretEnvValue)
}

export async function createSignedE2EAuthCookie(
  input: E2EAuthBootstrapInput,
  secret = getRequiredE2EAuthSecret(),
): Promise<string> {
  const payload = normalizePayload(input)
  const payloadSegment = encodeBase64Url(JSON.stringify(payload))
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    await getSigningKey(secret),
    textEncoder.encode(payloadSegment),
  )
  const signatureSegment = encodeBase64Url(new Uint8Array(signatureBuffer))

  return `${payloadSegment}.${signatureSegment}`
}

export async function verifySignedE2EAuthCookie(
  cookieValue: string | null | undefined,
  enabledEnvValue = process.env.E2E_AUTH_ENABLED,
  secretEnvValue = process.env.E2E_AUTH_BYPASS_SECRET,
): Promise<E2EAuthPayload | null> {
  if (!isE2EAuthEnabled(enabledEnvValue) || !cookieValue) {
    return null
  }

  const [payloadSegment, signatureSegment, extraSegment] = cookieValue.split('.')
  if (!payloadSegment || !signatureSegment || extraSegment) {
    return null
  }

  const secret = getRequiredE2EAuthSecret(secretEnvValue)
  const signatureBytes = decodeBase64Url(signatureSegment) as BufferSource
  const isValidSignature = await crypto.subtle.verify(
    'HMAC',
    await getSigningKey(secret),
    signatureBytes,
    textEncoder.encode(payloadSegment),
  )

  if (!isValidSignature) {
    return null
  }

  try {
    const parsed = JSON.parse(textDecoder.decode(decodeBase64Url(payloadSegment))) as unknown
    if (!isE2EAuthPayload(parsed)) {
      return null
    }

    return normalizePayload(parsed)
  } catch {
    return null
  }
}

export async function hasValidE2EAuthCookie(
  cookieValue: string | null | undefined,
): Promise<boolean> {
  return Boolean(await verifySignedE2EAuthCookie(cookieValue))
}

export async function resolveE2EAppUser(
  cookieValue: string | null | undefined,
): Promise<AppUser | null> {
  const payload = await verifySignedE2EAuthCookie(cookieValue)
  if (!payload) {
    return null
  }

  return createSyntheticAppUser(payload)
}

export function getE2EAuthCookieOptions(secure: boolean): {
  httpOnly: true
  maxAge: number
  path: '/'
  sameSite: 'lax'
  secure: boolean
} {
  return {
    httpOnly: true,
    maxAge: E2E_AUTH_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure,
  }
}
