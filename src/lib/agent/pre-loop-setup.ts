import { dispatchTool } from '@/lib/agent/tools'
import { incrementMessageCount, updateSession } from '@/lib/db/sessions'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import type { Session, WorkflowMode } from '@/types/agent'

type TimingTracker = {
  runStage<T>(stageName: string, work: () => Promise<T>): Promise<T>
}

type FileAttachmentSession = Pick<Session, 'id' | 'phase' | 'stateVersion'>

export function resolveWorkflowMode(
  session: Pick<Session, 'cvState' | 'agentState'>,
): WorkflowMode {
  const hasResumeContext = hasResumeContextForAutoGap(session)
  const hasTargetJobDescription = Boolean(session.agentState.targetJobDescription?.trim())

  if (hasResumeContext && hasTargetJobDescription) {
    return 'job_targeting'
  }

  if (hasResumeContext) {
    return 'ats_enhancement'
  }

  return 'resume_review'
}

async function persistWorkflowMode(
  session: Pick<Session, 'id' | 'cvState' | 'agentState'> & { agentState: Session['agentState'] },
): Promise<void> {
  const workflowMode = resolveWorkflowMode(session)

  if (session.agentState.workflowMode === workflowMode) {
    return
  }

  const nextAgentState: Session['agentState'] = {
    ...session.agentState,
    workflowMode,
  }

  await updateSession(session.id, {
    agentState: nextAgentState,
  })

  session.agentState = nextAgentState
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

async function handleFileAttachment(
  message: string,
  file: string,
  fileMime: string,
  session: FileAttachmentSession,
  appUserId: string,
  requestId: string,
  externalSignal?: AbortSignal,
): Promise<string> {
  const parseResult = parseJsonObject(
    await dispatchTool(
      'parse_file',
      { file_base64: file, mime_type: fileMime },
      session as Parameters<typeof dispatchTool>[2],
      externalSignal,
    ),
  )

  const parseError = typeof parseResult?.error === 'string' ? parseResult.error : undefined

  if (parseError) {
    logWarn('agent.file.parse_failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      fileMime,
      success: false,
      errorMessage: parseError,
    })
    return [message, `[Nota do sistema: Não foi possível processar o arquivo anexado. ${parseError}]`]
      .filter(Boolean)
      .join('\n\n')
  }

  logInfo('agent.file.parsed', {
    requestId,
    sessionId: session.id,
    appUserId,
    phase: session.phase,
    stateVersion: session.stateVersion,
    fileMime,
    success: true,
  })

  const base = message.trim()
    ? message
    : 'Analise o currículo anexado e me diga os próximos passos.'

  return [
    base,
    '[Nota do sistema: O currículo anexado já foi processado e o texto extraído está disponível para análise.]',
  ].join('\n\n')
}

export function hasResumeContextForAutoGap(session: Pick<Session, 'cvState' | 'agentState'>): boolean {
  return Boolean(
    session.agentState.sourceResumeText?.trim()
    || session.cvState.summary.trim()
    || session.cvState.skills.length > 0
    || session.cvState.experience.length > 0
    || session.cvState.education.length > 0
    || (session.cvState.certifications?.length ?? 0) > 0,
  )
}

export function shouldEmitExistingSessionPreparationProgress(
  session: Session,
  userMessage: string,
  hasFileAttachment: boolean,
): boolean {
  void session
  void userMessage
  return hasFileAttachment
}

export async function runPreLoopSetup(params: {
  session: Session
  message: string
  file?: string
  fileMime?: string
  appUserId: string
  requestId: string
  externalSignal?: AbortSignal
  timing: TimingTracker
  isNewSession: boolean
}): Promise<string> {
  const {
    session,
    message,
    file,
    fileMime,
    appUserId,
    requestId,
    externalSignal,
    timing,
    isNewSession,
  } = params
  const stageSuffix = isNewSession ? 'new' : 'existing'
  let nextMessage = message

  if (file && fileMime) {
    nextMessage = await timing.runStage(
      `file_attachment_${stageSuffix}`,
      () => handleFileAttachment(nextMessage, file, fileMime, session, appUserId, requestId, externalSignal),
    )
  }

  await timing.runStage(`workflow_mode_${stageSuffix}`, () => persistWorkflowMode(session))
  logInfo('agent.pre_loop.prepared', {
    requestId,
    appUserId,
    sessionId: session.id,
    phase: session.phase,
    isNewSession,
    workflowMode: session.agentState.workflowMode,
    success: true,
  })

  await timing.runStage(`increment_message_${stageSuffix}`, () => incrementMessageCount(session.id))
  return nextMessage
}
