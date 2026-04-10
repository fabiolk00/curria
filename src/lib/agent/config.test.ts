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
  it('resolves dedicated model knobs from the active combo', () => {
    expect(['combo_a', 'combo_b', 'combo_c']).toContain(ACTIVE_MODEL_COMBO)
    expect(MODEL_CONFIG).toEqual({
      agentModel: ACTIVE_OPENAI_MODEL,
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
