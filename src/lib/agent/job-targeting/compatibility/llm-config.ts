export const JOB_MATCHER_LLM_MODEL = 'gpt-4.1-mini-2025-04-14'
export const JOB_MATCHER_PROMPT_VERSION = 'job-matcher-llm-v4'

export const JOB_MATCHER_LLM_PRICING = {
  pricingUrl: 'https://platform.openai.com/docs/models/gpt-4.1-mini',
  consultedAt: '2026-05-05',
  inputUsdPerMillionTokens: 0.40,
  outputUsdPerMillionTokens: 1.60,
  formula: '(inputTokens / 1_000_000 * 0.40) + (outputTokens / 1_000_000 * 1.60)',
} as const

export type JobMatcherRetryConfig = {
  maxRetries: number
  initialBackoffMs: number
  backoffMultiplier: number
  retryJitter: boolean
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function getJobMatcherConfidenceThreshold(env: Partial<NodeJS.ProcessEnv> = process.env): number {
  return Math.min(1, Math.max(0, parseNumber(env.JOB_MATCHER_CONFIDENCE_THRESHOLD, 0.5)))
}

export function getJobMatcherMaxConcurrentRequirementCalls(env: Partial<NodeJS.ProcessEnv> = process.env): number {
  return Math.max(1, parseInteger(env.JOB_MATCHER_MAX_CONCURRENT_REQUIREMENT_CALLS, 8))
}

export function getJobMatcherRetryConfig(env: Partial<NodeJS.ProcessEnv> = process.env): JobMatcherRetryConfig {
  return {
    maxRetries: parseInteger(env.JOB_MATCHER_LLM_MAX_RETRIES, 3),
    initialBackoffMs: parseInteger(env.JOB_MATCHER_LLM_INITIAL_BACKOFF_MS, 500),
    backoffMultiplier: Math.max(1, parseNumber(env.JOB_MATCHER_LLM_BACKOFF_MULTIPLIER, 2)),
    retryJitter: parseBoolean(env.JOB_MATCHER_LLM_RETRY_JITTER, true),
  }
}

export function calculateJobMatcherCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * JOB_MATCHER_LLM_PRICING.inputUsdPerMillionTokens
    + (outputTokens / 1_000_000) * JOB_MATCHER_LLM_PRICING.outputUsdPerMillionTokens
  )
}
