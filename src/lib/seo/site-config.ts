const DEFAULT_SITE_URL = "https://www.trampofy.com.br"

export const SEO_LAST_MODIFIED = new Date("2026-04-26T00:00:00.000Z")

export function normalizeSiteUrl(value: string | undefined): string {
  const rawValue = value?.trim() || DEFAULT_SITE_URL

  try {
    return new URL(rawValue).origin.replace(/\/$/, "")
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function getSiteUrl(): string {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
}

export function buildSiteUrl(pathname: string): string {
  return new URL(pathname, `${getSiteUrl()}/`).toString()
}
