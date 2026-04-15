import type OpenAI from 'openai'
import { APIError } from 'openai'
import { createHash } from 'crypto'

import {
  type RewriteFocus,
  isCareerFitOverrideConfirmation,
  isDialogContinuationApproval,
  isDialogRewriteRequest,
  isGenerationApproval,
  isGenerationRequest,
  looksLikeJobDescription,
  normalizeText,
  resolveRewriteFocus,
} from '@/lib/agent/agent-intents'
import { buildSystemPrompt, trimMessages } from '@/lib/agent/context-builder'
import {
  buildCareerFitWarningText,
  formatProfileAuditSummary,
  hasActiveCareerFitWarning,
  hasConfirmedCareerFitOverride,
  requiresCareerFitWarning,
} from '@/lib/agent/profile-review'
import { localizeTargetFitSummary } from '@/lib/agent/target-fit'
import {
  AGENT_CONFIG,
  resolveAgentModelForPhase,
  resolveConciseFallbackMaxTokens,
  resolveConversationMaxOutputTokens,
  resolveMaxHistoryMessages,
  resolveMaxToolIterations,
} from '@/lib/agent/config'
import {
  appendAssistantTurn,
  appendUserTurn,
  buildDoneChunk,
  createPatchChunk,
  persistPatch,
} from '@/lib/agent/agent-persistence'
import {
  recoverAssistantResponse,
  recoverConciseTurn,
  recoverTruncatedTurn,
  recoverZeroTextTurn,
  type StreamTurnResult,
} from '@/lib/agent/agent-recovery'
import { streamAssistantTurn } from '@/lib/agent/agent-streaming'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { dispatchToolWithContext, getToolDefinitionsForPhase } from '@/lib/agent/tools'
import { calculateUsageCostCents, trackApiUsage } from '@/lib/agent/usage-tracker'
import { applyToolPatchWithVersion, getMessages } from '@/lib/db/sessions'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import { deriveTargetResumeCvState } from '@/lib/resume-targets/create-target-resume'
import { getAgentReleaseMetadata, type AgentReleaseMetadata } from '@/lib/runtime/release-metadata'
import type {
  AgentDoneChunk,
  AgentErrorChunk,
  AgentPatchChunk,
  AgentTextChunk,
  AgentToolResultChunk,
  AgentToolStartChunk,
  Session,
} from '@/types/agent'

const LENGTH_RECOVERY_PROMPT = 'Your previous response was cut off by token limits. Continue exactly where it stopped. Do not repeat prior text. Do not call tools.'
const GENERATION_CONFIRMATION_TEXT = 'Quando fizer sentido, clique em "Aceito" para gerar seu currículo.'
const MISSING_PROFILE_WITH_TARGET_TEXT = 'Recebi a vaga. Para adaptar seu currículo, complete primeiro seu perfil em "Meu Perfil" antes de continuar.'
const MISSING_PROFILE_TEXT = 'Preciso do seu currículo salvo em "Meu Perfil" para continuar.'
const RECOVERY_SYSTEM_PROMPT = [
  'You are CurrIA, a resume optimization assistant for Brazilian users.',
  'Respond in the same language as the user, in plain text, with a short and useful answer.',
  'If the user writes in Portuguese, answer only in Brazilian Portuguese (pt-BR) and do not mix English sentences into the reply.',
  'Do not call tools.',
  'Do not leave the content empty.',
  'If the user pasted a job description but resume context is missing, acknowledge the vacancy and ask them to complete their saved profile before continuing.',
  'If the user already has resume context loaded, acknowledge the latest request and give the clearest next step you can.',
].join(' ')

type AgentLoopEvent =
  | AgentTextChunk
  | AgentToolStartChunk
  | AgentToolResultChunk
  | AgentPatchChunk
  | AgentDoneChunk
  | AgentErrorChunk

export type AgentLoopParams = {
  session: Session
  userMessage: string
  appUserId: string
  requestId: string
  isNewSession: boolean
  requestStartedAt: number
  signal?: AbortSignal
}

type AccumulatedToolCall = {
  id: string
  name: string
  argumentsRaw: string
}

type DeterministicToolOutcome = {
  success: boolean
  hadPatch: boolean
  output?: unknown
  failureMessage?: string
  failureCode?: AgentErrorChunk['code']
}

type AnalysisPrimeResult = {
  mutatedPromptState: boolean
}

type DeterministicFallback = {
  text: string
  kind: string
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

function toOpenAIHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return history.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function buildToolMessage(
  toolCallId: string,
  content: string,
): OpenAI.Chat.Completions.ChatCompletionToolMessageParam {
  return { role: 'tool', tool_call_id: toolCallId, content }
}

function buildAssistantToolCallMessage(params: {
  assistantText: string
  toolCalls: AccumulatedToolCall[]
}): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  return {
    role: 'assistant',
    content: params.assistantText,
    tool_calls: params.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: toolCall.argumentsRaw,
      },
    })),
  }
}

function mapAPIErrorMessage(error: APIError): string {
  const status = error.status ?? 0
  const statusMessages: Record<number, string> = {
    400: 'Erro na requisição. Por favor, tente novamente.',
    401: 'Erro de configuração da IA. Entre em contato com o suporte.',
    403: 'Acesso negado ao serviço de IA. Entre em contato com o suporte.',
    429: 'O serviço de IA está sobrecarregado. Tente novamente em alguns segundos.',
    500: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
    502: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
    503: 'O serviço de IA está em manutenção. Tente novamente em alguns minutos.',
  }

  return statusMessages[status] ?? 'Algo deu errado. Por favor, tente novamente.'
}

function buildErrorChunk(params: {
  error: unknown
  requestId: string
  fallbackMessage?: string
}): AgentErrorChunk {
  if (params.error instanceof APIError && params.error.status) {
    return {
      type: 'error',
      error: mapAPIErrorMessage(params.error),
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      requestId: params.requestId,
    }
  }

  if ((params.error instanceof Error || params.error instanceof DOMException) && params.error.name === 'AbortError') {
    return {
      type: 'error',
      error: 'A requisição demorou muito. Por favor, tente novamente.',
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      requestId: params.requestId,
    }
  }

  return {
    type: 'error',
    error: params.fallbackMessage ?? 'Algo deu errado. Por favor, tente novamente.',
    code: TOOL_ERROR_CODES.INTERNAL_ERROR,
    requestId: params.requestId,
  }
}

function createErrorChunk(
  error: string,
  requestId: string,
  code: AgentErrorChunk['code'] = TOOL_ERROR_CODES.INTERNAL_ERROR,
): AgentErrorChunk {
  return {
    type: 'error',
    error,
    code,
    requestId,
  }
}

function mergeUsage(
  current: StreamTurnResult['usage'],
  next: StreamTurnResult['usage'],
): StreamTurnResult['usage'] {
  if (!current) {
    return next
  }

  if (!next) {
    return current
  }

  return {
    inputTokens: current.inputTokens + next.inputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
  }
}

function calculateHistoryChars(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): number {
  return messages.reduce((total, message) => {
    if (typeof message.content === 'string') {
      return total + message.content.length
    }

    if (Array.isArray(message.content)) {
      return total + JSON.stringify(message.content).length
    }

    if ('tool_calls' in message && Array.isArray(message.tool_calls)) {
      return total + JSON.stringify(message.tool_calls).length
    }

    return total
  }, 0)
}

function formatRewriteFocusLabel(focus: RewriteFocus): string {
  switch (focus) {
    case 'summary':
      return 'resumo profissional'
    case 'experience':
      return 'experiência'
    case 'skills':
      return 'competências'
  }
}

function buildDialogRewriteContinuation(params: {
  hasTargetJobContext: boolean
  focus: RewriteFocus
  explicit: boolean
}): DeterministicFallback {
  const focusLabel = formatRewriteFocusLabel(params.focus)

  return {
    kind: params.hasTargetJobContext
      ? `dialog_rewrite_saved_target_${params.focus}`
      : `dialog_rewrite_resume_only_${params.focus}`,
    text: params.hasTargetJobContext
      ? (params.explicit
        ? `Posso reescrever agora seu ${focusLabel}. Já tenho seu currículo e a vaga como referência. Vou devolver uma versão mais alinhada a essa oportunidade.`
        : `Posso seguir, sim. Já tenho seu currículo e a vaga como referência. Vou continuar pelo trecho com maior impacto para essa vaga: seu ${focusLabel}.`)
      : (params.explicit
        ? `Posso reescrever agora seu ${focusLabel}. Já tenho seu currículo em contexto e vou te devolver uma versão mais forte e objetiva.`
      : `Posso seguir, sim. Já tenho seu currículo em contexto. Vou continuar pelo trecho com maior impacto: seu ${focusLabel}.`),
  }
}

