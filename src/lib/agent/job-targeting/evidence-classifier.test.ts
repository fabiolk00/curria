import { beforeEach, describe, expect, it, vi } from 'vitest'

import { classifyTargetEvidence } from '@/lib/agent/job-targeting/evidence-classifier'
import type { TargetingPlan } from '@/types/agent'
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

const baseGapAnalysis: GapAnalysisResult = {
  matchScore: 70,
  missingSkills: [],
  weakAreas: [],
  improvementSuggestions: [],
}

function buildCvState(overrides: Partial<CVState> = {}): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Profissional com foco em BI, SQL e dashboards.',
    experience: [{
      title: 'Analista de Dados',
      company: 'Acme',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Construi dashboards em Power BI e automatizei analises em SQL.'],
    }],
    skills: ['SQL', 'Power BI'],
    education: [],
    certifications: [],
    ...overrides,
  }
}

function buildTargetingPlan(overrides: Partial<TargetingPlan> = {}): TargetingPlan {
  return {
    targetRole: 'Analytics Engineer',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    focusKeywords: [],
    mustEmphasize: [],
    shouldDeemphasize: [],
    missingButCannotInvent: [],
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

function buildOpenAIResponse(text: string) {
  return {
    choices: [{
      message: {
        content: text,
      },
    }],
  }
}

describe('classifyTargetEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallOpenAIWithRetry.mockImplementation(async (fn: (signal?: AbortSignal) => Promise<unknown>) => fn())
    mockTrackApiUsage.mockResolvedValue(undefined)
  })

  it('classifies explicit evidence as directly claimable', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState(),
      targetingPlan: buildTargetingPlan({
        mustEmphasize: ['SQL'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'SQL',
      evidenceLevel: 'explicit',
      rewritePermission: 'can_claim_directly',
    }))
  })

  it('classifies acronym/expanded-form matches as normalized aliases', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        skills: ['SQL'],
      }),
      targetingPlan: buildTargetingPlan({
        mustEmphasize: ['Structured Query Language'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'Structured Query Language',
      evidenceLevel: 'normalized_alias',
      rewritePermission: 'can_claim_normalized',
    }))
  })

  it('does not promote ambiguous two-letter acronyms to normalized aliases automatically', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'PM',
        evidenceLevel: 'strong_contextual_inference',
        confidence: 0.61,
        matchedResumeTerms: ['project delivery', 'roadmap'],
        supportingResumeSpans: ['Coordenei project delivery e roadmap com stakeholders.'],
        rationale: 'The acronym is ambiguous and only weakly supported by adjacent evidence.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Profissional com foco em product operations.',
        experience: [{
          title: 'Project Coordinator',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Coordenei project delivery e roadmap com stakeholders.'],
        }],
        skills: ['Roadmap', 'Project Delivery'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['PM'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'PM',
      evidenceLevel: 'strong_contextual_inference',
    }))
    expect(targetEvidence).not.toContainEqual(expect.objectContaining({
      jobSignal: 'PM',
      evidenceLevel: 'normalized_alias',
    }))
  })

  it('does not promote QA as a normalized alias when only adjacent quantitative analysis evidence exists', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'QA',
        evidenceLevel: 'unsupported_gap',
        confidence: 0.7,
        matchedResumeTerms: [],
        supportingResumeSpans: [],
        rationale: 'The acronym is ambiguous between quality assurance and quantitative analysis.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Profissional com foco em quantitative analysis.',
        skills: ['Quantitative Analysis'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['QA'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'QA',
      evidenceLevel: 'unsupported_gap',
    }))
  })

  it('supports technical equivalents through the semantic classifier fallback', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'modelagem dimensional',
        evidenceLevel: 'technical_equivalent',
        confidence: 0.88,
        matchedResumeTerms: ['star schema', 'snowflake schema'],
        supportingResumeSpans: ['Responsavel por star schema e snowflake schema para analytics.'],
        rationale: 'Star schema and snowflake schema are direct dimensional modeling evidence.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Especialista em modelagem de dados.',
        experience: [{
          title: 'BI Engineer',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Responsavel por star schema e snowflake schema para analytics.'],
        }],
        skills: ['star schema', 'snowflake schema'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['modelagem dimensional'],
      }),
      gapAnalysis: baseGapAnalysis,
      userId: 'usr_123',
      sessionId: 'sess_123',
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'modelagem dimensional',
      evidenceLevel: 'technical_equivalent',
      rewritePermission: 'can_claim_normalized',
    }))
  })

  it('matches REST API requirements when the resume contains API and REST evidence in the same span', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Profissional com foco em integrações e automação.',
        experience: [{
          title: 'Analista de Sistemas',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Integrei APIs de Dynamics CRM, SharePoint e REST para automatizar fluxos internos.'],
        }],
        skills: ['Integrações com APIs'],
      }),
      targetingPlan: buildTargetingPlan({
        mustEmphasize: ['APIs REST'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'APIs REST',
      evidenceLevel: 'technical_equivalent',
      rewritePermission: 'can_claim_normalized',
    }))
  })

  it('supports strong contextual inference without converting it into a direct claim', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'lifecycle marketing',
        evidenceLevel: 'strong_contextual_inference',
        confidence: 0.76,
        matchedResumeTerms: ['CRM', 'retencao', 'jornada do cliente'],
        supportingResumeSpans: ['Conduzi campanhas de retencao com CRM e jornadas do cliente.'],
        rationale: 'The resume shows strong adjacent retention and CRM evidence, but not the exact lifecycle term.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Profissional de marketing orientada a CRM.',
        experience: [{
          title: 'Marketing Specialist',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Conduzi campanhas de retencao com CRM e jornadas do cliente.'],
        }],
        skills: ['CRM', 'Retencao'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['lifecycle marketing'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'lifecycle marketing',
      evidenceLevel: 'strong_contextual_inference',
      rewritePermission: 'can_bridge_carefully',
    }))
  })

  it('classifies enterprise sales cross-domain evidence without inventing leadership', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'enterprise sales',
        evidenceLevel: 'technical_equivalent',
        confidence: 0.84,
        matchedResumeTerms: ['vendas B2B', 'grandes contas', 'venda consultiva'],
        supportingResumeSpans: ['Conduzi vendas B2B para grandes contas em ciclo de venda consultiva.'],
        rationale: 'The resume shows equivalent enterprise-account sales evidence.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Executiva comercial com foco em contas estrategicas.',
        experience: [{
          title: 'Executiva Comercial',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Conduzi vendas B2B para grandes contas em ciclo de venda consultiva.'],
        }],
        skills: ['Vendas B2B', 'Grandes contas', 'Venda consultiva'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['enterprise sales'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'enterprise sales',
      evidenceLevel: 'technical_equivalent',
      rewritePermission: 'can_claim_normalized',
    }))
  })

  it('classifies adjacent but unsupported tools as bridge-only context when appropriate', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'Lean Six Sigma',
        evidenceLevel: 'semantic_bridge_only',
        confidence: 0.74,
        matchedResumeTerms: ['melhoria continua'],
        supportingResumeSpans: ['Atuei com melhoria continua e reducao de desperdicio operacional.'],
        rationale: 'The resume shows adjacent continuous-improvement evidence, but not Lean Six Sigma itself.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Profissional de operacoes com foco em eficiencia.',
        experience: [{
          title: 'Operations Analyst',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Atuei com melhoria continua e reducao de desperdicio operacional.'],
        }],
        skills: ['Melhoria continua'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['Lean Six Sigma'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'Lean Six Sigma',
      evidenceLevel: 'semantic_bridge_only',
      rewritePermission: 'can_mention_as_related_context',
    }))
  })

  it('classifies juridical SaaS contract signals as bridge-only when SaaS is not explicit', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'SaaS contracts',
        evidenceLevel: 'semantic_bridge_only',
        confidence: 0.72,
        matchedResumeTerms: ['contratos de tecnologia', 'licenciamento de software'],
        supportingResumeSpans: ['Atuei com contratos de tecnologia e licenciamento de software B2B.'],
        rationale: 'The resume is adjacent to SaaS contracting but does not prove SaaS directly.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Advogada com foco em contratos B2B.',
        experience: [{
          title: 'Advogada Corporativa',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Atuei com contratos de tecnologia e licenciamento de software B2B.'],
        }],
        skills: ['Contratos de tecnologia', 'Licenciamento de software'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['SaaS contracts'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'SaaS contracts',
      evidenceLevel: 'semantic_bridge_only',
      rewritePermission: 'can_mention_as_related_context',
    }))
  })

  it('classifies people analytics cross-domain evidence from HR metrics context', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'people analytics',
        evidenceLevel: 'strong_contextual_inference',
        confidence: 0.8,
        matchedResumeTerms: ['indicadores de RH', 'turnover', 'headcount'],
        supportingResumeSpans: ['Criei indicadores de RH, turnover e headcount em dashboards executivos.'],
        rationale: 'The resume shows a strong people-metrics analytics context.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Profissional de RH orientada a dados.',
        experience: [{
          title: 'HR Analyst',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Criei indicadores de RH, turnover e headcount em dashboards executivos.'],
        }],
        skills: ['Indicadores de RH', 'Turnover', 'Headcount'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['people analytics'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'people analytics',
      evidenceLevel: 'strong_contextual_inference',
    }))
  })

  it('classifies FP&A signals from finance planning evidence without inflating title equivalence', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'FP&A',
        evidenceLevel: 'strong_contextual_inference',
        confidence: 0.79,
        matchedResumeTerms: ['orcamento', 'forecast', 'analise de variacao', 'reporting financeiro'],
        supportingResumeSpans: ['Conduzi orcamento, forecast, analise de variacao e reporting financeiro mensal.'],
        rationale: 'The profile strongly matches financial planning and analysis activities.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Analista financeira com foco em planejamento.',
        experience: [{
          title: 'Financial Analyst',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Conduzi orcamento, forecast, analise de variacao e reporting financeiro mensal.'],
        }],
        skills: ['Orcamento', 'Forecast', 'Analise de variacao', 'Reporting financeiro'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['FP&A'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'FP&A',
      evidenceLevel: 'strong_contextual_inference',
    }))
  })

  it('keeps unsupported gaps forbidden when no evidence exists', async () => {
    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState(),
      targetingPlan: buildTargetingPlan({
        missingButCannotInvent: ['Airflow'],
      }),
      gapAnalysis: {
        ...baseGapAnalysis,
        missingSkills: ['Airflow'],
      },
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'Airflow',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
    }))
  })

  it('downgrades ungrounded LLM fallback output to unsupported gaps', async () => {
    mockOpenAICompletionCreate.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        jobSignal: 'contracts SaaS',
        evidenceLevel: 'technical_equivalent',
        confidence: 0.82,
        matchedResumeTerms: ['SaaS enterprise contracting'],
        supportingResumeSpans: ['Led SaaS enterprise contracting.'],
        rationale: 'The profile appears related.',
      }],
    })))

    const targetEvidence = await classifyTargetEvidence({
      cvState: buildCvState({
        summary: 'Advogada com foco em contratos B2B de tecnologia.',
        skills: ['Contratos B2B'],
      }),
      targetingPlan: buildTargetingPlan({
        focusKeywords: ['contracts SaaS'],
      }),
      gapAnalysis: baseGapAnalysis,
    })

    expect(targetEvidence).toContainEqual(expect.objectContaining({
      jobSignal: 'contracts SaaS',
      evidenceLevel: 'unsupported_gap',
      rewritePermission: 'must_not_claim',
    }))
  })
})
