import { APIError } from 'openai'
import { z } from 'zod'

import { getChatCompletionText, getChatCompletionUsage, OpenAIRequestTimeoutError } from '@/lib/openai/chat'
import type {
  ClaimPermission,
  InternalEvidenceLevel,
  ProductEvidenceGroup,
  RequirementEvidence,
  RequirementEvidenceSource,
} from '@/lib/agent/job-targeting/compatibility/types'

import { runWithConcurrencyLimit } from './concurrency'
import {
  calculateJobMatcherCostUsd,
  getJobMatcherConfidenceThreshold,
  getJobMatcherMaxConcurrentRequirementCalls,
  getJobMatcherRetryConfig,
  JOB_MATCHER_LLM_MODEL,
  JOB_MATCHER_PROMPT_VERSION,
  type JobMatcherRetryConfig,
} from './llm-config'
import { percentile, recordJobMatcherMetric } from './llm-observability'
import type { MatcherRequirement, MatcherResumeEvidence } from './matcher'

export const MatcherOutputSchema = z.object({
  evidenceLevel: z.enum(['supported', 'adjacent', 'unsupported']),
  rewritePermission: z.enum([
    'can_claim_directly',
    'can_bridge_to_target_role',
    'must_not_claim',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
})

export type MatcherOutput = z.infer<typeof MatcherOutputSchema>

export type LlmMatcherFallbackReason =
  | 'classification_failed'
  | 'rate_limit_retries_exhausted'
  | 'llm_timeout_retries_exhausted'
  | 'llm_provider_error_retries_exhausted'
  | 'low_confidence_reclassified'

export type LlmRequirementResolverResult = {
  content: string
  inputTokens?: number
  outputTokens?: number
}

export type LlmRequirementResolver = (input: {
  requirement: MatcherRequirement
  evidenceBullets: string[]
  systemPrompt: string
  userPrompt: string
  model: string
  signal?: AbortSignal
}) => Promise<LlmRequirementResolverResult>

export type LlmRequirementClassification = {
  requirement: RequirementEvidence
  rawOutput?: MatcherOutput
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  retryCount: number
  fallbackReason?: LlmMatcherFallbackReason
  providerErrorKind?: 'rate_limit' | 'timeout' | 'provider_5xx'
}

type LlmSessionMetrics = {
  sessionWallClockLatencyMs: number
  requirementLatencies: number[]
  inputTokens: number
  outputTokens: number
  costUsd: number
  fallbackCount: number
  lowConfidenceCount: number
  invalidJsonCount: number
  retryCount: number
  retryExhaustedCount: number
  retrySuccessCount: number
  rateLimitCount: number
  provider5xxCount: number
  timeoutCount: number
  fallbackReasons: Partial<Record<LlmMatcherFallbackReason, number>>
  confidences: number[]
  maxConcurrentRequirementCalls: number
}

export const JOB_MATCHER_SYSTEM_PROMPT = [
  'Voce e um avaliador conservador de compatibilidade entre vaga e curriculo.',
  'Avalie apenas as evidencias fornecidas.',
  'Nunca fabrique experiencia, ferramenta, certificacao, senioridade ou responsabilidade.',
  'Nunca use conhecimento externo para inferir competencia que nao esteja sustentada pelas evidencias.',
  'Quando houver duvida, escolha a classificacao mais conservadora.',
  'Ferramentas concorrentes ou semelhantes nao devem ser tratadas como equivalentes.',
  'Variacoes de produto, edicao, modulo, cloud/on-premise ou nome comercial da mesma familia podem ser tratadas como evidencia direta.',
  'Para ferramenta especifica, evidencia de ferramenta concorrente ou apenas metodologia generica e unsupported.',
  'Para ferramenta especifica, evidencia do mesmo runtime, plataforma, linguagem ou familia tecnica pode ser adjacent quando sustenta ponte honesta, mas nao claim direto.',
  'Para requisito legal/compliance especifico, evidencia concreta de praticas relacionadas de privacidade, protecao, controles ou governanca pode ser adjacent, mas nao claim direto da lei ou certificacao.',
  'Para responsabilidade ampla end-to-end, evidencia de atuacao desde levantamento/coleta de requisitos ate visualizacao ou implementacao pode ser supported quando cobre claramente o ciclo pedido.',
  'Mantenha coerencia: supported usa can_claim_directly; adjacent usa can_bridge_to_target_role; unsupported usa must_not_claim.',
  'Responda somente no JSON solicitado pelo contrato.',
].join('\n')

export function buildJobMatcherUserPrompt(requirement: MatcherRequirement, evidenceBullets: string[]): string {
  return [
    'Requisito da vaga:',
    `"${requirement.text}"`,
    '',
    'Evidencias do curriculo:',
    evidenceBullets.length === 0 ? '- Nenhuma evidencia fornecida.' : evidenceBullets.map((item) => `- ${item}`).join('\n'),
    '',
    'Avalie se o requisito esta atendido apenas com base nas evidencias fornecidas.',
    '',
    'Responda apenas JSON neste formato:',
    '{',
    '  "evidenceLevel": "supported" | "adjacent" | "unsupported",',
    '  "rewritePermission": "can_claim_directly" | "can_bridge_to_target_role" | "must_not_claim",',
    '  "confidence": 0.0 a 1.0,',
    '  "reasoning": "uma linha"',
    '}',
    '',
    'Regras de classificacao:',
    '- supported: ha evidencia direta e clara no curriculo',
    '- adjacent: ha evidencia relacionada, mas nao exatamente o mesmo requisito',
    '- unsupported: nao ha evidencia real no curriculo',
    '',
    'Regras de permissao:',
    '- can_claim_directly: use apenas com supported',
    '- can_bridge_to_target_role: use apenas com adjacent',
    '- must_not_claim: use apenas com unsupported',
  ].join('\n')
}

let globalInflightProviderCalls = 0

export function getJobMatcherGlobalInflightProviderCallsForTest(): number {
  return globalInflightProviderCalls
}

async function defaultLlmRequirementResolver(input: {
  requirement: MatcherRequirement
  evidenceBullets: string[]
  systemPrompt: string
  userPrompt: string
  model: string
  signal?: AbortSignal
}): Promise<LlmRequirementResolverResult> {
  globalInflightProviderCalls += 1
  try {
    const { openai } = await import('@/lib/openai/client')
    const response = await openai.chat.completions.create({
      model: input.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }, { signal: input.signal })
    const usage = getChatCompletionUsage(response)

    return {
      content: getChatCompletionText(response),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    }
  } finally {
    globalInflightProviderCalls -= 1
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(attempt: number, config: JobMatcherRetryConfig): number {
  const base = config.initialBackoffMs * Math.pow(config.backoffMultiplier, attempt - 1)
  if (!config.retryJitter) {
    return base
  }

  return Math.round(base * (0.5 + Math.random()))
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APIError && error.status === 429) {
    return true
  }

  const value = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error)
  return /429|rate_limit_exceeded|rate limit|throttl/i.test(value)
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof OpenAIRequestTimeoutError) {
    return true
  }

  const value = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error)
  return /timeout|timed out|abort/i.test(value)
}

