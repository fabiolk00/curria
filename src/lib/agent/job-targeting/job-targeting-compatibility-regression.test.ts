import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildCoreRequirementCoverage, extractCoreRequirementSignalsFromDescription } from '@/lib/agent/job-targeting/core-requirement-coverage'
import { classifyTargetEvidence } from '@/lib/agent/job-targeting/evidence-classifier'
import { buildJobTargetingScoreBreakdown } from '@/lib/agent/job-targeting/score-breakdown'
import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import type { TargetEvidence, TargetingPlan } from '@/types/agent'
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

const cvState: CVState = {
  fullName: 'Fábio Kröker',
  email: 'fabio@example.com',
  phone: '555-0100',
  location: 'Curitiba, Paraná, Brazil',
  summary: [
    'Profissional com mais de 5 anos de experiência em Engenharia de Dados e BI.',
    'Atuação em pipelines ETL, modelagem de dados, dashboards, governança e qualidade de dados.',
    'Vivência em Azure Databricks, PySpark, SQL, Power BI e Qlik Sense.',
  ].join(' '),
  experience: [
    {
      title: 'Senior Business Intelligence',
      company: 'CNH',
      startDate: '01/2025',
      endDate: '04/2026',
      bullets: [
        'Desenvolvi pipelines ETL completos no Azure Databricks com PySpark, Python e SQL.',
        'Desenvolvi dashboards estratégicos em Power BI para Supply Chain e Manufatura.',
        'Atuei com governança e qualidade de dados em bases confiáveis para áreas de negócio.',
      ],
    },
    {
      title: 'Desenvolvedor de Business Intelligence',
      company: 'Grupo Positivo',
      startDate: '01/2021',
      endDate: '01/2024',
      bullets: [
        'Projetei e implementei dashboards multifuncionais em Qlik Cloud, Qlik View e Qlik Sense.',
        'Otimizei fluxos de trabalho com Power Automate e integrei APIs de Dynamics CRM, SharePoint e REST para eliminar processos manuais.',
      ],
    },
  ],
  skills: [
    'SQL',
    'Dashboards',
    'PostgreSQL',
    'Python',
    'Data Modeling',
    'Data Governance',
    'Azure Databricks',
    'Microsoft Power BI',
    'QlikView Development',
    'PySpark',
    'Data Visualization',
    'Extract, Transform, Load (ETL)',
  ],
  education: [{
    degree: 'Graduação em Análise e Desenvolvimento de Sistemas',
    institution: 'UniCesumar',
    year: '12/2026',
  }],
  certifications: [],
}

const targetJobDescription = [
  'Descrição',
  'Realizar coleta, limpeza, estruturação e modelagem de dados provenientes de diversas fontes.',
  'Desenvolver e manter dashboards, relatórios e indicadores (KPIs) em ferramentas de BI (Power BI).',
  'Garantir a governança, integridade e qualidade dos dados nos sistemas corporativos.',
  'Contribuir na evolução de modelos analíticos e automações (Python, SQL, machine learning básicos, quando aplicável).',
  'Criar robôs para automatizar rotinas das diversas áreas de Marketing.',
  '',
  'Requisitos',
  'Formação em Administração, Engenharia, Estatística, Economia, Sistemas de Informação, Ciência de Dados ou áreas correlatas.',
  'Domínio avançado de Excel (procv/xlookup, tabelas dinâmicas, fórmulas financeiras, Power Query).',
  'Domínio de ferramentas de manipulação de dados: Excel avançado, Python.',
  'Experiência com ferramentas de BI como Power BI, Tableau ou similares.',
  'Conhecimento em modelagem de dados e construção de dashboards gerenciais.',
  'Experiência com bases de dados (SQL intermediário ou avançado).',
  'Vivência com ERP Totvs Protheus.',
  'Conhecimento em indicadores financeiros e leitura de demonstrações financeiras (desejável).',
].join('\n')

const gapAnalysis: GapAnalysisResult = {
  matchScore: 72,
  missingSkills: [
    'Power Query',
    'Totvs Protheus',
    'Excel avançado',
    'indicadores financeiros',
    'demonstrações financeiras',
  ],
  weakAreas: [],
  improvementSuggestions: [],
}

function buildTargetingPlan(overrides: Partial<TargetingPlan> = {}): TargetingPlan {
  return {
    targetRole: 'Analista de Dados',
    targetRoleConfidence: 'high',
    targetRoleSource: 'llm',
    focusKeywords: [],
    mustEmphasize: [],
    shouldDeemphasize: [],
    missingButCannotInvent: gapAnalysis.missingSkills,
    sectionStrategy: {
      summary: [],
      experience: [],
      skills: [],
      education: [],
      certifications: [],
    },
    ...overrides,
  }
}

