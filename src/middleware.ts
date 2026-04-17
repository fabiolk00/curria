import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

import { decodeClerkFrontendApi } from '@/lib/auth/clerk-frontend-api'
import {
  E2E_AUTH_COOKIE_NAME,
  assertE2EAuthConfigured,
  hasValidE2EAuthCookie,
  isE2EAuthEnabled,
} from '@/lib/auth/e2e-auth'
import { getAppUrl, isCanonicalAppHost } from '@/lib/config/app-url'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/pricing(.*)',
  '/what-is-ats(.*)',
  '/curriculo-(.*)-ats(.*)',
  '/sso-callback(.*)',
  '/api/webhook/asaas(.*)',
  '/api/webhook/clerk(.*)',
])

function addSecurityHeaders(response: NextResponse): NextResponse {
  const clerkFrontendApi = decodeClerkFrontendApi(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const clerkScriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    clerkFrontendApi,
    'https://*.clerk.accounts.dev',
    'https://challenges.cloudflare.com',
  ].filter(Boolean).join(' ')

  const clerkConnectSrc = [
    "'self'",
    clerkFrontendApi,
    'https:',
  ].filter(Boolean).join(' ')

  const clerkFrameSrc = [
    "'self'",
    'blob:',
    clerkFrontendApi,
    'https://*.clerk.accounts.dev',
    'https://challenges.cloudflare.com',
  ].filter(Boolean).join(' ')

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  )

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src ${clerkScriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      `connect-src ${clerkConnectSrc}`,
      "worker-src 'self' blob:",
      `frame-src ${clerkFrameSrc}`,
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; ') + ';',
  )

  return response
}

function shouldRedirectToCanonicalHost(req: NextRequest): boolean {
  const pathname = req.nextUrl.pathname
  if (pathname.startsWith('/api/webhook/')) {
    return false
  }

  const hostname = req.nextUrl.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app')) {
    return false
  }

  if (!hostname.endsWith('curria.com.br')) {
    return false
  }

  return !isCanonicalAppHost(hostname)
}

async function handleCanonicalHostRedirect(req: NextRequest): Promise<NextResponse | null> {
  if (shouldRedirectToCanonicalHost(req)) {
    const canonical = getAppUrl()
    const redirectUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical)
    return addSecurityHeaders(NextResponse.redirect(redirectUrl, 308))
  }

  return null
}

async function handleE2EMiddleware(req: NextRequest): Promise<NextResponse> {
  assertE2EAuthConfigured()

  const canonicalRedirect = await handleCanonicalHostRedirect(req)
  if (canonicalRedirect) {
    return canonicalRedirect
  }

  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')
  const hasValidE2EAuth = !isApiRoute
    && await hasValidE2EAuthCookie(req.cookies.get(E2E_AUTH_COOKIE_NAME)?.value)

  if (!isPublicRoute(req) && !isApiRoute && !hasValidE2EAuth) {
    const loginUrl = new URL('/login', req.url)
    return addSecurityHeaders(NextResponse.redirect(loginUrl, 307))
  }

  return addSecurityHeaders(NextResponse.next())
}

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  const canonicalRedirect = await handleCanonicalHostRedirect(req)
  if (canonicalRedirect) {
    return canonicalRedirect
  }

  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  if (!isPublicRoute(req) && !isApiRoute) {
    await auth().protect()
  }

  return addSecurityHeaders(NextResponse.next())
})

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isE2EAuthEnabled()) {
    return handleE2EMiddleware(req)
  }

  return clerkAuthMiddleware(req, event)
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
