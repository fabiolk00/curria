import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  claimAndProcessJob,
  cleanupOldImportJobs,
  createImportJob,
  getImportJob,
  type ImportJobRow,
} from './import-jobs'
import { LinkedInImportLimitError } from './import-limits'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/db/ids', () => ({
  createDatabaseId: vi.fn(() => 'job_test_123'),
}))

vi.mock('@/lib/db/timestamps', () => ({
  createInsertTimestamps: vi.fn(() => ({
    created_at: '2026-04-07T00:00:00.000Z',
    updated_at: '2026-04-07T00:00:00.000Z',
  })),
  createUpdatedAtTimestamp: vi.fn(() => ({
    updated_at: '2026-04-07T01:00:00.000Z',
  })),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('./import-limits', () => ({
  toLinkedInImportLimitError: vi.fn(),
  LinkedInImportLimitError: class LinkedInImportLimitError extends Error {
    code = 'LINKEDIN_IMPORT_LIMIT_REACHED'
    status = 429
  },
}))

vi.mock('./extract-profile', () => ({
  extractAndSaveProfile: vi.fn(),
}))

import { extractAndSaveProfile } from './extract-profile'
import { toLinkedInImportLimitError } from './import-limits'

// ---------------------------------------------------------------------------
// Supabase chain builder
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock that records every .eq(), .in(), .lt() call
 * and resolves to the configured result when .single() is called, or
 * returns a thenable from non-terminal methods so awaiting the chain
 * without .single() also works (e.g. delete → in → lt → select).
 */
function createChainMock(result: { data: unknown; error: unknown }): any {
  const calls: { method: string; args: unknown[] }[] = []

  const chain: Record<string, (...args: unknown[]) => Record<string, unknown>> = {}

  const self = new Proxy(chain, {
    get(_target, prop: string) {
      if (prop === '_calls') return calls
      // Make the proxy thenable so `await chain.select(...)` resolves
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          Promise.resolve(result).then(resolve, reject)
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args })
        if (prop === 'single') return Promise.resolve(result)
        return self
      }
    },
  })

  return self as unknown as ReturnType<typeof createChainMock>
}

// Track the latest chain per operation so tests can inspect `.eq()` args
let latestChains: Record<string, ReturnType<typeof createChainMock>>

function resetChains() {
  latestChains = {}
}

function makeFrom(overrides: Record<string, () => ReturnType<typeof createChainMock>> = {}) {
  return vi.fn((table: string) => {
    const ops: Record<string, (...args: unknown[]) => unknown> = {}

    for (const op of ['insert', 'select', 'update', 'delete'] as const) {
      ops[op] = (...args: unknown[]) => {
        const key = `${table}.${op}`
        if (overrides[key]) {
          const c = overrides[key]()
          latestChains[key] = c
          // Forward the initial args as a call so tests can see the update payload
          ;(c as unknown as { _calls: { method: string; args: unknown[] }[] })._calls.push({
            method: op,
            args,
          })
          return c
        }
        const c = createChainMock({ data: null, error: null })
        latestChains[key] = c
        ;(c as unknown as { _calls: { method: string; args: unknown[] }[] })._calls.push({
          method: op,
          args,
        })
        return c
      }
    }

    return ops
  })
}

let mockSupabase: {
  from: ReturnType<typeof makeFrom>
  rpc?: ReturnType<typeof vi.fn>
}
let mockRpc: ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JOB_ID = 'job_test_123'
const USER_ID = 'usr_test_1'
const LINKEDIN_URL = 'https://www.linkedin.com/in/testuser/'

function buildPendingJob(overrides: Partial<ImportJobRow> = {}): ImportJobRow {
  return {
    id: JOB_ID,
    user_id: USER_ID,
    linkedin_url: LINKEDIN_URL,
    status: 'pending',
    error_message: null,
    claimed_at: null,
    completed_at: null,
    created_at: '2026-04-07T00:00:00.000Z',
    updated_at: '2026-04-07T00:00:00.000Z',
    ...overrides,
  }
}

function buildProcessingJob(
  claimedAt: string,
  overrides: Partial<ImportJobRow> = {},
): ImportJobRow {
  return buildPendingJob({
    status: 'processing',
    claimed_at: claimedAt,
    ...overrides,
  })
}

/** A claimed_at value 10 minutes in the past — well past the 5-min lease. */
function staleClaimedAt(): string {
  return new Date(Date.now() - 10 * 60 * 1000).toISOString()
}

