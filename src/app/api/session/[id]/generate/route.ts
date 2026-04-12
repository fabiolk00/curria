import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getHttpStatusForToolError, isToolFailure } from '@/lib/agent/tool-errors'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchTool } from '@/lib/agent/tools'
import { getSession } from '@/lib/db/sessions'

const BodySchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('base'),
    clientRequestId: z.string().min(1).max(200).optional(),
  }),
  z.object({
    scope: z.literal('target'),
    targetId: z.string().min(1),
    clientRequestId: z.string().min(1).max(200).optional(),
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
      idempotency_key: body.data.clientRequestId,
    }, session)
    const result = JSON.parse(rawResult) as unknown

    if (isToolFailure(result)) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: getHttpStatusForToolError(result.code) },
      )
    }

    return NextResponse.json({
      success: true,
      scope: body.data.scope,
      targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
      creditsUsed: (result as { creditsUsed?: number }).creditsUsed ?? 0,
      generationType: body.data.scope === 'target' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT',
      resumeGenerationId: (result as { resumeGenerationId?: string }).resumeGenerationId,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
