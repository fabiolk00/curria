import { describe, expect, it } from 'vitest'

import {
  ACTIVE_OPENAI_MODEL,
  ACTIVE_MODEL_COMBO,
  AGENT_CONFIG,
  DEFAULT_OPENAI_MODEL,
  MODEL_COMBINATIONS,
  MODEL_CONFIG,
  resolveOpenAIModel,
  resolveModelCombo,
} from './config'

describe('AGENT_CONFIG', () => {
  it('uses a single standardized OpenAI model at runtime', () => {
    expect(['combo_a', 'combo_b', 'combo_c']).toContain(ACTIVE_MODEL_COMBO)
    expect(MODEL_CONFIG).toEqual({
      agent: ACTIVE_OPENAI_MODEL,
      structured: ACTIVE_OPENAI_MODEL,
      vision: ACTIVE_OPENAI_MODEL,
    })
  })

  it('keeps combo names pinned to the default standardized model', () => {
    const uniformDefaultModel = {
      agent: DEFAULT_OPENAI_MODEL,
      structured: DEFAULT_OPENAI_MODEL,
      vision: DEFAULT_OPENAI_MODEL,
    }

    expect(MODEL_COMBINATIONS).toEqual({
      combo_a: uniformDefaultModel,
      combo_b: uniformDefaultModel,
      combo_c: uniformDefaultModel,
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

  it('has maxMessagesPerSession set to 15', () => {
    expect(AGENT_CONFIG.maxMessagesPerSession).toBe(15)
  })

  it('has maxToolIterations to prevent infinite loops', () => {
    expect(AGENT_CONFIG.maxToolIterations).toBe(10)
  })

  it('has reasonable timeout (30 seconds)', () => {
    expect(AGENT_CONFIG.timeout).toBe(30_000)
  })

  it('keeps max 12 messages in history', () => {
    expect(AGENT_CONFIG.maxHistoryMessages).toBe(12)
  })
})
