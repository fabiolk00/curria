export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!candidate) {
    return fallback
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  return candidate
}
