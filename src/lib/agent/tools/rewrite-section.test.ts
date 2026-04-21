import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/types/agent'

import { CURRENT_SESSION_STATE_VERSION } from '@/lib/db/sessions'
import { mergeToolPatch } from '@/lib/db/sessions'

import { rewriteSection } from './rewrite-section'

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(() => Promise.resolve(undefined)),
}))

function buildSession(): Session {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: CURRENT_SESSION_STATE_VERSION,
    phase: 'dialog',
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer',
      experience: [
        {
          title: 'Engineer',
          company: 'Acme',
          startDate: '2022',
          endDate: 'present',
          bullets: ['Built APIs'],
        },
      ],
      skills: ['TypeScript'],
      education: [
        {
          degree: 'BSc Computer Science',
          institution: 'USP',
          year: '2021',
        },
      ],
      certifications: [
        {
          name: 'AWS SAA',
          issuer: 'AWS',
          year: '2023',
        },
      ],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
    },
    generatedOutput: {
      status: 'idle',
    },
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date('2026-03-25T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T12:00:00.000Z'),
  }
}

function buildOpenAIResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
    },
  }
}

describe('rewriteSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the correct canonical cvState field', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'TypeScript, PostgreSQL, Redis',
      section_data: ['TypeScript', 'PostgreSQL', 'Redis'],
      keywords_added: ['Redis'],
      changes_made: ['Added infrastructure keyword'],
    })))

    const session = buildSession()
    const result = await rewriteSection({
      section: 'skills',
      current_content: 'TypeScript',
      instructions: 'Add relevant backend skills',
    }, session.userId, session.id)

    expect(result.output.success).toBe(true)
    expect(result.patch).toBeDefined()

    const merged = mergeToolPatch(session, result.patch ?? {})
    expect(merged.cvState.skills).toEqual(['TypeScript', 'PostgreSQL', 'Redis'])
  })

  it('keeps unrelated cvState fields unchanged', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'TypeScript, PostgreSQL',
      section_data: ['TypeScript', 'PostgreSQL'],
      keywords_added: ['PostgreSQL'],
      changes_made: ['Expanded database coverage'],
    })))

    const session = buildSession()
    const result = await rewriteSection({
      section: 'skills',
      current_content: 'TypeScript',
      instructions: 'Expand skills',
    }, session.userId, session.id)

    const merged = mergeToolPatch(session, result.patch ?? {})

    expect(merged.cvState.summary).toBe('Backend engineer')
    expect(merged.cvState.experience).toEqual(session.cvState.experience)
    expect(merged.cvState.education).toEqual(session.cvState.education)
    expect(merged.cvState.certifications).toEqual(session.cvState.certifications)
  })

  it('stores rewrite metadata in agentState', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'TypeScript, PostgreSQL',
      section_data: ['TypeScript', 'PostgreSQL'],
      keywords_added: ['PostgreSQL'],
      changes_made: ['Expanded database coverage'],
    })))

    const session = buildSession()
    const result = await rewriteSection({
      section: 'skills',
      current_content: 'TypeScript',
      instructions: 'Expand skills',
    }, session.userId, session.id)

    const merged = mergeToolPatch(session, result.patch ?? {})
    expect(merged.agentState.rewriteHistory.skills).toMatchObject({
      rewrittenContent: 'TypeScript, PostgreSQL',
      keywordsAdded: ['PostgreSQL'],
      changesMade: ['Expanded database coverage'],
    })
    expect(merged.agentState.rewriteHistory.skills?.updatedAt).toEqual(expect.any(String))
  })

  it('rejects invalid rewrite payloads and returns no patch', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'TypeScript, PostgreSQL',
      section_data: 'TypeScript, PostgreSQL',
      keywords_added: ['PostgreSQL'],
      changes_made: ['Expanded database coverage'],
    })))

    const result = await rewriteSection({
      section: 'skills',
      current_content: 'TypeScript',
      instructions: 'Expand skills',
    }, 'usr_123', 'sess_123')

    expect(result).toEqual({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid rewrite payload for section "skills".',
      },
    })
  })

  it('recovers summary rewrites when the model omits section_data', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'Analytics Engineer com foco em dbt, BigQuery e produtos analiticos escalaveis.',
      keywords_added: ['dbt', 'BigQuery'],
      changes_made: ['Resumo alinhado a analytics engineering'],
    })))

    const result = await rewriteSection({
      section: 'summary',
      current_content: 'Backend engineer',
      instructions: 'Rewrite for analytics engineering',
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      rewritten_content: 'Analytics Engineer com foco em dbt, BigQuery e produtos analiticos escalaveis.',
      section_data: 'Analytics Engineer com foco em dbt, BigQuery e produtos analiticos escalaveis.',
      keywords_added: ['dbt', 'BigQuery'],
      changes_made: ['Resumo alinhado a analytics engineering'],
    })
  })

  it('cleans redundant summary labels and duplicated summary sentences', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'Resumo Profissional: Analytics Engineer com foco em SQL e Power BI. Analytics Engineer com foco em SQL e Power BI.',
      section_data: 'Professional Summary: Analytics Engineer com foco em SQL e Power BI. Analytics Engineer com foco em SQL e Power BI.',
      keywords_added: ['SQL', 'Power BI'],
      changes_made: ['Resumo consolidado'],
    })))

    const result = await rewriteSection({
      section: 'summary',
      current_content: 'Resumo original',
      instructions: 'Rewrite summary',
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      rewritten_content: 'Analytics Engineer com foco em SQL e Power BI.',
      section_data: 'Analytics Engineer com foco em SQL e Power BI.',
      keywords_added: ['SQL', 'Power BI'],
      changes_made: ['Resumo consolidado'],
    })
  })

  it('parses summary rewrites wrapped in markdown fences', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(`\`\`\`json
{
  "rewritten_content": "Senior Analytics Engineer com experiência em dbt, SQL avançado e modelagem analítica escalável.",
  "section_data": "Senior Analytics Engineer com experiência em dbt, SQL avançado e modelagem analítica escalável.",
  "keywords_added": ["dbt", "SQL"],
  "changes_made": ["Resumo alinhado a engenharia analitica"]
}
\`\`\``))

    const result = await rewriteSection({
      section: 'summary',
      current_content: 'Backend engineer',
      instructions: 'Rewrite for analytics engineering',
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(true)
    expect(result.patch?.cvState).toEqual({
      summary: 'Senior Analytics Engineer com experiência em dbt, SQL avançado e modelagem analítica escalável.',
    })
  })

  it('recovers summary rewrites when the model nests content inside a serialized section payload', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: '{"section":"summary","title":"Resumo profissional","items":[{"type":"text","content":"Engenheiro de Dados com experiência em ETL e analytics."},{"type":"text","content":"Atuação com PySpark, SQL e Power BI para decisões estratégicas."}]}',
      section_data: '{"section":"summary","title":"Resumo profissional","items":[{"type":"text","content":"Engenheiro de Dados com experiência em ETL e analytics."},{"type":"text","content":"Atuação com PySpark, SQL e Power BI para decisões estratégicas."}]}',
      keywords_added: ['PySpark', 'Power BI'],
      changes_made: ['Resumo consolidado a partir do payload estruturado'],
    })))

    const result = await rewriteSection({
      section: 'summary',
      current_content: 'Resumo original',
      instructions: 'Rewrite summary',
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      rewritten_content: 'Engenheiro de Dados com experiência em ETL e analytics. Atuação com PySpark, SQL e Power BI para decisões estratégicas.',
      section_data: 'Engenheiro de Dados com experiência em ETL e analytics. Atuação com PySpark, SQL e Power BI para decisões estratégicas.',
      keywords_added: ['PySpark', 'Power BI'],
      changes_made: ['Resumo consolidado a partir do payload estruturado'],
    })
  })

  it('normalizes common experience payload variants instead of failing the rewrite', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'Experiencia profissional reestruturada.',
      experiences: [
        {
          role: 'Senior Analytics Engineer',
          employer: 'Pravaler',
          city: 'Sao Paulo',
          start: '01/2024',
          current: true,
          achievements: [
            { text: 'Liderou a modelagem analitica com dbt.' },
            'Otimizou pipelines de dados para reporting executivo.',
          ],
        },
      ],
      keywords_added: ['dbt'],
      changes_made: ['Bullets fortalecidos com verbos de impacto'],
    })))

    const result = await rewriteSection({
      section: 'experience',
      current_content: JSON.stringify([
        {
          title: 'Analytics Engineer',
          company: 'Pravaler',
          location: 'Sao Paulo',
          startDate: '01/2024',
          endDate: 'present',
          bullets: ['Criou dashboards executivos.'],
        },
      ]),
      instructions: 'Rewrite experience',
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      rewritten_content: 'Experiencia profissional reestruturada.',
      section_data: [
        {
          title: 'Senior Analytics Engineer',
          company: 'Pravaler',
          location: 'Sao Paulo',
          startDate: '01/2024',
          endDate: 'present',
          bullets: [
            'Liderou a modelagem analitica com dbt.',
            'Otimizou pipelines de dados para reporting executivo.',
          ],
        },
      ],
      keywords_added: ['dbt'],
      changes_made: ['Bullets fortalecidos com verbos de impacto'],
    })
  })

  it('limits changes_made to a short factual list', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'TypeScript, PostgreSQL, Redis',
      section_data: ['TypeScript', 'PostgreSQL', 'Redis'],
      keywords_added: ['TypeScript', 'PostgreSQL'],
      changes_made: [
        'Item 1',
        'Item 2',
        'Item 3',
        'Item 4',
        'Item 5',
        'Item 6',
        'Item 7',
        'Item 8',
      ],
    })))

    const result = await rewriteSection({
      section: 'skills',
      current_content: 'TypeScript',
      instructions: 'Expand skills',
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(true)
    if (!result.output.success) {
      throw new Error('Expected rewrite to succeed')
    }

    expect(result.output.changes_made).toEqual([
      'Item 1',
      'Item 2',
      'Item 3',
      'Item 4',
      'Item 5',
      'Item 6',
      'Item 7',
    ])
  })

  it('sends guardrails that preserve detail, metrics, and stronger bullet structure', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: 'Implementei pipelines de dados e reduzi o tempo de processamento em 30%.',
      section_data: [{
        title: 'Engineer',
        company: 'Acme',
        startDate: '2022',
        endDate: 'present',
        bullets: ['Implementei pipelines de dados e reduzi o tempo de processamento em 30%.'],
      }],
      keywords_added: ['pipelines de dados'],
      changes_made: ['Bullets fortalecidos'],
    })))

    await rewriteSection({
      section: 'experience',
      current_content: JSON.stringify([
        {
          title: 'Engineer',
          company: 'Acme',
          startDate: '2022',
          endDate: 'present',
          bullets: ['Built APIs'],
        },
      ]),
      instructions: 'Rewrite experience',
    }, 'usr_123', 'sess_123')

    const systemPrompt = createCompletion.mock.calls[0]?.[0]?.messages?.[0]?.content

    expect(systemPrompt).toContain('REGRA DE OURO (nunca viole):')
    expect(systemPrompt).toContain('Se tiver dúvida entre preservar ou melhorar, priorize preservar.')
    expect(systemPrompt).toContain('Mantenha TODAS as métricas reais. Nunca omita, suavize ou generalize números.')
    expect(systemPrompt).toContain('Nunca troque um bullet quantificado por um bullet genérico.')
    expect(systemPrompt).toContain('Trate bullets com percentuais, ganhos, reduções, volumes, SLA, throughput, escopo regional/global e resultados mensuráveis como evidência premium.')
    expect(systemPrompt).toContain('changes_made" deve listar no máximo 7 melhorias curtas, factuais e reais')
    expect(systemPrompt).toContain('Experiência: mantenha ferramentas, métricas, senioridade, escopo e contexto de negócio em cada bullet.')
    expect(systemPrompt).toContain('Experiência: preserve percentuais, reduções de tempo, economia, throughput, SLA, volumes e impacto regional/global sempre que forem reais.')
    expect(systemPrompt).toContain('Mantenha nomes próprios de ferramentas e termos técnicos em inglês')
  })
})
