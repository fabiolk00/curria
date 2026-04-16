import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runPreLoopSetup, shouldEmitExistingSessionPreparationProgress } from './pre-loop-setup'
import { dispatchTool } from '@/lib/agent/tools'
import { incrementMessageCount, updateSession } from '@/lib/db/sessions'
import { logInfo } from '@/lib/observability/structured-log'
import type { Session } from '@/types/agent'

vi.mock('@/lib/agent/tools', () => ({
  dispatchTool: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  incrementMessageCount: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

function buildSession(overrides?: Partial<Session>): Session {
  return {
    id: 'sess_preloop',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog',
    cvState: {
      fullName: 'Fabio Silva',
      email: 'fabio@example.com',
      phone: '11999999999',
      summary: 'Analista de dados com foco em BI.',
      experience: [],
      skills: ['SQL'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      sourceResumeText: 'Resumo salvo em perfil.',
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

function createTimingTracker() {
  const stages: string[] = []

  return {
    stages,
    timing: {
      async runStage<T>(stageName: string, work: () => Promise<T>): Promise<T> {
        stages.push(stageName)
        return work()
      },
    },
  }
}

describe('pre-loop-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({ success: true }))
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(updateSession).mockResolvedValue(undefined)
  })

  it('appends file-attachment context before incrementing the message count', async () => {
    const session = buildSession({
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
    })
    const { stages, timing } = createTimingTracker()

    const nextMessage = await runPreLoopSetup({
      session,
      message: '',
      file: 'base64data',
      fileMime: 'application/pdf',
      appUserId: 'usr_123',
      requestId: 'req_file',
      timing,
      isNewSession: true,
    })

    expect(nextMessage).toContain('anexado')
    expect(stages).toEqual([
      'file_attachment_new',
      'workflow_mode_new',
      'increment_message_new',
    ])
    expect(updateSession).toHaveBeenCalledWith('sess_preloop', {
      agentState: expect.objectContaining({
        workflowMode: 'resume_review',
      }),
    })
    expect(session.agentState.workflowMode).toBe('resume_review')
    expect(incrementMessageCount).toHaveBeenCalledWith('sess_preloop')
  })

  it('keeps resume-only confirmation setup lightweight and does not mutate cvState inline', async () => {
    const session = buildSession({
      phase: 'confirm',
    })
    const cvStateBefore = structuredClone(session.cvState)
    const { timing } = createTimingTracker()

    await runPreLoopSetup({
      session,
      message: 'Aceito',
      appUserId: 'usr_123',
      requestId: 'req_ats',
      timing,
      isNewSession: false,
    })

    expect(session.agentState.workflowMode).toBe('ats_enhancement')
    expect(session.cvState).toEqual(cvStateBefore)
    expect(logInfo).toHaveBeenCalledWith('agent.pre_loop.prepared', expect.objectContaining({
      sessionId: 'sess_preloop',
      workflowMode: 'ats_enhancement',
    }))
  })

  it('keeps job-targeting setup lightweight when resume context and target job are both present', async () => {
    const session = buildSession({
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Resumo salvo em perfil.',
        targetJobDescription: 'Senior Analytics Engineer com foco em SQL, dbt e BigQuery.',
        rewriteStatus: 'pending',
      },
    })
    const { timing } = createTimingTracker()

    await runPreLoopSetup({
      session,
      message: 'Continue',
      appUserId: 'usr_123',
      requestId: 'req_target',
      timing,
      isNewSession: false,
    })

    expect(session.agentState.workflowMode).toBe('job_targeting')
    expect(incrementMessageCount).toHaveBeenCalledWith('sess_preloop')
    expect(logInfo).toHaveBeenCalledWith('agent.pre_loop.prepared', expect.objectContaining({
      sessionId: 'sess_preloop',
      workflowMode: 'job_targeting',
    }))
  })

  it('only emits preparation progress for file attachments now that heavy setup moved out of band', () => {
    const targetingSession = buildSession({
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Resumo salvo em perfil.',
        targetJobDescription: 'Senior Analytics Engineer com foco em SQL, dbt e BigQuery.',
        rewriteStatus: 'pending',
      },
    })

    expect(shouldEmitExistingSessionPreparationProgress(targetingSession, 'Continue', false)).toBe(false)
    expect(shouldEmitExistingSessionPreparationProgress(targetingSession, 'Continue', true)).toBe(true)
    expect(vi.mocked(logInfo)).not.toHaveBeenCalled()
  })
})
