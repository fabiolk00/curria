export const PROFILE_SETUP_PATH = "/profile-setup"
export const DASHBOARD_SESSIONS_PATH = "/dashboard/sessions"
export const DASHBOARD_RESUMES_HISTORY_PATH = "/dashboard/resumes-history"

export const LEGACY_DASHBOARD_PATH = "/dashboard"
export const LEGACY_PROFILE_SETUP_PATH = "/dashboard/resumes/new"
export const LEGACY_PROFILE_SETUP_ALIAS_PATH = "/dashboard/resume/new"
export const LEGACY_RESUMES_HISTORY_PATH = "/dashboard/resumes/history"
export const LEGACY_RESUMES_HISTORY_ALIAS_PATH = "/dashboard/resume/history"
export const LEGACY_PROFILE_PATH = "/profile"

const APP_URL_BASE = "http://curria.local"

export function buildResumeComparisonPath(sessionId: string): string {
  return `/dashboard/resume/compare/${encodeURIComponent(sessionId)}`
}

function formatRelativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`
}

function normalizePathname(pathname: string): string {
  if (pathname.length <= 1) {
    return pathname
  }

  return pathname.replace(/\/+$/, "")
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function canonicalizeAppPath(candidate: string): string {
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return candidate
  }

  try {
    const url = new URL(candidate, APP_URL_BASE)
    const pathname = normalizePathname(url.pathname)
    const chatSessionMatch = pathname.match(/^\/chat\/([^/]+)$/)
    const chatSessionSearchParam = pathname === "/chat" ? url.searchParams.get("session") : null

    if (chatSessionMatch) {
      url.pathname = buildResumeComparisonPath(decodePathSegment(chatSessionMatch[1]))
      url.search = ""
      return formatRelativeUrl(url)
    }

    if (chatSessionSearchParam) {
      url.pathname = buildResumeComparisonPath(chatSessionSearchParam)
      url.searchParams.delete("session")
      return formatRelativeUrl(url)
    }

    if (pathname === "/chat") {
      url.pathname = PROFILE_SETUP_PATH
      return formatRelativeUrl(url)
    }

    if (pathname === LEGACY_DASHBOARD_PATH) {
      const legacySessionId = url.searchParams.get("session")
      if (legacySessionId) {
        url.pathname = buildResumeComparisonPath(legacySessionId)
        url.searchParams.delete("session")
        return formatRelativeUrl(url)
      }

      url.pathname = PROFILE_SETUP_PATH
      return formatRelativeUrl(url)
    }

    if (
      pathname === LEGACY_PROFILE_SETUP_PATH
      || pathname === LEGACY_PROFILE_SETUP_ALIAS_PATH
      || pathname === LEGACY_PROFILE_PATH
    ) {
      url.pathname = PROFILE_SETUP_PATH
      return formatRelativeUrl(url)
    }

    if (
      pathname === LEGACY_RESUMES_HISTORY_PATH
      || pathname === LEGACY_RESUMES_HISTORY_ALIAS_PATH
    ) {
      url.pathname = DASHBOARD_RESUMES_HISTORY_PATH
      return formatRelativeUrl(url)
    }

    if (url.pathname !== pathname) {
      url.pathname = pathname
      return formatRelativeUrl(url)
    }

    return candidate
  } catch {
    return candidate
  }
}
