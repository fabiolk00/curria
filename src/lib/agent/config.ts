import type { Phase } from '@/types/cv'

type AgentToolName =
  | 'parse_file'
  | 'score_ats'
  | 'analyze_gap'
  | 'apply_gap_action'
  | 'rewrite_section'
  | 'create_target_resume'
  | 'set_phase'
  | 'generate_file'

export const AGENT_CONFIG = {
  conversationMaxOutputTokens: 900,
  conciseFallbackMaxTokens: 350,
  rewriterMaxTokens: 1200,
  ocrMaxTokens: 2000,
  timeout: 45_000,
  maxToolIterations: 10,
  rateLimitPerMinute: 30,
  maxHistoryMessages: 24,
  maxMessagesPerSession: 30, // Hard cap on messages per session; must be >= maxHistoryMessages
  /** Per-phase prompt caps in characters. Keeps repeated context small for multi-turn chats. */
  maxSystemPromptCharsByPhase: {
    intake: 6_000,
    analysis: 8_000,
    dialog: 8_000,
    confirm: 6_500,
    generation: 6_000,
  } satisfies Record<Phase, number>,
  phaseToolAllowlist: {
    intake: ['parse_file', 'set_phase'],
    analysis: ['score_ats', 'analyze_gap', 'set_phase'],
    dialog: ['rewrite_section', 'apply_gap_action', 'set_phase'],
    confirm: ['generate_file', 'create_target_resume', 'set_phase'],
    generation: ['generate_file', 'create_target_resume', 'set_phase'],
  } satisfies Record<Phase, readonly AgentToolName[]>,
} as const

export const DEFAULT_OPENAI_MODEL = 'gpt-5-nano' as const

const SUPPORTED_OPENAI_MODELS = [
  DEFAULT_OPENAI_MODEL,
  'gpt-5.4-nano',
  'gpt-5-mini',
  'gpt-5',
  'gpt-5.4',
  'gpt-5.4-mini',
] as const

type OpenAIModelName = typeof SUPPORTED_OPENAI_MODELS[number]

function createModelConfig(params: {
  agent: OpenAIModelName
  structured?: OpenAIModelName
  vision?: OpenAIModelName
}) {
  return {
    agent: params.agent,
    structured: params.structured ?? DEFAULT_OPENAI_MODEL,
    vision: params.vision ?? DEFAULT_OPENAI_MODEL,
  } as const
}

export const MODEL_COMBINATIONS = {
  combo_a: createModelConfig({
    agent: DEFAULT_OPENAI_MODEL,
  }),
  combo_b: createModelConfig({
    agent: 'gpt-5.4-nano',
  }),
  combo_c: createModelConfig({
    agent: 'gpt-5-mini',
  }),
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
export function resolveOpenAIModel(
  value: string | undefined,
  fallback: OpenAIModelName = DEFAULT_OPENAI_MODEL,
): OpenAIModelName {
  const normalized = value?.trim()

  if (!normalized) {
    return fallback
  }

  if (SUPPORTED_OPENAI_MODELS.includes(normalized as OpenAIModelName)) {
    return normalized as OpenAIModelName
  }

  return fallback
}

const ACTIVE_COMBO_CONFIG = MODEL_COMBINATIONS[ACTIVE_MODEL_COMBO]

const ACTIVE_AGENT_MODEL = resolveOpenAIModel(
  process.env.OPENAI_AGENT_MODEL ?? process.env.OPENAI_MODEL,
  ACTIVE_COMBO_CONFIG.agent,
)

export const MODEL_CONFIG = {
  agentModel: ACTIVE_AGENT_MODEL,
  // Dialog and confirm inherit the resolved agent model unless an explicit
  // OPENAI_DIALOG_MODEL override is present.
  dialogModel: resolveDialogModel(
    ACTIVE_AGENT_MODEL,
    process.env.OPENAI_DIALOG_MODEL,
  ),
  structuredModel: resolveOpenAIModel(
    process.env.OPENAI_STRUCTURED_MODEL,
    ACTIVE_COMBO_CONFIG.structured,
  ),
  visionModel: resolveOpenAIModel(
    process.env.OPENAI_VISION_MODEL,
    ACTIVE_COMBO_CONFIG.vision,
  ),
} as const

export const ACTIVE_OPENAI_MODEL = MODEL_CONFIG.agentModel

const DIALOG_MODEL_PHASES = new Set<Phase>(['dialog', 'confirm'])

export function resolveDialogModel(
  agentModel: OpenAIModelName,
  value: string | undefined,
): OpenAIModelName {
  return resolveOpenAIModel(value, agentModel)
}

export function resolveAgentModelForPhase(phase: Phase): OpenAIModelName {
  if (DIALOG_MODEL_PHASES.has(phase)) {
    return MODEL_CONFIG.dialogModel
  }

  return MODEL_CONFIG.agentModel
}

type AgentConfig = typeof AGENT_CONFIG
type ModelConfig = typeof MODEL_CONFIG
