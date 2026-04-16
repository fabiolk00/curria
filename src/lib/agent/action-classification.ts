import {
  isDialogContinuationApproval,
  isGenerationApproval,
  normalizeText,
  looksLikeJobDescription,
} from '@/lib/agent/agent-intents'
import {
  buildCareerFitWarningText,
  hasConfirmedCareerFitOverride,
  requiresCareerFitWarning,
} from '@/lib/agent/profile-review'
import {
  hasResumeContextForAutoGap,
  resolveWorkflowMode,
} from '@/lib/agent/pre-loop-setup'
import type { Session, WorkflowMode } from '@/types/agent'
import {
  resolveExecutionMode,
  type AgentActionType,
  type ExecutionMode,
} from '@/types/jobs'

const MISSING_PROFILE_WITH_TARGET_TEXT = 'Recebi a vaga. Para adaptar seu currículo, complete primeiro seu perfil em "Meu Perfil" antes de continuar.'
const MISSING_PROFILE_TEXT = 'Preciso do seu currículo salvo em "Meu Perfil" para continuar.'
const MISSING_TARGET_JOB_TEXT = 'Já tenho seu currículo salvo. Cole a descrição da vaga antes de gerar o currículo otimizado ATS.'

export type ClassifiedAgentAction = {
  actionType: AgentActionType
  executionMode: ExecutionMode
  workflowMode: WorkflowMode
}

function hasPendingCareerFitOverride(session: Session): boolean {
  return requiresCareerFitWarning(session) && !hasConfirmedCareerFitOverride(session)
}

export function resolveGenerationPrerequisiteMessage(session: Session): string | null {
  const hasResumeContext = hasResumeContextForAutoGap(session)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim())

  if (!hasResumeContext && hasTargetJobContext) {
    return MISSING_PROFILE_WITH_TARGET_TEXT
  }

  if (!hasResumeContext) {
    return MISSING_PROFILE_TEXT
  }

  if (!hasTargetJobContext) {
    return MISSING_TARGET_JOB_TEXT
  }

  if (hasPendingCareerFitOverride(session)) {
    return buildCareerFitWarningText(session)
      ?? 'Antes de seguir com a geração, preciso do seu ok explícito para continuar mesmo com o desalinhamento atual.'
  }

  return null
}

function shouldDispatchArtifactGeneration(
  session: Session,
  userMessage: string,
): boolean {
  return isGenerationApproval(userMessage)
    && resolveGenerationPrerequisiteMessage(session) === null
}

function shouldDispatchJobTargeting(
  session: Session,
  workflowMode: WorkflowMode,
  userMessage: string,
): boolean {
  return workflowMode === 'job_targeting'
    && hasResumeContextForAutoGap(session)
    && Boolean(session.agentState.targetJobDescription?.trim())
    && (
      looksLikeJobDescription(userMessage)
      || isDialogContinuationApproval(userMessage)
    )
}

function shouldDispatchAtsEnhancement(
  session: Session,
  workflowMode: WorkflowMode,
  userMessage: string,
): boolean {
  if (
    workflowMode !== 'ats_enhancement'
    || !hasResumeContextForAutoGap(session)
    || (session.agentState.optimizedCvState && session.agentState.rewriteStatus === 'completed')
  ) {
    return false
  }

  if (session.phase === 'confirm' || session.phase === 'generation') {
    return true
  }

  if (isDialogContinuationApproval(userMessage)) {
    return true
  }

  const normalizedMessage = normalizeText(userMessage)

  return (
    normalizedMessage === 'aceito'
    || normalizedMessage.includes('gerar curriculo')
    || normalizedMessage.includes('gere o curriculo')
    || normalizedMessage.includes('gerar arquivo')
    || normalizedMessage.includes('gere o arquivo')
  )
}

export function classifyAgentAction(
  session: Session,
  userMessage: string,
): ClassifiedAgentAction {
  const workflowMode = resolveWorkflowMode(session)
  let actionType: AgentActionType = 'chat'

  if (shouldDispatchArtifactGeneration(session, userMessage)) {
    actionType = 'artifact_generation'
  } else if (shouldDispatchJobTargeting(session, workflowMode, userMessage)) {
    actionType = 'job_targeting'
  } else if (shouldDispatchAtsEnhancement(session, workflowMode, userMessage)) {
    actionType = 'ats_enhancement'
  }

  return {
    actionType,
    executionMode: resolveExecutionMode(actionType),
    workflowMode,
  }
}
