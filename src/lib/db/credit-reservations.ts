import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type { ResumeGenerationType } from '@/types/agent'

export type CreditReservationStatus = 'reserved' | 'finalized' | 'released' | 'needs_reconciliation'
export type CreditReservationReconciliationStatus = 'clean' | 'pending' | 'repaired' | 'manual_review'
export type CreditLedgerEntryType = 'reservation_hold' | 'reservation_finalize' | 'reservation_release'

export type CreditReservation = {
  id: string
  userId: string
  generationIntentKey: string
  jobId?: string
  sessionId?: string
  resumeTargetId?: string
  resumeGenerationId?: string
  type: ResumeGenerationType
  status: CreditReservationStatus
  creditsReserved: number
  failureReason?: string
  reservedAt: Date
  finalizedAt?: Date
  releasedAt?: Date
  reconciliationStatus: CreditReservationReconciliationStatus
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type CreditLedgerEntry = {
  id: string
  userId: string
  reservationId?: string
  generationIntentKey: string
  entryType: CreditLedgerEntryType
  creditsDelta: number
  balanceAfter?: number
  jobId?: string
  sessionId?: string
  resumeTargetId?: string
  resumeGenerationId?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

type CreditReservationRow = {
  id: string
  user_id: string
  generation_intent_key: string
  job_id?: string | null
  session_id?: string | null
  resume_target_id?: string | null
  resume_generation_id?: string | null
  type: ResumeGenerationType
  status: CreditReservationStatus
  credits_reserved: number
  failure_reason?: string | null
  reserved_at: string
  finalized_at?: string | null
  released_at?: string | null
  reconciliation_status: CreditReservationReconciliationStatus
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type CreditLedgerEntryRow = {
  id: string
  user_id: string
  reservation_id?: string | null
  generation_intent_key: string
  entry_type: CreditLedgerEntryType
  credits_delta: number
  balance_after?: number | null
  job_id?: string | null
  session_id?: string | null
  resume_target_id?: string | null
  resume_generation_id?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

type PostgrestErrorLike = {
  code?: string
  message?: string
}

type ReserveCreditReservationInput = {
  userId: string
  generationIntentKey: string
  generationType: ResumeGenerationType
  jobId?: string
  sessionId?: string
  resumeTargetId?: string
  resumeGenerationId?: string
  metadata?: Record<string, unknown>
}

type ReservationTransitionAction = 'finalize' | 'release'

type SettleCreditReservationInput = {
  userId: string
  generationIntentKey: string
  action: ReservationTransitionAction
  resumeGenerationId?: string
}

function isDuplicateKeyError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }

  return error.code === '23505' || error.message?.toLowerCase().includes('duplicate key') === true
}

function mapCreditReservationRow(row: CreditReservationRow): CreditReservation {
  return {
    id: row.id,
    userId: row.user_id,
    generationIntentKey: row.generation_intent_key,
    jobId: row.job_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    resumeTargetId: row.resume_target_id ?? undefined,
    resumeGenerationId: row.resume_generation_id ?? undefined,
    type: row.type,
    status: row.status,
    creditsReserved: row.credits_reserved,
    failureReason: row.failure_reason ?? undefined,
    reservedAt: new Date(row.reserved_at),
    finalizedAt: row.finalized_at ? new Date(row.finalized_at) : undefined,
    releasedAt: row.released_at ? new Date(row.released_at) : undefined,
    reconciliationStatus: row.reconciliation_status,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapCreditLedgerEntryRow(row: CreditLedgerEntryRow): CreditLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    reservationId: row.reservation_id ?? undefined,
    generationIntentKey: row.generation_intent_key,
    entryType: row.entry_type,
    creditsDelta: row.credits_delta,
    balanceAfter: row.balance_after ?? undefined,
    jobId: row.job_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    resumeTargetId: row.resume_target_id ?? undefined,
    resumeGenerationId: row.resume_generation_id ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

async function getCreditReservationByIntent(input: {
  userId: string
  generationIntentKey: string
}): Promise<CreditReservation | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('credit_reservations')
    .select('*')
    .eq('user_id', input.userId)
    .eq('generation_intent_key', input.generationIntentKey)
    .maybeSingle<CreditReservationRow>()

  if (error) {
    throw new Error(`Failed to load credit reservation by generation intent: ${error.message}`)
  }

  return data ? mapCreditReservationRow(data) : null
}

function assertReservationTransitionAllowed(
  reservation: CreditReservation,
  action: ReservationTransitionAction,
): void {
  if (reservation.status === 'reserved' || reservation.status === 'needs_reconciliation') {
    return
  }

  if (reservation.status === 'finalized' && action === 'finalize') {
    return
  }

  if (reservation.status === 'released' && action === 'release') {
    return
  }

  throw new Error(`Cannot ${action} credit reservation from ${reservation.status} state`)
}

export async function reserveCreditForGenerationIntent(
  input: ReserveCreditReservationInput,
): Promise<{ reservation: CreditReservation; wasCreated: boolean }> {
  const existingReservation = await getCreditReservationByIntent({
    userId: input.userId,
    generationIntentKey: input.generationIntentKey,
  })

  if (existingReservation) {
    return {
      reservation: existingReservation,
      wasCreated: false,
    }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('credit_reservations')
    .insert({
      id: createDatabaseId(),
      user_id: input.userId,
      generation_intent_key: input.generationIntentKey,
      job_id: input.jobId ?? null,
      session_id: input.sessionId ?? null,
      resume_target_id: input.resumeTargetId ?? null,
      resume_generation_id: input.resumeGenerationId ?? null,
      type: input.generationType,
      status: 'reserved',
      credits_reserved: 1,
      reconciliation_status: 'clean',
      metadata: input.metadata ?? null,
    })
    .select('*')
    .single<CreditReservationRow>()

  if (error && isDuplicateKeyError(error)) {
    const duplicatedReservation = await getCreditReservationByIntent({
      userId: input.userId,
      generationIntentKey: input.generationIntentKey,
    })

    if (duplicatedReservation) {
      return {
        reservation: duplicatedReservation,
        wasCreated: false,
      }
    }
  }

  if (error || !data) {
    throw new Error(`Failed to reserve credit for generation intent: ${error?.message ?? 'Unknown error'}`)
  }

  return {
    reservation: mapCreditReservationRow(data),
    wasCreated: true,
  }
}

export async function settleCreditReservationTransition(
  input: SettleCreditReservationInput,
): Promise<CreditReservation> {
  const reservation = await getCreditReservationByIntent({
    userId: input.userId,
    generationIntentKey: input.generationIntentKey,
  })

  if (!reservation) {
    throw new Error(`Credit reservation not found for generation intent: ${input.generationIntentKey}`)
  }

  assertReservationTransitionAllowed(reservation, input.action)
  return {
    ...reservation,
    resumeGenerationId: input.resumeGenerationId ?? reservation.resumeGenerationId,
  }
}

export async function getCreditLedgerEntriesForIntent(input: {
  userId: string
  generationIntentKey: string
}): Promise<CreditLedgerEntry[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('credit_ledger_entries')
    .select('*')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load credit ledger entries for generation intent: ${error.message}`)
  }

  return (data ?? [])
    .filter((row): row is CreditLedgerEntryRow => row.generation_intent_key === input.generationIntentKey)
    .map(mapCreditLedgerEntryRow)
}
