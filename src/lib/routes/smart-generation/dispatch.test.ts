import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchSmartGenerationArtifact } from './dispatch'
import { dispatchToolWithContext } from '@/lib/agent/tools'

vi.mock('@/lib/agent/ats-enhancement-pipeline', () => ({
  runAtsEnhancementPipeline: vi.fn(),
}))

vi.mock('@/lib/agent/job-targeting-pipeline', () => ({
  runJobTargetingPipeline: vi.fn(),
}))

vi.mock('@/lib/agent/tools', () => ({
  dispatchToolWithContext: vi.fn(async () => ({
    output: { success: true },
    outputJson: '{"success":true}',
  })),
}))

describe('smart-generation dispatch', () => {
  const optimizedCvState = {
    fullName: 'Ana',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Resumo otimizado',
    experience: [],
    skills: ['Qlik'],
    education: [],
  }
  const patchedSession = {
    id: 'sess_1',
    userId: 'usr_1',
    phase: 'intake',
    stateVersion: 1,
    cvState: optimizedCvState,
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
    },
    generatedOutput: { status: 'idle' },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends target_id to generate_file for job-targeting artifacts', async () => {
    await dispatchSmartGenerationArtifact({
      workflowMode: 'job_targeting',
      patchedSession,
      optimizedCvState,
      idempotencyKey: 'idem_1',
      targetId: 'target_1',
    })

    expect(dispatchToolWithContext).toHaveBeenCalledWith(
      'generate_file',
      {
        cv_state: optimizedCvState,
        idempotency_key: 'idem_1',
        target_id: 'target_1',
      },
      patchedSession,
    )
  })

  it('fails explicitly when job-targeting dispatch has no target_id', async () => {
    const result = await dispatchSmartGenerationArtifact({
      workflowMode: 'job_targeting',
      patchedSession,
      optimizedCvState,
      idempotencyKey: 'idem_1',
    })

    expect(result.outputFailure).toEqual(expect.objectContaining({
      error: 'Job-targeting artifact generation requires a target_id handoff.',
      code: 'PRECONDITION_FAILED',
    }))
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })
})
