import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/pricing(.*)',
  '/sso-callback(.*)',
  '/api/webhook/asaas(.*)',
  '/api/webhook/clerk(.*)',
])

export default clerkMiddleware((auth, req) => {
  // API routes handle their own auth and should not redirect
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  if (!isPublicRoute(req) && !isApiRoute) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
