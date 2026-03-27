import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession } from '@/lib/db/sessions'
import { dispatchTool } from '@/lib/agent/tools'

const BodySchema = z.object({
  itemType: z.enum(['missing_skill', 'weak_area', 'suggestion']),
  itemValue: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(params.id, appUser.id)
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }

  try {
    const rawResult = await dispatchTool('apply_gap_action', {
      item_type: body.data.itemType,
      item_value: body.data.itemValue,
    }, session)
    const result = JSON.parse(rawResult) as {
      success: boolean
      error?: string
      section?: string
      item_type?: string
      item_value?: string
      rewritten_content?: string
      section_data?: unknown
      keywords_added?: string[]
      changes_made?: string[]
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Gap action failed.' }, { status: 400 })
    }

    return NextResponse.json({
      result,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