function buildRewriteCurrentContent(
  session: Session,
  focus: RewriteFocus,
): string | null {
  const effectiveCvState = getEffectiveCvState(session)

  switch (focus) {
    case 'summary':
      return effectiveCvState.summary.trim() || buildResumeTextForScoring(session)
    case 'experience':
      return effectiveCvState.experience.length > 0
        ? JSON.stringify(effectiveCvState.experience, null, 2)
        : null
    case 'skills':
      return effectiveCvState.skills.length > 0
        ? effectiveCvState.skills.join(', ')
        : null
  }
}

function buildRewriteInstructions(
  session: Session,
  focus: RewriteFocus,
): string {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  const commonRules = 'Keep the content truthful, ATS-friendly, concise, and in pt-BR. Preserve only claims supported by the saved resume context.'
  const targetContext = targetJobDescription
    ? `Target job description:\n${truncateForRecovery(targetJobDescription, 1_600)}`
    : 'No target job description is saved yet. Optimize for clarity and ATS readability only.'

  switch (focus) {
    case 'summary':
      return [
        'Rewrite the professional summary for this target opportunity.',
        'Keep it to 3 to 4 lines, emphasize business impact, analytics ownership, SQL/BI strengths, and collaboration with non-technical stakeholders when supported by the resume.',
        commonRules,
        targetContext,
      ].join('\n\n')
    case 'experience':
      return [
        'Rewrite the professional experience bullets for this target opportunity.',
        'Prioritize measurable impact, analytics delivery, Power BI/SQL/ETL work, and stakeholder partnership when supported by the resume.',
        commonRules,
        targetContext,
      ].join('\n\n')
    case 'skills':
      return [
        'Rewrite and reorder the skills section for this target opportunity.',
        'Prioritize the most relevant ATS keywords first and keep the final list clean and realistic.',
        commonRules,
        targetContext,
      ].join('\n\n')
  }
}

function buildRewriteTargetKeywords(session: Session): string[] | undefined {
  const missingSkills = session.agentState.gapAnalysis?.result.missingSkills ?? []
  const existingSkills = getEffectiveCvState(session).skills ?? []
  const targetKeywords = Array.from(
    new Set(
      [...missingSkills, ...existingSkills]
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8)

  return targetKeywords.length > 0 ? targetKeywords : undefined
}

function buildResumeTextFromCvState(cvState: Session['cvState']): string {
  const lines: string[] = []

  if (cvState.fullName.trim()) {
    lines.push(cvState.fullName.trim())
  }

  const contactFields = [
    cvState.email?.trim(),
    cvState.phone?.trim(),
    cvState.linkedin?.trim(),
    cvState.location?.trim(),
  ].filter((field): field is string => Boolean(field))

  if (contactFields.length > 0) {
    lines.push(...contactFields)
  }

  if (cvState.summary.trim()) {
    lines.push('Summary')
    lines.push(cvState.summary.trim())
  }

  if (cvState.skills.length > 0) {
    lines.push('Skills')
    lines.push(cvState.skills.join(', '))
  }

  if (cvState.experience.length > 0) {
    lines.push('Experience')
    for (const experience of cvState.experience.slice(0, 6)) {
      lines.push(`${experience.title} - ${experience.company} (${experience.startDate} - ${experience.endDate})`)
      for (const bullet of experience.bullets.slice(0, 4)) {
        lines.push(`- ${bullet}`)
      }
    }
  }

  if (cvState.education.length > 0) {
    lines.push('Education')
    for (const education of cvState.education.slice(0, 4)) {
      lines.push(`${education.degree} - ${education.institution} (${education.year})`)
    }
  }

  if ((cvState.certifications?.length ?? 0) > 0) {
    lines.push('Certifications')
    for (const certification of cvState.certifications?.slice(0, 4) ?? []) {
      lines.push(`${certification.name} - ${certification.issuer}`)
    }
  }

  return lines.join('\n').trim()
}

function getEffectiveCvState(session: Session): Session['cvState'] {
  return session.agentState.optimizedCvState ?? session.cvState
}

function buildResumeTextForScoring(session: Session): string {
  const canonicalResumeText = buildResumeTextFromCvState(getEffectiveCvState(session))

  if (canonicalResumeText.trim()) {
    return canonicalResumeText
  }

  if (session.agentState.sourceResumeText?.trim()) {
    return session.agentState.sourceResumeText
  }

  return canonicalResumeText
}

function buildChatGenerationIdempotencyKey(session: Session): string {
  const scope = session.agentState.targetJobDescription?.trim() ? 'job_targeting' : 'ats_enhancement'
  const payload = JSON.stringify({
    scope,
    cvState: session.cvState,
    targetJobDescription: session.agentState.targetJobDescription ?? null,
  })
  const fingerprint = createHash('sha256').update(payload).digest('hex').slice(0, 24)

  return `generation:${session.id}:chat:${scope}:${fingerprint}`
}

type TargetPreparationResult = {
  applied: boolean
  previousAtsTotal?: number
  optimizedAtsTotal?: number
}

function dedupeOrderedSentences(items: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const item of items) {
    const trimmed = item?.trim()
    if (!trimmed) {
      continue
    }

    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(trimmed)
  }

  return unique
}

function normalizeTrailingSentence(text: string): string {
  return text.trim().replace(/[.!?\s]+$/g, '')
}

function hasResumeContextForDeterministicAnalysis(session: Session): boolean {
  return buildResumeTextForScoring(session).trim().length > 0
}

function resolveGenerationPrerequisiteMessage(session: Session): string | null {
  const hasResumeContext = hasResumeContextForDeterministicAnalysis(session)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim())

  if (!hasResumeContext && hasTargetJobContext) {
    return MISSING_PROFILE_WITH_TARGET_TEXT
  }

  if (!hasResumeContext) {
    return MISSING_PROFILE_TEXT
  }

  if (!hasTargetJobContext) {
    return 'Já tenho seu currículo salvo. Cole a descrição da vaga antes de gerar o currículo otimizado ATS.'
  }

  if (hasPendingCareerFitOverride(session)) {
    return buildCareerFitWarningText(session)
  }

  return null
}

function shouldShowCareerFitWarning(session: Session): boolean {
  return requiresCareerFitWarning(session) && !hasActiveCareerFitWarning(session)
}

function hasPendingCareerFitOverride(session: Session): boolean {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  const phaseMeta = session.agentState.phaseMeta

  if (!targetJobDescription || !phaseMeta?.careerFitWarningIssuedAt) {
    return false
  }

  if (phaseMeta.careerFitWarningTargetJobDescription?.trim() !== targetJobDescription) {
    return false
  }

  if (!phaseMeta.careerFitOverrideConfirmedAt) {
    return true
  }

  return phaseMeta.careerFitOverrideTargetJobDescription?.trim() !== targetJobDescription
}

async function markCareerFitWarningIssued(session: Session): Promise<Parameters<typeof applyToolPatchWithVersion>[1] | null> {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()

  if (!targetJobDescription) {
    return null
  }

  const patch = {
    agentState: {
      phaseMeta: {
        careerFitWarningIssuedAt: new Date().toISOString(),
        careerFitWarningTargetJobDescription: targetJobDescription,
      },
    },
  } satisfies Parameters<typeof applyToolPatchWithVersion>[1]

  await persistPatch(session, patch)
  return patch
}

async function confirmCareerFitOverride(session: Session): Promise<Parameters<typeof applyToolPatchWithVersion>[1] | null> {
  const targetJobDescription = session.agentState.targetJobDescription?.trim()

  if (!targetJobDescription) {
    return null
  }

  const patch = {
    agentState: {
      phaseMeta: {
        careerFitOverrideConfirmedAt: new Date().toISOString(),
        careerFitOverrideTargetJobDescription: targetJobDescription,
      },
    },
  } satisfies Parameters<typeof applyToolPatchWithVersion>[1]

  await persistPatch(session, patch)
  return patch
}

