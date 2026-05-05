import { describe, expect, it, vi } from 'vitest'

import {
  runJobCompatibilityLlmAssessment,
  runJobCompatibilityLlmShadow,
} from './llm-shadow'
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

  it('returns a full JobCompatibilityAssessment without catalog metadata', async () => {
    const assessment = await runJobCompatibilityLlmAssessment({
      cvState: {
        fullName: 'Ana',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Analista de BI com experiencia em Qlik Sense.',
        experience: [{
          title: 'Analista BI',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Liderou migracao de aplicacoes Qlik Sense para Qlik Cloud.'],
        }],
        skills: ['Qlik Sense', 'SQL'],
        education: [],
      },
      targetJobDescription: [
        'Cargo: Analista de BI',
        'Requisitos: Conhecimento na ferramenta Qlik.',
      ].join('\n'),
      userId: 'usr-1',
      sessionId: 'sess-1',
      resolver: vi.fn(async () => ({
        content: JSON.stringify({
          evidenceLevel: 'supported',
          rewritePermission: 'can_claim_directly',
          confidence: 0.96,
          reasoning: 'Qlik Sense e Qlik Cloud sustentam o requisito.',
        }),
      })),
    })

    expect(loadJobTargetingCatalog).not.toHaveBeenCalled()
    expect(assessment).toEqual(expect.objectContaining({
      version: 'job-compat-assessment-v1',
      targetRole: 'Analista de BI',
      catalog: {
        catalogIds: [],
        catalogVersions: {},
      },
      requirements: expect.any(Array),
      claimPolicy: expect.any(Object),
      scoreBreakdown: expect.any(Object),
      lowFit: expect.any(Object),
      audit: expect.objectContaining({
        matcherVersion: 'job-matcher-llm-v4',
        runIds: {
          userId: 'usr-1',
          sessionId: 'sess-1',
        },
      }),
    }))
    expect(assessment.requirements.every((requirement) => requirement.source === 'llm_semantic')).toBe(true)
    expect(assessment.supportedRequirements.length).toBeGreaterThan(0)
    expect(assessment.audit.counters.requirements).toBe(assessment.requirements.length)
    expect(assessment.audit.counters.resumeEvidence).toBeGreaterThan(0)
  })
})
