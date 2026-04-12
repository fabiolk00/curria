import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  appendMessage,
  applyToolPatchWithVersion,
  checkUserQuota,
  createSessionWithCredit,
  getMessages,
  getSession,
  incrementMessageCount,
  updateSession,
} from '@/lib/db/sessions'
import { agentLimiter } from '@/lib/rate-limit'
import { createChatCompletionStreamWithRetry } from '@/lib/openai/chat'

const {
  mockDispatchTool,
  mockDispatchToolWithContext,
  mockGetToolDefinitionsForPhase,
  mockDeriveTargetResumeCvState,
} = vi.hoisted(() => ({
  mockDispatchTool: vi.fn(),
  mockDispatchToolWithContext: vi.fn(),
  mockGetToolDefinitionsForPhase: vi.fn(() => []),
  mockDeriveTargetResumeCvState: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {},
}))

vi.mock('@/lib/openai/chat', () => ({
  createChatCompletionStreamWithRetry: vi.fn(),
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  agentLimiter: {
    limit: vi.fn(),
  },
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  createSessionWithCredit: vi.fn(),
  getMessages: vi.fn(),
  appendMessage: vi.fn(),
  applyToolPatchWithVersion: vi.fn(),
  checkUserQuota: vi.fn(),
  incrementMessageCount: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/agent/context-builder', () => ({
  buildSystemPrompt: vi.fn(() => 'system prompt'),
  trimMessages: vi.fn((messages: unknown) => messages),
}))

vi.mock('@/lib/agent/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: mockDispatchTool,
  dispatchToolWithContext: mockDispatchToolWithContext,
  getToolDefinitionsForPhase: mockGetToolDefinitionsForPhase,
}))

vi.mock('@/lib/resume-targets/create-target-resume', () => ({
  deriveTargetResumeCvState: mockDeriveTargetResumeCvState,
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(() => Promise.resolve()),
  calculateUsageCostCents: vi.fn(() => 1),
}))

vi.mock('@/lib/agent/url-extractor', () => ({
  extractUrl: vi.fn(() => null),
}))

vi.mock('@/lib/agent/scraper', () => ({
  scrapeJobPosting: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: vi.fn(() => ({})),
}))

function parseSseDataEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter((entry) => entry.startsWith('data: '))
    .map((entry) => JSON.parse(entry.replace('data: ', '')) as Record<string, unknown>)
}

async function* emptyStopStream() {
  yield {
    choices: [{
      delta: {},
      finish_reason: 'stop',
    }],
    usage: null,
  }
}

async function* emptyLengthStream() {
  yield {
    choices: [{
      delta: {},
      finish_reason: 'length',
    }],
    usage: null,
  }

  yield {
    choices: [],
    usage: {
      prompt_tokens: 1540,
      completion_tokens: 1250,
      total_tokens: 2790,
    },
  }
}

