import { NextRequest, NextResponse } from 'next/server'

import {
  E2E_AUTH_COOKIE_NAME,
  createSignedE2EAuthCookie,
  getE2EAuthCookieOptions,
  getRequiredE2EAuthSecret,
  isE2EAuthEnabled,
} from '@/lib/auth/e2e-auth'

type AuthRequestBody = {
  appUserId?: string
  creditsRemaining?: number
  displayName?: string | null
  email?: string | null
  secret?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAuthRequestBody(value: unknown): AuthRequestBody {
  if (!isRecord(value)) {
    return {}
  }

  return {
    appUserId: typeof value.appUserId === 'string' ? value.appUserId : undefined,
    creditsRemaining: typeof value.creditsRemaining === 'number' ? value.creditsRemaining : undefined,
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
    email: typeof value.email === 'string' ? value.email : null,
    secret: typeof value.secret === 'string' ? value.secret : undefined,
  }
}

function rejectWhenDisabled(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function rejectForbidden(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost'
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) {
    return true
  }

  try {
    const originUrl = new URL(origin)
    if (originUrl.origin === request.nextUrl.origin) {
      return true
    }

    return (
      originUrl.protocol === request.nextUrl.protocol
      && originUrl.port === request.nextUrl.port
      && isLoopbackHost(originUrl.hostname)
      && isLoopbackHost(request.nextUrl.hostname)
    )
  } catch {
    return false
  }
}

function resolveProvidedSecret(request: NextRequest, body?: AuthRequestBody): string | undefined {
  const headerSecret = request.headers.get('x-e2e-auth-secret')?.trim()
  return headerSecret || body?.secret?.trim()
}

async function readOptionalBody(request: NextRequest): Promise<AuthRequestBody> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return {}
  }

  try {
    return parseAuthRequestBody(await request.json())
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isE2EAuthEnabled()) {
    return rejectWhenDisabled()
  }

  if (!isSameOriginRequest(request)) {
    return rejectForbidden()
  }

  const body = await readOptionalBody(request)
  const providedSecret = resolveProvidedSecret(request, body)
  if (providedSecret !== getRequiredE2EAuthSecret()) {
    return rejectForbidden()
  }

  const appUserId = body.appUserId?.trim() || 'usr_e2e_browser'
  const cookieValue = await createSignedE2EAuthCookie({
    appUserId,
    creditsRemaining: body.creditsRemaining,
    displayName: body.displayName ?? 'E2E Browser User',
    primaryEmail: body.email ?? 'e2e@curria.local',
  })

  const response = NextResponse.json({ ok: true, appUserId })
  response.cookies.set({
    name: E2E_AUTH_COOKIE_NAME,
    value: cookieValue,
    ...getE2EAuthCookieOptions(request.nextUrl.protocol === 'https:'),
  })

  return response
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isE2EAuthEnabled()) {
    return rejectWhenDisabled()
  }

  if (!isSameOriginRequest(request)) {
    return rejectForbidden()
  }

  const body = await readOptionalBody(request)
  const providedSecret = resolveProvidedSecret(request, body)
  if (providedSecret !== getRequiredE2EAuthSecret()) {
    return rejectForbidden()
  }

  const response = new NextResponse(null, { status: 204 })
  response.cookies.set({
    name: E2E_AUTH_COOKIE_NAME,
    value: '',
    ...getE2EAuthCookieOptions(request.nextUrl.protocol === 'https:'),
    maxAge: 0,
  })

  return response
}
