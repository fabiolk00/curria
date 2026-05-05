import { describe, expect, it, vi } from 'vitest'

import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import type { LlmRequirementResolver } from '@/lib/agent/job-targeting/compatibility/llm-matcher'
import type { CVState } from '@/types/cv'

const cvState: CVState = {
  fullName: 'Fixture User',
  email: 'fixture@example.com',
  phone: '+55 11 99999-9999',
  summary: 'Profissional de BI.',
  skills: ['Qlik Sense', 'Power BI'],
  experience: [{
    title: 'Analista BI',
    company: 'Acme',
    startDate: '2021',
    endDate: '2025',
    bullets: ['Liderou migracao de 30 aplicacoes Qlik Sense para Qlik Cloud'],
  }],
  education: [],
}

describe('LLM job compatibility assessment', () => {
  it('runs the assessment without loading catalog metadata', async () => {
    const resolver = vi.fn(async () => ({
      content: JSON.stringify({
        evidenceLevel: 'supported',
        rewritePermission: 'can_claim_directly',
        confidence: 0.9,
        reasoning: 'Qlik product variation',
      }),
      inputTokens: 100,
      outputTokens: 20,
    })) satisfies LlmRequirementResolver

    const assessment = await evaluateJobCompatibility({
      cvState,
      targetJobDescription: 'Required qualifications:\n- Conhecimento na ferramenta Qlik',
      matcherEngine: 'llm',
      llmResolver: resolver,
      userId: 'usr_123',
      sessionId: 'sess_123',
    })

    expect(resolver).toHaveBeenCalledTimes(1)
    expect(assessment.supportedRequirements).toHaveLength(1)
    expect(assessment.catalog).toEqual({
      catalogIds: [],
      catalogVersions: {},
    })
    expect(assessment.audit).toMatchObject({
      matcherEngine: 'llm',
      matcherModel: 'gpt-4.1-mini-2025-04-14',
      matcherPromptVersion: 'job-matcher-llm-v2',
    })
  })
})
