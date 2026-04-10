import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession, getMessages } from '@/lib/db/sessions'
import { logError, logWarn, serializeError } from '@/lib/observability/structured-log'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const requestPath = req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.session.messages_unauthorized', {
      requestMethod: req.method,
      requestPath,
      sessionId: params.id,
      success: false,
    })

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(params.id, appUser.id)
  if (!session) {
    logWarn('api.session.messages_not_found', {
      requestMethod: req.method,
      requestPath,
      sessionId: params.id,
      appUserId: appUser.id,
      success: false,
    })

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const messages = await getMessages(params.id, 50)
    return NextResponse.json({ messages })
  } catch (err) {
    logError('api.session.messages_failed', {
      requestMethod: req.method,
      requestPath,
      sessionId: params.id,
      appUserId: appUser.id,
      success: false,
      ...serializeError(err),
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
