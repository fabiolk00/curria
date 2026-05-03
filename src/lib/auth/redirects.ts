import { PROFILE_SETUP_PATH, canonicalizeAppPath } from "@/lib/routes/app"

export const SSO_CALLBACK_PATH = "/sso-callback"

export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = PROFILE_SETUP_PATH,
): string {
  if (!candidate) {
    return fallback
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  return canonicalizeAppPath(candidate)
}

export function buildSsoCallbackPath(redirectTo: string): string {
  return `${SSO_CALLBACK_PATH}?redirect_to=${encodeURIComponent(redirectTo)}`
}
