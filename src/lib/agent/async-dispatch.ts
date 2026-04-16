import { createHash } from 'crypto'

import { createJob } from '@/lib/jobs/repository'
import { startDurableJobProcessing } from '@/lib/jobs/runtime'
import { resolveEffectiveResumeSource } from '@/lib/jobs/source-of-truth'
import type { Session } from '@/types/agent'
import type { JobStatusSnapshot, JobType } from '@/types/jobs'

type AsyncDispatchResult = {
  acknowledgementText: string
  job: JobStatusSnapshot
  wasCreated: boolean
}

function buildIdempotencyPayload(
  session: Session,
  actionType: JobType,
): string {
  const effectiveResumeSource = resolveEffectiveResumeSource(session)

  return JSON.stringify({
    actionType,
    sessionId: session.id,
    workflowMode: session.agentState.workflowMode ?? null,
    targetJobDescription: session.agentState.targetJobDescription?.trim() ?? null,
    dispatchInputRef: effectiveResumeSource.ref,
    cvState: effectiveResumeSource.cvState,
  })
}

function buildJobIdempotencyKey(
  session: Session,
  actionType: JobType,
): string {
  const fingerprint = createHash('sha256')
    .update(buildIdempotencyPayload(session, actionType))
    .digest('hex')
    .slice(0, 24)

  return `agent:${session.id}:${actionType}:${fingerprint}`
}

function buildCreatedAcknowledgementText(actionType: JobType): string {
  switch (actionType) {
    case 'artifact_generation':
      return 'Recebi seu aceite e iniciei a geração do currículo em segundo plano. Vou manter esta solicitação vinculada à sessão atual.'
    case 'job_targeting':
      return 'Recebi a vaga e iniciei a adaptação do currículo em segundo plano. Vou usar esta sessão como referência para os próximos resultados.'
    case 'ats_enhancement':
      return 'Iniciei a otimização ATS do seu currículo em segundo plano. Vou manter esta sessão sincronizada com esse processamento.'
  }
}

function buildReusedAcknowledgementText(job: JobStatusSnapshot): string {
  switch (job.status) {
    case 'queued':
    case 'running':
      return 'Já existe um processamento equivalente em andamento para esta sessão. Vou reaproveitar esse job para evitar duplicidade.'
    case 'completed':
      return 'Já existe um processamento equivalente concluído para esta sessão. Vou reutilizar esse job em vez de abrir outro.'
    case 'failed':
    case 'cancelled':
      return 'Encontrei um job equivalente recente para esta sessão e vou reaproveitar esse registro em vez de abrir outro agora.'
  }
}

export async function dispatchAsyncAction(params: {
  session: Session
  userId: string
  actionType: JobType
  requestMessage: string
}): Promise<AsyncDispatchResult> {
  const resumeSource = resolveEffectiveResumeSource(params.session)
  const idempotencyKey = buildJobIdempotencyKey(params.session, params.actionType)
  const { job, wasCreated } = await createJob({
    userId: params.userId,
    sessionId: params.session.id,
    type: params.actionType,
    idempotencyKey,
    stage: 'queued',
    dispatchInputRef: resumeSource.ref,
    metadata: {
      requestMessage: params.requestMessage,
      workflowMode: params.session.agentState.workflowMode ?? null,
      targetJobDescription: params.session.agentState.targetJobDescription?.trim() ?? null,
    },
  })
  const startedJob = await startDurableJobProcessing({
    jobId: job.jobId,
    userId: params.userId,
  })

  return {
    acknowledgementText: wasCreated
      ? buildCreatedAcknowledgementText(params.actionType)
      : buildReusedAcknowledgementText(job),
    job: startedJob ?? job,
    wasCreated,
  }
}
