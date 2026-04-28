import type { NextRequest } from 'next/server'

import {
  getRequestQueryContext,
  runWithRequestQueryContext,
} from '@/lib/observability/request-query-context'
import { summarizePatternStats } from '@/lib/observability/query-fingerprint'
import { logInfo, logWarn } from '@/lib/observability/structured-log'

const DEFAULT_QUERY_THRESHOLD = 15

function readThresholdFromEnv(): number {
  const rawThreshold = process.env.DB_QUERY_WARNING_THRESHOLD?.trim()
  if (!rawThreshold) {
    return DEFAULT_QUERY_THRESHOLD
  }

  const parsedThreshold = Number.parseInt(rawThreshold, 10)
  return Number.isFinite(parsedThreshold) && parsedThreshold > 0
    ? parsedThreshold
    : DEFAULT_QUERY_THRESHOLD
}

export async function withRequestQueryTracking<T>(
  req: NextRequest,
  run: () => Promise<T>,
  threshold = readThresholdFromEnv(),
): Promise<T> {
  return runWithRequestQueryContext(
    {
      requestId: crypto.randomUUID(),
      requestMethod: req.method,
      requestPath: req.nextUrl.pathname,
    },
    async () => {
      let result!: T

      try {
        result = await run()
      } finally {
        if (!isServerSentEventResponse(result)) {
          flushRequestQueryTracking(threshold)
        }
      }

      return result
    },
  )
}

export function flushRequestQueryTracking(
  threshold = readThresholdFromEnv(),
): void {
  const context = getRequestQueryContext()
  if (!context || context.completed) {
    return
  }

  context.completed = true

  const patternSummary = summarizePatternStats(context.patternStats)
  const suspectedNPlusOne = thresholdExceeded({
    queryCount: context.queryCount,
    threshold,
    maxRepeatedPatternCount: patternSummary.maxRepeatedPatternCount,
  })

  const payload = {
    requestId: context.requestId,
    requestMethod: context.requestMethod,
    requestPath: context.requestPath,
    queryCount: context.queryCount,
    threshold,
    latencyMs: Date.now() - context.startedAt,
    uniqueQueryPatternCount: patternSummary.uniqueQueryPatternCount,
    repeatedQueryPatternCount: patternSummary.repeatedQueryPatternCount,
    maxRepeatedPatternCount: patternSummary.maxRepeatedPatternCount,
    suspectedNPlusOne,
  }

  logInfo('db.request_queries', payload)

  if (context.queryCount > threshold) {
    const warningEvent = suspectedNPlusOne
      ? 'db.n_plus_one_threshold_exceeded'
      : 'db.query_count_threshold_exceeded'
    logWarn(warningEvent, {
      ...payload,
      sampledQueries: context.queries,
      topRepeatedQueryPatterns: patternSummary.topRepeatedQueryPatterns,
    })
  }
}

function isServerSentEventResponse(value: unknown): value is Response {
  return value instanceof Response
    && value.headers.get('Content-Type')?.toLowerCase().includes('text/event-stream') === true
}

function thresholdExceeded(input: {
  queryCount: number
  threshold: number
  maxRepeatedPatternCount: number
}): boolean {
  return input.queryCount > input.threshold
    && input.maxRepeatedPatternCount >= 3
}