function findEvidence(targetEvidence: TargetEvidence[], signal: string): TargetEvidence {
  const canonicalSignal = buildCanonicalSignal(signal)
  const evidence = targetEvidence.find((item) => buildCanonicalSignal(item.jobSignal) === canonicalSignal)

  expect(evidence, `expected evidence for ${signal}`).toBeDefined()
  return evidence as TargetEvidence
}

describe('job targeting compatibility regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallOpenAIWithRetry.mockImplementation(async (fn: (signal?: AbortSignal) => Promise<unknown>) => fn())
    mockOpenAICompletionCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ items: [] }),
        },
      }],
    })
    mockTrackApiUsage.mockResolvedValue(undefined)
  })

  it('keeps compound BI requirements conservative in the non-LLM evidence classifier', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState,
      targetingPlan: buildTargetingPlan({ missingButCannotInvent: [] }),
      gapAnalysis,
      coreRequirementSignals: ['Experiência com ferramentas de BI como Power BI, Tableau ou similares'],
    })
    const evidence = findEvidence(targetEvidence, 'Experiência com ferramentas de BI como Power BI, Tableau ou similares')

    expect(evidence.evidenceLevel).toBe('unsupported_gap')
    expect(evidence.rewritePermission).toBe('must_not_claim')
  })

  it('treats ADS graduation as related technology education', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState,
      targetingPlan: buildTargetingPlan({ missingButCannotInvent: [] }),
      gapAnalysis,
      coreRequirementSignals: ['Formação em Administração, Engenharia, Estatística, Economia, Sistemas de Informação, Ciência de Dados ou áreas correlatas'],
    })
    const evidence = findEvidence(
      targetEvidence,
      'Formação em Administração, Engenharia, Estatística, Economia, Sistemas de Informação, Ciência de Dados ou áreas correlatas',
    )

    expect(evidence.evidenceLevel).toBe('strong_contextual_inference')
    expect(evidence.rewritePermission).toBe('can_bridge_carefully')
  })

  it('does not turn Power Query into a direct claim because Power BI exists', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState,
      targetingPlan: buildTargetingPlan({ missingButCannotInvent: [] }),
      gapAnalysis,
      coreRequirementSignals: ['Power Query'],
    })
    const evidence = findEvidence(targetEvidence, 'Power Query')

    expect(evidence.evidenceLevel).not.toBe('explicit')
    expect(evidence.rewritePermission).not.toBe('can_claim_directly')
  })

  it('keeps Totvs Protheus as a real gap when no ERP evidence exists', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState,
      targetingPlan: buildTargetingPlan({ missingButCannotInvent: [] }),
      gapAnalysis,
      coreRequirementSignals: ['Vivência com ERP Totvs Protheus'],
    })
    const evidence = findEvidence(targetEvidence, 'Vivência com ERP Totvs Protheus')

    expect(evidence.evidenceLevel).toBe('unsupported_gap')
    expect(evidence.rewritePermission).toBe('must_not_claim')
  })

  it('raises the visual score into a realistic range without hiding true gaps', async () => {
    const coreRequirementSignals = extractCoreRequirementSignalsFromDescription(targetJobDescription)
    const targetEvidence = await classifyTargetEvidence({
      cvState,
      targetingPlan: buildTargetingPlan(),
      gapAnalysis,
      coreRequirementSignals,
    })
    const coverage = buildCoreRequirementCoverage({
      targetJobDescription,
      targetRole: 'Analista de Dados',
      targetEvidence,
      missingButCannotInvent: gapAnalysis.missingSkills,
    })
    const score = buildJobTargetingScoreBreakdown({
      cvState,
      coreRequirements: coverage.requirements.filter((requirement) => requirement.importance === 'core'),
      preferredRequirements: coverage.requirements.filter((requirement) => requirement.importance === 'differential'),
      targetEvidence,
      criticalGapSignals: coverage.topUnsupportedSignalsForDisplay,
    })

    expect(score.total).toBeGreaterThanOrEqual(40)
    expect(score.total).toBeLessThanOrEqual(60)
    expect(coverage.topUnsupportedSignalsForDisplay).toEqual(expect.arrayContaining([
      'Power Query',
      'Totvs Protheus',
    ]))
  })
})
