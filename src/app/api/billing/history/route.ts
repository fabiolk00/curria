import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { listBillingHistoryForUser } from '@/lib/billing/credit-activity'
import type { BillingHistory, BillingHistoryResponse } from '@/types/billing'

const querySchema = z.object({
  limit: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
      return value
    }

    return Math.min(Math.max(Math.trunc(parsed), 1), 20)
  }, z.number().int().default(10)),
})

function serializeBillingHistory(history: BillingHistory): BillingHistoryResponse {
  return {
    entries: history.entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}

export async function GET(request: NextRequest) {
  const appUser = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedQuery = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 })
  }

  const history = await listBillingHistoryForUser({
    userId: appUser.id,
    limit: parsedQuery.data.limit,
  })

  return NextResponse.json(serializeBillingHistory(history))
}
