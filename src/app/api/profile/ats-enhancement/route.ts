import type { NextRequest, NextResponse } from 'next/server'

import { POST as postSmartGeneration } from '../smart-generation/route'

export async function POST(request: NextRequest): Promise<NextResponse> {
  return postSmartGeneration(request)
}
