import { describe, expect, it } from 'vitest'

import { resolveJobTargetingEngineVersion } from '@/lib/agent/job-targeting-pipeline'
import { getJobCompatibilityAssessmentMode } from '@/lib/agent/job-targeting/compatibility/feature-flags'
import type { Session } from '@/types/agent'

function buildSession(agentState: Partial<Session['agentState']> = {}): Session {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'intake',
    cvState: {
      fullName: 'Ana',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo',
      experience: [],
      skills: [],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      ...agentState,
    },
    generatedOutput: { status: 'idle' },
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date('2026-05-04T00:00:00.000Z'),
    updatedAt: new Date('2026-05-04T00:00:00.000Z'),
  }
}

describe('job targeting engine version', () => {
  it('assigns canonical-v1 for new sessions only after source-of-truth cutover is approved', () => {
    const mode = getJobCompatibilityAssessmentMode({
      JOB_COMPATIBILITY_ASSESSMENT_ENABLED: 'true',
      JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE: 'false',
      JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH: 'true',
      JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED: 'true',
    })

    expect(resolveJobTargetingEngineVersion(buildSession(), mode)).toBe('canonical-v1')
  })

  it('treats undefined engineVersion on running sessions as legacy-v1', () => {
    const mode = getJobCompatibilityAssessmentMode({
      JOB_COMPATIBILITY_ASSESSMENT_ENABLED: 'true',
      JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE: 'false',
      JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH: 'true',
      JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED: 'true',
    })

    expect(resolveJobTargetingEngineVersion(buildSession({
      atsWorkflowRun: {
        status: 'running',
        attemptCount: 1,
        retriedSections: [],
        compactedSections: [],
        sectionAttempts: {},
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    }), mode)).toBe('legacy-v1')
  })

  it('keeps a recorded canonical running session canonical during rollback', () => {
    const rollbackMode = getJobCompatibilityAssessmentMode({
      JOB_COMPATIBILITY_ASSESSMENT_ENABLED: 'true',
      JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE: 'true',
      JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH: 'false',
      JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED: 'true',
    })

    expect(resolveJobTargetingEngineVersion(buildSession({
      jobTargetingEngineVersion: 'canonical-v1',
      atsWorkflowRun: {
        status: 'running',
        attemptCount: 1,
        retriedSections: [],
        compactedSections: [],
        sectionAttempts: {},
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    }), rollbackMode)).toBe('canonical-v1')
    expect(resolveJobTargetingEngineVersion(buildSession(), rollbackMode)).toBe('legacy-v1')
  })
})
