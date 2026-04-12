import type OpenAI from 'openai'
import { APIError } from 'openai'
import { createHash } from 'crypto'

import { buildSystemPrompt, trimMessages } from '@/lib/agent/context-builder'
import { AGENT_CONFIG, resolveAgentModelForPhase } from '@/lib/agent/config'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { dispatchToolWithContext, getToolDefinitionsForPhase } from '@/lib/agent/tools'
import { calculateUsageCostCents, trackApiUsage } from '@/lib/agent/usage-tracker'
import { appendMessage, applyToolPatchWithVersion, getMessages } from '@/lib/db/sessions'
import { createChatCompletionStreamWithRetry } from '@/lib/openai/chat'
import { openai } from '@/lib/openai/client'
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
const GENERATION_CONFIRMATION_TEXT = 'Quando fizer sentido, clique em "Aceito" para gerar seu curriculo.'
const MISSING_PROFILE_WITH_TARGET_TEXT = 'Recebi a vaga. Para adaptar seu curriculo, complete primeiro seu perfil em "Meu Perfil" antes de continuar.'
const MISSING_PROFILE_TEXT = 'Preciso do seu curriculo salvo em "Meu Perfil" para continuar.'
const RECOVERY_SYSTEM_PROMPT = [
  'You are CurrIA, a resume optimization assistant for Brazilian users.',
  'Respond in the same language as the user, in plain text, with a short and useful answer.',
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

type AgentLoopParams = {
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

type StreamTurnResult = {
  assistantText: string
  toolCalls: AccumulatedToolCall[]
  finishReason: OpenAI.Chat.Completions.ChatCompletionChunk.Choice['finish_reason'] | null
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  usedLengthRecovery?: boolean
  usedZeroTextRecovery?: boolean
  usedConciseRecovery?: boolean
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

function toUsage(
  usage: OpenAI.CompletionUsage | null | undefined,
): StreamTurnResult['usage'] | undefined {
  if (!usage) {
    return undefined
  }

  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
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

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isGenerationApproval(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || /\b(nao|not|cancel|depois)\b/.test(normalized)) {
    return false
  }

  return /\b(aceito|aceito gerar|aceito a geracao|confirmo a geracao)\b/.test(normalized)
}

function isGenerationRequest(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || /\b(nao|not|cancel|depois)\b/.test(normalized)) {
    return false
  }

  return (
    /\b(pode gerar|gerar agora|gere o arquivo|gere os arquivos|gere o curriculo|gere meu curriculo)\b/.test(normalized)
    || (
      /\b(gere|gerar|gera|exporte|exportar|baixar|baixe|download)\b/.test(normalized)
      && /\b(arquivo|arquivos|curriculo|pdf|docx|versao final)\b/.test(normalized)
    )
  )
}

function isDialogContinuationApproval(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || /\b(nao|not|cancel|depois)\b/.test(normalized)) {
    return false
  }

  return /^(sim|ok|okay|pode|pode fazer|pode seguir|segue|continue|continua|vai|manda ver|bora)$/.test(normalized)
}

type RewriteFocus = 'summary' | 'experience' | 'skills'

function resolveRewriteFocus(message: string): RewriteFocus | null {
  const normalized = normalizeText(message)

  if (!normalized) {
    return null
  }

  if (/\b(resumo|summary|perfil profissional)\b/.test(normalized)) {
    return 'summary'
  }

  if (/\b(experiencia|experience|historico)\b/.test(normalized)) {
    return 'experience'
  }

  if (/\b(competencia|competencias|skills|habilidades)\b/.test(normalized)) {
    return 'skills'
  }

  return null
}

function isDialogRewriteRequest(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || looksLikeJobDescription(message)) {
    return false
  }

  if (resolveRewriteFocus(message)) {
    return true
  }

  return /\b(reescreva|reescrever|reescreve|rewrite|adapte|adaptar|ajuste|ajustar|melhore|melhorar|refaca|refazer)\b/.test(normalized)
}

