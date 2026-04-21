import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { manualEditSection, ManualEditInputSchema } from '@/lib/agent/tools/manual-edit'
import { CVStateSchema } from '@/lib/cv/schema'
import {
  getResumeTargetForSession,
  updateResumeTargetGeneratedOutput,
  updateResumeTargetCvStateWithVersion,
} from '@/lib/db/resume-targets'
import { applyToolPatchWithVersion, getSession, mergeToolPatch } from '@/lib/db/sessions'
import { isLockedPreview } from '@/lib/generated-preview/locked-preview'
import { listJobsForSession } from '@/lib/jobs/repository'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import type { GeneratedOutput, ToolPatch } from '@/types/agent'
import type { JobStatusSnapshot } from '@/types/jobs'

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

function createInvalidatedGeneratedOutputPatch(): Partial<GeneratedOutput> {
  return {
    status: 'idle',
    docxPath: undefined,
    pdfPath: undefined,
    generatedAt: undefined,
    error: undefined,
    previewAccess: undefined,
  }
}

function createManualEditPersistenceLogFields(input: {
  sessionId: string
  targetId?: string
  scope: 'base' | 'optimized' | 'target'
  changed: boolean
  invalidatedArtifact: boolean
}): Record<string, string | boolean | undefined> {
  return {
    sessionId: input.sessionId,
    targetId: input.targetId,
    scope: input.scope,
    changed: input.changed,
    invalidatedArtifact: input.invalidatedArtifact,
  }
}

function isActiveArtifactJob(job: JobStatusSnapshot): boolean {
  return job.type === 'artifact_generation' && (job.status === 'queued' || job.status === 'running')
}

async function getActiveArtifactJobForScope(input: {
  userId: string
  sessionId: string
  targetId?: string
}): Promise<JobStatusSnapshot | null> {
  const jobs = await listJobsForSession({
    userId: input.userId,
    sessionId: input.sessionId,
    type: 'artifact_generation',
    resumeTargetId: input.targetId ?? null,
    limit: 5,
  })

  return jobs.find(isActiveArtifactJob) ?? null
}