async function* textStopStream(text: string) {
  yield {
    choices: [{
      delta: { content: text },
      finish_reason: null,
    }],
    usage: null,
  }

  yield {
    choices: [{
      delta: {},
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 45,
      completion_tokens: 20,
      total_tokens: 65,
    },
  }
}

function buildDialogSession(overrides?: {
  id?: string
  agentState?: Record<string, unknown>
}) {
  return {
    id: overrides?.id ?? 'sess_dialog',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog' as const,
    cvState: {
      fullName: 'Fabio Silva',
      email: 'fabio@example.com',
      phone: '11999999999',
      summary: 'Analista de dados com foco em BI e automacao.',
      experience: [],
      skills: ['SQL', 'Power BI'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
      sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.',
      ...overrides?.agentState,
    },
    generatedOutput: { status: 'idle' as const },
    atsScore: undefined,
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any
}

function buildIntakeSession(overrides?: {
  id?: string
  agentState?: Record<string, unknown>
}) {
  return {
    id: overrides?.id ?? 'sess_intake',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'intake' as const,
    cvState: {
      fullName: 'Fabio Silva',
      email: 'fabio@example.com',
      phone: '11999999999',
      summary: 'Analista de dados com foco em BI e automacao.',
      experience: [],
      skills: ['SQL', 'Power BI'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
      sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.',
      ...overrides?.agentState,
    },
    generatedOutput: { status: 'idle' as const },
    atsScore: undefined,
    creditsUsed: 1,
    messageCount: 0,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildContextToolResultWithAppliedPatch(result: {
  output: Record<string, unknown>
  outputJson: string
  persistedPatch?: Record<string, unknown>
}) {
  return async (_toolName: string, _input: Record<string, unknown>, session: any) => {
    const patch = result.persistedPatch

    if (patch?.phase) {
      session.phase = patch.phase
    }

    if (patch?.cvState) {
      session.cvState = {
        ...session.cvState,
        ...patch.cvState,
      }
    }

    if (patch?.agentState) {
      session.agentState = {
        ...session.agentState,
        ...patch.agentState,
      }
    }

    if ('atsScore' in (patch ?? {})) {
      session.atsScore = patch?.atsScore
    }

    if (patch?.generatedOutput) {
      session.generatedOutput = {
        ...session.generatedOutput,
        ...patch.generatedOutput,
      }
    }

    return result
  }
}

describe('/api/agent SSE fallback coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'clerk_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    vi.mocked(agentLimiter.limit).mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: 0,
      pending: Promise.resolve(),
    })

    vi.mocked(getMessages).mockResolvedValue([
      { role: 'user', content: 'Quero uma analise', createdAt: new Date() },
    ])
    vi.mocked(appendMessage).mockResolvedValue(undefined)
    vi.mocked(applyToolPatchWithVersion).mockImplementation(async (session, patch) => {
      if (patch?.phase) {
        session.phase = patch.phase
      }

      if (patch?.cvState) {
        session.cvState = {
          ...session.cvState,
          ...patch.cvState,
        }
      }

      if (patch?.agentState) {
        session.agentState = {
          ...session.agentState,
          ...patch.agentState,
        }
      }

      if ('atsScore' in (patch ?? {})) {
        session.atsScore = patch?.atsScore
      }

      if (patch?.generatedOutput) {
        session.generatedOutput = {
          ...session.generatedOutput,
          ...patch.generatedOutput,
        }
      }
    })
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue(null)
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    mockDispatchTool.mockReset()
    mockDispatchToolWithContext.mockReset()
    mockGetToolDefinitionsForPhase.mockReturnValue([])
    mockDeriveTargetResumeCvState.mockResolvedValue({
      success: false,
      code: 'LLM_INVALID_OUTPUT',
      error: 'Invalid target resume payload.',
    })
  })

  it('streams a dialog continue fallback through the real agent loop without repeating the bootstrap copy', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_continue_real',
      agentState: {
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
      },
    })

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry).mockImplementation(
      async () => emptyStopStream() as never,
    )

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'pode fazer',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Posso seguir, sim.')
    expect(finalText).toContain('resumo profissional')
    expect(finalText).not.toContain('Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      isNewSession: false,
    })
    expect(createChatCompletionStreamWithRetry).toHaveBeenCalledTimes(5)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      expect.stringContaining('Posso seguir, sim.'),
    ])
  })

  it('streams a deterministic summary rewrite for terse requests like "reescreva"', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_rewrite_real',
      agentState: {
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
      },
    })

    vi.mocked(getSession).mockResolvedValue(session)
    mockDispatchToolWithContext.mockResolvedValueOnce({
      output: {
        success: true,
        rewritten_content: 'Analista de BI com experiencia em Power BI, SQL e ETL, focado em dashboards executivos e traducao de indicadores para o negocio.',
        section_data: 'Analista de BI com experiencia em Power BI, SQL e ETL, focado em dashboards executivos e traducao de indicadores para o negocio.',
        keywords_added: ['Power BI', 'SQL', 'ETL'],
        changes_made: ['Resumo alinhado a BI senior'],
      },
      outputJson: JSON.stringify({
        success: true,
        rewritten_content: 'Analista de BI com experiencia em Power BI, SQL e ETL, focado em dashboards executivos e traducao de indicadores para o negocio.',
        section_data: 'Analista de BI com experiencia em Power BI, SQL e ETL, focado em dashboards executivos e traducao de indicadores para o negocio.',
        keywords_added: ['Power BI', 'SQL', 'ETL'],
        changes_made: ['Resumo alinhado a BI senior'],
      }),
      persistedPatch: {
        cvState: {
          summary: 'Analista de BI com experiencia em Power BI, SQL e ETL, focado em dashboards executivos e traducao de indicadores para o negocio.',
        },
      },
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'reescreva',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Aqui esta uma versao reescrita do seu resumo profissional:')
    expect(finalText).toContain('Analista de BI com experiencia em Power BI, SQL e ETL')
    expect(finalText).toContain('Aceito')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      isNewSession: false,
    })
    expect(createChatCompletionStreamWithRetry).not.toHaveBeenCalled()
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      expect.stringContaining('Aqui esta uma versao reescrita do seu resumo profissional:'),
    ])
  })

  it('streams the Aceito confirmation prompt before generating files', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_generation_confirm_real',
      agentState: {
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
      },
    })

    vi.mocked(getSession).mockResolvedValue(session)
    mockDispatchToolWithContext.mockImplementationOnce(async (_toolName, _toolInput, currentSession) => {
      currentSession.phase = 'confirm'
      return {
        output: { success: true, phase: 'confirm' },
        outputJson: JSON.stringify({ success: true, phase: 'confirm' }),
        persistedPatch: {
          phase: 'confirm',
        },
      }
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'gere o arquivo',
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toBe('Quando fizer sentido, clique em "Aceito" para gerar seu curriculo.')
    expect(events).toContainEqual(expect.objectContaining({
      type: 'patch',
      phase: 'confirm',
      patch: expect.objectContaining({
        phase: 'confirm',
      }),
    }))
    expect(createChatCompletionStreamWithRetry).not.toHaveBeenCalled()
  })

  it('generates files directly when Aceito is sent from dialog with vacancy and resume context already loaded', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_direct_generate_real',
      agentState: {
        targetJobDescription: 'Senior Analytics Engineer com foco em dbt, SQL e BigQuery.',
      },
    })
    session.atsScore = {
      total: 43,
      breakdown: {
        format: 60,
        structure: 42,
        keywords: 38,
        contact: 95,
        impact: 30,
      },
      issues: [],
      suggestions: [],
    }

    vi.mocked(getSession).mockResolvedValue(session)
    mockDispatchToolWithContext
      .mockResolvedValueOnce({
        output: { success: true, phase: 'generation' },
        outputJson: JSON.stringify({ success: true, phase: 'generation' }),
        persistedPatch: {
          phase: 'generation',
        },
      })
      .mockResolvedValueOnce({
        output: {
          success: true,
          targetId: 'target_123',
          targetJobDescription: 'Senior Analytics Engineer com foco em dbt, SQL e BigQuery.',
          derivedCvState: {
            ...session.cvState,
            summary: 'Analytics Engineer com foco em dbt, SQL, BigQuery e governanca de dados.',
            skills: ['dbt', 'SQL', 'BigQuery', 'DataOps'],
          },
        },
        outputJson: JSON.stringify({
          success: true,
          targetId: 'target_123',
        }),
        persistedPatch: {
          agentState: {
            targetJobDescription: 'Senior Analytics Engineer com foco em dbt, SQL e BigQuery.',
          },
        },
      })
      .mockResolvedValueOnce({
        output: {
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
        },
        outputJson: JSON.stringify({
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
        }),
        persistedPatch: {
          generatedOutput: {
            status: 'ready',
            pdfPath: 'usr_123/sess_dialog_direct_generate_real/resume.pdf',
          },
        },
      })
      .mockResolvedValueOnce({
        output: {
          success: true,
          result: {
            total: 73,
            breakdown: {
              format: 70,
              structure: 70,
              keywords: 80,
              contact: 95,
              impact: 50,
            },
            issues: [],
            suggestions: [],
          },
        },
        outputJson: JSON.stringify({ success: true, result: { total: 73 } }),
        persistedPatch: {
          atsScore: {
            total: 73,
            breakdown: {
              format: 70,
              structure: 70,
              keywords: 80,
              contact: 95,
              impact: 50,
            },
            issues: [],
            suggestions: [],
          },
        },
      })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'Aceito',
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Seu curriculo ATS-otimizado em PDF esta pronto.')
    expect(finalText).toContain('ATS Score antes: 43/100. ATS agora: 73/100.')
    expect(events).toContainEqual(expect.objectContaining({
      type: 'patch',
      phase: 'dialog',
      patch: expect.objectContaining({
        phase: 'generation',
      }),
    }))
    expect(vi.mocked(applyToolPatchWithVersion)).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        cvState: expect.objectContaining({
          summary: 'Analytics Engineer com foco em dbt, SQL, BigQuery e governanca de dados.',
        }),
      }),
      'target-derived',
    )
    expect(createChatCompletionStreamWithRetry).not.toHaveBeenCalled()
  })

  it('streams the latest pasted vacancy acknowledgement through the real agent loop when dialog recovery fails', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_latest_vacancy_real',
      agentState: {
        targetJobDescription: undefined,
      },
    })
    const jobDescription = [
      'Responsabilidades',
      'Construir dashboards executivos em Power BI e traduzir necessidades do negocio em indicadores.',
      'Requisitos',
      'SQL avancado, ETL, comunicacao com areas nao tecnicas e Power BI.',
      'Diferenciais',
      'Python, APIs e Microsoft Fabric.',
    ].join('\n')

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry).mockImplementation(
      async () => emptyStopStream() as never,
    )

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: jobDescription,
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Recebi essa nova vaga')
    expect(finalText).toContain('adaptar agora seu resumo')
    expect(finalText).not.toContain('Diga qual trecho voce quer ajustar primeiro')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      isNewSession: false,
    })
    expect(updateSession).toHaveBeenCalledWith(session.id, {
      agentState: expect.objectContaining({
        targetJobDescription: expect.stringContaining('Power BI'),
      }),
      phase: undefined,
    })
    expect(createChatCompletionStreamWithRetry).toHaveBeenCalledTimes(5)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      expect.stringContaining('Recebi essa nova vaga'),
    ])
  })

  it('recovers an intake turn that ends with length and zero visible text before falling back to the generic retry loop', async () => {
    const session = buildIntakeSession({
      id: 'sess_intake_zero_text_real',
    })

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry)
      .mockImplementationOnce(async () => emptyLengthStream() as never)
      .mockImplementation(async () => textStopStream('Bom dia! Otimo iniciar. Pode me dizer qual vaga voce esta mirando?') as never)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'bom dia',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Pode me dizer qual vaga')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'intake',
      isNewSession: false,
    })
    expect(vi.mocked(createChatCompletionStreamWithRetry)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      'Bom dia! Otimo iniciar. Pode me dizer qual vaga voce esta mirando?',
    ])
  })

  it('bootstraps summarized requirement-list vacancies into dialog with ATS context', async () => {
    const session = buildIntakeSession({
      id: 'sess_requirement_summary_real',
    })

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry).mockImplementation(async () => emptyStopStream() as never)

    const requirementSummary = [
      'Requisitos Desejaveis',
      '',
      'Experiencia em analises que envolvem multiplas areas de negocio. Vivencia em GitHub, Looker ou outras ferramentas de data visualization. Capacidade de resolver problemas com foco em resultados para o negocio. Experiencia em digital analytics com ferramentas como Google Analytics, Google Tag Manager e Appsflyer. Conhecimento em tecnicas avancadas de ETL e transformacao de dados.',
      '',
      'Resumo dos requisitos: SQL, Google Sheets, Looker Platform, Machine Learning, GitHub, R, BigQuery, SQL Server, Google Analytics, Google Tag Manager, Appsflyer.',
    ].join('\n')

    mockDispatchToolWithContext
      .mockImplementationOnce(buildContextToolResultWithAppliedPatch({
        output: {
          success: true,
          result: {
            total: 51,
            breakdown: {
              format: 70,
              structure: 60,
              keywords: 45,
              contact: 95,
              impact: 35,
            },
            issues: [],
            suggestions: [],
          },
        },
        outputJson: JSON.stringify({ success: true, result: { total: 51 } }),
        persistedPatch: {
          atsScore: {
            total: 51,
            breakdown: {
              format: 70,
              structure: 60,
              keywords: 45,
              contact: 95,
              impact: 35,
            },
            issues: [],
            suggestions: [],
          },
        },
      }))
      .mockImplementationOnce(buildContextToolResultWithAppliedPatch({
        output: {
          success: true,
          result: {
            matchScore: 61,
            missingSkills: ['Looker', 'Machine Learning'],
            weakAreas: ['resumo profissional'],
            improvementSuggestions: ['Destaque analytics e ETL no resumo.'],
          },
        },
        outputJson: JSON.stringify({
          success: true,
          result: {
            matchScore: 61,
            missingSkills: ['Looker', 'Machine Learning'],
            weakAreas: ['resumo profissional'],
            improvementSuggestions: ['Destaque analytics e ETL no resumo.'],
          },
        }),
        persistedPatch: {
          agentState: {
            gapAnalysis: {
              analyzedAt: '2026-04-12T20:00:00.000Z',
              result: {
                matchScore: 61,
                missingSkills: ['Looker', 'Machine Learning'],
                weakAreas: ['resumo profissional'],
                improvementSuggestions: ['Destaque analytics e ETL no resumo.'],
              },
            },
          },
        },
      }))
      .mockImplementationOnce(buildContextToolResultWithAppliedPatch({
        output: { success: true, phase: 'dialog' },
        outputJson: JSON.stringify({ success: true, phase: 'dialog' }),
        persistedPatch: {
          phase: 'dialog',
        },
      }))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: requirementSummary,
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    const doneEvent = events.find((event) => event.type === 'done')
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(createChatCompletionStreamWithRetry).not.toHaveBeenCalled()
    expect(doneEvent).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      atsScore: expect.objectContaining({
        total: 51,
      }),
    })
    expect(finalText).toContain('Pontuacao ATS atual: 51/100.')
    expect(finalText).toContain('Quando fizer sentido, clique em "Aceito" para gerar seu curriculo.')
  })
})