function buildCareerFitOverrideAcknowledgement(session: Session): string {
  const profileAudit = formatProfileAuditSummary(session.cvState, 2)

  return [
    'Entendido. Vou continuar mesmo com esse desalinhamento e focar em deixar sua candidatura o mais competitiva possível dentro do seu histórico real.',
    profileAudit ? `Antes de seguir, eu também reforçaria estes pontos no seu perfil salvo: ${profileAudit}` : null,
    'Agora posso adaptar seu resumo, experiência ou competências para a vaga. Quando fizer sentido, clique em "Aceito" para gerar seu currículo.',
  ].filter(Boolean).join(' ')
}

async function* maybeIssueCareerFitWarning(params: {
  session: Session
}): AsyncGenerator<AgentLoopEvent, string | null> {
  if (!shouldShowCareerFitWarning(params.session)) {
    return null
  }

  const patch = await markCareerFitWarningIssued(params.session)
  if (patch) {
    yield createPatchChunk(params.session, patch)
  }

  return buildCareerFitWarningText(params.session)
}

function truncateForRecovery(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }

  return `${text.slice(0, maxChars - 15)}\n[truncated]`
}

function formatFitLevel(level: 'strong' | 'partial' | 'weak'): string {
  switch (level) {
    case 'strong':
      return 'forte'
    case 'partial':
      return 'parcial'
    case 'weak':
      return 'fraca'
  }
}

function buildRecoveryUserPrompt(params: {
  session: Session
  userMessage: string
  mode: 'concise' | 'empty'
  attempt?: number
}): string {
  const hasResumeContext = hasResumeContextForDeterministicAnalysis(params.session)
  const targetJobDescription = params.session.agentState.targetJobDescription?.trim()
  const latestMessageLooksLikeVacancy = looksLikeJobDescription(params.userMessage)
  const latestRewriteFocus = resolveRewriteFocus(params.userMessage)
  const latestMessageIsRewriteRequest = isDialogRewriteRequest(params.userMessage)
  const targetLooksLikeVacancy = Boolean(targetJobDescription || latestMessageLooksLikeVacancy)
  const resumeExcerpt = hasResumeContext
    ? truncateForRecovery(buildResumeTextForScoring(params.session), latestMessageLooksLikeVacancy ? 1_000 : 650)
    : ''

  return [
    params.mode === 'concise'
      ? 'The previous response was cut off. Answer again from scratch with a concise reply under 180 words.'
      : `The previous response attempt returned no visible text. Reply now with at least one complete sentence.${params.attempt ? ` This is retry ${params.attempt}.` : ''}`,
    `Current phase: ${params.session.phase}.`,
    `Resume context available: ${hasResumeContext ? 'yes' : 'no'}.`,
    `Target job context available: ${targetLooksLikeVacancy ? 'yes' : 'no'}.`,
    `Latest message asks for rewrite: ${latestMessageIsRewriteRequest ? 'yes' : 'no'}.`,
    latestRewriteFocus ? `Preferred rewrite focus: ${latestRewriteFocus}.` : '',
    resumeExcerpt ? `Saved resume context:\n${resumeExcerpt}` : '',
    targetJobDescription && !latestMessageLooksLikeVacancy
      ? `Saved target job context:\n${truncateForRecovery(targetJobDescription, 1_200)}`
      : '',
    `Latest user message:\n${truncateForRecovery(params.userMessage, 3_000)}`,
    'Respond directly. No markdown fences. No tools.',
  ].filter(Boolean).join('\n\n')
}

function buildDeterministicAssistantFallback(session: Session, userMessage: string): string {
  const hasResumeContext = hasResumeContextForDeterministicAnalysis(session)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim() || looksLikeJobDescription(userMessage))
  const hasStructuredTargetAnalysis = Boolean(
    session.atsScore
    || session.agentState.targetFitAssessment
    || session.agentState.gapAnalysis
  )
  const confirmFallbackText = session.phase === 'confirm'
    ? GENERATION_CONFIRMATION_TEXT
    : null

  if (!hasResumeContext && hasTargetJobContext) {
    return MISSING_PROFILE_WITH_TARGET_TEXT
  }

  if (!hasResumeContext) {
    return MISSING_PROFILE_TEXT
  }

  if (confirmFallbackText) {
    return confirmFallbackText
  }

  if (hasTargetJobContext && hasStructuredTargetAnalysis) {
    const careerFitWarning = hasPendingCareerFitOverride(session)
      ? buildCareerFitWarningText(session)
      : null
    if (careerFitWarning) {
      return careerFitWarning
    }

    const parts = ['Recebi a vaga e ela já ficou salva como referência para o seu currículo.']

    if (session.atsScore) {
      parts.push(`Pontuacao ATS atual: ${session.atsScore.total}/100.`)
    }

    if (session.agentState.targetFitAssessment) {
      parts.push(
        `Aderência inicial: ${formatFitLevel(session.agentState.targetFitAssessment.level)}. ${localizeTargetFitSummary(session.agentState.targetFitAssessment.summary)}`,
      )
    } else if (session.agentState.gapAnalysis) {
      parts.push(`Aderência estimada à vaga: ${session.agentState.gapAnalysis.result.matchScore}/100.`)
    }

    if (session.agentState.gapAnalysis) {
      const topGaps = [
        ...session.agentState.gapAnalysis.result.missingSkills.slice(0, 2),
        ...session.agentState.gapAnalysis.result.weakAreas.slice(0, 2),
      ].filter(Boolean)

      if (topGaps.length > 0) {
        parts.push(`Principais gaps: ${topGaps.join(', ')}.`)
      }
    }

    parts.push('Posso seguir reescrevendo seu resumo ou experiência com base nesses pontos. Se quiser gerar agora a versão otimizada, responda com "Aceito".')
    return parts.join(' ')
  }

  if (hasTargetJobContext) {
    return 'Recebi a vaga e ela já ficou salva como referência para o seu currículo. Posso seguir reescrevendo seu resumo ou experiência com base nela. Se quiser gerar agora a versão otimizada, responda com "Aceito".'
  }

  if (hasTargetJobContext) {
    return 'Recebi a vaga e vou usá-la como referência. Tente novamente com um pedido curto, como "compare meu currículo com esta vaga" ou "reescreva meu resumo para esta vaga".'
  }

  const profileAuditSummary = formatProfileAuditSummary(session.cvState, 3)
  if (profileAuditSummary) {
    return `Tenho seu currículo salvo e já identifiquei alguns pontos que podem reduzir sua visibilidade para recrutadores e ATS: ${profileAuditSummary} Cole a descrição da vaga que eu cruzo isso com a oportunidade certa.`
  }

  return 'Tenho seu currículo salvo. Cole a descrição da vaga que eu comparo seu perfil com a oportunidade e sigo com os ajustes mais estratégicos.'
}

