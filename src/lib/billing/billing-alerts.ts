import {
  listCreditReservationsForReconciliation,
} from '@/lib/db/credit-reservations'
import type {
  BillingAnomalyReport,
  BillingAnomalyThresholds,
} from '@/types/billing'
import { summarizeBillingAnomaliesFromReservations } from './billing-anomaly-summary'

export async function summarizeBillingAnomalies(input: {
  userId?: string
  limit?: number
  now?: Date
  thresholds?: Partial<BillingAnomalyThresholds>
} = {}): Promise<BillingAnomalyReport> {
  const reservations = await listCreditReservationsForReconciliation({
    userId: input.userId,
    limit: input.limit,
  })
  return summarizeBillingAnomaliesFromReservations(reservations, {
    now: input.now,
    thresholds: input.thresholds,
  })
}
