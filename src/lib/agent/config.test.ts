import { describe, expect, it } from 'vitest'

import {
  ACTIVE_MODEL_COMBO,
  AGENT_CONFIG,
  MODEL_COMBINATIONS,
  MODEL_CONFIG,
  resolveModelCombo,
} from './config'

describe('AGENT_CONFIG', () => {
  it('uses a supported OpenAI model routing at runtime', () => {
    expect(['combo_a', 'combo_b', 'combo_c']).toContain(ACTIVE_MODEL_COMBO)
    expect(MODEL_CONFIG).toEqual(MODEL_COMBINATIONS[ACTIVE_MODEL_COMBO])
  })

  it('defines the supported model combinations', () => {
    expect(MODEL_COMBINATIONS).toEqual({
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
    })
  })

  it('falls back to combo_a for invalid OPENAI_MODEL_COMBO values', () => {
    expect(resolveModelCombo(undefined)).toBe('combo_a')
    expect(resolveModelCombo('combo_b')).toBe('combo_b')
    expect(resolveModelCombo('invalid')).toBe('combo_a')
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
