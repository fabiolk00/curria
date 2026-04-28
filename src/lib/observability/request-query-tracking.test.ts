import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { recordQuery } from './request-query-context'
import { withRequestQueryTracking } from './request-query-tracking'
import { logInfo, logWarn } from './structured-log'

vi.mock('./structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

describe('request-query-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always emits a summary log and skips the warning at or below threshold', async () => {
    const request = new NextRequest('https://example.com/api/session/sess_123', {
      method: 'GET',
    })

    await withRequestQueryTracking(
      request,
      async () => {
        recordQuery('GET /rest/v1/sessions?id=eq.sess_123')
        recordQuery('GET /rest/v1/resume_targets?session_id=eq.sess_123')
        return 'ok'
      },
      2,
    )

    expect(logInfo).toHaveBeenCalledWith(
      'db.request_queries',
      expect.objectContaining({
        requestMethod: 'GET',
        requestPath: '/api/session/sess_123',
        queryCount: 2,
        threshold: 2,
        uniqueQueryPatternCount: 2,
        repeatedQueryPatternCount: 0,
        maxRepeatedPatternCount: 0,
        suspectedNPlusOne: false,
      }),
    )
    expect(logWarn).not.toHaveBeenCalled()
  })

  it('emits a warning with repeated pattern summaries when the threshold is exceeded', async () => {
    const request = new NextRequest('https://example.com/api/file/sess_123', {
      method: 'GET',
    })

    await withRequestQueryTracking(
      request,
      async () => {
        recordQuery('GET /rest/v1/jobs?id=eq.123&select=*')
        recordQuery('GET /rest/v1/jobs?id=eq.456&select=*')
        recordQuery('GET /rest/v1/jobs?id=eq.789&select=*')
        return 'ok'
      },
      2,
    )

    expect(logInfo).toHaveBeenCalledTimes(1)
    expect(logWarn).toHaveBeenCalledWith(
      'db.n_plus_one_threshold_exceeded',
      expect.objectContaining({
        requestMethod: 'GET',
        requestPath: '/api/file/sess_123',
        queryCount: 3,
        threshold: 2,
        uniqueQueryPatternCount: 1,
        repeatedQueryPatternCount: 1,
        maxRepeatedPatternCount: 3,
        suspectedNPlusOne: true,
        sampledQueries: [
          'GET /rest/v1/jobs?id=eq.123&select=*',
          'GET /rest/v1/jobs?id=eq.456&select=*',
          'GET /rest/v1/jobs?id=eq.789&select=*',
        ],
        topRepeatedQueryPatterns: [{
          fingerprint: 'GET /rest/v1/jobs?id=eq.:number&select=*',
          sample: 'GET /rest/v1/jobs?id=eq.123&select=*',
          count: 3,
        }],
      }),
    )
  })

  it('does not mark high-count diverse traffic as suspected N+1 when no pattern repeats enough', async () => {
    const request = new NextRequest('https://example.com/api/file/sess_123', {
      method: 'GET',
    })

    await withRequestQueryTracking(
      request,
      async () => {
        recordQuery('GET /rest/v1/jobs?id=eq.123')
        recordQuery('GET /rest/v1/sessions?id=eq.sess_123')
        recordQuery('GET /rest/v1/resume_targets?session_id=eq.target_123')
        return 'ok'
      },
      2,
    )

    expect(logWarn).toHaveBeenCalledWith(
      'db.query_count_threshold_exceeded',
      expect.objectContaining({
        queryCount: 3,
        threshold: 2,
        uniqueQueryPatternCount: 3,
        repeatedQueryPatternCount: 0,
        maxRepeatedPatternCount: 0,
        suspectedNPlusOne: false,
        topRepeatedQueryPatterns: [],
      }),
    )
  })
})
