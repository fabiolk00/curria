import { NextRequest, NextResponse } from 'next/server'

import { toNextJsonResponse } from '@/lib/routes/shared/response'
import { resolveSmartGenerationContext } from '@/lib/routes/smart-generation/context'
import { executeSmartGenerationDecision } from '@/lib/routes/smart-generation/decision'
import { toSmartGenerationResponse } from '@/lib/routes/smart-generation/response'

export const maxDuration = 300

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Execution order:
  // 1. resolve request context
  // 2. execute generation decision and orchestration
  // 3. map normalized outcomes to HTTP
  const contextResult = await resolveSmartGenerationContext(request)
  if (contextResult.kind === 'blocked') {
    return toNextJsonResponse(contextResult.response)
  }

  const decision = await executeSmartGenerationDecision(contextResult.context)
  return toSmartGenerationResponse(decision)
}
