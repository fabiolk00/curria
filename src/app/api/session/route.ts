import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { db } from '@/lib/db/sessions'
import { logError, logWarn, serializeError } from '@/lib/observability/structured-log'

export async function GET(req: NextRequest) {
  const requestPath = req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.session.list_unauthorized', {
      requestMethod: req.method,
      requestPath,
      success: false,
    })

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sessions = await db.getUserSessions(appUser.id)
    return NextResponse.json({ sessions })
  } catch (err) {
    logError('api.session.list_failed', {
      requestMethod: req.method,
      requestPath,
      appUserId: appUser.id,
      success: false,
      ...serializeError(err),
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const requestPath = req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.session.create_unauthorized', {
      requestMethod: req.method,
      requestPath,
      success: false,
    })

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Do NOT allow direct session creation via this endpoint
  // Sessions must be created through /api/agent which handles credit consumption
  // Allowing direct session creation bypasses the credit system
  logWarn('api.session.create_blocked', {
    requestMethod: req.method,
    requestPath,
    appUserId: appUser.id,
    success: false,
  })

  return NextResponse.json({
    error: 'Direct session creation not allowed. Send a message to /api/agent to start a session.',
  }, { status: 403 })

  /* DISABLED - Credit bypass vulnerability
  try {
    const session = await db.createSession(appUser.id)
    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    console.error('[api/session POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  */
}