function isProvider5xxError(error: unknown): boolean {
  if (error instanceof APIError && typeof error.status === 'number' && error.status >= 500) {
    return true
  }

  const value = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error)
  return /5\d\d|temporarily_unavailable|unavailable|provider/i.test(value)
}

function isTransientProviderError(error: unknown): boolean {
  return isRateLimitError(error) || isTimeoutError(error) || isProvider5xxError(error)
}

function exhaustedReasonForError(error: unknown): Exclude<LlmMatcherFallbackReason, 'classification_failed' | 'low_confidence_reclassified'> {
  if (isRateLimitError(error)) {
    return 'rate_limit_retries_exhausted'
  }

  if (isTimeoutError(error)) {
    return 'llm_timeout_retries_exhausted'
  }

  return 'llm_provider_error_retries_exhausted'
}

function providerErrorKindForReason(
  reason: LlmMatcherFallbackReason,
): LlmRequirementClassification['providerErrorKind'] {
  if (reason === 'rate_limit_retries_exhausted') return 'rate_limit'
  if (reason === 'llm_timeout_retries_exhausted') return 'timeout'
  if (reason === 'llm_provider_error_retries_exhausted') return 'provider_5xx'
  return undefined
}

function parseMatcherOutput(content: string): MatcherOutput | null {
  if (!content.trim()) {
    return null
  }

  try {
    return MatcherOutputSchema.parse(JSON.parse(content))
  } catch {
    return null
  }
}

