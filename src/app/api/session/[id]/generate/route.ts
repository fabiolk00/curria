import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchTool } from '@/lib/agent/tools'
import { getSession } from '@/lib/db/sessions'

const BodySchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('base'),
  }),
  z.object({
    scope: z.literal('target'),
    targetId: z.string().min(1),
  }),
])

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
    const rawResult = await dispatchTool('generate_file', {
      cv_state: session.cvState,
      target_id: body.data.scope === 'target' ? body.data.targetId : undefined,
    }, session)
    const result = JSON.parse(rawResult) as {
      success: boolean
      error?: string
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Generation failed.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      scope: body.data.scope,
      targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