function buildDeterministicVacancyBootstrap(
  session: Session,
  userMessage: string,
  targetPreparation: TargetPreparationResult,
): string {
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim() || looksLikeJobDescription(userMessage))

  if (!hasTargetJobContext) {
    return buildDeterministicAssistantFallback(session, userMessage)
  }

  const careerFitWarning = hasPendingCareerFitOverride(session)
    ? buildCareerFitWarningText(session)
    : null
  if (careerFitWarning) {
    return careerFitWarning
  }

  const parts = ['Recebi a vaga e comparei com seu currículo com foco em aderência ATS.']

  if (
    targetPreparation.applied
    && targetPreparation.previousAtsTotal !== undefined
    && targetPreparation.optimizedAtsTotal !== undefined
  ) {
    parts.push(
      `Atualizei a versão de trabalho do seu currículo para essa vaga. ATS antes: ${targetPreparation.previousAtsTotal}/100. ATS da versão otimizada: ${targetPreparation.optimizedAtsTotal}/100.`,
    )
  } else if (session.atsScore) {
    parts.push(`Pontuacao ATS atual: ${session.atsScore.total}/100.`)
  }

  if (session.agentState.targetFitAssessment) {
    parts.push(
      `Aderência inicial: ${formatFitLevel(session.agentState.targetFitAssessment.level)}. ${localizeTargetFitSummary(session.agentState.targetFitAssessment.summary)}`,
    )
  } else if (session.agentState.gapAnalysis) {
    parts.push(`Aderência estimada à vaga: ${session.agentState.gapAnalysis.result.matchScore}/100.`)
  }

  if (session.agentState.gapAnalysis) {
    const missingSkills = session.agentState.gapAnalysis.result.missingSkills.slice(0, 3)
    const weakAreas = session.agentState.gapAnalysis.result.weakAreas.slice(0, 2)
    const topSuggestion = session.agentState.gapAnalysis.result.improvementSuggestions[0]

    if (missingSkills.length > 0) {
      parts.push(`Palavras-chave e sinais que ainda estão fracos: ${missingSkills.join(', ')}.`)
    }

    if (weakAreas.length > 0) {
      parts.push(`Trechos do currículo com maior oportunidade de ganho: ${weakAreas.join(', ')}.`)
    }

    if (topSuggestion) {
      parts.push(`Melhor próximo ajuste ATS: ${normalizeTrailingSentence(topSuggestion)}.`)
    }
  } else if (session.atsScore) {
    const topIssue = session.atsScore.issues[0]?.message
    const topSuggestion = session.atsScore.suggestions[0]
    const uniqueMessages = dedupeOrderedSentences([topIssue, topSuggestion])

    if (uniqueMessages[0]) {
      parts.push(`Principal ponto a melhorar: ${normalizeTrailingSentence(uniqueMessages[0])}.`)
    }

    if (uniqueMessages[1]) {
      parts.push(`Melhor próximo ajuste ATS: ${normalizeTrailingSentence(uniqueMessages[1])}.`)
    }
  }

  if (targetPreparation.applied) {
    parts.push('Já deixei uma versão base otimizada para essa vaga. Se quiser, ainda posso refinar resumo, experiência ou competências antes da geração.')
  } else {
    parts.push('Posso otimizar agora seu resumo, experiência ou competências com base nessa vaga.')
  }

  const profileAuditSummary = formatProfileAuditSummary(session.cvState, 2)
  if (profileAuditSummary) {
    parts.push(`No seu perfil base, eu ainda reforçaria estes pontos: ${profileAuditSummary}`)
  }

  parts.push('Quando fizer sentido, clique em "Aceito" para gerar seu currículo.')

  return parts.join(' ')
}

function buildDialogFallback(session: Session, userMessage: string): DeterministicFallback {
  const latestMessageLooksLikeVacancy = looksLikeJobDescription(userMessage)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim() || latestMessageLooksLikeVacancy)
  const rewriteFocus = resolveRewriteFocus(userMessage)
  const latestMessageIsRewriteRequest = isDialogRewriteRequest(userMessage)
  const careerFitWarning = hasPendingCareerFitOverride(session)
    ? buildCareerFitWarningText(session)
    : null

  if (careerFitWarning) {
    return {
      kind: 'dialog_career_fit_warning',
      text: careerFitWarning,
    }
  }

  if (latestMessageLooksLikeVacancy) {
    return {
      kind: 'dialog_latest_target_job_context',
      text: 'Recebi essa nova vaga e já tenho seu currículo em contexto. Posso adaptar agora seu resumo, experiência ou competências para essa oportunidade. Se quiser, responda com "reescreva meu resumo" ou "Aceito" para gerar a versão otimizada.',
    }
  }

  if (isDialogContinuationApproval(userMessage)) {
    const continuation = buildDialogRewriteContinuation({
      hasTargetJobContext,
      focus: rewriteFocus ?? 'summary',
      explicit: false,
    })

    return {
      ...continuation,
      kind: hasTargetJobContext ? 'dialog_continue_saved_target' : 'dialog_continue_resume_only',
    }
  }

  if (latestMessageIsRewriteRequest) {
    return buildDialogRewriteContinuation({
      hasTargetJobContext,
      focus: rewriteFocus ?? 'summary',
      explicit: true,
    })
  }

  if (hasTargetJobContext) {
    return {
      kind: 'dialog_saved_target_context',
      text: 'Já tenho seu currículo e a vaga como referência. Posso reescrever agora seu resumo, experiência ou competências para aumentar a aderência ATS. Se quiser, responda com "reescreva meu resumo" ou "Aceito" para gerar a versão otimizada.',
    }
  }

  return {
    kind: 'dialog_resume_context_only',
    text: 'Já tenho seu currículo em contexto. Posso reescrever seu resumo, experiência ou competências. Diga qual trecho você quer ajustar primeiro.',
  }
}

function resolveDeterministicAssistantFallback(session: Session, userMessage: string): DeterministicFallback {
  const hasResumeContext = hasResumeContextForDeterministicAnalysis(session)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim() || looksLikeJobDescription(userMessage))
  const hasStructuredTargetAnalysis = Boolean(
    session.atsScore
    || session.agentState.targetFitAssessment
    || session.agentState.gapAnalysis
  )
  const confirmFallback = session.phase === 'confirm'
    ? {
        kind: 'confirm_generation_prompt' as const,
        text: GENERATION_CONFIRMATION_TEXT,
      }
    : null

  if (!hasResumeContext && hasTargetJobContext) {
    return {
      kind: 'missing_resume_with_target_job',
      text: MISSING_PROFILE_WITH_TARGET_TEXT,
    }
  }

  if (!hasResumeContext) {
    return {
      kind: 'missing_resume',
      text: MISSING_PROFILE_TEXT,
    }
  }

  if (confirmFallback) {
    return confirmFallback
  }

  if (session.phase === 'dialog') {
    return buildDialogFallback(session, userMessage)
  }

  return {
    kind: hasTargetJobContext
      ? (hasStructuredTargetAnalysis ? 'analysis_structured_target_context' : 'analysis_saved_target_context')
      : 'generic_retry',
    text: buildDeterministicAssistantFallback(session, userMessage),
  }
}

function shouldUseDeterministicVacancyBootstrap(session: Session, userMessage: string): boolean {
  return session.phase === 'analysis'
    && hasResumeContextForDeterministicAnalysis(session)
    && looksLikeJobDescription(userMessage)
}

function isBootstrapLikeAssistantText(text: string): boolean {
  return /recebi a vaga e ela ja ficou salva como referencia|posso seguir reescrevendo seu resumo ou experiencia/.test(normalizeText(text))
}

function isConcreteRewriteContinuationText(text: string): boolean {
  return /(?:posso|vou) (?:seguir|reescrever|adaptar|continuar).*(?:resumo|experiencia|competenc)/.test(normalizeText(text))
}

function mergeConciseRecoveryTurn(
  priorTurn: StreamTurnResult,
  conciseTurn: StreamTurnResult,
): StreamTurnResult {
  const priorText = priorTurn.assistantText.trim()
  const conciseText = conciseTurn.assistantText.trim()
  const priorTextLooksLikeBootstrap = isBootstrapLikeAssistantText(priorText)
  const conciseTextLooksLikeBootstrap = isBootstrapLikeAssistantText(conciseText)
  const conciseTextLooksLikeConcreteContinuation = isConcreteRewriteContinuationText(conciseText)
  const shouldPreferConciseText = conciseText.length > 0
    && (
      !priorText
      || conciseTurn.finishReason === 'stop'
      || (priorTextLooksLikeBootstrap && !conciseTextLooksLikeBootstrap)
      || (conciseTextLooksLikeConcreteContinuation && conciseText.length >= Math.max(80, priorText.length))
    )

  return {
    ...priorTurn,
    assistantText: shouldPreferConciseText ? conciseTurn.assistantText : priorTurn.assistantText,
    finishReason: shouldPreferConciseText ? conciseTurn.finishReason : priorTurn.finishReason,
    model: shouldPreferConciseText ? conciseTurn.model : priorTurn.model,
    toolCalls: conciseTurn.toolCalls.length > 0 ? conciseTurn.toolCalls : priorTurn.toolCalls,
    usage: mergeUsage(priorTurn.usage, conciseTurn.usage),
    usedLengthRecovery: Boolean(priorTurn.usedLengthRecovery || conciseTurn.usedLengthRecovery),
    usedConciseRecovery: true,
  }
}