function productGroupForOutput(output: MatcherOutput): ProductEvidenceGroup {
  return output.evidenceLevel
}

function evidenceLevelForOutput(output: MatcherOutput): InternalEvidenceLevel {
  if (output.evidenceLevel === 'supported') return 'strong_contextual_inference'
  if (output.evidenceLevel === 'adjacent') return 'semantic_bridge_only'
  return 'unsupported_gap'
}

function rewritePermissionForOutput(output: MatcherOutput): ClaimPermission {
  if (output.rewritePermission === 'can_claim_directly') return 'can_claim_directly'
  if (output.rewritePermission === 'can_bridge_to_target_role') return 'can_bridge_carefully'
  return 'must_not_claim'
}

function buildRequirementEvidence(input: {
  requirement: MatcherRequirement
  resumeEvidence: MatcherResumeEvidence[]
  output: MatcherOutput
  source: RequirementEvidenceSource
  rationale: string
  fallbackReason?: LlmMatcherFallbackReason
}): RequirementEvidence {
  const supportingResumeSpans = input.output.evidenceLevel === 'unsupported'
    ? []
    : input.resumeEvidence.map((item) => ({
        id: item.id,
        text: item.text,
        ...(item.section === undefined ? {} : { section: item.section }),
        ...(item.sourceKind === undefined ? {} : { sourceKind: item.sourceKind }),
        ...(item.cvPath === undefined ? {} : { cvPath: item.cvPath }),
      }))

  return {
    id: input.requirement.id,
    originalRequirement: input.requirement.text,
    normalizedRequirement: input.requirement.normalizedText ?? input.requirement.text,
    extractedSignals: [input.requirement.text],
    kind: input.requirement.kind ?? 'unknown',
    importance: input.requirement.importance ?? 'secondary',
    productGroup: productGroupForOutput(input.output),
    evidenceLevel: evidenceLevelForOutput(input.output),
    rewritePermission: rewritePermissionForOutput(input.output),
    matchedResumeTerms: supportingResumeSpans.map((item) => item.text),
    supportingResumeSpans,
    confidence: input.output.confidence,
    rationale: input.rationale,
    source: input.source,
    catalogTermIds: [],
    catalogCategoryIds: [],
    prohibitedTerms: input.output.evidenceLevel === 'unsupported' ? [input.requirement.text] : [],
    audit: {
      matcherVersion: JOB_MATCHER_PROMPT_VERSION,
      precedence: ['llm_semantic', 'fallback'],
      catalogIds: [],
      catalogVersions: {},
      catalogTermIds: [],
      catalogCategoryIds: [],
      promptVersion: JOB_MATCHER_PROMPT_VERSION,
      model: JOB_MATCHER_LLM_MODEL,
      ...(input.fallbackReason === undefined ? {} : {
        fallbackReason: input.fallbackReason,
        reasonCode: input.fallbackReason,
      }),
    },
  }
}

