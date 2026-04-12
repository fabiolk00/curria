---
title: CurrIA API Conventions
audience: [developers]
related: [README.md, CODE_STYLE.md, ERROR_HANDLING.md]
status: current
updated: 2026-04-12
---

# API Conventions

Back to [Developer Rules](./README.md) | [All Docs](../INDEX.md)

## Current Route Surface
- `POST /api/agent`
- `GET /api/session`
- `POST /api/session` returns `403`
- `GET /api/session/[id]/messages`
- `GET /api/session/[id]/versions`
- `GET /api/session/[id]/targets`
- `POST /api/session/[id]/targets`
- `GET /api/file/[sessionId]`
- `POST /api/checkout`
- `POST /api/webhook/asaas`
- `POST /api/webhook/clerk`
- `GET /api/cron/cleanup`

## Default route pattern
Use this pattern for authenticated JSON routes when applicable:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'

const BodySchema = z.object({ ... })

export async function POST(req: NextRequest) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }

  try {
    const result = await doThing(appUser.id, body.data)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/route]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## `/api/agent`
- Requires an authenticated app user
- Applies Upstash rate limiting
- Validates `{ sessionId?, message, file?, fileMime? }`
- Creates sessions only through this route
- Session creation is free
- Chat messages are free
- Generation requests must only consume credits after a successful resume-generation outcome
- Supports long-running sessions; the old 30-message cap is not a billing boundary anymore
- Streams SSE responses
- Returns `X-Session-Id` for new sessions
- Emits `sessionCreated` as the earliest SSE event for new sessions
- May persist target-job context before the model loop starts when the current message clearly looks like a vacancy
- May deterministically bootstrap ATS scoring and gap analysis on the first analysis turn when enough resume context already exists
- Executes the tool loop and persists tool patches centrally

## `/api/session`
- `GET` returns the current app user's sessions
- `POST` is intentionally blocked to prevent bypassing the `/api/agent` session/bootstrap flow and related billing guards

## `/api/session/[id]/messages`
- Requires auth
- Verifies ownership through `getSession()`
- Returns recent message history

## `/api/session/[id]/versions`
- Requires auth
- Verifies ownership through `getSession()`
- Returns immutable CV snapshots for that session

## `/api/session/[id]/targets`
- Requires auth
- Verifies ownership through `getSession()`
- `GET` lists target-specific derived resumes
- `POST` creates a target-derived resume without overwriting base `cvState`

## `/api/file/[sessionId]`
- Requires auth
- Verifies ownership through `getSession()`
- Returns transient signed URLs as JSON: `{ docxUrl, pdfUrl }`
- Accepts `?targetId=<id>` for target-specific generated files
- Must not persist signed URLs in session state or target state
- Must only return downloadable URLs for artifacts whose persisted generation status is `ready`

## `/api/checkout`
- Requires auth
- Validates the requested plan with Zod
- Creates an Asaas checkout link

## `/api/webhook/asaas`
- Public webhook
- Verifies `asaas-access-token`
- Parses and validates payload before processing
- Uses processed-event deduplication
- Marks events processed only after successful side effects

## `/api/webhook/clerk`
- Public webhook
- Verifies Svix signature
- Deduplicates with Upstash Redis
- Bootstraps or syncs internal users

## `/api/cron/cleanup`
- Protected by `Authorization: Bearer ${CRON_SECRET}`
- Deletes old `processed_events` rows

## Common status codes
| Situation | Status |
|---|---|
| Success | 200 |
| Created | 201 |
| Bad input | 400 |
| Unauthenticated | 401 |
| Quota exhausted | 402 |
| Forbidden | 403 |
| Not found | 404 |
| Rate limited | 429 |
| Server error | 500 |
