import { describe, expect, it, vi } from 'vitest'

import { runJobCompatibilityLlmShadow } from './llm-shadow'
import { loadJobTargetingCatalog } from '@/lib/agent/job-targeting/catalog/catalog-loader'

vi.mock('@/lib/agent/job-targeting/catalog/catalog-loader', () => ({
  loadJobTargetingCatalog: vi.fn(),
}))

describe('LLM matcher shadow runner', () => {
  it('does not load the job-targeting catalog in the LLM matching path', async () => {
    await runJobCompatibilityLlmShadow({
      cvState: {
        fullName: 'Ana',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Analista de BI',
        experience: [{
          title: 'Analista BI',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Liderou migração de aplicações Qlik Sense para Qlik Cloud.'],
        }],
        skills: ['Qlik Sense', 'SQL'],
        education: [],
      },
      targetJobDescription: 'Conhecimento na ferramenta Qlik',
      resolver: vi.fn(async () => ({
        content: JSON.stringify({
          evidenceLevel: 'supported',
          rewritePermission: 'can_claim_directly',
          confidence: 0.9,
          reasoning: 'evidencia direta',
        }),
      })),
    })

    expect(loadJobTargetingCatalog).not.toHaveBeenCalled()
  })
})
