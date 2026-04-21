import { NextResponse } from 'next/server'

import { createSignedResumeArtifactUrls } from '@/lib/agent/tools/generate-file'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logError, logInfo, serializeError } from '@/lib/observability/structured-log'
import { buildResumeExportFilename } from '@/lib/resume/export-filename'
import { assertNever } from '@/lib/routes/shared/exhaustive'

import type { FileAccessContext, FileAccessDecision } from './types'

function buildPdfFileName(context: FileAccessContext): string {
  return buildResumeExportFilename({
    fullName: context.session.cvState.fullName,
    workflowMode: context.targetId
      ? 'job_targeting'
      : context.session.agentState.lastRewriteMode ?? context.session.agentState.workflowMode,
    targetRole: context.session.agentState.targetingPlan?.targetRole,
    targetRoleConfidence: context.session.agentState.targetingPlan?.targetRoleConfidence ?? null,
    targetJobDescription: context.target?.targetJobDescription ?? context.session.agentState.targetJobDescription,
    extension: 'pdf',
  })
}

export async function toFileAccessResponse(
  context: FileAccessContext,
  decision: FileAccessDecision,
): Promise<NextResponse> {
  const pdfFileName = buildPdfFileName(context)

  switch (decision.kind) {
    case 'artifact_unavailable':
      logInfo('resume_export.download_unavailable_state', {
        sessionId: context.session.id,
        targetId: context.targetId,
        resumeTargetId: context.target?.id ?? null,
        generationStatus: decision.log.generationStatus,
        lifecycleStatus: decision.log.lifecycleStatus,
        stage: decision.log.stage,
        jobId: decision.log.jobId,
      })
      logInfo('api.file.download_urls_unavailable', {
        requestMethod: context.request.method,
        requestPath: context.requestPath,
        sessionId: context.session.id,
        targetId: context.targetId,
        resumeTargetId: context.target?.id ?? null,
        appUserId: context.appUser.id,
        jobId: decision.log.jobId,
        type: 'artifact_generation',
        status: decision.log.lifecycleStatus,
        generationStatus: decision.log.generationStatus,
        stage: decision.log.stage,
        success: true,
        latencyMs: Date.now() - context.requestStartedAt,
      })
      return NextResponse.json(
        {
          ...decision.body,
          pdfFileName,
        },
        { status: 200 },
      )
    case 'locked_preview':
      recordMetricCounter('architecture.file.locked_preview_responses')
      return NextResponse.json({
        ...decision.body,
        pdfFileName,
      })
    case 'artifact_available':
      recordMetricCounter('architecture.file.artifact_available_responses')
      try {
        const signedUrls = await createSignedResumeArtifactUrls(undefined, decision.pdfPath)

        logInfo('resume_export.used_latest_resume_state', {
          sessionId: context.session.id,
          targetId: context.targetId,
          resumeTargetId: context.target?.id ?? null,
          generationStatus: decision.log.generationStatus,
          stage: decision.log.stage,
        })

        logInfo('api.file.download_urls_ready', {
          requestMethod: context.request.method,
          requestPath: context.requestPath,
          sessionId: context.session.id,
          targetId: context.targetId,
          resumeTargetId: context.target?.id ?? null,
          appUserId: context.appUser.id,
          jobId: decision.log.jobId,
          type: 'artifact_generation',
          status: decision.log.lifecycleStatus,
          generationStatus: decision.log.generationStatus,
          stage: decision.log.stage,
          success: true,
          latencyMs: Date.now() - context.requestStartedAt,
        })

        return NextResponse.json({
          ...decision.body,
          pdfFileName,
          pdfUrl: signedUrls.pdfUrl,
        })
      } catch (error) {
        logError('api.file.download_urls_failed', {
          requestMethod: context.request.method,
          requestPath: context.requestPath,
          sessionId: context.session.id,
          targetId: context.targetId,
          resumeTargetId: context.target?.id ?? null,
          appUserId: context.appUser.id,
          jobId: decision.log.jobId,
          type: 'artifact_generation',
          status: decision.log.lifecycleStatus,
          generationStatus: decision.log.generationStatus,
          stage: decision.log.stage,
          success: false,
          latencyMs: Date.now() - context.requestStartedAt,
          ...serializeError(error),
        })

        return NextResponse.json(
          { error: 'Generated resume artifacts could not be retrieved.' },
          { status: 404 },
        )
      }
    default:
      return assertNever(decision, 'file access decision')
  }
}
