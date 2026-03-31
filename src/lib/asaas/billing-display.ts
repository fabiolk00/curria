const DAY_IN_MS = 1000 * 60 * 60 * 24

export function formatRenewalCountdown(
  renewsAt: string | null,
  now: Date = new Date(),
): string | null {
  if (!renewsAt) {
    return null
  }

  const renewalDate = new Date(renewsAt)
  if (!Number.isFinite(renewalDate.getTime())) {
    return null
  }

  const diffInMs = renewalDate.getTime() - now.getTime()
  if (diffInMs <= 0) {
    return null
  }

  const daysRemaining = Math.ceil(diffInMs / DAY_IN_MS)
  return `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}`
}
