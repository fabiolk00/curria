import {
  listCreditReservationsForReconciliation,
  type CreditReservation,
} from '@/lib/db/credit-reservations'
import type {
  BillingAnomalyExample,
  BillingAnomalyKind,
  BillingAnomalyReport,
  BillingAnomalySummary,
  BillingAnomalyThresholds,
} from '@/types/billing'

const DEFAULT_THRESHOLDS: BillingAnomalyThresholds = {
  staleReconciliationMinutes: 30,
  repeatedFailureCount: 2,
  reservedBacklogCount: 10,
  exampleLimit: 5,
}

function resolveThresholds(
  thresholds: Partial<BillingAnomalyThresholds> | undefined,
): BillingAnomalyThresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  }
}

function resolveAgeMinutes(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60000))
}

function buildExample(
  reservation: CreditReservation,
  now: Date,
): BillingAnomalyExample {
  return {
    reservationId: reservation.id,
    userId: reservation.userId,
    generationIntentKey: reservation.generationIntentKey,
    status: reservation.status,
    ageMinutes: resolveAgeMinutes(reservation.createdAt, now),
    failureReason: reservation.failureReason,
  }
}

function buildSummary(input: {
  kind: BillingAnomalyKind
  threshold: number
  reservations: CreditReservation[]
  now: Date
  exampleLimit: number
}): BillingAnomalySummary | null {
  if (input.reservations.length < input.threshold) {
    return null
  }

  return {
    kind: input.kind,
    count: input.reservations.length,
    threshold: input.threshold,
    examples: input.reservations
      .slice(0, input.exampleLimit)
      .map((reservation) => buildExample(reservation, input.now)),
  }
}

function classifyFailureKind(failureReason: string | undefined): Exclude<
  BillingAnomalyKind,
  'stale_reconciliation' | 'reserved_backlog'
> | null {
  const normalized = failureReason?.toLowerCase() ?? ''

  if (normalized.includes('release')) {
    return 'repeated_release_failure'
  }

  if (normalized.includes('finalize')) {
    return 'repeated_finalize_failure'
  }

  return null
}

function groupRepeatedFailures(
  reservations: CreditReservation[],
): Map<string, CreditReservation[]> {
  const grouped = new Map<string, CreditReservation[]>()

  for (const reservation of reservations) {
    const anomalyKind = classifyFailureKind(reservation.failureReason)

    if (!anomalyKind) {
      continue
    }

    const key = `${anomalyKind}:${reservation.userId}:${reservation.generationIntentKey}`
    const existing = grouped.get(key) ?? []
    existing.push(reservation)
    grouped.set(key, existing)
  }

  return grouped
}

export async function summarizeBillingAnomalies(input: {
  userId?: string
  limit?: number
  now?: Date
  thresholds?: Partial<BillingAnomalyThresholds>
} = {}): Promise<BillingAnomalyReport> {
  const now = input.now ?? new Date()
  const thresholds = resolveThresholds(input.thresholds)
  const reservations = await listCreditReservationsForReconciliation({
    userId: input.userId,
    limit: input.limit,
  })
  const needsReconciliation = reservations.filter((reservation) => reservation.status === 'needs_reconciliation')
  const reserved = reservations.filter((reservation) => reservation.status === 'reserved')
  const staleReconciliation = needsReconciliation.filter(
    (reservation) => resolveAgeMinutes(reservation.createdAt, now) >= thresholds.staleReconciliationMinutes,
  )

  const anomalies: BillingAnomalySummary[] = []
  const staleSummary = buildSummary({
    kind: 'stale_reconciliation',
    threshold: 1,
    reservations: staleReconciliation,
    now,
    exampleLimit: thresholds.exampleLimit,
  })

  if (staleSummary) {
    staleSummary.threshold = thresholds.staleReconciliationMinutes
    anomalies.push(staleSummary)
  }

  const backlogSummary = buildSummary({
    kind: 'reserved_backlog',
    threshold: thresholds.reservedBacklogCount,
    reservations: reserved,
    now,
    exampleLimit: thresholds.exampleLimit,
  })

  if (backlogSummary) {
    anomalies.push(backlogSummary)
  }

  for (const [groupKey, groupedReservations] of groupRepeatedFailures(needsReconciliation)) {
    const anomalyKind = groupKey.startsWith('repeated_release_failure:')
      ? 'repeated_release_failure'
      : 'repeated_finalize_failure'
    const repeatedFailureSummary = buildSummary({
      kind: anomalyKind,
      threshold: thresholds.repeatedFailureCount,
      reservations: groupedReservations,
      now,
      exampleLimit: thresholds.exampleLimit,
    })

    if (repeatedFailureSummary) {
      anomalies.push(repeatedFailureSummary)
    }
  }

  return {
    generatedAt: now,
    thresholds,
    totals: {
      reservedCount: reserved.length,
      needsReconciliationCount: needsReconciliation.length,
    },
    anomalies,
  }
}