async function trackTurnUsage(params: {
  session: Session
  appUserId: string
  releaseMetadata: AgentReleaseMetadata
  model: string
  usage: NonNullable<StreamTurnResult['usage']>
  finishReason: StreamTurnResult['finishReason']
  toolCalls: number
  assistantTextChars: number
  requestId: string
  systemPromptChars: number
  historyChars: number
  allowedToolCount: number
  usedLengthRecovery: boolean
  usedZeroTextRecovery: boolean
  usedConciseRecovery: boolean
}): Promise<void> {
  const costCents = calculateUsageCostCents(
    params.model,
    params.usage.inputTokens,
    params.usage.outputTokens,
  )

  trackApiUsage({
    userId: params.appUserId,
    sessionId: params.session.id,
    model: params.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    endpoint: 'agent',
  }).catch(() => {})

  logInfo('agent.turn.completed', {
    ...params.releaseMetadata,
    requestId: params.requestId,
    sessionId: params.session.id,
    appUserId: params.appUserId,
    phase: params.session.phase,
    stateVersion: params.session.stateVersion,
    model: params.model,
    systemPromptChars: params.systemPromptChars,
    historyChars: params.historyChars,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    assistantTextChars: params.assistantTextChars,
    finishReason: params.finishReason ?? 'none',
    toolCalls: params.toolCalls,
    allowedToolCount: params.allowedToolCount,
    usedLengthRecovery: params.usedLengthRecovery,
    usedZeroTextRecovery: params.usedZeroTextRecovery,
    usedConciseRecovery: params.usedConciseRecovery,
    costCents,
    success: true,
  })
}

async function* runDeterministicTool(params: {
  session: Session
  toolName: string
  toolInput: Record<string, unknown>
  requestId: string
  signal?: AbortSignal
  surfaceToolStartToUser?: boolean
  surfaceFailureToUser?: boolean
}): AsyncGenerator<AgentLoopEvent, DeterministicToolOutcome> {
  const surfaceToolStartToUser = params.surfaceToolStartToUser ?? true
  const surfaceFailureToUser = params.surfaceFailureToUser ?? true

  if (surfaceToolStartToUser) {
    yield {
      type: 'toolStart',
      toolName: params.toolName,
    }
  }

  const toolResult = await dispatchToolWithContext(
    params.toolName,
    params.toolInput,
    params.session,
    params.signal,
  )

  if (toolResult.outputFailure) {
    if (surfaceFailureToUser) {
      yield {
        type: 'error',
        error: toolResult.outputFailure.error,
        code: toolResult.outputFailure.code,
        requestId: params.requestId,
      }
    }

    if (toolResult.persistedPatch) {
      yield createPatchChunk(params.session, toolResult.persistedPatch)
    }

    return {
      success: false,
      hadPatch: toolResult.persistedPatch !== undefined,
      output: toolResult.outputFailure,
      failureMessage: toolResult.outputFailure.error,
      failureCode: toolResult.outputFailure.code,
    }
  }

  yield {
    type: 'toolResult',
    toolName: params.toolName,
    output: toolResult.output,
  }

  if (toolResult.persistedPatch) {
    yield createPatchChunk(params.session, toolResult.persistedPatch)
  }

  return {
    success: true,
    hadPatch: toolResult.persistedPatch !== undefined,
    output: toolResult.output,
  }
}

async function* primeAnalysisState(params: {
  session: Session
  userMessage: string
  requestId: string
  signal?: AbortSignal
}): AsyncGenerator<AgentLoopEvent, AnalysisPrimeResult> {
  const { session } = params

  if (session.phase !== 'analysis' || !hasResumeContextForDeterministicAnalysis(session)) {
    return {
      mutatedPromptState: false,
    }
  }

  let mutatedPromptState = false
  const latestMessageLooksLikeVacancy = looksLikeJobDescription(params.userMessage)
  const latestTargetJobDescription = latestMessageLooksLikeVacancy
    ? params.userMessage.trim()
    : session.agentState.targetJobDescription?.trim()

  if (!session.atsScore || latestMessageLooksLikeVacancy) {
    const scoreResult = yield* runDeterministicTool({
      session,
      toolName: 'score_ats',
      toolInput: {
        resume_text: buildResumeTextForScoring(session),
        job_description: latestTargetJobDescription,
      },
      requestId: params.requestId,
      signal: params.signal,
      surfaceToolStartToUser: false,
      surfaceFailureToUser: false,
    })
    mutatedPromptState = mutatedPromptState || scoreResult.hadPatch
  }

  if (latestTargetJobDescription && (!session.agentState.gapAnalysis || latestMessageLooksLikeVacancy)) {
    const gapResult = yield* runDeterministicTool({
      session,
      toolName: 'analyze_gap',
      toolInput: {
        target_job_description: latestTargetJobDescription,
      },
      requestId: params.requestId,
      signal: params.signal,
      surfaceToolStartToUser: false,
      surfaceFailureToUser: false,
    })
    mutatedPromptState = mutatedPromptState || gapResult.hadPatch
  }

  return {
    mutatedPromptState,
  }
}

async function* maybePrepareTargetResumeForDeterministicFlow(params: {
  session: Session
  requestId: string
  signal?: AbortSignal
}): AsyncGenerator<AgentLoopEvent, TargetPreparationResult> {
  const targetJobDescription = params.session.agentState.targetJobDescription?.trim()
  const previousAtsTotal = params.session.atsScore?.total

  if (!targetJobDescription || !hasResumeContextForDeterministicAnalysis(params.session)) {
    return {
      applied: false,
      previousAtsTotal,
    }
  }

  const derivationResult = await deriveTargetResumeCvState({
    sessionId: params.session.id,
    userId: params.session.userId,
    baseCvState: getEffectiveCvState(params.session),
    targetJobDescription,
    externalSignal: params.signal,
  })

  if (!derivationResult.success) {
    return {
      applied: false,
      previousAtsTotal,
    }
  }

  const derivedCvState = derivationResult.derivedCvState

  if (JSON.stringify(derivedCvState) === JSON.stringify(params.session.cvState)) {
    return {
      applied: false,
      previousAtsTotal,
      optimizedAtsTotal: params.session.atsScore?.total,
    }
  }

  const derivedPatch = {
    cvState: derivedCvState,
    agentState: {
      sourceResumeText: buildResumeTextFromCvState(derivedCvState),
    },
    generatedOutput: {
      status: 'idle' as const,
      pdfPath: undefined,
      generatedAt: undefined,
      error: undefined,
    },
  } satisfies Parameters<typeof applyToolPatchWithVersion>[1]

  await persistPatch(
    params.session,
    derivedPatch,
    'target-derived',
  )

  yield createPatchChunk(params.session, derivedPatch)

  const refreshedScoreResult = yield* runDeterministicTool({
    session: params.session,
    toolName: 'score_ats',
    toolInput: {
      resume_text: buildResumeTextFromCvState(params.session.cvState),
      job_description: targetJobDescription,
    },
    requestId: params.requestId,
    signal: params.signal,
    surfaceToolStartToUser: false,
    surfaceFailureToUser: false,
  })

  const refreshedScoreOutput = refreshedScoreResult.output
  const optimizedAtsTotal = (
    refreshedScoreResult.success
    && refreshedScoreOutput
    && typeof refreshedScoreOutput === 'object'
    && 'success' in refreshedScoreOutput
    && refreshedScoreOutput.success === true
    && 'result' in refreshedScoreOutput
    && refreshedScoreOutput.result
    && typeof refreshedScoreOutput.result === 'object'
    && 'total' in refreshedScoreOutput.result
    && typeof refreshedScoreOutput.result.total === 'number'
  )
    ? refreshedScoreOutput.result.total
    : params.session.atsScore?.total

  return {
    applied: true,
    previousAtsTotal,
    optimizedAtsTotal,
  }
}