function formatRewriteFocusLabel(focus: RewriteFocus): string {
  switch (focus) {
    case 'summary':
      return 'resumo profissional'
    case 'experience':
      return 'experiencia'
    case 'skills':
      return 'competencias'
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
        ? `Posso reescrever agora seu ${focusLabel}. Ja tenho seu curriculo e a vaga como referencia. Vou devolver uma versao mais alinhada a essa oportunidade.`
        : `Posso seguir, sim. Ja tenho seu curriculo e a vaga como referencia. Vou continuar pelo trecho com maior impacto para essa vaga: seu ${focusLabel}.`)
      : (params.explicit
        ? `Posso reescrever agora seu ${focusLabel}. Ja tenho seu curriculo em contexto e vou te devolver uma versao mais forte e objetiva.`
      : `Posso seguir, sim. Ja tenho seu curriculo em contexto. Vou continuar pelo trecho com maior impacto: seu ${focusLabel}.`),
  }
}

function buildRewriteCurrentContent(
  session: Session,
  focus: RewriteFocus,
): string | null {
  switch (focus) {
    case 'summary':
      return session.cvState.summary.trim() || buildResumeTextForScoring(session)
    case 'experience':
      return session.cvState.experience.length > 0
        ? JSON.stringify(session.cvState.experience, null, 2)
        : null
    case 'skills':
      return session.cvState.skills.length > 0
        ? session.cvState.skills.join(', ')
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
  const existingSkills = session.cvState.skills ?? []
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

function buildResumeTextForScoring(session: Session): string {
  const canonicalResumeText = buildResumeTextFromCvState(session.cvState)

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
    return 'Ja tenho seu curriculo salvo. Cole a descricao da vaga antes de gerar o curriculo otimizado ATS.'
  }

  return null
}

function normalizeForJobDetection(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function looksLikeJobDescription(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 140) {
    return false
  }

  const normalized = normalizeForJobDetection(trimmed)
  const sectionSignals = [
    'responsabilidades',
    'responsibility',
    'responsibilities',
    'requisitos',
    'requirements',
    'qualificacoes',
    'qualifications',
    'diferenciais',
    'nice to have',
    'o que oferecemos',
    'o que procuramos',
    'we are looking for',
    'job description',
  ]

  const sectionHits = sectionSignals.filter((signal) => normalized.includes(signal)).length
  const roleHit = /\b(analista|engenheiro|developer|desenvolvedor|cientista|gerente|coordenador|consultor|product|designer|arquiteto|devops|sre|qa|bi|dados|data)\b/.test(normalized)
  const hiringIntentHit = /\b(vaga|cargo|posicao|position|role|opportunity|buscamos|contratando)\b/.test(normalized)

  return sectionHits >= 2 || (roleHit && hiringIntentHit && trimmed.length >= 220)
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
    const parts = ['Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.']

    if (session.atsScore) {
      parts.push(`Pontuacao ATS atual: ${session.atsScore.total}/100.`)
    }

    if (session.agentState.targetFitAssessment) {
      parts.push(
        `Aderencia inicial: ${formatFitLevel(session.agentState.targetFitAssessment.level)}. ${session.agentState.targetFitAssessment.summary}`,
      )
    } else if (session.agentState.gapAnalysis) {
      parts.push(`Aderencia estimada a vaga: ${session.agentState.gapAnalysis.result.matchScore}/100.`)
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

    parts.push('Posso seguir reescrevendo seu resumo ou experiencia com base nesses pontos. Se quiser gerar agora a versao otimizada, responda com "Aceito".')
    return parts.join(' ')
  }

  if (hasTargetJobContext) {
    return 'Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo. Posso seguir reescrevendo seu resumo ou experiencia com base nela. Se quiser gerar agora a versao otimizada, responda com "Aceito".'
  }

  if (hasTargetJobContext) {
    return 'Recebi a vaga e vou usá-la como referência. Tente novamente com um pedido curto, como "compare meu currículo com esta vaga" ou "reescreva meu resumo para esta vaga".'
  }

  return 'Recebi sua mensagem, mas esta resposta falhou. Tente repetir o pedido em uma frase curta e objetiva que eu continuo daqui.'
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

  const parts = ['Recebi a vaga e comparei com seu curriculo com foco em aderencia ATS.']

  if (
    targetPreparation.applied
    && targetPreparation.previousAtsTotal !== undefined
    && targetPreparation.optimizedAtsTotal !== undefined
  ) {
    parts.push(
      `Atualizei a versao de trabalho do seu curriculo para essa vaga. ATS antes: ${targetPreparation.previousAtsTotal}/100. ATS da versao otimizada: ${targetPreparation.optimizedAtsTotal}/100.`,
    )
  } else if (session.atsScore) {
    parts.push(`Pontuacao ATS atual: ${session.atsScore.total}/100.`)
  }

  if (session.agentState.targetFitAssessment) {
    parts.push(
      `Aderencia inicial: ${formatFitLevel(session.agentState.targetFitAssessment.level)}. ${session.agentState.targetFitAssessment.summary}`,
    )
  } else if (session.agentState.gapAnalysis) {
    parts.push(`Aderencia estimada a vaga: ${session.agentState.gapAnalysis.result.matchScore}/100.`)
  }

  if (session.agentState.gapAnalysis) {
    const missingSkills = session.agentState.gapAnalysis.result.missingSkills.slice(0, 3)
    const weakAreas = session.agentState.gapAnalysis.result.weakAreas.slice(0, 2)
    const topSuggestion = session.agentState.gapAnalysis.result.improvementSuggestions[0]

    if (missingSkills.length > 0) {
      parts.push(`Palavras-chave e sinais que ainda estao fracos: ${missingSkills.join(', ')}.`)
    }

    if (weakAreas.length > 0) {
      parts.push(`Trechos do curriculo com maior oportunidade de ganho: ${weakAreas.join(', ')}.`)
    }

    if (topSuggestion) {
      parts.push(`Melhor proximo ajuste ATS: ${normalizeTrailingSentence(topSuggestion)}.`)
    }
  } else if (session.atsScore) {
    const topIssue = session.atsScore.issues[0]?.message
    const topSuggestion = session.atsScore.suggestions[0]
    const uniqueMessages = dedupeOrderedSentences([topIssue, topSuggestion])

    if (uniqueMessages[0]) {
      parts.push(`Principal ponto a melhorar: ${normalizeTrailingSentence(uniqueMessages[0])}.`)
    }

    if (uniqueMessages[1]) {
      parts.push(`Melhor proximo ajuste ATS: ${normalizeTrailingSentence(uniqueMessages[1])}.`)
    }
  }

  if (targetPreparation.applied) {
    parts.push('Ja deixei uma versao base otimizada para essa vaga. Se quiser, ainda posso refinar resumo, experiencia ou competencias antes da geracao.')
  } else {
    parts.push('Posso otimizar agora seu resumo, experiencia ou competencias com base nessa vaga.')
  }

  parts.push('Quando fizer sentido, clique em "Aceito" para gerar seu curriculo.')

  return parts.join(' ')
}

function buildDialogFallback(session: Session, userMessage: string): DeterministicFallback {
  const latestMessageLooksLikeVacancy = looksLikeJobDescription(userMessage)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim() || latestMessageLooksLikeVacancy)
  const rewriteFocus = resolveRewriteFocus(userMessage)
  const latestMessageIsRewriteRequest = isDialogRewriteRequest(userMessage)

  if (latestMessageLooksLikeVacancy) {
    return {
      kind: 'dialog_latest_target_job_context',
      text: 'Recebi essa nova vaga e ja tenho seu curriculo em contexto. Posso adaptar agora seu resumo, experiencia ou competencias para essa oportunidade. Se quiser, responda com "reescreva meu resumo" ou "Aceito" para gerar a versao otimizada.',
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
      text: 'Ja tenho seu curriculo e a vaga como referencia. Posso reescrever agora seu resumo, experiencia ou competencias para aumentar a aderencia ATS. Se quiser, responda com "reescreva meu resumo" ou "Aceito" para gerar a versao otimizada.',
    }
  }

  return {
    kind: 'dialog_resume_context_only',
    text: 'Ja tenho seu curriculo em contexto. Posso reescrever seu resumo, experiencia ou competencias. Diga qual trecho voce quer ajustar primeiro.',
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

async function* streamAssistantTurn(params: {
  session: Session
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  cachedSystemPrompt: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
}): AsyncGenerator<AgentTextChunk, StreamTurnResult> {
  const streamStartedAt = Date.now()
  const selectedModel = resolveAgentModelForPhase(params.session.phase)

  // Only include tool_choice if tools are provided. OpenAI API requires tools when tool_choice is set.
  const requestParams: Parameters<typeof createChatCompletionStreamWithRetry>[1] = {
    model: selectedModel,
    max_completion_tokens: params.maxCompletionTokens,
    messages: [
      { role: 'system', content: params.cachedSystemPrompt },
      ...params.messages,
    ],
    stream: true,
    stream_options: { include_usage: true },
  }

  if (params.tools && params.tools.length > 0) {
    requestParams.tools = params.tools
    if (params.toolChoice) {
      requestParams.tool_choice = params.toolChoice
    }
  }

  const stream = await createChatCompletionStreamWithRetry(
    openai,
    requestParams,
    3,
    AGENT_CONFIG.timeout,
    params.signal,
  )

  const toolCalls: AccumulatedToolCall[] = []
  let assistantText = ''
  let finishReason: StreamTurnResult['finishReason'] = null
  let usage: StreamTurnResult['usage']
  let loggedFirstToken = false

  for await (const chunk of stream) {
    if (params.signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }

    if (chunk.usage) {
      usage = toUsage(chunk.usage)
    }

    const choice = chunk.choices[0]
    if (!choice) {
      continue
    }

    const { delta } = choice
    if (choice.finish_reason) {
      finishReason = choice.finish_reason
    }

    if (delta.content) {
      assistantText += delta.content

      if (!loggedFirstToken) {
        loggedFirstToken = true
        logInfo('agent.stream.first_token', {
          requestId: params.requestId,
          sessionId: params.session.id,
          appUserId: params.appUserId,
          phase: params.session.phase,
          stateVersion: params.session.stateVersion,
          setupMs: streamStartedAt - params.requestStartedAt,
          firstTokenMs: Date.now() - streamStartedAt,
          totalLatencyMs: Date.now() - params.requestStartedAt,
          success: true,
        })
      }

      yield {
        type: 'text',
        content: delta.content,
      }
    }

    if (!delta.tool_calls) {
      continue
    }

    for (const toolCallDelta of delta.tool_calls) {
      const index = toolCallDelta.index ?? 0

      if (!toolCalls[index]) {
        toolCalls[index] = {
          id: toolCallDelta.id ?? '',
          name: toolCallDelta.function?.name ?? '',
          argumentsRaw: '',
        }
      }

      if (toolCallDelta.id) {
        toolCalls[index].id = toolCallDelta.id
      }

      if (toolCallDelta.function?.name) {
        toolCalls[index].name = toolCallDelta.function.name
      }

      if (toolCallDelta.function?.arguments) {
        toolCalls[index].argumentsRaw += toolCallDelta.function.arguments
      }
    }
  }

  return {
    assistantText,
    toolCalls: toolCalls.filter(Boolean),
    finishReason,
    model: selectedModel,
    usage,
  }
}

async function* recoverTruncatedTurn(params: {
  initialTurn: StreamTurnResult
  session: Session
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  cachedSystemPrompt: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
}): AsyncGenerator<AgentTextChunk, StreamTurnResult> {
  let accumulatedAssistantText = params.initialTurn.assistantText
  let finishReason = params.initialTurn.finishReason
  let usage = params.initialTurn.usage
  let recoveryAttempts = 0

  while (finishReason === 'length' && recoveryAttempts < 2 && !params.signal?.aborted) {
    recoveryAttempts++

    const continuationTurn = yield* streamAssistantTurn({
      session: params.session,
      messages: [
        ...params.messages,
        { role: 'assistant', content: accumulatedAssistantText },
        { role: 'user', content: LENGTH_RECOVERY_PROMPT },
      ],
      cachedSystemPrompt: params.cachedSystemPrompt,
      requestId: params.requestId,
      appUserId: params.appUserId,
      requestStartedAt: params.requestStartedAt,
      signal: params.signal,
      maxCompletionTokens: Math.min(params.maxCompletionTokens, 450),
    })

    const shouldReplacePriorText = isBootstrapLikeAssistantText(accumulatedAssistantText)
      && !isBootstrapLikeAssistantText(continuationTurn.assistantText)
      && isConcreteRewriteContinuationText(continuationTurn.assistantText)

    accumulatedAssistantText = shouldReplacePriorText
      ? continuationTurn.assistantText
      : `${accumulatedAssistantText}${continuationTurn.assistantText}`
    finishReason = continuationTurn.finishReason
    usage = mergeUsage(usage, continuationTurn.usage)

    if (continuationTurn.toolCalls.length > 0) {
      return {
        assistantText: accumulatedAssistantText,
        toolCalls: continuationTurn.toolCalls,
        finishReason,
        model: continuationTurn.model,
        usage,
        usedLengthRecovery: true,
      }
    }
  }

  return {
    assistantText: accumulatedAssistantText,
    toolCalls: [],
    finishReason,
    model: params.initialTurn.model,
    usage,
    usedLengthRecovery: recoveryAttempts > 0,
  }
}

async function* recoverZeroTextTurn(params: {
  initialTurn: StreamTurnResult
  session: Session
  userMessage: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
}): AsyncGenerator<AgentTextChunk, StreamTurnResult> {
  let lastTurn = params.initialTurn
  let usage = params.initialTurn.usage
  let recoveryAttempts = 0

  while (recoveryAttempts < 2 && !params.signal?.aborted) {
    recoveryAttempts++

    const recoveryTurn = yield* streamAssistantTurn({
      session: params.session,
      messages: [
        {
          role: 'user',
          content: buildRecoveryUserPrompt({
            session: params.session,
            userMessage: params.userMessage,
            mode: 'empty',
            attempt: recoveryAttempts,
          }),
        },
      ],
      cachedSystemPrompt: RECOVERY_SYSTEM_PROMPT,
      requestId: params.requestId,
      appUserId: params.appUserId,
      requestStartedAt: params.requestStartedAt,
      signal: params.signal,
      maxCompletionTokens: Math.min(params.maxCompletionTokens, 550),
    })

    usage = mergeUsage(usage, recoveryTurn.usage)
    lastTurn = {
      ...recoveryTurn,
      usage,
    }

    if (recoveryTurn.toolCalls.length > 0 || recoveryTurn.assistantText.trim() || recoveryTurn.finishReason !== 'length') {
      return {
        ...lastTurn,
        usedZeroTextRecovery: true,
      }
    }
  }

  return {
    ...lastTurn,
    model: lastTurn.model || params.initialTurn.model,
    usage,
    usedZeroTextRecovery: recoveryAttempts > 0,
  }
}

async function* recoverConciseTurn(params: {
  session: Session
  userMessage: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
}): AsyncGenerator<AgentTextChunk, StreamTurnResult> {
  const turn = yield* streamAssistantTurn({
    session: params.session,
    messages: [
      {
        role: 'user',
        content: buildRecoveryUserPrompt({
          session: params.session,
          userMessage: params.userMessage,
          mode: 'concise',
        }),
      },
    ],
    cachedSystemPrompt: RECOVERY_SYSTEM_PROMPT,
    requestId: params.requestId,
    appUserId: params.appUserId,
    requestStartedAt: params.requestStartedAt,
    signal: params.signal,
    maxCompletionTokens: AGENT_CONFIG.conciseFallbackMaxTokens,
  })

  return {
    ...turn,
    usedConciseRecovery: true,
  }
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
      yield {
        type: 'patch',
        patch: toolResult.persistedPatch,
        phase: params.session.phase,
      }
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
    yield {
      type: 'patch',
      patch: toolResult.persistedPatch,
      phase: params.session.phase,
    }
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
    baseCvState: params.session.cvState,
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

  await applyToolPatchWithVersion(
    params.session,
    derivedPatch,
    'target-derived',
  )

  yield {
    type: 'patch',
    patch: derivedPatch,
    phase: params.session.phase,
  }

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

      await applyToolPatchWithVersion(
        params.session,
        targetDerivedPatch,
        'target-derived',
      )

      yield {
        type: 'patch',
        patch: targetDerivedPatch,
        phase: params.session.phase,
      }
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
        'Seu curriculo ATS-otimizado em PDF esta pronto.',
        atsSummary,
        `Mantive avisos claros nos campos pendentes do perfil: ${generationWarnings.join(', ')}.`,
        'Confira o download e a pre-visualizacao acima.',
      ].filter(Boolean).join(' ')
    }

    return [
      'Seu curriculo ATS-otimizado em PDF esta pronto.',
      atsSummary,
      'Confira o download e a pre-visualizacao acima.',
    ].filter(Boolean).join(' ')
  }

  if (!setPhaseResult.success && setPhaseResult.failureMessage) {
    return `Nao consegui iniciar a geracao agora. ${setPhaseResult.failureMessage}`
  }

  return `Nao consegui gerar os arquivos agora. ${generationResult.failureMessage ?? 'Tente novamente em alguns instantes.'}`
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
      return `Nao consegui preparar a confirmacao da geracao agora. ${setPhaseResult.failureMessage ?? 'Tente novamente em alguns instantes.'}`
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
        return 'Seu perfil salvo ainda nao tem experiencias suficientes para eu reescrever essa secao. Posso comecar pelo resumo profissional se quiser.'
      case 'skills':
        return 'Seu perfil salvo ainda nao tem competencias suficientes para eu reorganizar essa secao. Posso comecar pelo resumo profissional se quiser.'
      case 'summary':
        return 'Nao encontrei resumo suficiente no seu perfil salvo para reescrever agora. Atualize seu perfil e tente novamente.'
    }
  }

  if (!params.session.agentState.targetJobDescription?.trim()) {
    return 'Ja tenho seu curriculo salvo. Cole a descricao da vaga antes de pedir a reescrita otimizada.'
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
      ? ' Se quiser gerar os arquivos com a versao atual do curriculo, responda com "Aceito".'
      : ''
    return `Nao consegui reescrever essa secao agora. ${rewriteResult.failureMessage ?? 'Tente novamente em alguns instantes.'}${generationHint}`
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
    return 'Consegui atualizar a secao, mas nao recebi um texto legivel para mostrar aqui. Tente novamente em alguns instantes.'
  }

  const focusLabel = formatRewriteFocusLabel(focus)

  return [
    `Aqui esta uma versao reescrita do seu ${focusLabel}:`,
    '',
    rewrittenContent.trim(),
    '',
    'Se quiser seguir para a geracao agora, responda com "Aceito".',
  ].join('\n')
}

