import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockHeaders,
  mockRedisConstructor,
  mockRedisSet,
  mockRedisDel,
  mockWebhookConstructor,
  mockWebhookVerify,
  mockGetOrCreateAppUserByClerkUserId,
  mockSyncClerkUserProfile,
  mockDisableAppUserByClerkUserId,
  mockLogError,
  mockLogInfo,
  mockLogWarn,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockRedisConstructor: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
  mockWebhookConstructor: vi.fn(),
  mockWebhookVerify: vi.fn(),
  mockGetOrCreateAppUserByClerkUserId: vi.fn(),
  mockSyncClerkUserProfile: vi.fn(),
  mockDisableAppUserByClerkUserId: vi.fn(),
  mockLogError: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(options: unknown) {
      mockRedisConstructor(options)
    }

    set(...args: unknown[]) {
      return mockRedisSet(...args)
    }

    del(...args: unknown[]) {
      return mockRedisDel(...args)
    }
  },
}))

vi.mock('svix', () => ({
  Webhook: class MockWebhook {
    constructor(secret: string) {
      mockWebhookConstructor(secret)
    }

    verify(...args: unknown[]) {
      return mockWebhookVerify(...args)
    }
  },
}))

vi.mock('@/lib/auth/app-user', () => ({
  getOrCreateAppUserByClerkUserId: mockGetOrCreateAppUserByClerkUserId,
  syncClerkUserProfile: mockSyncClerkUserProfile,
  disableAppUserByClerkUserId: mockDisableAppUserByClerkUserId,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: mockLogError,
  logInfo: mockLogInfo,
  logWarn: mockLogWarn,
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const originalClerkWebhookSecret = process.env.CLERK_WEBHOOK_SECRET

function setSvixHeaders(): void {
  mockHeaders.mockReturnValue(new Headers({
    'svix-id': 'evt_123',
    'svix-timestamp': String(Math.floor(Date.now() / 1000)),
    'svix-signature': 'sig_123',
  }))
}

async function loadRoute() {
  vi.resetModules()
  return import('./route')
}

beforeEach(() => {
  vi.clearAllMocks()
  setSvixHeaders()
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token_123'
  process.env.CLERK_WEBHOOK_SECRET = 'whsec_123'
  mockRedisSet.mockResolvedValue('OK')
  mockRedisDel.mockResolvedValue(1)
  mockWebhookVerify.mockReturnValue({
    type: 'user.created',
    data: { id: 'user_123' },
  })
  mockGetOrCreateAppUserByClerkUserId.mockResolvedValue(undefined)
  mockSyncClerkUserProfile.mockResolvedValue(undefined)
  mockDisableAppUserByClerkUserId.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()

  if (originalRedisUrl === undefined) {
    delete process.env.UPSTASH_REDIS_REST_URL
  } else {
    process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl
  }

  if (originalRedisToken === undefined) {
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  } else {
    process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken
  }

  if (originalClerkWebhookSecret === undefined) {
    delete process.env.CLERK_WEBHOOK_SECRET
  } else {
    process.env.CLERK_WEBHOOK_SECRET = originalClerkWebhookSecret
  }
})

describe('clerk webhook route', () => {
  it('returns 400 when Svix headers are missing', async () => {
    mockHeaders.mockReturnValue(new Headers())

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Missing svix headers' })
    expect(mockWebhookConstructor).not.toHaveBeenCalled()
    expect(mockRedisSet).not.toHaveBeenCalled()
    expect(mockLogWarn).toHaveBeenCalledWith('clerk.webhook.headers_missing', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      success: false,
    }))
  })

  it('returns 500 when CLERK_WEBHOOK_SECRET is missing', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Missing required environment variable CLERK_WEBHOOK_SECRET for Clerk webhook.',
    })
    expect(mockWebhookConstructor).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith('clerk.webhook.config_missing', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      svixId: 'evt_123',
      success: false,
      errorMessage: 'Missing required environment variable CLERK_WEBHOOK_SECRET for Clerk webhook.',
    }))
  })

  it('returns 500 when the Upstash Redis URL is missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Missing required environment variable UPSTASH_REDIS_REST_URL for Clerk webhook.',
    })
    expect(mockRedisConstructor).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith('clerk.webhook.config_missing', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      svixId: 'evt_123',
      success: false,
      errorMessage: 'Missing required environment variable UPSTASH_REDIS_REST_URL for Clerk webhook.',
    }))
  })

  it('returns a duplicate response before signature verification when the event was already seen', async () => {
    mockRedisSet.mockResolvedValue(null)

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, duplicate: true })
    expect(mockWebhookConstructor).toHaveBeenCalledWith('whsec_123')
    expect(mockWebhookVerify).toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('clerk.webhook.duplicate', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      svixId: 'evt_123',
      success: true,
      duplicate: true,
    }))
  })

  it('returns 400 when the webhook signature is invalid', async () => {
    mockWebhookVerify.mockImplementation(() => {
      throw new Error('bad signature')
    })

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid signature' })
    expect(mockRedisSet).not.toHaveBeenCalled()
    expect(mockRedisDel).not.toHaveBeenCalled()
    expect(mockLogWarn).toHaveBeenCalledWith('clerk.webhook.signature_invalid', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      svixId: 'evt_123',
      success: false,
      errorMessage: 'bad signature',
    }))
  })

  it('returns 400 when the webhook timestamp is malformed', async () => {
    mockHeaders.mockReturnValue(new Headers({
      'svix-id': 'evt_123',
      'svix-timestamp': 'not-a-number',
      'svix-signature': 'sig_123',
    }))

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Webhook timestamp out of tolerance' })
    expect(mockWebhookVerify).not.toHaveBeenCalled()
    expect(mockRedisSet).not.toHaveBeenCalled()
    expect(mockLogWarn).toHaveBeenCalledWith('clerk.webhook.timestamp_out_of_tolerance', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      svixId: 'evt_123',
      success: false,
      eventAgeSeconds: null,
    }))
  })

  it('processes a verified user.created event', async () => {
    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mockWebhookConstructor).toHaveBeenCalledWith('whsec_123')
    expect(mockWebhookVerify).toHaveBeenCalled()
    expect(mockGetOrCreateAppUserByClerkUserId).toHaveBeenCalledWith('user_123')
    expect(mockSyncClerkUserProfile).toHaveBeenCalledWith({
      clerkUserId: 'user_123',
      displayName: null,
      email: null,
      emailVerifiedAt: null,
      signupMethod: 'email',
    })
    expect(mockLogInfo).toHaveBeenCalledWith('clerk.webhook.processed', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/webhook/clerk',
      svixId: 'evt_123',
      eventType: 'user.created',
      clerkUserId: 'user_123',
      success: true,
    }))
  })

  it('stores google as the signup method when a user.created event has a Google external account', async () => {
    mockWebhookVerify.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_google',
        first_name: 'Ana',
        last_name: 'Silva',
        email_addresses: [{
          email_address: 'ana@example.com',
          verification: { status: 'verified' },
        }],
        external_accounts: [{ provider: 'oauth_google' }],
      },
    })

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mockGetOrCreateAppUserByClerkUserId).toHaveBeenCalledWith('user_google')
    expect(mockSyncClerkUserProfile).toHaveBeenCalledWith({
      clerkUserId: 'user_google',
      displayName: 'Ana Silva',
      email: 'ana@example.com',
      emailVerifiedAt: expect.any(String),
      signupMethod: 'google',
    })
  })

  it('stores linkedin as the signup method when a user.created event has a LinkedIn external account', async () => {
    mockWebhookVerify.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_linkedin',
        first_name: 'Bruno',
        last_name: 'Souza',
        email_addresses: [{
          email_address: 'bruno@example.com',
          verification: { status: 'verified' },
        }],
        external_accounts: [{ provider: 'oauth_linkedin_oidc' }],
      },
    })

    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/webhook/clerk', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mockGetOrCreateAppUserByClerkUserId).toHaveBeenCalledWith('user_linkedin')
    expect(mockSyncClerkUserProfile).toHaveBeenCalledWith({
      clerkUserId: 'user_linkedin',
      displayName: 'Bruno Souza',
      email: 'bruno@example.com',
      emailVerifiedAt: expect.any(String),
      signupMethod: 'linkedin',
    })
  })
})