function conservativeFallback(
  requirement: MatcherRequirement,
  resumeEvidence: MatcherResumeEvidence[],
  reason: LlmMatcherFallbackReason,
  latencyMs: number,
  retryCount: number,
): LlmRequirementClassification {
  const output: MatcherOutput = {
    evidenceLevel: 'unsupported',
    rewritePermission: 'must_not_claim',
    confidence: 0,
    reasoning: reason === 'classification_failed' ? 'classification_failed' : reason,
  }

  return {
    requirement: buildRequirementEvidence({
      requirement,
      resumeEvidence,
      output,
      source: 'fallback',
      rationale: output.reasoning,
      fallbackReason: reason,
    }),
    rawOutput: output,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs,
    retryCount,
    fallbackReason: reason,
    providerErrorKind: providerErrorKindForReason(reason),
  }
}

export async function classifyRequirementWithLlm(input: {
  requirement: MatcherRequirement
  resumeEvidence: MatcherResumeEvidence[]
  evidenceBullets: string[]
  resolver?: LlmRequirementResolver
  confidenceThreshold?: number
  retryConfig?: JobMatcherRetryConfig
}): Promise<LlmRequirementClassification> {
  const resolver = input.resolver ?? defaultLlmRequirementResolver
  const confidenceThreshold = input.confidenceThreshold ?? getJobMatcherConfidenceThreshold()
  const retryConfig = input.retryConfig ?? getJobMatcherRetryConfig()
  const startedAt = Date.now()
  const userPrompt = buildJobMatcherUserPrompt(input.requirement, input.evidenceBullets)
  let retryCount = 0
  let lastError: unknown

  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt += 1) {
    try {
      const response = await resolver({
        requirement: input.requirement,
        evidenceBullets: input.evidenceBullets,
        systemPrompt: JOB_MATCHER_SYSTEM_PROMPT,
        userPrompt,
        model: JOB_MATCHER_LLM_MODEL,
      })
      const parsed = parseMatcherOutput(response.content)
      const latencyMs = Date.now() - startedAt

      if (!parsed) {
        return conservativeFallback(
          input.requirement,
          input.resumeEvidence,
          'classification_failed',
          latencyMs,
          retryCount,
        )
      }

      const effectiveOutput = parsed.confidence < confidenceThreshold
        ? {
            evidenceLevel: 'unsupported',
            rewritePermission: 'must_not_claim',
            confidence: parsed.confidence,
            reasoning: 'low_confidence_reclassified',
          } satisfies MatcherOutput
        : parsed
      const fallbackReason = parsed.confidence < confidenceThreshold
        ? 'low_confidence_reclassified' satisfies LlmMatcherFallbackReason
        : undefined
      const inputTokens = response.inputTokens ?? 0
      const outputTokens = response.outputTokens ?? 0

      return {
        requirement: buildRequirementEvidence({
          requirement: input.requirement,
          resumeEvidence: input.resumeEvidence,
          output: effectiveOutput,
          source: 'llm_semantic',
          rationale: effectiveOutput.reasoning,
          fallbackReason,
        }),
        rawOutput: parsed,
        inputTokens,
        outputTokens,
        costUsd: calculateJobMatcherCostUsd(inputTokens, outputTokens),
        latencyMs,
        retryCount,
        fallbackReason,
      }
    } catch (error) {
      lastError = error

      if (!isTransientProviderError(error) || attempt > retryConfig.maxRetries) {
        const latencyMs = Date.now() - startedAt
        const reason = isTransientProviderError(error)
          ? exhaustedReasonForError(error)
          : 'llm_provider_error_retries_exhausted'

        return conservativeFallback(
          input.requirement,
          input.resumeEvidence,
          reason,
          latencyMs,
          retryCount,
        )
      }

      retryCount += 1
      await sleep(retryDelayMs(attempt, retryConfig))
    }
  }

  return conservativeFallback(
    input.requirement,
    input.resumeEvidence,
    exhaustedReasonForError(lastError),
    Date.now() - startedAt,
    retryCount,
  )
}

