import { NextRequest, NextResponse } from 'next/server'

import { toNextJsonResponse } from '@/lib/routes/shared/response'
import { resolveSessionComparisonContext } from '@/lib/routes/session-comparison/context'
import { decideSessionComparison } from '@/lib/routes/session-comparison/decision'
import { toSessionComparisonResponse } from '@/lib/routes/session-comparison/response'

// Compatibility-only dashboard surface: keep GET /api/session/[id]/comparison public without repointing consumers.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const contextResult = await resolveSessionComparisonContext(req, params)
  if (contextResult.kind === 'blocked') {
    return toNextJsonResponse(contextResult.response)
  }

  const decision = await decideSessionComparison(contextResult.context)
  return toSessionComparisonResponse(decision)
}
