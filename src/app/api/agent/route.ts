import type { NextRequest } from 'next/server'

import { handleAgentPost } from '@/lib/agent/request-orchestrator'

export async function POST(req: NextRequest) {
  return handleAgentPost(req)
}
