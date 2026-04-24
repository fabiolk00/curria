import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  listResumeGenerationHistory,
} from '@/lib/resume-history/resume-generation-history'

const querySchema = z.object({
  page: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
      return value
    }

    return Math.max(Math.trunc(parsed), 1)
  }, z.number().int().default(1)),
  limit: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
      return value
    }

    return Math.min(Math.max(Math.trunc(parsed), 1), 4)
  }, z.number().int().default(4)),
})

export async function GET(request: NextRequest) {
  const appUser = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedQuery = querySchema.safeParse({
    page: request.nextUrl.searchParams.get('page') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 })
  }

  const history = await listResumeGenerationHistory({
    userId: appUser.id,
    page: parsedQuery.data.page,
    limit: parsedQuery.data.limit,
  })

  return NextResponse.json(history)
}