/** A claimed_at value 1 minute ago — within the lease window. */
function freshClaimedAt(): string {
  return new Date(Date.now() - 1 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Tests: createImportJob
// ---------------------------------------------------------------------------

describe('createImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChains()
    mockRpc = vi.fn()
  })

  it('creates a pending row through the limiting RPC and returns the job ID', async () => {
    mockSupabase = {
      from: makeFrom(),
      rpc: mockRpc.mockResolvedValue({ data: [{ id: JOB_ID }], error: null }),
    }

    const result = await createImportJob(USER_ID, LINKEDIN_URL)
    expect(result).toEqual({ jobId: JOB_ID })
    expect(mockRpc).toHaveBeenCalledWith('create_linkedin_import_job', {
      p_user_id: USER_ID,
      p_linkedin_url: LINKEDIN_URL,
    })
  })

  it('throws on insert failure', async () => {
    mockSupabase = {
      from: makeFrom(),
      rpc: mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key' },
      }),
    }

    await expect(createImportJob(USER_ID, LINKEDIN_URL)).rejects.toThrow(
      'Failed to create import job: duplicate key',
    )
  })

  it('surfaces the mapped limit error from the RPC', async () => {
    mockSupabase = {
      from: makeFrom(),
      rpc: mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'FREE_TRIAL_LINKEDIN_IMPORT_LIMIT_REACHED' },
      }),
    }

    vi.mocked(toLinkedInImportLimitError).mockReturnValueOnce(
      new LinkedInImportLimitError('limit reached'),
    )

    await expect(createImportJob(USER_ID, LINKEDIN_URL)).rejects.toThrow('limit reached')
  })
})

// ---------------------------------------------------------------------------
// Tests: getImportJob
// ---------------------------------------------------------------------------

describe('getImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChains()
  })

  it('returns the job when found', async () => {
    const job = buildPendingJob()
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.select': () =>
          createChainMock({ data: job, error: null }),
      }),
    }

    const result = await getImportJob(JOB_ID, USER_ID)
    expect(result).toEqual(job)
  })

  it('returns null when no row matches (PGRST116)', async () => {
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.select': () =>
          createChainMock({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
      }),
    }

    const result = await getImportJob(JOB_ID, USER_ID)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: claimAndProcessJob
// ---------------------------------------------------------------------------

describe('claimAndProcessJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChains()
  })

  it('claims a pending job, extracts, and persists completed', async () => {
    const claimedRow = buildProcessingJob('2026-04-07T01:00:00.000Z')
    const completedRow = buildPendingJob({ status: 'completed', completed_at: '2026-04-07T01:01:00.000Z' })

    let updateCallCount = 0
    mockSupabase = {
      from: makeFrom({
        // First update: atomicClaim from 'pending' → succeeds
        // Second update: persistTerminalStatus → succeeds
        'linkedin_import_jobs.update': () => {
          updateCallCount++
          if (updateCallCount === 1) {
            return createChainMock({ data: claimedRow, error: null })
          }
          return createChainMock({ data: completedRow, error: null })
        },
      }),
    }

    vi.mocked(extractAndSaveProfile).mockResolvedValueOnce({
      cvState: { fullName: 'Test', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
    })

    const result = await claimAndProcessJob(JOB_ID, USER_ID)
    expect(result.status).toBe('completed')
    expect(extractAndSaveProfile).toHaveBeenCalledWith(LINKEDIN_URL, USER_ID)
  })

  it('persists failed status when extraction throws', async () => {
    const claimedRow = buildProcessingJob('2026-04-07T01:00:00.000Z')
    const failedRow = buildPendingJob({ status: 'failed', error_message: 'API timeout' })

    let updateCallCount = 0
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.update': () => {
          updateCallCount++
          if (updateCallCount === 1) {
            return createChainMock({ data: claimedRow, error: null })
          }
          return createChainMock({ data: failedRow, error: null })
        },
      }),
    }

    vi.mocked(extractAndSaveProfile).mockRejectedValueOnce(new Error('API timeout'))

    const result = await claimAndProcessJob(JOB_ID, USER_ID)
    expect(result.status).toBe('failed')
    expect(result.error_message).toBe('API timeout')
  })

  it('throws when terminal status persistence fails', async () => {
    const claimedRow = buildProcessingJob('2026-04-07T01:00:00.000Z')

    let updateCallCount = 0
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.update': () => {
          updateCallCount++
          if (updateCallCount === 1) {
            return createChainMock({ data: claimedRow, error: null })
          }
          // Both persistTerminalStatus calls fail — no row matched (ownership fencing)
          return createChainMock({
            data: null,
            error: { code: 'PGRST116', message: 'no rows' },
          })
        },
      }),
    }

    vi.mocked(extractAndSaveProfile).mockResolvedValueOnce({
      cvState: { fullName: 'Test', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
    })

    // When completed persistence fails, the catch tries to persist 'failed',
    // which also fails (same mock), so the final throw is about 'failed'.
    await expect(claimAndProcessJob(JOB_ID, USER_ID)).rejects.toThrow(
      /Failed to persist failed/,
    )
  })

  it('returns current state when job is already completed', async () => {
    const completedJob = buildPendingJob({ status: 'completed' })

    let selectCallCount = 0
    mockSupabase = {
      from: makeFrom({
        // atomicClaim from 'pending' → no row (already transitioned)
        'linkedin_import_jobs.update': () =>
          createChainMock({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
        // getImportJob → returns completed
        'linkedin_import_jobs.select': () => {
          selectCallCount++
          return createChainMock({ data: completedJob, error: null })
        },
      }),
    }

    const result = await claimAndProcessJob(JOB_ID, USER_ID)
    expect(result.status).toBe('completed')
    expect(extractAndSaveProfile).not.toHaveBeenCalled()
  })

  it('returns current state when processing job is not stale', async () => {
    const freshProcessingJob = buildProcessingJob(freshClaimedAt())

    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.update': () =>
          createChainMock({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
        'linkedin_import_jobs.select': () =>
          createChainMock({ data: freshProcessingJob, error: null }),
      }),
    }

    const result = await claimAndProcessJob(JOB_ID, USER_ID)
    expect(result.status).toBe('processing')
    expect(extractAndSaveProfile).not.toHaveBeenCalled()
  })

  it('reclaims a stale processing job with fenced claimed_at', async () => {
    const oldClaimedAt = staleClaimedAt()
    const staleJob = buildProcessingJob(oldClaimedAt)
    const reclaimedRow = buildProcessingJob('2026-04-07T02:00:00.000Z')
    const completedRow = buildPendingJob({ status: 'completed' })

    let updateCallCount = 0
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.update': () => {
          updateCallCount++
          if (updateCallCount === 1) {
            // First claim attempt from 'pending' fails
            return createChainMock({ data: null, error: { code: 'PGRST116', message: 'not found' } })
          }
          if (updateCallCount === 2) {
            // Reclaim from 'processing' with fenced claimed_at succeeds
            return createChainMock({ data: reclaimedRow, error: null })
          }
          // Terminal write succeeds
          return createChainMock({ data: completedRow, error: null })
        },
        'linkedin_import_jobs.select': () =>
          createChainMock({ data: staleJob, error: null }),
      }),
    }

    vi.mocked(extractAndSaveProfile).mockResolvedValueOnce({
      cvState: { fullName: 'Test', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
    })

    const result = await claimAndProcessJob(JOB_ID, USER_ID)
    expect(result.status).toBe('completed')
    expect(extractAndSaveProfile).toHaveBeenCalledOnce()
  })

  it('concurrent reclaim: second poll fails to claim when first already reclaimed', async () => {
    // Simulates: both polls read the same stale row, but only one wins the fenced UPDATE
    const oldClaimedAt = staleClaimedAt()
    const staleJob = buildProcessingJob(oldClaimedAt)
    // After first reclaim, the job now has a fresh claimed_at
    const freshJob = buildProcessingJob(freshClaimedAt())

    let updateCallCount = 0
    let selectCallCount = 0
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.update': () => {
          updateCallCount++
          if (updateCallCount === 1) {
            // pending claim fails
            return createChainMock({ data: null, error: { code: 'PGRST116', message: 'not found' } })
          }
          // Reclaim fails — the fenced claimed_at no longer matches because
          // another poll already reclaimed and set a new claimed_at
          return createChainMock({ data: null, error: { code: 'PGRST116', message: 'not found' } })
        },
        'linkedin_import_jobs.select': () => {
          selectCallCount++
          if (selectCallCount === 1) {
            // First read sees stale job (this poll observed it before reclaim)
            return createChainMock({ data: staleJob, error: null })
          }
          // Shouldn't be called again, but if it is return the fresh state
          return createChainMock({ data: freshJob, error: null })
        },
      }),
    }

    // The second poll should return the stale snapshot without extracting
    const result = await claimAndProcessJob(JOB_ID, USER_ID)
    expect(result.status).toBe('processing')
    expect(extractAndSaveProfile).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: cleanupOldImportJobs
