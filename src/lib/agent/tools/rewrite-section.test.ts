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

  it('parses summary rewrites wrapped in markdown fences', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(`\`\`\`json
{
  "rewritten_content": "Senior Analytics Engineer com experiencia em dbt, SQL avancado e modelagem analitica escalavel.",
  "section_data": "Senior Analytics Engineer com experiencia em dbt, SQL avancado e modelagem analitica escalavel.",
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
      summary: 'Senior Analytics Engineer com experiencia em dbt, SQL avancado e modelagem analitica escalavel.',
    })
  })

  it('recovers summary rewrites when the model nests content inside a serialized section payload', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      rewritten_content: '{"section":"summary","title":"Resumo profissional","items":[{"type":"text","content":"Engenheiro de Dados com experiencia em ETL e analytics."},{"type":"text","content":"Atuacao com PySpark, SQL e Power BI para decisoes estrategicas."}]}',
      section_data: '{"section":"summary","title":"Resumo profissional","items":[{"type":"text","content":"Engenheiro de Dados com experiencia em ETL e analytics."},{"type":"text","content":"Atuacao com PySpark, SQL e Power BI para decisoes estrategicas."}]}',
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
      rewritten_content: 'Engenheiro de Dados com experiencia em ETL e analytics. Atuacao com PySpark, SQL e Power BI para decisoes estrategicas.',
      section_data: 'Engenheiro de Dados com experiencia em ETL e analytics. Atuacao com PySpark, SQL e Power BI para decisoes estrategicas.',
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
})
