import { beforeEach, describe, expect, it, vi } from 'vitest'

const runPsqlJsonQueryMock = vi.fn()
const summarizeBillingAnomaliesFromReservationsMock = vi.fn()
const supabaseRows = new Map<string, Array<Record<string, unknown>>>()

type SupabaseQueryResult = {
  data: Array<Record<string, unknown>>
  error: null
}

type SupabaseQueryBuilder = {
  select: () => SupabaseQueryBuilder
  eq: (column: string, value: unknown) => SupabaseQueryBuilder
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder
  limit: (value: number) => SupabaseQueryBuilder
  then: PromiseLike<SupabaseQueryResult>['then']
}

function createSupabaseQuery(table: string) {
  const state: {
    eq?: { column: string, value: unknown }
    in?: { column: string, values: unknown[] }
    order?: { column: string, ascending: boolean }
    limit?: number
  } = {}

  const finalize = () => {
    let rows = [...(supabaseRows.get(table) ?? [])]

    if (state.eq) {
      rows = rows.filter((row) => row[state.eq!.column] === state.eq!.value)
    }

    if (state.in) {
      rows = rows.filter((row) => state.in!.values.includes(row[state.in!.column]))
    }

    if (state.order) {
      rows.sort((left, right) => {
        const leftValue = left[state.order!.column]
        const rightValue = right[state.order!.column]

        if (leftValue === rightValue) {
          return 0
        }

        const comparison = String(leftValue ?? '').localeCompare(String(rightValue ?? ''))
        return state.order!.ascending ? comparison : -comparison
      })
    }

    if (typeof state.limit === 'number') {
      rows = rows.slice(0, state.limit)
    }

    return { data: rows, error: null }
  }

  const builder: SupabaseQueryBuilder = {
    select: vi.fn((): SupabaseQueryBuilder => builder) as SupabaseQueryBuilder['select'],
    eq: vi.fn((column: string, value: unknown): SupabaseQueryBuilder => {
      state.eq = { column, value }
      return builder
    }) as SupabaseQueryBuilder['eq'],
    in: vi.fn((column: string, values: unknown[]): SupabaseQueryBuilder => {
      state.in = { column, values }
      return builder
    }) as SupabaseQueryBuilder['in'],
    order: vi.fn((column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder => {
      state.order = { column, ascending: options?.ascending ?? true }
      return builder
    }) as SupabaseQueryBuilder['order'],
    limit: vi.fn((value: number): SupabaseQueryBuilder => {
      state.limit = value
      return builder
    }) as SupabaseQueryBuilder['limit'],
    then: (resolve, reject) => {
      return Promise.resolve(finalize()).then(resolve, reject)
    },
  }

  return builder
}

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn((_command: string, args: string[]) => {
    const sql = String(args[args.length - 1] ?? '')

    if (sql.includes("SELECT COALESCE(json_agg(row_to_json(result_row)), '[]'::json)")) {
      const rows = runPsqlJsonQueryMock(sql)

      return {
        status: 0,
        stdout: JSON.stringify(rows),
        stderr: '',
      }
    }

    return {
      status: 0,
      stdout: 'psql (PostgreSQL) 16.0',
      stderr: '',
    }
  }),
}))

vi.mock('../src/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => createSupabaseQuery(table),
  }),
}))

vi.mock('../src/lib/billing/billing-anomaly-summary', () => ({
  summarizeBillingAnomaliesFromReservations: summarizeBillingAnomaliesFromReservationsMock,
}))