export async function classifyRequirementsWithLlm(input: {
  requirements: MatcherRequirement[]
  resumeEvidence: MatcherResumeEvidence[]
  userId?: string
  sessionId?: string
  resolver?: LlmRequirementResolver
  maxConcurrentRequirementCalls?: number
  confidenceThreshold?: number
  retryConfig?: JobMatcherRetryConfig
}): Promise<{
  requirements: RequirementEvidence[]
  classifications: LlmRequirementClassification[]
  metrics: LlmSessionMetrics
}> {
  const sessionStartedAt = Date.now()
  const evidenceBullets = input.resumeEvidence.map((item) => item.text)
  const maxConcurrentRequirementCalls = input.maxConcurrentRequirementCalls
    ?? getJobMatcherMaxConcurrentRequirementCalls()
  const classifications = await runWithConcurrencyLimit(
    input.requirements,
    maxConcurrentRequirementCalls,
    async (requirement) => classifyRequirementWithLlm({
      requirement,
      resumeEvidence: input.resumeEvidence,
      evidenceBullets,
      resolver: input.resolver,
      confidenceThreshold: input.confidenceThreshold,
      retryConfig: input.retryConfig,
    }),
  )
  const metrics = buildSessionMetrics(classifications, Date.now() - sessionStartedAt, maxConcurrentRequirementCalls)

  recordSessionMetrics(metrics, {
    userId: input.userId,
    sessionId: input.sessionId,
    requirements: input.requirements.length,
  })

  return {
    requirements: classifications.map((classification) => classification.requirement),
    classifications,
    metrics,
  }
}

function incrementReason(
  reasons: LlmSessionMetrics['fallbackReasons'],
  reason: LlmMatcherFallbackReason | undefined,
): void {
  if (!reason) {
    return
  }

  reasons[reason] = (reasons[reason] ?? 0) + 1
}

function buildSessionMetrics(
  classifications: LlmRequirementClassification[],
  sessionWallClockLatencyMs: number,
  maxConcurrentRequirementCalls: number,
): LlmSessionMetrics {
  const fallbackReasons: LlmSessionMetrics['fallbackReasons'] = {}
  classifications.forEach((classification) => incrementReason(fallbackReasons, classification.fallbackReason))
  const fallbackCount = classifications.filter((classification) => (
    classification.fallbackReason !== undefined
    && classification.fallbackReason !== 'low_confidence_reclassified'
  )).length
  const lowConfidenceCount = fallbackReasons.low_confidence_reclassified ?? 0
  const retryCount = classifications.reduce((total, item) => total + item.retryCount, 0)

  return {
    sessionWallClockLatencyMs,
    requirementLatencies: classifications.map((item) => item.latencyMs),
    inputTokens: classifications.reduce((total, item) => total + item.inputTokens, 0),
    outputTokens: classifications.reduce((total, item) => total + item.outputTokens, 0),
    costUsd: classifications.reduce((total, item) => total + item.costUsd, 0),
    fallbackCount,
    lowConfidenceCount,
    invalidJsonCount: fallbackReasons.classification_failed ?? 0,
    retryCount,
    retryExhaustedCount: classifications.filter((item) => (
      item.fallbackReason === 'rate_limit_retries_exhausted'
      || item.fallbackReason === 'llm_timeout_retries_exhausted'
      || item.fallbackReason === 'llm_provider_error_retries_exhausted'
    )).length,
    retrySuccessCount: classifications.filter((item) => item.retryCount > 0 && item.fallbackReason === undefined).length,
    rateLimitCount: classifications.filter((item) => item.providerErrorKind === 'rate_limit').length,
    provider5xxCount: classifications.filter((item) => item.providerErrorKind === 'provider_5xx').length,
    timeoutCount: classifications.filter((item) => item.providerErrorKind === 'timeout').length,
    fallbackReasons,
    confidences: classifications.map((item) => item.requirement.confidence),
    maxConcurrentRequirementCalls,
  }
}

