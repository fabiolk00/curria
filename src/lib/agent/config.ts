export const AGENT_CONFIG = {
  maxTokens: 2000,
  rewriterMaxTokens: 1200,
  ocrMaxTokens: 2000,
  timeout: 30_000,
  maxToolIterations: 10,
  rateLimitPerMinute: 30,
  maxHistoryMessages: 12,
  maxMessagesPerSession: 15,
} as const

export const MODEL_COMBINATIONS = {
  combo_a: {
    agent: 'gpt-5-nano',
    structured: 'gpt-5-nano',
    vision: 'gpt-5-nano',
  },
  combo_b: {
    agent: 'gpt-5-nano',
    structured: 'gpt-5-nano',
    vision: 'gpt-5-nano',
  },
  combo_c: {
    agent: 'gpt-5-nano',
    structured: 'gpt-5-nano',
    vision: 'gpt-5-nano',
  },
} as const

export type ModelComboName = keyof typeof MODEL_COMBINATIONS

export function resolveModelCombo(value: string | undefined): ModelComboName {
  const normalized = value?.trim().toLowerCase()

  if (normalized && normalized in MODEL_COMBINATIONS) {
    return normalized as ModelComboName
  }

  return 'combo_a'
}

export const ACTIVE_MODEL_COMBO = resolveModelCombo(process.env.OPENAI_MODEL_COMBO)
export const MODEL_CONFIG = MODEL_COMBINATIONS[ACTIVE_MODEL_COMBO]

export type AgentConfig = typeof AGENT_CONFIG
export type ModelConfig = typeof MODEL_CONFIG
