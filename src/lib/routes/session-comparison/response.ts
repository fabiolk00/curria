import { NextResponse } from 'next/server'

import { assertNever } from '@/lib/routes/shared/exhaustive'

import type { SessionComparisonDecision } from './types'

export function toSessionComparisonResponse(decision: SessionComparisonDecision): NextResponse {
  switch (decision.kind) {
    case 'success':
      return NextResponse.json(decision.body, { status: 200 })
    case 'no_optimized_resume':
    case 'internal_error':
      return NextResponse.json(decision.body, { status: decision.status })
    default:
      return assertNever(decision, 'session comparison decision')
  }
}