function logManualSaveWithActiveExport(input: {
  sessionId: string
  scope: 'base' | 'optimized' | 'target'
  targetId?: string
  activeJob: JobStatusSnapshot
}) {
  logInfo('resume_export.lock_detected_on_manual_save', {
    sessionId: input.sessionId,
    scope: input.scope,
    targetId: input.targetId,
    jobId: input.activeJob.jobId,
    stage: input.activeJob.stage,
  })

  logInfo('resume_manual_save_allowed_after_lock_resolution', {
    sessionId: input.sessionId,
    scope: input.scope,
    targetId: input.targetId,
    resolution: 'kept_existing_artifact_until_export_finishes',
    jobId: input.activeJob.jobId,
  })
}

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
        const activeArtifactJob = changed
          ? await getActiveArtifactJobForScope({
            userId: appUser.id,
            sessionId: session.id,
            targetId: body.data.targetId,
          })
          : null

        if (!changed) {
          logInfo('resume_manual_edit.saved', createManualEditPersistenceLogFields({
            sessionId: session.id,
            targetId: body.data.targetId,
            scope: 'target',
            changed: false,
            invalidatedArtifact: false,
          }))
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
        if (activeArtifactJob) {
          logManualSaveWithActiveExport({
            sessionId: session.id,
            targetId: body.data.targetId,
            scope: 'target',
            activeJob: activeArtifactJob,
          })
        } else {
          await updateResumeTargetGeneratedOutput(
            session.id,
            body.data.targetId,
            createInvalidatedGeneratedOutputPatch() as GeneratedOutput,
          )
          logInfo('resume_export.stale_artifact_invalidated', {
            sessionId: session.id,
            targetId: body.data.targetId,
            scope: 'target',
          })
        }

        logInfo('resume_manual_edit.persisted', createManualEditPersistenceLogFields({
          sessionId: session.id,
          targetId: body.data.targetId,
          scope: 'target',
          changed: true,
          invalidatedArtifact: !activeArtifactJob,
        }))

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
        const activeArtifactJob = changed
          ? await getActiveArtifactJobForScope({
            userId: appUser.id,
            sessionId: session.id,
          })
          : null

        if (!changed) {
          logInfo('resume_manual_edit.saved', createManualEditPersistenceLogFields({
            sessionId: session.id,
            scope: 'optimized',
            changed: false,
            invalidatedArtifact: false,
          }))
          return NextResponse.json({
            success: true,
            scope: 'optimized',
            changed: false,
          })
        }

        const patch: ToolPatch = {
          agentState: {
            optimizedCvState: body.data.cvState,
            optimizedAt: new Date().toISOString(),
            rewriteStatus: 'completed',
          },
        }
        if (!activeArtifactJob) {
          patch.generatedOutput = createInvalidatedGeneratedOutputPatch()
        }

        await applyToolPatchWithVersion(session, patch)
        if (activeArtifactJob) {
          logManualSaveWithActiveExport({
            sessionId: session.id,
            scope: 'optimized',
            activeJob: activeArtifactJob,
          })
        } else {
          logInfo('resume_export.stale_artifact_invalidated', {
            sessionId: session.id,
            scope: 'optimized',
          })
        }

        logInfo('resume_manual_edit.persisted', createManualEditPersistenceLogFields({
          sessionId: session.id,
          scope: 'optimized',
          changed: true,
          invalidatedArtifact: !activeArtifactJob,
        }))

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
        logInfo('resume_manual_edit.saved', createManualEditPersistenceLogFields({
          sessionId: session.id,
          scope: 'base',
          changed: false,
          invalidatedArtifact: false,
        }))
        return NextResponse.json({
          success: true,
          scope: 'base',
          changed: false,
        })
      }

      const activeArtifactJob = !session.agentState.optimizedCvState
        ? await getActiveArtifactJobForScope({
          userId: appUser.id,
          sessionId: session.id,
        })
        : null
      const shouldInvalidateArtifact = !session.agentState.optimizedCvState && !activeArtifactJob
      const patch: ToolPatch = { cvState: body.data.cvState }
      if (shouldInvalidateArtifact) {
        patch.generatedOutput = createInvalidatedGeneratedOutputPatch()
      }

      await applyToolPatchWithVersion(session, patch, 'manual')
      if (activeArtifactJob) {
        logManualSaveWithActiveExport({
          sessionId: session.id,
          scope: 'base',
          activeJob: activeArtifactJob,
        })
      } else if (shouldInvalidateArtifact) {
        logInfo('resume_export.stale_artifact_invalidated', {
          sessionId: session.id,
          scope: 'base',
        })
      }

      logInfo('resume_manual_edit.persisted', createManualEditPersistenceLogFields({
        sessionId: session.id,
        scope: 'base',
        changed: true,
        invalidatedArtifact: shouldInvalidateArtifact,
      }))

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
      const activeArtifactJob = !session.agentState.optimizedCvState
        ? await getActiveArtifactJobForScope({
          userId: appUser.id,
          sessionId: session.id,
        })
        : null
      const shouldInvalidateArtifact = !session.agentState.optimizedCvState && !activeArtifactJob
      const patch: ToolPatch = {
        ...result.patch,
        generatedOutput: shouldInvalidateArtifact
          ? createInvalidatedGeneratedOutputPatch()
          : result.patch.generatedOutput,
      }

      await applyToolPatchWithVersion(session, patch, 'manual')
      if (activeArtifactJob) {
        logManualSaveWithActiveExport({
          sessionId: session.id,
          scope: 'base',
          activeJob: activeArtifactJob,
        })
      } else if (shouldInvalidateArtifact) {
        logInfo('resume_export.stale_artifact_invalidated', {
          sessionId: session.id,
          scope: 'base',
        })
      }

      logInfo('resume_manual_edit.persisted', createManualEditPersistenceLogFields({
        sessionId: session.id,
        scope: 'base',
        changed: true,
        invalidatedArtifact: shouldInvalidateArtifact,
      }))
    } else {
      logInfo('resume_manual_edit.saved', createManualEditPersistenceLogFields({
        sessionId: session.id,
        scope: 'base',
        changed,
        invalidatedArtifact: false,
      }))
    }

    return NextResponse.json({
      ...result.output,
      changed,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