// ---------------------------------------------------------------------------

describe('cleanupOldImportJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChains()
  })

  it('deletes old terminal jobs and resets stale processing jobs', async () => {
    let opCount = 0
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.delete': () =>
          createChainMock({ data: [{ id: '1' }, { id: '2' }], error: null }),
        'linkedin_import_jobs.update': () =>
          createChainMock({ data: [{ id: '3' }], error: null }),
      }),
    }

    const result = await cleanupOldImportJobs(1)
    expect(result).toBe(3) // 2 deleted + 1 reset
  })

  it('throws when delete fails', async () => {
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.delete': () =>
          createChainMock({ data: null, error: { message: 'permission denied' } }),
      }),
    }

    await expect(cleanupOldImportJobs(1)).rejects.toThrow()
  })

  it('throws when stale reset fails', async () => {
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.delete': () =>
          createChainMock({ data: [], error: null }),
        'linkedin_import_jobs.update': () =>
          createChainMock({ data: null, error: { message: 'connection lost' } }),
      }),
    }

    await expect(cleanupOldImportJobs(1)).rejects.toThrow()
  })

  it('returns 0 when nothing to clean', async () => {
    mockSupabase = {
      from: makeFrom({
        'linkedin_import_jobs.delete': () =>
          createChainMock({ data: [], error: null }),
        'linkedin_import_jobs.update': () =>
          createChainMock({ data: [], error: null }),
      }),
    }

    const result = await cleanupOldImportJobs(1)
    expect(result).toBe(0)
  })
})
