import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTargetingPlan } from '@/lib/agent/tools/build-targeting-plan'
import type { CVState, GapAnalysisResult } from '@/types/cv'

const { mockOpenAICompletionCreate, mockCallOpenAIWithRetry, mockTrackApiUsage } = vi.hoisted(() => ({
  mockOpenAICompletionCreate: vi.fn(),
  mockCallOpenAIWithRetry: vi.fn(),
  mockTrackApiUsage: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: mockOpenAICompletionCreate,
      },
    },
  },
}))

vi.mock('@/lib/openai/chat', () => ({
  callOpenAIWithRetry: mockCallOpenAIWithRetry,
  getChatCompletionText: (response: { choices?: Array<{ message?: { content?: string } }> }) =>
    response.choices?.[0]?.message?.content ?? '',
  getChatCompletionUsage: () => ({
    inputTokens: 10,
    outputTokens: 10,
  }),
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: mockTrackApiUsage,
}))

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Engenheira de dados com foco em SQL e automacao.',
    experience: [
      {
        title: 'Engenheira de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Automatizei pipelines em SQL e Python.'],
      },
    ],
    skills: ['SQL', 'Python', 'ETL'],
    education: [],
    certifications: [],
  }
}

const gapAnalysis: GapAnalysisResult = {
  matchScore: 72,
  missingSkills: ['Airflow'],
  weakAreas: ['summary'],
  improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiÃªncia.'],
}

describe('buildTargetingPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallOpenAIWithRetry.mockImplementation(async (fn: (signal?: AbortSignal) => Promise<unknown>) => fn())
    mockTrackApiUsage.mockResolvedValue(undefined)
  })

  it('extracts a role from prose instead of promoting section headings', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Requisitos ObrigatÃ³rios',
        'SQL avanÃ§ado e modelagem de dados.',
        'Estamos contratando uma pessoa Engenheira de Dados para atuar com pipelines e analytics.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Engenheira De Dados')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
  })

  it('preserves explicit role labels when present', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Requisitos ObrigatÃ³rios',
        'SQL e BigQuery.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Analytics Engineer')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
  })

  it('falls back to richer prose when the explicit role label is too weak', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: BI.',
        'Responsabilidades',
        'Estamos contratando Analista de BI para atuar com dashboards, SQL e indicadores.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Analista De BI')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
  })

  it('uses LLM extraction when the role is implied but not explicit', async () => {
    mockOpenAICompletionCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            targetRole: 'Product Manager',
            confidence: 'medium',
          }),
        },
      }],
    })

    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'About The Job',
        'Own roadmap prioritization, partner with design and engineering, and define product strategy.',
        'Drive discovery, stakeholder alignment, and go-to-market execution.',
      ].join('\n'),
      gapAnalysis,
      userId: 'usr_123',
      sessionId: 'sess_123',
    })

    expect(plan.targetRole).toBe('Product Manager')
    expect(plan.targetRoleConfidence).toBe('medium')
    expect(plan.targetRoleSource).toBe('llm')
    expect(mockOpenAICompletionCreate).toHaveBeenCalledTimes(1)
    expect(mockTrackApiUsage).toHaveBeenCalled()
  })

  it('falls back to Vaga Alvo when heuristic and LLM both fail', async () => {
    mockOpenAICompletionCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            targetRole: 'Unknown Role',
            confidence: 'low',
          }),
        },
      }],
    })

    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'About The Job',
        'Responsibilities',
        'Build Power BI dashboards and SQL models for analytics reporting.',
        'Requirements',
        'Strong SQL and Power BI experience.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Vaga Alvo')
    expect(plan.targetRoleConfidence).toBe('low')
    expect(plan.targetRoleSource).toBe('fallback')
    expect(plan.focusKeywords).toEqual(expect.arrayContaining(['power bi', 'sql']))
    expect(plan.mustEmphasize).toEqual(expect.arrayContaining(['SQL']))
  })

  it('does not treat weak areas as invented missing requirements', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer',
      gapAnalysis: {
        ...gapAnalysis,
        missingSkills: ['Airflow'],
        weakAreas: ['summary', 'experience'],
      },
    })

    expect(plan.missingButCannotInvent).toEqual(['Airflow'])
  })
})