async function* handleConfirmedGeneration(params: {
  session: Session
  requestId: string
  signal?: AbortSignal
}): AsyncGenerator<AgentLoopEvent, string> {
  const previousAtsTotal = params.session.atsScore?.total
  const setPhaseResult = yield* runDeterministicTool({
    session: params.session,
    toolName: 'set_phase',
    toolInput: {
      phase: 'generation',
      reason: 'User explicitly approved file generation.',
    },
    requestId: params.requestId,
    signal: params.signal,
  })

  if (params.session.agentState.targetJobDescription?.trim()) {
    const targetResumeResult = yield* runDeterministicTool({
      session: params.session,
      toolName: 'create_target_resume',
      toolInput: {
        target_job_description: params.session.agentState.targetJobDescription,
      },
      requestId: params.requestId,
      signal: params.signal,
      surfaceToolStartToUser: false,
      surfaceFailureToUser: false,
    })

    const targetResumeOutput = targetResumeResult.output
    const derivedCvState = (
      targetResumeResult.success
      && targetResumeOutput
      && typeof targetResumeOutput === 'object'
      && 'success' in targetResumeOutput
      && targetResumeOutput.success === true
      && 'derivedCvState' in targetResumeOutput
      && targetResumeOutput.derivedCvState
      && typeof targetResumeOutput.derivedCvState === 'object'
    )
      ? targetResumeOutput.derivedCvState as Session['cvState']
      : null

    if (derivedCvState && JSON.stringify(derivedCvState) !== JSON.stringify(params.session.cvState)) {
      const targetDerivedPatch = {
        cvState: derivedCvState,
        agentState: {
          sourceResumeText: buildResumeTextFromCvState(derivedCvState),
        },
      } satisfies Parameters<typeof applyToolPatchWithVersion>[1]

      await persistPatch(
        params.session,
        targetDerivedPatch,
        'target-derived',
      )

      yield createPatchChunk(params.session, targetDerivedPatch)
    }
  }

  const generationResult = yield* runDeterministicTool({
    session: params.session,
    toolName: 'generate_file',
    toolInput: {
      cv_state: params.session.cvState,
      idempotency_key: buildChatGenerationIdempotencyKey(params.session),
    },
    requestId: params.requestId,
    signal: params.signal,
  })

  if (generationResult.success) {
    const generationOutput = generationResult.output
    const generationInProgress = Boolean(
      generationOutput
      && typeof generationOutput === 'object'
      && 'success' in generationOutput
      && generationOutput.success === true
      && 'inProgress' in generationOutput
      && generationOutput.inProgress === true,
    )

    if (generationInProgress) {
      return 'Sua geração já está em andamento. Aguarde alguns segundos e tente novamente para recuperar o resultado sem consumir outro crédito.'
    }

    let refreshedAtsTotal: number | null = null

    if (params.session.agentState.targetJobDescription?.trim()) {
      const refreshedScoreResult = yield* runDeterministicTool({
        session: params.session,
        toolName: 'score_ats',
        toolInput: {
          resume_text: buildResumeTextFromCvState(params.session.cvState),
          job_description: params.session.agentState.targetJobDescription,
        },
        requestId: params.requestId,
        signal: params.signal,
        surfaceToolStartToUser: false,
        surfaceFailureToUser: false,
      })

      const refreshedScoreOutput = refreshedScoreResult.output
      if (
        refreshedScoreResult.success
        && refreshedScoreOutput
        && typeof refreshedScoreOutput === 'object'
        && 'success' in refreshedScoreOutput
        && refreshedScoreOutput.success === true
        && 'result' in refreshedScoreOutput
        && refreshedScoreOutput.result
        && typeof refreshedScoreOutput.result === 'object'
        && 'total' in refreshedScoreOutput.result
        && typeof refreshedScoreOutput.result.total === 'number'
      ) {
        refreshedAtsTotal = refreshedScoreOutput.result.total
      }
    }

    const generationWarnings = (
      generationResult.output
      && typeof generationResult.output === 'object'
      && 'success' in generationResult.output
      && generationResult.output.success === true
      && 'warnings' in generationResult.output
      && Array.isArray(generationResult.output.warnings)
    )
      ? generationResult.output.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
      : []

    const atsSummary = refreshedAtsTotal !== null
      ? (previousAtsTotal !== undefined
        ? `ATS Score antes: ${previousAtsTotal}/100. ATS agora: ${refreshedAtsTotal}/100.`
        : `ATS atual estimado: ${refreshedAtsTotal}/100.`)
      : null

    if (generationWarnings.length > 0) {
      return [
        'Seu currículo ATS-otimizado em PDF está pronto.',
        atsSummary,
        `Mantive avisos claros nos campos pendentes do perfil: ${generationWarnings.join(', ')}.`,
        'Confira o download e a pré-visualização acima.',
      ].filter(Boolean).join(' ')
    }

    return [
      'Seu currículo ATS-otimizado em PDF está pronto.',
      atsSummary,
      'Confira o download e a pré-visualização acima.',
    ].filter(Boolean).join(' ')
  }

  if (!setPhaseResult.success && setPhaseResult.failureMessage) {
    return `Não consegui iniciar a geração agora. ${setPhaseResult.failureMessage}`
  }

  return `Não consegui gerar os arquivos agora. ${generationResult.failureMessage ?? 'Tente novamente em alguns instantes.'}`
}

async function* handleGenerationConfirmationRequest(params: {
  session: Session
  requestId: string
  signal?: AbortSignal
}): AsyncGenerator<AgentLoopEvent, string> {
  if (params.session.phase !== 'confirm') {
    const setPhaseResult = yield* runDeterministicTool({
      session: params.session,
      toolName: 'set_phase',
      toolInput: {
        phase: 'confirm',
        reason: 'User requested deterministic file generation confirmation.',
      },
      requestId: params.requestId,
      signal: params.signal,
      surfaceToolStartToUser: false,
      surfaceFailureToUser: false,
    })

    if (!setPhaseResult.success) {
      return `Não consegui preparar a confirmação da geração agora. ${setPhaseResult.failureMessage ?? 'Tente novamente em alguns instantes.'}`
    }
  }

  return GENERATION_CONFIRMATION_TEXT
}

async function* handleDeterministicRewriteRequest(params: {
  session: Session
  userMessage: string
  requestId: string
  signal?: AbortSignal
}): AsyncGenerator<AgentLoopEvent, string> {
  const focus = resolveRewriteFocus(params.userMessage) ?? 'summary'
  const currentContent = buildRewriteCurrentContent(params.session, focus)

  if (!currentContent?.trim()) {
    switch (focus) {
      case 'experience':
        return 'Seu perfil salvo ainda não tem experiências suficientes para eu reescrever essa seção. Posso começar pelo resumo profissional se quiser.'
      case 'skills':
        return 'Seu perfil salvo ainda não tem competências suficientes para eu reorganizar essa seção. Posso começar pelo resumo profissional se quiser.'
      case 'summary':
        return 'Não encontrei resumo suficiente no seu perfil salvo para reescrever agora. Atualize seu perfil e tente novamente.'
    }
  }

  if (!params.session.agentState.targetJobDescription?.trim()) {
    return 'Já tenho seu currículo salvo. Cole a descrição da vaga antes de pedir a reescrita otimizada.'
  }

  if (hasPendingCareerFitOverride(params.session)) {
    return buildCareerFitWarningText(params.session)
      ?? 'Antes de otimizar para essa vaga, preciso do seu ok explícito para seguir mesmo com o desalinhamento atual.'
  }

  if (params.session.phase !== 'dialog') {
    yield* runDeterministicTool({
      session: params.session,
      toolName: 'set_phase',
      toolInput: {
        phase: 'dialog',
        reason: 'User requested another deterministic rewrite.',
      },
      requestId: params.requestId,
      signal: params.signal,
      surfaceToolStartToUser: false,
      surfaceFailureToUser: false,
    })
  }

  const rewriteResult = yield* runDeterministicTool({
    session: params.session,
    toolName: 'rewrite_section',
    toolInput: {
      section: focus,
      current_content: currentContent,
      instructions: buildRewriteInstructions(params.session, focus),
      target_keywords: buildRewriteTargetKeywords(params.session),
    },
    requestId: params.requestId,
    signal: params.signal,
  })

  if (!rewriteResult.success) {
    const generationHint = resolveGenerationPrerequisiteMessage(params.session) === null
      ? ' Se quiser gerar os arquivos com a versão atual do currículo, responda com "Aceito".'
      : ''
    return `Não consegui reescrever essa seção agora. ${rewriteResult.failureMessage ?? 'Tente novamente em alguns instantes.'}${generationHint}`
  }

  const rewriteOutput = rewriteResult.output
  const rewrittenContent = (
    rewriteOutput
    && typeof rewriteOutput === 'object'
    && 'success' in rewriteOutput
    && rewriteOutput.success === true
    && 'rewritten_content' in rewriteOutput
    && typeof rewriteOutput.rewritten_content === 'string'
  )
    ? rewriteOutput.rewritten_content
    : null

  if (!rewrittenContent?.trim()) {
    return 'Consegui atualizar a seção, mas não recebi um texto legível para mostrar aqui. Tente novamente em alguns instantes.'
  }

  const focusLabel = formatRewriteFocusLabel(focus)

  return [
    `Aqui está uma versão reescrita do seu ${focusLabel}:`,
    '',
    rewrittenContent.trim(),
    '',
    'Se quiser seguir para a geração agora, responda com "Aceito".',
  ].join('\n')
}

