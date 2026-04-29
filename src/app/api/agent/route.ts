import type { NextRequest } from 'next/server'

import { handleAgentPost } from '@/lib/agent/request-orchestrator'
import { withRequestQueryTracking } from '@/lib/observability/request-query-tracking'

// Deprecated compatibility route for the retired open-ended chat surface.
// New resume generation callers must use POST /api/profile/smart-generation.
export async function POST(req: NextRequest) {
  return withRequestQueryTracking(req, async () => handleAgentPost(req))
}
