import { NextResponse } from 'next/server'

import { assertNever } from '@/lib/routes/shared/exhaustive'

import type { SmartGenerationDecision } from './types'

export function toSmartGenerationResponse(decision: SmartGenerationDecision): NextResponse {
  switch (decision.kind) {
    case 'success':
      return NextResponse.json(decision.body, { status: decision.status ?? 200 })
    case 'validation_error':
      return NextResponse.json(decision.body, { status: decision.status })
    default:
      return assertNever(decision, 'smart generation decision')
  }
}