function recordSessionMetrics(
  metrics: LlmSessionMetrics,
  fields: { userId?: string; sessionId?: string; requirements: number },
): void {
  const commonFields = {
    userId: fields.userId,
    sessionId: fields.sessionId,
    model: JOB_MATCHER_LLM_MODEL,
    promptVersion: JOB_MATCHER_PROMPT_VERSION,
  }
  const averageRequirementLatency = metrics.requirementLatencies.length === 0
    ? 0
    : metrics.requirementLatencies.reduce((total, item) => total + item, 0) / metrics.requirementLatencies.length
  const averageConfidence = metrics.confidences.length === 0
    ? 0
    : metrics.confidences.reduce((total, item) => total + item, 0) / metrics.confidences.length

  recordJobMatcherMetric('job_targeting.matcher.llm.model', JOB_MATCHER_LLM_MODEL, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.prompt_version', JOB_MATCHER_PROMPT_VERSION, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.requirements_per_session', fields.requirements, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.calls_per_session', fields.requirements, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.concurrent_calls_per_session', metrics.maxConcurrentRequirementCalls, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.session_max_concurrent_requirement_calls', metrics.maxConcurrentRequirementCalls, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.global_inflight_provider_calls', globalInflightProviderCalls, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.input_tokens_per_session', metrics.inputTokens, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.output_tokens_per_session', metrics.outputTokens, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.cost_usd_per_session', metrics.costUsd, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.session_wall_clock_latency_ms', metrics.sessionWallClockLatencyMs, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.session_wall_clock_latency_ms.p95', metrics.sessionWallClockLatencyMs, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.requirement_latency_ms.avg', averageRequirementLatency, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.requirement_latency_ms.p95', percentile(metrics.requirementLatencies, 95), commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.total_latency_ms', metrics.requirementLatencies.reduce((total, item) => total + item, 0), commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.p95_latency_ms', percentile(metrics.requirementLatencies, 95), commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.invalid_json_count', metrics.invalidJsonCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.fallback_count', metrics.fallbackCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.requirement_fallback_count', metrics.fallbackCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.session_with_partial_fallback_count', metrics.fallbackCount > 0 && metrics.fallbackCount < fields.requirements ? 1 : 0, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.session_full_fallback_count', metrics.fallbackCount === fields.requirements && fields.requirements > 0 ? 1 : 0, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.confidence.avg', averageConfidence, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.confidence.p10', percentile(metrics.confidences, 10), commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.confidence.p50', percentile(metrics.confidences, 50), commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.confidence.p90', percentile(metrics.confidences, 90), commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.low_confidence_count', metrics.lowConfidenceCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.low_confidence_rate', fields.requirements === 0 ? 0 : metrics.lowConfidenceCount / fields.requirements, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.rate_limit_count', metrics.rateLimitCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.retry_count', metrics.retryCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.retry_exhausted_count', metrics.retryExhaustedCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.retry_success_count', metrics.retrySuccessCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.provider_5xx_count', metrics.provider5xxCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.timeout_count', metrics.timeoutCount, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.fallback_reason.classification_failed', metrics.fallbackReasons.classification_failed ?? 0, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.fallback_reason.rate_limit_retries_exhausted', metrics.fallbackReasons.rate_limit_retries_exhausted ?? 0, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.fallback_reason.llm_timeout_retries_exhausted', metrics.fallbackReasons.llm_timeout_retries_exhausted ?? 0, commonFields)
  recordJobMatcherMetric('job_targeting.matcher.llm.fallback_reason.llm_provider_error_retries_exhausted', metrics.fallbackReasons.llm_provider_error_retries_exhausted ?? 0, commonFields)

  if (fields.requirements > 0) {
    recordJobMatcherMetric('job_targeting.matcher.llm.input_tokens_per_requirement', metrics.inputTokens / fields.requirements, commonFields)
    recordJobMatcherMetric('job_targeting.matcher.llm.output_tokens_per_requirement', metrics.outputTokens / fields.requirements, commonFields)
    recordJobMatcherMetric('job_targeting.matcher.llm.cost_usd_per_requirement', metrics.costUsd / fields.requirements, commonFields)
  }
}
