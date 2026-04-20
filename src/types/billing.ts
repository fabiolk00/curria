import type {
  CreditLedgerEntryType,
  CreditReservationReconciliationStatus,
  CreditReservationStatus,
} from '@/lib/db/credit-reservations'

export type BillingHistoryEventStatus = 'pending' | 'completed' | 'released' | 'attention'

export type BillingHistoryEntry = {
  createdAt: Date
  generationIntentKey: string
  reservationStatus: CreditReservationStatus
  reconciliationStatus: CreditReservationReconciliationStatus
  ledgerEntryType: CreditLedgerEntryType
  creditsDelta: number
  eventLabel: string
  eventStatus: BillingHistoryEventStatus
  jobId?: string
  sessionId?: string
  resumeTargetId?: string
  resumeGenerationId?: string
}

export type BillingHistory = {
  entries: BillingHistoryEntry[]
}

export type BillingHistoryResponse = {
  entries: Array<Omit<BillingHistoryEntry, 'createdAt'> & { createdAt: string }>
}

export type BillingAnomalyKind =
  | 'stale_reconciliation'
  | 'repeated_finalize_failure'
  | 'repeated_release_failure'
  | 'reserved_backlog'

export type BillingAnomalyExample = {
  reservationId: string
  userId: string
  generationIntentKey: string
  status: CreditReservationStatus
  ageMinutes: number
  failureReason?: string
}

export type BillingAnomalySummary = {
  kind: BillingAnomalyKind
  count: number
  threshold: number
  examples: BillingAnomalyExample[]
}

export type BillingAnomalyThresholds = {
  staleReconciliationMinutes: number
  repeatedFailureCount: number
  reservedBacklogCount: number
  exampleLimit: number
}

export type BillingAnomalyReport = {
  generatedAt: Date
  thresholds: BillingAnomalyThresholds
  totals: {
    reservedCount: number
    needsReconciliationCount: number
  }
  anomalies: BillingAnomalySummary[]
}
