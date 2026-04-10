import type OpenAI from 'openai'
import { APIError } from 'openai'

import { buildSystemPrompt, trimMessages } from '@/lib/agent/context-builder'
import { AGENT_CONFIG, resolveAgentModelForPhase } from '@/lib/agent/config'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { dispatchToolWithContext, getToolDefinitionsForPhase } from '@/lib/agent/tools'
import { calculateUsageCostCents, trackApiUsage } from '@/lib/agent/usage-tracker'
import { appendMessage, getMessages } from '@/lib/db/sessions'
import { createChatCompletionStreamWithRetry } from '@/lib/openai/chat'
import { openai } from '@/lib/openai/client'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
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
const RECOVERY_SYSTEM_PROMPT = [
  'You are CurrIA, a resume optimization assistant for Brazilian users.',
  'Respond in the same language as the user, in plain text, with a short and useful answer.',
  'Do not call tools.',
  'Do not leave the content empty.',
  'If the user pasted a job description but has not provided a resume yet, acknowledge the vacancy and ask for the resume file or pasted resume text.',
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
  usedConciseRecovery?: boolean
}

type DeterministicToolOutcome = {
  success: boolean
  hadPatch: boolean
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

  return /\b(sim|yes|ok|okay|pode gerar|pode seguir|gera|gerar agora|generate now)\b/.test(normalized)
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

function buildResumeTextForScoring(session: Session): string {
  if (session.agentState.sourceResumeText?.trim()) {
    return session.agentState.sourceResumeText
  }

  const lines: string[] = []

  if (session.cvState.fullName.trim()) {
    lines.push(session.cvState.fullName.trim())
  }

  const contactLine = [
    session.cvState.email?.trim(),
    session.cvState.phone?.trim(),
    session.cvState.linkedin?.trim(),
    session.cvState.location?.trim(),
  ].filter(Boolean).join(' | ')

  if (contactLine) {
    lines.push(contactLine)
  }

  if (session.cvState.summary.trim()) {
    lines.push('Summary')
    lines.push(session.cvState.summary.trim())
  }

  if (session.cvState.skills.length > 0) {
    lines.push('Skills')
    lines.push(session.cvState.skills.join(', '))
  }

  if (session.cvState.experience.length > 0) {
    lines.push('Experience')
    for (const experience of session.cvState.experience.slice(0, 6)) {
      lines.push(`${experience.title} - ${experience.company} (${experience.startDate} - ${experience.endDate})`)
      for (const bullet of experience.bullets.slice(0, 4)) {
        lines.push(`- ${bullet}`)
      }
    }
  }

  if (session.cvState.education.length > 0) {
    lines.push('Education')
    for (const education of session.cvState.education.slice(0, 4)) {
      lines.push(`${education.degree} - ${education.institution} (${education.year})`)
    }
  }

  if ((session.cvState.certifications?.length ?? 0) > 0) {
    lines.push('Certifications')
    for (const certification of session.cvState.certifications?.slice(0, 4) ?? []) {
      lines.push(`${certification.name} - ${certification.issuer}`)
    }
  }

  return lines.join('\n').trim()
}

function hasResumeContextForDeterministicAnalysis(session: Session): boolean {
  return buildResumeTextForScoring(session).trim().length > 0
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

  if (!hasResumeContext && hasTargetJobContext) {
    return 'Recebi a vaga. Para comparar aderência e adaptar seu currículo a essa oportunidade, envie seu currículo em PDF/DOCX ou cole o texto do currículo aqui.'
  }

  if (!hasResumeContext) {
    return 'Preciso do seu currículo para continuar. Envie um PDF/DOCX ou cole o texto do currículo aqui no chat.'
  }

  if (session.phase === 'confirm') {
    return 'Estou na etapa final. Se quiser gerar os arquivos agora, responda com "sim, pode gerar". Se preferir, peça mais ajustes no currículo.'
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

    parts.push('Posso seguir reescrevendo seu resumo ou experiencia com base nesses pontos.')
    return parts.join(' ')
  }

  if (hasTargetJobContext) {
    return 'Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo. Posso seguir reescrevendo seu resumo ou experiencia com base nela.'
  }

  if (hasTargetJobContext) {
    return 'Recebi a vaga e vou usá-la como referência. Tente novamente com um pedido curto, como "compare meu currículo com esta vaga" ou "reescreva meu resumo para esta vaga".'
  }

  return 'Recebi sua mensagem, mas esta resposta falhou. Tente repetir o pedido em uma frase curta e objetiva que eu continuo daqui.'
}

function buildDialogFallback(session: Session, userMessage: string): DeterministicFallback {
  const latestMessageLooksLikeVacancy = looksLikeJobDescription(userMessage)
  const hasTargetJobContext = Boolean(session.agentState.targetJobDescription?.trim() || latestMessageLooksLikeVacancy)
  const rewriteFocus = resolveRewriteFocus(userMessage)
  const latestMessageIsRewriteRequest = isDialogRewriteRequest(userMessage)

  if (latestMessageLooksLikeVacancy) {
    return {
      kind: 'dialog_latest_target_job_context',
      text: 'Recebi essa nova vaga e ja tenho seu curriculo em contexto. Posso adaptar agora seu resumo, experiencia ou competencias para essa oportunidade. Se quiser, responda com "reescreva meu resumo".',
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
      text: 'Ja tenho seu curriculo e a vaga como referencia. Posso reescrever agora seu resumo, experiencia ou competencias para aumentar a aderencia ATS. Se quiser, responda com "reescreva meu resumo".',
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

  if (!hasResumeContext && hasTargetJobContext) {
    return {
      kind: 'missing_resume_with_target_job',
      text: 'Recebi a vaga. Para comparar aderência e adaptar seu currículo a essa oportunidade, envie seu currículo em PDF/DOCX ou cole o texto do currículo aqui.',
    }
  }

  if (!hasResumeContext) {
    return {
      kind: 'missing_resume',
      text: 'Preciso do seu currículo para continuar. Envie um PDF/DOCX ou cole o texto do currículo aqui no chat.',
    }
  }

  if (session.phase === 'confirm') {
    return {
      kind: 'confirm_generation_prompt',
      text: 'Estou na etapa final. Se quiser gerar os arquivos agora, responda com "sim, pode gerar". Se preferir, peca mais ajustes no curriculo.',
    }
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

  if (!session.atsScore) {
    const scoreResult = yield* runDeterministicTool({
      session,
      toolName: 'score_ats',
      toolInput: {
        resume_text: buildResumeTextForScoring(session),
        job_description: session.agentState.targetJobDescription,
      },
      requestId: params.requestId,
      signal: params.signal,
      surfaceToolStartToUser: false,
      surfaceFailureToUser: false,
    })
    mutatedPromptState = mutatedPromptState || scoreResult.hadPatch
  }

  if (
    !latestMessageLooksLikeVacancy
    && session.agentState.targetJobDescription?.trim()
    && !session.agentState.gapAnalysis
  ) {
    const gapResult = yield* runDeterministicTool({
      session,
      toolName: 'analyze_gap',
      toolInput: {
        target_job_description: session.agentState.targetJobDescription,
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

async function* handleConfirmedGeneration(params: {
  session: Session
  requestId: string
  signal?: AbortSignal
}): AsyncGenerator<AgentLoopEvent, string> {
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

  const generationResult = yield* runDeterministicTool({
    session: params.session,
    toolName: 'generate_file',
    toolInput: {
      cv_state: params.session.cvState,
    },
    requestId: params.requestId,
    signal: params.signal,
  })

  if (generationResult.success) {
    return 'Seus arquivos ATS-otimizados estao prontos. Confira os downloads de DOCX e PDF acima.'
  }

  if (!setPhaseResult.success && setPhaseResult.failureMessage) {
    return `Nao consegui iniciar a geracao agora. ${setPhaseResult.failureMessage}`
  }

  return `Nao consegui gerar os arquivos agora. ${generationResult.failureMessage ?? 'Tente novamente em alguns instantes.'}`
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
    if (session.phase === 'confirm' && isGenerationApproval(userMessage)) {
      const generationAssistantText = yield* handleConfirmedGeneration({
        session,
        requestId,
        signal,
      })

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

      const bootstrapAssistantText = buildDeterministicAssistantFallback(session, userMessage)
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

      if (turn.finishReason === 'length' && turn.toolCalls.length === 0 && turn.assistantText.trim()) {
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
      }

      if (
        turn.toolCalls.length === 0
        && (turn.finishReason === 'length' || !turn.assistantText.trim())
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
