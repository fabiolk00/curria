function normalizeDecodedClerkHost(value: string): string | null {
  const decoded = value.replace(/\$/g, "").trim()
  if (!decoded) {
    return null
  }

  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    try {
      const url = new URL(decoded)
      return url.hostname ? url.origin : null
    } catch {
      return null
    }
  }

  if (!/^[a-z0-9.-]+$/i.test(decoded)) {
    return null
  }

  return `https://${decoded}`
}

export function decodeClerkFrontendApi(publishableKey?: string): string | null {
  const rawKey = publishableKey?.trim()
  if (!rawKey) {
    return null
  }

  const segments = rawKey.split("_")
  const encodedPart = segments.at(-1)
  if (!encodedPart) {
    return null
  }

  try {
    const normalizedBase64 = encodedPart.replace(/-/g, "+").replace(/_/g, "/")
    const paddedBase64 = normalizedBase64.padEnd(Math.ceil(normalizedBase64.length / 4) * 4, "=")
    const decoded = atob(paddedBase64)
    return normalizeDecodedClerkHost(decoded)
  } catch {
    return null
  }
}