export async function* runAgentLoop(
  params: AgentLoopParams,
): AsyncGenerator<AgentLoopEvent> {
  const { session, userMessage, appUserId, requestId, isNewSession, requestStartedAt, signal } = params
  const releaseMetadata = getAgentReleaseMetadata()
  const initialHistoryLimit = resolveMaxHistoryMessages(session.phase)

  await appendUserTurn(session.id, userMessage)

  const history = await getMessages(session.id, initialHistoryLimit)
  const messages = toOpenAIHistory(
    trimMessages(history.map((message) => ({ role: message.role, content: message.content })), initialHistoryLimit),
  )

  let toolIterations = 0
  let assistantResponded = false
  let cachedSystemPrompt = buildSystemPrompt(session)
  let systemPromptDirty = false
  const pendingCareerFitOverride = Boolean(
    session.agentState.targetJobDescription?.trim()
    && session.agentState.phaseMeta?.careerFitWarningIssuedAt
    && session.agentState.phaseMeta?.careerFitWarningTargetJobDescription?.trim() === session.agentState.targetJobDescription?.trim()
    && !session.agentState.phaseMeta?.careerFitOverrideConfirmedAt,
  )

  try {
    if (pendingCareerFitOverride && isCareerFitOverrideConfirmation(userMessage)) {
      const patch = await confirmCareerFitOverride(session)
      if (patch) {
        yield createPatchChunk(session, patch)
      }

      const careerFitAcknowledgement = buildCareerFitOverrideAcknowledgement(session)

      yield {
        type: 'text',
        content: careerFitAcknowledgement,
      }

      assistantResponded = true
      await appendAssistantTurn(session.id, careerFitAcknowledgement)

      yield buildDoneChunk({
        requestId,
        session,
        isNewSession,
        toolIterations,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      })
      return
    }

    if (isGenerationApproval(userMessage)) {
      if (hasPendingCareerFitOverride(session) && hasActiveCareerFitWarning(session)) {
        const overridePatch = await confirmCareerFitOverride(session)
        if (overridePatch) {
          yield createPatchChunk(session, overridePatch)
        }
      }

      const careerFitWarning = pendingCareerFitOverride
        ? buildCareerFitWarningText(session)
        : (yield* maybeIssueCareerFitWarning({ session }))
      if (careerFitWarning) {
        yield {
          type: 'text',
          content: careerFitWarning,
        }

        assistantResponded = true
        await appendAssistantTurn(session.id, careerFitWarning)

        yield buildDoneChunk({
          requestId,
          session,
          isNewSession,
          toolIterations,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        })
        return
      }

      const generationPrerequisiteMessage = resolveGenerationPrerequisiteMessage(session)
      const generationAssistantText = generationPrerequisiteMessage
        ?? (yield* handleConfirmedGeneration({
          session,
          requestId,
          signal,
        }))

      yield {
        type: 'text',
        content: generationAssistantText,
      }

      assistantResponded = true
      await appendAssistantTurn(session.id, generationAssistantText)

      logInfo('agent.stream.completed', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        isNewSession,
        messageCountAfter: session.messageCount + 1,
        toolLoopsUsed: toolIterations,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })

      yield buildDoneChunk({
        requestId,
        session,
        isNewSession,
        toolIterations,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      })
      return
    }

    if (isGenerationRequest(userMessage)) {
      if (hasPendingCareerFitOverride(session) && hasActiveCareerFitWarning(session)) {
        const overridePatch = await confirmCareerFitOverride(session)
        if (overridePatch) {
          yield createPatchChunk(session, overridePatch)
        }
      }

      const careerFitWarning = pendingCareerFitOverride
        ? buildCareerFitWarningText(session)
        : (yield* maybeIssueCareerFitWarning({ session }))
      if (careerFitWarning) {
        yield {
          type: 'text',
          content: careerFitWarning,
        }

        assistantResponded = true
        await appendAssistantTurn(session.id, careerFitWarning)

        logInfo('agent.stream.completed', {
          ...releaseMetadata,
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
          isNewSession,
          messageCountAfter: session.messageCount + 1,
          toolLoopsUsed: toolIterations,
          success: true,
          latencyMs: Date.now() - requestStartedAt,
        })

        yield buildDoneChunk({
          requestId,
          session,
          isNewSession,
          toolIterations,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        })
        return
      }

      const generationAssistantText = resolveGenerationPrerequisiteMessage(session)
        ?? (yield* handleGenerationConfirmationRequest({
          session,
          requestId,
          signal,
        }))

      yield {
        type: 'text',
        content: generationAssistantText,
      }

      assistantResponded = true
      await appendAssistantTurn(session.id, generationAssistantText)

      logInfo('agent.stream.completed', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        isNewSession,
        messageCountAfter: session.messageCount + 1,
        toolLoopsUsed: toolIterations,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })

      yield buildDoneChunk({
        requestId,
        session,
        isNewSession,
        toolIterations,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      })
      return
    }

    if ((session.phase === 'dialog' || session.phase === 'confirm') && isDialogRewriteRequest(userMessage)) {
      const rewriteAssistantText = yield* handleDeterministicRewriteRequest({
        session,
        userMessage,
        requestId,
        signal,
      })

      yield {
        type: 'text',
        content: rewriteAssistantText,
      }

      assistantResponded = true
      await appendAssistantTurn(session.id, rewriteAssistantText)

      logInfo('agent.stream.completed', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        isNewSession,
        messageCountAfter: session.messageCount + 1,
        toolLoopsUsed: toolIterations,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })

      yield buildDoneChunk({
        requestId,
        session,
        isNewSession,
        toolIterations,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      })
      return
    }

    if (session.phase === 'dialog' && isDialogContinuationApproval(userMessage)) {
      const continuationAssistantText = buildDialogFallback(session, userMessage).text

      yield {
        type: 'text',
        content: continuationAssistantText,
      }

      assistantResponded = true
      await appendAssistantTurn(session.id, continuationAssistantText)

      logInfo('agent.stream.completed', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        isNewSession,
        messageCountAfter: session.messageCount + 1,
        toolLoopsUsed: toolIterations,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
        deterministicFastPath: 'dialog_continue',
      })

      yield buildDoneChunk({
        requestId,
        session,
        isNewSession,
        toolIterations,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      })
      return
    }

    const analysisPrimed = yield* primeAnalysisState({
      session,
      userMessage,
      requestId,
      signal,
    })

    if (analysisPrimed.mutatedPromptState) {
      systemPromptDirty = true
    }

    if (shouldUseDeterministicVacancyBootstrap(session, userMessage)) {
      yield* runDeterministicTool({
        session,
        toolName: 'set_phase',
        toolInput: {
          phase: 'dialog',
          reason: 'Vacancy was saved and the initial ATS-oriented bootstrap summary is ready.',
        },
        requestId,
        signal,
        surfaceToolStartToUser: false,
        surfaceFailureToUser: false,
      })

      const targetPreparation = yield* maybePrepareTargetResumeForDeterministicFlow({
        session,
        requestId,
        signal,
      })

      if (targetPreparation.applied) {
        systemPromptDirty = true
      }

      const bootstrapCareerFitWarning = yield* maybeIssueCareerFitWarning({ session })
      const bootstrapAssistantText = bootstrapCareerFitWarning
        ?? buildDeterministicVacancyBootstrap(session, userMessage, targetPreparation)
      const bootstrapFallbackKind = session.atsScore
        || session.agentState.targetFitAssessment
        || session.agentState.gapAnalysis
        ? 'analysis_structured_target_context'
        : 'analysis_saved_target_context'

      yield {
        type: 'text',
        content: bootstrapAssistantText,
      }

      assistantResponded = true
      await appendAssistantTurn(session.id, bootstrapAssistantText)

      logInfo('agent.stream.completed', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        fallbackKind: bootstrapFallbackKind,
        isNewSession,
        messageCountAfter: session.messageCount + 1,
        toolLoopsUsed: toolIterations,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })

      yield buildDoneChunk({
        requestId,
        session,
        isNewSession,
        toolIterations,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      })
      return
    }

    while (true) {
      const phaseToolIterationLimit = resolveMaxToolIterations(session.phase)
      const phaseOutputBudget = resolveConversationMaxOutputTokens(session.phase)

      if (signal?.aborted) {
        logInfo('agent.request.cancelled', {
          ...releaseMetadata,
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          toolIterations,
          success: false,
          latencyMs: Date.now() - requestStartedAt,
        })
        return
      }

      toolIterations++

      if (toolIterations > phaseToolIterationLimit) {
        logError('agent.tool_loop.exceeded', {
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
          toolIterations,
          maxToolIterations: phaseToolIterationLimit,
          success: false,
        })

        yield {
          type: 'error',
          error: 'A IA excedeu o número máximo de chamadas de ferramenta. Tente novamente.',
          code: TOOL_ERROR_CODES.INTERNAL_ERROR,
          requestId,
        }
        break
      }

      if (systemPromptDirty) {
        cachedSystemPrompt = buildSystemPrompt(session)
        systemPromptDirty = false
      }

      const toolsForPhase = getToolDefinitionsForPhase(session.phase)
      const historyChars = calculateHistoryChars(messages)

      logInfo('agent.turn.started', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        model: resolveAgentModelForPhase(session.phase),
        toolIteration: toolIterations,
        systemPromptChars: cachedSystemPrompt.length,
        historyChars,
        historyMessages: messages.length,
        allowedToolCount: toolsForPhase.length,
        maxOutputTokens: phaseOutputBudget,
        maxToolIterations: phaseToolIterationLimit,
        success: true,
      })

      let turn = yield* streamAssistantTurn({
        session,
        messages,
        cachedSystemPrompt,
        requestId,
        appUserId,
        requestStartedAt,
        signal,
        maxCompletionTokens: phaseOutputBudget,
        tools: toolsForPhase,
      })

      if (turn.finishReason === 'length' && turn.toolCalls.length === 0) {
        if (turn.assistantText.trim()) {
          turn = yield* recoverTruncatedTurn({
            initialTurn: turn,
            session,
            messages,
            cachedSystemPrompt,
            requestId,
            appUserId,
            requestStartedAt,
            signal,
            maxCompletionTokens: phaseOutputBudget,
            lengthRecoveryPrompt: LENGTH_RECOVERY_PROMPT,
            streamAssistantTurn,
            isBootstrapLikeAssistantText,
            isConcreteRewriteContinuationText,
          })
        } else {
          turn = yield* recoverZeroTextTurn({
            initialTurn: turn,
            session,
            userMessage,
            requestId,
            appUserId,
            requestStartedAt,
            signal,
            maxCompletionTokens: phaseOutputBudget,
            recoverySystemPrompt: RECOVERY_SYSTEM_PROMPT,
            buildRecoveryUserPrompt,
            streamAssistantTurn,
          })
        }
      }

      if (
        turn.toolCalls.length === 0
        && (turn.finishReason === 'length' || !turn.assistantText.trim())
        && !turn.usedZeroTextRecovery
      ) {
        const conciseTurn = yield* recoverConciseTurn({
          session,
          userMessage,
          requestId,
          appUserId,
          requestStartedAt,
          signal,
          conciseFallbackMaxTokens: AGENT_CONFIG.conciseFallbackMaxTokens,
          recoverySystemPrompt: RECOVERY_SYSTEM_PROMPT,
          buildRecoveryUserPrompt,
          streamAssistantTurn,
        })

        turn = mergeConciseRecoveryTurn(turn, conciseTurn)
      }

      if (turn.usage) {
        await trackTurnUsage({
          session,
          appUserId,
          releaseMetadata,
          model: turn.model,
          usage: turn.usage,
          finishReason: turn.finishReason,
          toolCalls: turn.toolCalls.length,
          assistantTextChars: turn.assistantText.length,
          requestId,
          systemPromptChars: cachedSystemPrompt.length,
          historyChars,
          allowedToolCount: toolsForPhase.length,
          usedLengthRecovery: Boolean(turn.usedLengthRecovery),
          usedZeroTextRecovery: Boolean(turn.usedZeroTextRecovery),
          usedConciseRecovery: Boolean(turn.usedConciseRecovery),
        })
      }

      if (turn.assistantText.trim()) {
        assistantResponded = true
        await appendAssistantTurn(session.id, turn.assistantText.trim())
      }

      if (turn.finishReason === 'tool_calls') {
        if (turn.toolCalls.length === 0) {
          yield createErrorChunk(
            'The AI response was incomplete.',
            requestId,
          )
          break
        }
      } else if (turn.finishReason === 'stop') {
        break
      } else if (turn.finishReason === 'length') {
        logWarn('agent.response.truncated_after_recovery', {
          ...releaseMetadata,
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
          model: turn.model,
          assistantTextChars: turn.assistantText.length,
          toolIterations,
          success: true,
        })
        break
      } else if (!turn.finishReason) {
        yield createErrorChunk(
          'The AI response was incomplete.',
          requestId,
        )
        break
      } else {
        yield createErrorChunk(
          `Unexpected finish reason: ${turn.finishReason}`,
          requestId,
        )
        break
      }

      messages.push(buildAssistantToolCallMessage({
        assistantText: turn.assistantText,
        toolCalls: turn.toolCalls,
      }))

      for (const toolCall of turn.toolCalls) {
        yield {
          type: 'toolStart',
          toolName: toolCall.name,
        }

        const toolInput = parseJsonObject(toolCall.argumentsRaw)
        if (!toolInput) {
          const failure = toolFailure(
            TOOL_ERROR_CODES.LLM_INVALID_OUTPUT,
            `Failed to parse arguments for tool "${toolCall.name}".`,
          )

          messages.push(buildToolMessage(toolCall.id, JSON.stringify(failure)))

          yield createErrorChunk(failure.error, requestId, failure.code)
          break
        }

        const toolResult = await dispatchToolWithContext(toolCall.name, toolInput, session, signal)

        if (toolResult.outputFailure) {
          // Append tool message for failed execution (required by chat API protocol)
          // Even failed tools must have a matching tool message in the conversation history
          messages.push(buildToolMessage(toolCall.id, JSON.stringify(toolResult.outputFailure)))

          yield {
            type: 'error',
            error: toolResult.outputFailure.error,
            code: toolResult.outputFailure.code,
            requestId,
          }

          if (toolResult.persistedPatch) {
            yield createPatchChunk(session, toolResult.persistedPatch)
            systemPromptDirty = true
          }
          continue
        }

        // Add successful tool results to message history
        messages.push(buildToolMessage(toolCall.id, toolResult.outputJson))

        yield {
          type: 'toolResult',
          toolName: toolCall.name,
          output: toolResult.output,
        }

        if (toolResult.persistedPatch) {
          yield createPatchChunk(session, toolResult.persistedPatch)
          systemPromptDirty = true
        }
      }
    }

    if (!assistantResponded && !signal?.aborted) {
      const recovery = yield* recoverAssistantResponse({
        session,
        userMessage,
        requestId,
        appUserId,
        requestStartedAt,
        signal,
        cachedSystemPrompt,
        historyChars: calculateHistoryChars(messages),
        releaseMetadata,
        toolIterations,
        recoverySystemPrompt: RECOVERY_SYSTEM_PROMPT,
        conciseFallbackMaxTokens: resolveConciseFallbackMaxTokens(session.phase),
        buildRecoveryUserPrompt,
        streamAssistantTurn,
        trackTurnUsage,
        resolveAgentModelForPhase,
        resolveDeterministicAssistantFallback,
        logWarn,
      })

      assistantResponded = true
      await appendAssistantTurn(session.id, recovery.assistantText)
    }

    logInfo('agent.stream.completed', {
      ...releaseMetadata,
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      isNewSession,
      messageCountAfter: session.messageCount + 1,
      toolLoopsUsed: toolIterations,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })

    yield buildDoneChunk({
      requestId,
      session,
      isNewSession,
      toolIterations,
      maxMessages: AGENT_CONFIG.maxMessagesPerSession,
    })
  } catch (error) {
    if ((error instanceof Error || error instanceof DOMException) && error.name === 'AbortError' && signal?.aborted) {
      logInfo('agent.request.cancelled', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        toolIterations,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return
    }

    logError('agent.request.failed', {
      ...releaseMetadata,
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      parseConfidenceScore: session.agentState.parseConfidenceScore,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
      ...serializeError(error),
    })

    yield buildErrorChunk({
      error,
      requestId,
    })
  }
}