describe('check-staging-billing-state psql snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STAGING_DB_URL = 'postgres://curria-staging'
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    supabaseRows.clear()
    summarizeBillingAnomaliesFromReservationsMock.mockImplementation(async (reservations) => {
      const actual = await vi.importActual<typeof import('../src/lib/billing/billing-anomaly-summary')>(
        '../src/lib/billing/billing-anomaly-summary',
      )

      return actual.summarizeBillingAnomaliesFromReservations(reservations)
    })
  })

  it('does not issue an empty billing_checkouts WHERE clause for --session snapshots', async () => {
    const reservationRows = [{
      id: 'reservation_1',
      user_id: 'usr_123',
      generation_intent_key: 'intent_1',
      job_id: 'job_1',
      session_id: 'sess_123',
      resume_target_id: null,
      resume_generation_id: null,
      type: 'ATS_ENHANCEMENT',
      status: 'reserved',
      credits_reserved: 1,
      failure_reason: null,
      reserved_at: '2026-04-20T09:00:00.000Z',
      finalized_at: null,
      released_at: null,
      reconciliation_status: 'clean',
      metadata: { source: 'test' },
      created_at: '2026-04-20T09:00:00.000Z',
      updated_at: '2026-04-20T09:05:00.000Z',
    }]

    runPsqlJsonQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM credit_reservations')) {
        return reservationRows
      }

      if (sql.includes('FROM credit_accounts')) {
        return [{
          id: 'account_1',
          user_id: 'usr_123',
          credits_remaining: 4,
          created_at: '2026-04-20T09:00:00.000Z',
          updated_at: '2026-04-20T09:05:00.000Z',
        }]
      }

      if (sql.includes('FROM credit_ledger_entries')) {
        return [{
          id: 'ledger_1',
          user_id: 'usr_123',
          reservation_id: 'reservation_1',
          generation_intent_key: 'intent_1',
          entry_type: 'reservation_hold',
          credits_delta: -1,
          balance_after: 4,
          job_id: 'job_1',
          session_id: 'sess_123',
          resume_target_id: null,
          resume_generation_id: null,
          metadata: { source: 'test' },
          created_at: '2026-04-20T09:00:01.000Z',
        }]
      }

      return []
    })
    const { createPsqlSnapshot } = await import('./check-staging-billing-state')
    const snapshot = await createPsqlSnapshot({
      userId: null,
      checkoutReference: null,
      subscriptionId: null,
      sessionId: 'sess_123',
    })

    expect(runPsqlJsonQueryMock).not.toHaveBeenCalledWith(expect.stringContaining('FROM billing_checkouts'))
    expect(snapshot.credit_reservations).toHaveLength(1)
    expect(snapshot.discovered.userIds).toEqual(['usr_123'])
    expect(snapshot.discovered.sessionIds).toEqual(['sess_123'])
  })

  it('derives anomaly output from psql reservation snapshots instead of returning an empty stub', async () => {
    runPsqlJsonQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM billing_checkouts')) {
        return [{
          id: 'checkout_1',
          user_id: 'usr_456',
          checkout_reference: 'chk_123',
          plan: 'pro',
          amount_minor: 9900,
          currency: 'BRL',
          status: 'paid',
          asaas_link: null,
          asaas_payment_id: 'pay_123',
          asaas_subscription_id: 'sub_123',
          created_at: '2026-04-20T08:00:00.000Z',
          updated_at: '2026-04-20T08:10:00.000Z',
        }]
      }

      if (sql.includes('FROM user_quotas')) {
        return [{
          id: 'quota_1',
          user_id: 'usr_456',
          plan: 'pro',
          credits_remaining: 10,
          asaas_customer_id: 'cus_123',
          asaas_subscription_id: 'sub_123',
          renews_at: '2026-05-20T08:00:00.000Z',
          status: 'active',
          created_at: '2026-04-01T08:00:00.000Z',
          updated_at: '2026-04-20T08:10:00.000Z',
        }]
      }

      if (sql.includes('FROM credit_reservations')) {
        return [
          {
            id: 'reservation_a',
            user_id: 'usr_456',
            generation_intent_key: 'intent_a',
            job_id: 'job_a',
            session_id: 'sess_456',
            resume_target_id: null,
            resume_generation_id: null,
            type: 'ATS_ENHANCEMENT',
            status: 'needs_reconciliation',
            credits_reserved: 1,
            failure_reason: 'finalize_failed_timeout',
            reserved_at: '2026-04-20T08:00:00.000Z',
            finalized_at: null,
            released_at: null,
            reconciliation_status: 'pending',
            metadata: { source: 'test' },
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:05:00.000Z',
          },
          {
            id: 'reservation_b',
            user_id: 'usr_456',
            generation_intent_key: 'intent_b',
            job_id: 'job_b',
            session_id: 'sess_789',
            resume_target_id: null,
            resume_generation_id: null,
            type: 'ATS_ENHANCEMENT',
            status: 'needs_reconciliation',
            credits_reserved: 1,
            failure_reason: 'finalize_failed_retry',
            reserved_at: '2026-04-20T08:10:00.000Z',
            finalized_at: null,
            released_at: null,
            reconciliation_status: 'pending',
            metadata: { source: 'test' },
            created_at: '2026-04-20T08:10:00.000Z',
            updated_at: '2026-04-20T08:15:00.000Z',
          },
        ]
      }

      return []
    })

    const { createPsqlSnapshot } = await import('./check-staging-billing-state')
    const snapshot = await createPsqlSnapshot({
      userId: 'usr_456',
      checkoutReference: null,
      subscriptionId: null,
      sessionId: null,
    })

    expect(snapshot.billing_anomalies.anomalies).toContainEqual(expect.objectContaining({
      kind: 'repeated_finalize_failure',
      count: 2,
    }))
    expect(snapshot.billing_anomalies.anomalies).not.toEqual([])
  })

  it('scopes supabase fallback anomalies to discovered reservation evidence for session snapshots', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    supabaseRows.set('credit_reservations', [
      {
        id: 'reservation_scoped',
        user_id: 'usr_scoped',
        generation_intent_key: 'intent_scoped',
        job_id: 'job_scoped',
        session_id: 'sess_scoped',
        resume_target_id: null,
        resume_generation_id: null,
        type: 'ATS_ENHANCEMENT',
        status: 'needs_reconciliation',
        credits_reserved: 1,
        failure_reason: 'finalize_failed_timeout',
        reserved_at: '2026-04-20T08:00:00.000Z',
        finalized_at: null,
        released_at: null,
        reconciliation_status: 'pending',
        metadata: { source: 'scoped' },
        created_at: '2026-04-20T08:00:00.000Z',
        updated_at: '2026-04-20T08:10:00.000Z',
      },
      {
        id: 'reservation_unrelated',
        user_id: 'usr_other',
        generation_intent_key: 'intent_other',
        job_id: 'job_other',
        session_id: 'sess_other',
        resume_target_id: null,
        resume_generation_id: null,
        type: 'ATS_ENHANCEMENT',
        status: 'needs_reconciliation',
        credits_reserved: 1,
        failure_reason: 'finalize_failed_retry',
        reserved_at: '2026-04-20T07:00:00.000Z',
        finalized_at: null,
        released_at: null,
        reconciliation_status: 'pending',
        metadata: { source: 'unrelated' },
        created_at: '2026-04-20T07:00:00.000Z',
        updated_at: '2026-04-20T07:10:00.000Z',
      },
    ])
    supabaseRows.set('credit_accounts', [{
      id: 'account_scoped',
      user_id: 'usr_scoped',
      credits_remaining: 7,
      created_at: '2026-04-20T08:00:00.000Z',
      updated_at: '2026-04-20T08:10:00.000Z',
    }])
    supabaseRows.set('user_quotas', [{
      id: 'quota_scoped',
      user_id: 'usr_scoped',
      asaas_customer_id: 'cus_scoped',
      asaas_subscription_id: 'sub_scoped',
      current_plan: 'pro',
      plan_status: 'active',
      billing_cycle_anchor: '2026-04-20T08:00:00.000Z',
      created_at: '2026-04-20T08:00:00.000Z',
      updated_at: '2026-04-20T08:10:00.000Z',
    }])
    supabaseRows.set('credit_ledger_entries', [])
    supabaseRows.set('processed_events', [])

    summarizeBillingAnomaliesFromReservationsMock.mockResolvedValue({
      generatedAt: new Date('2026-04-20T10:00:00.000Z'),
      thresholds: {
        staleReconciliationMinutes: 30,
        repeatedFailureCount: 2,
        reservedBacklogCount: 10,
        exampleLimit: 5,
      },
      totals: {
        reservedCount: 0,
        needsReconciliationCount: 1,
      },
      anomalies: [{
        kind: 'stale_reconciliation',
        count: 1,
        threshold: 30,
        examples: [],
      }],
    })

    const { createSupabaseSnapshot } = await import('./check-staging-billing-state')
    const snapshot = await createSupabaseSnapshot({
      userId: null,
      checkoutReference: null,
      subscriptionId: null,
      sessionId: 'sess_scoped',
    })

    expect(summarizeBillingAnomaliesFromReservationsMock).toHaveBeenCalledTimes(1)
    expect(summarizeBillingAnomaliesFromReservationsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'reservation_scoped',
        userId: 'usr_scoped',
        sessionId: 'sess_scoped',
      }),
    ])
    expect(snapshot.discovered.userIds).toEqual(['usr_scoped'])
    expect(snapshot.credit_accounts).toEqual([
      expect.objectContaining({
        id: 'account_scoped',
        user_id: 'usr_scoped',
      }),
    ])
    expect(snapshot.user_quotas).toEqual([
      expect.objectContaining({
        id: 'quota_scoped',
        user_id: 'usr_scoped',
      }),
    ])
    expect(snapshot.billing_anomalies.anomalies).toHaveLength(1)
  })
})
