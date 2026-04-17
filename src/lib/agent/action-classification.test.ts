import { describe, expect, it } from 'vitest'

import {
  classifyAgentAction,
  resolveGenerationPrerequisiteMessage,
} from './action-classification'
import type { Session } from '@/types/agent'

function buildSession(overrides?: Partial<Session>): Session {
  return {
    id: 'sess_classification',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog',
    cvState: {
      fullName: 'Fabio Silva',
      email: 'fabio@example.com',
      phone: '11999999999',
      summary: 'Analista de dados com foco em BI, SQL e automação.',
      experience: [],
      skills: ['SQL', 'Power BI'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      sourceResumeText: 'Resumo salvo no perfil.',
    },
    generatedOutput: { status: 'idle' },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Session
}

describe('classifyAgentAction', () => {
  it('keeps lightweight chat synchronous', () => {
    const classification = classifyAgentAction(buildSession(), 'oi')

    expect(classification).toEqual({
      actionType: 'chat',
      executionMode: 'sync',
      workflowMode: 'ats_enhancement',
    })
  })

  it('classifies generation approval with ready target context as async artifact generation', () => {
    const session = buildSession({
      phase: 'confirm',
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Resumo salvo no perfil.',
        targetJobDescription: 'Senior Analytics Engineer com foco em SQL, dbt e BigQuery.',
      },
    })

    const classification = classifyAgentAction(session, 'Aceito')

    expect(classification).toEqual({
      actionType: 'artifact_generation',
      executionMode: 'async',
      workflowMode: 'job_targeting',
    })
    expect(resolveGenerationPrerequisiteMessage(session)).toBeNull()
  })

  it('classifies pasted vacancies with resume context as async job targeting', () => {
    const vacancy = [
      'Analista de BI Senior',
      'Responsabilidades',
      'Construir dashboards em Power BI e integrar dados com SQL.',
      'Requisitos',
      'Power BI, SQL, ETL e comunicação com negócio.',
    ].join('\n')

    const classification = classifyAgentAction(
      buildSession({
        phase: 'analysis',
        agentState: {
          parseStatus: 'parsed',
          rewriteHistory: {},
          sourceResumeText: 'Resumo salvo no perfil.',
          targetJobDescription: vacancy,
        },
      }),
      vacancy,
    )

    expect(classification).toEqual({
      actionType: 'job_targeting',
      executionMode: 'async',
      workflowMode: 'job_targeting',
    })
  })

  it('classifies saved-target continuation as async job targeting', () => {
    const classification = classifyAgentAction(buildSession({
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Resumo salvo no perfil.',
        targetJobDescription: 'Senior Analytics Engineer com foco em SQL, dbt e BigQuery.',
      },
    }), 'pode seguir')

    expect(classification).toEqual({
      actionType: 'job_targeting',
      executionMode: 'async',
      workflowMode: 'job_targeting',
    })
  })

  it('keeps a freshly pasted vacancy in dialog on the synchronous acknowledgement path', () => {
    const vacancy = [
      'Analista de BI Senior',
      'Responsabilidades',
      'Construir dashboards em Power BI e integrar dados com SQL.',
      'Requisitos',
      'Power BI, SQL, ETL e comunicação com negócio.',
    ].join('\n')

    const classification = classifyAgentAction(buildSession({
      phase: 'dialog',
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Resumo salvo no perfil.',
        targetJobDescription: vacancy,
      },
    }), vacancy)

    expect(classification).toEqual({
      actionType: 'chat',
      executionMode: 'sync',
      workflowMode: 'job_targeting',
    })
  })

  it('keeps deterministic rewrite requests synchronous', () => {
    const classification = classifyAgentAction(buildSession({
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Resumo salvo no perfil.',
        targetJobDescription: 'Senior Analytics Engineer com foco em SQL, dbt e BigQuery.',
      },
    }), 'reescreva meu resumo')

    expect(classification).toEqual({
      actionType: 'chat',
      executionMode: 'sync',
      workflowMode: 'job_targeting',
    })
  })

  it('classifies resume-only confirmation flows as async ATS enhancement', () => {
    const classification = classifyAgentAction(buildSession({
      phase: 'confirm',
    }), 'Aceito')

    expect(classification).toEqual({
      actionType: 'ats_enhancement',
      executionMode: 'async',
      workflowMode: 'ats_enhancement',
    })
    expect(resolveGenerationPrerequisiteMessage(buildSession())).toContain('Cole a descrição da vaga')
  })
})
