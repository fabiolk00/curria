import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { manualEditSection, ManualEditInputSchema } from '@/lib/agent/tools/manual-edit'
import { CVStateSchema } from '@/lib/cv/schema'
import {
  getResumeTargetForSession,
  updateResumeTargetCvStateWithVersion,
} from '@/lib/db/resume-targets'
import { applyToolPatchWithVersion, getSession, mergeToolPatch } from '@/lib/db/sessions'
import { isLockedPreview } from '@/lib/generated-preview/locked-preview'
import { logWarn } from '@/lib/observability/structured-log'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'

function didCanonicalStateChange(previous: string, next: string): boolean {
  return previous !== next
}

const ResumeEditorSaveSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('base'),
    cvState: CVStateSchema,
  }),
  z.object({
    scope: z.literal('optimized'),
    cvState: CVStateSchema,
  }),
  z.object({
    scope: z.literal('target'),
    targetId: z.string().min(1),
    cvState: CVStateSchema,
  }),
])

const ManualEditRequestSchema = z.union([ManualEditInputSchema, ResumeEditorSaveSchema])

type ResumeEditorSaveInput = z.infer<typeof ResumeEditorSaveSchema>

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

  const trust = validateTrustedMutationRequest(req)
  if (!trust.ok) {
    logWarn('api.session.manual_edit.untrusted_request', {
      appUserId: appUser.id,
      requestMethod: req.method,
      requestPath: req.nextUrl.pathname,
      sessionId: params.id,
      success: false,
      trustSignal: trust.signal,
      trustReason: trust.reason,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = ManualEditRequestSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }

  try {
    if ('scope' in body.data) {
      if (body.data.scope === 'target') {
        const target = await getResumeTargetForSession(session.id, body.data.targetId)

        if (!target) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        if (isLockedPreview(target.generatedOutput)) {
          return NextResponse.json({
            error: 'Este preview gratuito está bloqueado. Faça upgrade e gere novamente para editar a versão real.',
          }, { status: 409 })
        }

        const changed = didCanonicalStateChange(
          JSON.stringify(target.derivedCvState),
          JSON.stringify(body.data.cvState),
        )

        if (!changed) {
          return NextResponse.json({
            success: true,
            scope: 'target',
            targetId: body.data.targetId,
            changed: false,
          })
        }

        await updateResumeTargetCvStateWithVersion({
          sessionId: session.id,
          targetId: body.data.targetId,
          userId: appUser.id,
          derivedCvState: body.data.cvState,
        })

        return NextResponse.json({
          success: true,
          scope: 'target',
          targetId: body.data.targetId,
          changed: true,
        })
      }

      if (body.data.scope === 'optimized') {
        const currentOptimizedCvState = session.agentState.optimizedCvState
        if (!currentOptimizedCvState) {
          return NextResponse.json({ error: 'No optimized resume found for this session.' }, { status: 409 })
        }

        if (isLockedPreview(session.generatedOutput)) {
          return NextResponse.json({
            error: 'Este preview gratuito está bloqueado. Faça upgrade e gere novamente para editar a versão real.',
          }, { status: 409 })
        }

        const changed = didCanonicalStateChange(
          JSON.stringify(currentOptimizedCvState),
          JSON.stringify(body.data.cvState),
        )

        if (!changed) {
          return NextResponse.json({
            success: true,
            scope: 'optimized',
            changed: false,
          })
        }

        await applyToolPatchWithVersion(session, {
          agentState: {
            optimizedCvState: body.data.cvState,
            optimizedAt: new Date().toISOString(),
            rewriteStatus: 'completed',
          },
        })

        return NextResponse.json({
          success: true,
          scope: 'optimized',
          changed: true,
        })
      }

      const changed = didCanonicalStateChange(
        JSON.stringify(session.cvState),
        JSON.stringify(body.data.cvState),
      )

      if (!changed) {
        return NextResponse.json({
          success: true,
          scope: 'base',
          changed: false,
        })
      }

      await applyToolPatchWithVersion(session, { cvState: body.data.cvState }, 'manual')

      return NextResponse.json({
        success: true,
        scope: 'base',
        changed: true,
      })
    }

    const result = await manualEditSection(body.data)

    if (!result.output.success) {
      return NextResponse.json(
        { success: false, error: result.output.error, code: result.output.code },
        { status: getHttpStatusForToolError(result.output.code) },
      )
    }

    const nextSession = mergeToolPatch(session, result.patch ?? {})
    const changed = didCanonicalStateChange(
      JSON.stringify(session.cvState),
      JSON.stringify(nextSession.cvState),
    )

    if (changed && result.patch) {
      await applyToolPatchWithVersion(session, result.patch, 'manual')
    }

    return NextResponse.json({
      ...result.output,
      changed,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