export async function* runAgentLoop(
  params: AgentLoopParams,
): AsyncGenerator<AgentLoopEvent> {
  const { session, userMessage, appUserId, requestId, isNewSession, requestStartedAt, signal } = params
  const releaseMetadata = getAgentReleaseMetadata()

  await appendMessage(session.id, 'user', userMessage)

  const history = await getMessages(session.id, AGENT_CONFIG.maxHistoryMessages)
  const messages = toOpenAIHistory(
    trimMessages(history.map((message) => ({ role: message.role, content: message.content }))),
  )

  let toolIterations = 0
  let assistantResponded = false
  let cachedSystemPrompt = buildSystemPrompt(session)
  let systemPromptDirty = false

  try {
    if (isGenerationApproval(userMessage)) {
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
      await appendMessage(session.id, 'assistant', generationAssistantText)

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

      yield {
        type: 'done',
        requestId,
        sessionId: session.id,
        phase: session.phase,
        atsScore: session.atsScore,
        messageCount: session.messageCount + 1,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        isNewSession,
        toolIterations,
      }
      return
    }

    if (isGenerationRequest(userMessage)) {
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
      await appendMessage(session.id, 'assistant', generationAssistantText)

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

      yield {
        type: 'done',
        requestId,
        sessionId: session.id,
        phase: session.phase,
        atsScore: session.atsScore,
        messageCount: session.messageCount + 1,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        isNewSession,
        toolIterations,
      }
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
      await appendMessage(session.id, 'assistant', rewriteAssistantText)

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

      yield {
        type: 'done',
        requestId,
        sessionId: session.id,
        phase: session.phase,
        atsScore: session.atsScore,
        messageCount: session.messageCount + 1,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        isNewSession,
        toolIterations,
      }
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

      const bootstrapAssistantText = buildDeterministicVacancyBootstrap(session, userMessage, targetPreparation)
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
      await appendMessage(session.id, 'assistant', bootstrapAssistantText)

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

      yield {
        type: 'done',
        requestId,
        sessionId: session.id,
        phase: session.phase,
        atsScore: session.atsScore,
        messageCount: session.messageCount + 1,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        isNewSession,
        toolIterations,
      }
      return
    }

    while (true) {
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

      if (toolIterations > AGENT_CONFIG.maxToolIterations) {
        logError('agent.tool_loop.exceeded', {
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
          toolIterations,
          maxToolIterations: AGENT_CONFIG.maxToolIterations,
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
        maxOutputTokens: AGENT_CONFIG.conversationMaxOutputTokens,
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
        maxCompletionTokens: AGENT_CONFIG.conversationMaxOutputTokens,
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
            maxCompletionTokens: AGENT_CONFIG.conversationMaxOutputTokens,
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
            maxCompletionTokens: AGENT_CONFIG.conversationMaxOutputTokens,
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
        await appendMessage(session.id, 'assistant', turn.assistantText.trim())
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
            yield {
              type: 'patch',
              patch: toolResult.persistedPatch,
              phase: session.phase,
            }
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
          yield {
            type: 'patch',
            patch: toolResult.persistedPatch,
            phase: session.phase,
          }
          systemPromptDirty = true
        }
      }
    }

    if (!assistantResponded && !signal?.aborted) {
      // Recovery attempt with retry logic: up to 3 attempts with exponential backoff
      let recoverySucceeded = false
      let finalAssistantText = ''
      const maxRecoveryAttempts = 3

      for (let recoveryAttempt = 1; recoveryAttempt <= maxRecoveryAttempts && !recoverySucceeded && !signal?.aborted; recoveryAttempt++) {
        if (recoveryAttempt > 1) {
          // Wait before retry: 1s, 2s delays
          const delayMs = Math.pow(2, recoveryAttempt - 2) * 1000
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }

        const recoveryTurn = yield* streamAssistantTurn({
          session,
          messages: [
            {
              role: 'user',
              content: buildRecoveryUserPrompt({
                session,
                userMessage,
                mode: 'empty',
                attempt: recoveryAttempt,
              }),
            },
          ],
          cachedSystemPrompt: RECOVERY_SYSTEM_PROMPT,
          requestId,
          appUserId,
          requestStartedAt,
          signal,
          maxCompletionTokens: AGENT_CONFIG.conciseFallbackMaxTokens,
          // No tools in recovery mode, so no tool_choice needed
        })

        if (recoveryTurn.usage) {
          await trackTurnUsage({
            session,
            appUserId,
            releaseMetadata,
            model: recoveryTurn.model,
            usage: recoveryTurn.usage,
            finishReason: recoveryTurn.finishReason,
            toolCalls: recoveryTurn.toolCalls.length,
            assistantTextChars: recoveryTurn.assistantText.length,
            requestId,
            systemPromptChars: cachedSystemPrompt.length,
            historyChars: calculateHistoryChars(messages),
            allowedToolCount: 0,
            usedLengthRecovery: false,
            usedZeroTextRecovery: false,
            usedConciseRecovery: true,
          })
        }

        // Check if recovery was successful (got assistant text)
        if (recoveryTurn.assistantText?.trim()) {
          recoverySucceeded = true
          finalAssistantText = recoveryTurn.assistantText.trim()
        }
      }

      if (!recoverySucceeded) {
        // Final fallback after all recovery attempts failed
        const fallback = resolveDeterministicAssistantFallback(session, userMessage)
        finalAssistantText = fallback.text
        yield {
          type: 'text',
          content: finalAssistantText,
        }
      }

      assistantResponded = true
      await appendMessage(session.id, 'assistant', finalAssistantText)

      logWarn(recoverySucceeded ? 'agent.response.empty_recovered' : 'agent.response.empty_fallback', {
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        model: resolveAgentModelForPhase(session.phase),
        fallbackKind: recoverySucceeded ? undefined : resolveDeterministicAssistantFallback(session, userMessage).kind,
        finalAssistantTextChars: finalAssistantText.length,
        toolIterations,
        success: true,
      })
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

    yield {
      type: 'done',
      requestId,
      sessionId: session.id,
      phase: session.phase,
      atsScore: session.atsScore,
      messageCount: session.messageCount + 1,
      maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      isNewSession,
      toolIterations,
    }
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
