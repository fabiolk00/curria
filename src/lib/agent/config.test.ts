import { describe, expect, it, vi } from 'vitest'

import {
  ACTIVE_OPENAI_MODEL,
  ACTIVE_MODEL_COMBO,
  AGENT_CONFIG,
  DEFAULT_OPENAI_MODEL,
  MODEL_COMBINATIONS,
  MODEL_CONFIG,
  resolveAgentModelForPhase,
  resolveDialogModel,
  resolveOpenAIModel,
  resolveModelCombo,
} from './config'

const CONFIG_ENV_KEYS = [
  'OPENAI_MODEL_COMBO',
  'OPENAI_MODEL',
  'OPENAI_AGENT_MODEL',
  'OPENAI_DIALOG_MODEL',
  'OPENAI_STRUCTURED_MODEL',
  'OPENAI_VISION_MODEL',
] as const

async function loadFreshConfigModule(env: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string | undefined>>) {
  const previousValues = new Map(CONFIG_ENV_KEYS.map((key) => [key, process.env[key]] as const))

  try {
    for (const key of CONFIG_ENV_KEYS) {
      const nextValue = env[key]

      if (nextValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = nextValue
      }
    }

    vi.resetModules()

    return await import('./config')
  } finally {
    for (const key of CONFIG_ENV_KEYS) {
      const previousValue = previousValues.get(key)

      if (previousValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }

    vi.resetModules()
  }
}

describe('AGENT_CONFIG', () => {
  it('resolves dedicated model knobs from the active combo', () => {
    expect(['combo_a', 'combo_b', 'combo_c']).toContain(ACTIVE_MODEL_COMBO)
    expect(MODEL_CONFIG).toEqual({
      agentModel: ACTIVE_OPENAI_MODEL,
      dialogModel: resolveDialogModel(
        ACTIVE_OPENAI_MODEL,
        process.env.OPENAI_DIALOG_MODEL,
      ),
      structuredModel: expect.any(String),
      visionModel: expect.any(String),
    })
  })

  it('uses real bakeoff model combinations without changing the default combo', () => {
    expect(MODEL_COMBINATIONS).toEqual({
      combo_a: {
        agent: DEFAULT_OPENAI_MODEL,
        structured: DEFAULT_OPENAI_MODEL,
        vision: DEFAULT_OPENAI_MODEL,
      },
      combo_b: {
        agent: 'gpt-5.4-nano',
        structured: DEFAULT_OPENAI_MODEL,
        vision: DEFAULT_OPENAI_MODEL,
      },
      combo_c: {
        agent: 'gpt-5-mini',
        structured: DEFAULT_OPENAI_MODEL,
        vision: DEFAULT_OPENAI_MODEL,
      },
    })
  })

  it('falls back to combo_a for invalid OPENAI_MODEL_COMBO values', () => {
    expect(resolveModelCombo(undefined)).toBe('combo_a')
    expect(resolveModelCombo('combo_b')).toBe('combo_b')
    expect(resolveModelCombo('invalid')).toBe('combo_a')
  })

  it('resolves the standardized OPENAI_MODEL with a safe fallback', () => {
    expect(resolveOpenAIModel(undefined)).toBe(DEFAULT_OPENAI_MODEL)
    expect(resolveOpenAIModel('gpt-5.4-mini')).toBe('gpt-5.4-mini')
    expect(resolveOpenAIModel('unknown-model')).toBe(DEFAULT_OPENAI_MODEL)
    expect(resolveOpenAIModel('unknown-model', 'gpt-5-mini')).toBe('gpt-5-mini')
  })

  it('keeps dialog turns aligned with the resolved agent model unless explicitly overridden', () => {
    expect(resolveDialogModel('gpt-5-mini', undefined)).toBe('gpt-5-mini')
    expect(resolveDialogModel('gpt-5-mini', 'gpt-5.4-mini')).toBe('gpt-5.4-mini')
    expect(resolveDialogModel('gpt-5-mini', 'unknown-model')).toBe('gpt-5-mini')
    expect(resolveAgentModelForPhase('dialog')).toBe(MODEL_CONFIG.dialogModel)
    expect(resolveAgentModelForPhase('confirm')).toBe(MODEL_CONFIG.dialogModel)
    expect(resolveAgentModelForPhase('analysis')).toBe(MODEL_CONFIG.agentModel)
  })

  it('loads a real OPENAI_DIALOG_MODEL override on module import', async () => {
    const loadedConfig = await loadFreshConfigModule({
      OPENAI_MODEL_COMBO: 'combo_b',
      OPENAI_MODEL: 'gpt-5-mini',
      OPENAI_DIALOG_MODEL: 'gpt-5.4-mini',
    })

    expect(loadedConfig.MODEL_CONFIG).toEqual({
      agentModel: 'gpt-5-mini',
      dialogModel: 'gpt-5.4-mini',
      structuredModel: DEFAULT_OPENAI_MODEL,
      visionModel: DEFAULT_OPENAI_MODEL,
    })
    expect(loadedConfig.resolveAgentModelForPhase('dialog')).toBe('gpt-5.4-mini')
    expect(loadedConfig.resolveAgentModelForPhase('confirm')).toBe('gpt-5.4-mini')
    expect(loadedConfig.resolveAgentModelForPhase('analysis')).toBe('gpt-5-mini')
  })

  it('inherits the resolved agent model for dialog and confirm when OPENAI_DIALOG_MODEL is unset', async () => {
    const loadedConfig = await loadFreshConfigModule({
      OPENAI_MODEL_COMBO: 'combo_a',
      OPENAI_AGENT_MODEL: 'gpt-5.4-mini',
      OPENAI_DIALOG_MODEL: undefined,
    })

    expect(loadedConfig.MODEL_CONFIG).toEqual({
      agentModel: 'gpt-5.4-mini',
      dialogModel: 'gpt-5.4-mini',
      structuredModel: DEFAULT_OPENAI_MODEL,
      visionModel: DEFAULT_OPENAI_MODEL,
    })
    expect(loadedConfig.resolveAgentModelForPhase('dialog')).toBe('gpt-5.4-mini')
    expect(loadedConfig.resolveAgentModelForPhase('confirm')).toBe('gpt-5.4-mini')
    expect(loadedConfig.resolveAgentModelForPhase('analysis')).toBe('gpt-5.4-mini')
  })

  it('keeps the conversation output budget intentionally short', () => {
    expect(AGENT_CONFIG.conversationMaxOutputTokens).toBe(900)
    expect(AGENT_CONFIG.conciseFallbackMaxTokens).toBe(350)
  })

  it('caps prompt size by phase', () => {
    expect(AGENT_CONFIG.maxSystemPromptCharsByPhase).toEqual({
      intake: 6_000,
      analysis: 8_000,
      dialog: 8_000,
      confirm: 6_500,
      generation: 6_000,
    })
  })

  it('locks tool availability by phase', () => {
    expect(AGENT_CONFIG.phaseToolAllowlist).toEqual({
      intake: ['parse_file', 'set_phase'],
      analysis: ['score_ats', 'analyze_gap', 'set_phase'],
      dialog: ['rewrite_section', 'apply_gap_action', 'set_phase'],
      confirm: ['generate_file', 'create_target_resume', 'set_phase'],
      generation: ['generate_file', 'create_target_resume', 'set_phase'],
    })
  })

  it('keeps the default combo pinned to the cheapest production model', () => {
    const comboADefault = {
      agent: DEFAULT_OPENAI_MODEL,
      structured: DEFAULT_OPENAI_MODEL,
      vision: DEFAULT_OPENAI_MODEL,
    }

    expect(MODEL_COMBINATIONS.combo_a).toEqual(comboADefault)
  })

  it('has maxMessagesPerSession set to 30', () => {
    expect(AGENT_CONFIG.maxMessagesPerSession).toBe(30)
  })

  it('has maxToolIterations to prevent infinite loops', () => {
    expect(AGENT_CONFIG.maxToolIterations).toBe(10)
  })

  it('has reasonable timeout (45 seconds)', () => {
    expect(AGENT_CONFIG.timeout).toBe(45_000)
  })

  it('keeps max 24 messages in history', () => {
    expect(AGENT_CONFIG.maxHistoryMessages).toBe(24)
  })
})
