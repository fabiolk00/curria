import { logInfo } from '@/lib/observability/structured-log'
import type { CVState } from '@/types/cv'

import { extractResumeEvidence } from './evidence-extraction'
import { extractJobRequirements } from './requirement-extraction'
import {
  classifyRequirementsWithLlm,
  type LlmRequirementResolver,
} from './llm-matcher'

export async function runJobCompatibilityLlmShadow(input: {
  cvState: CVState
  targetJobDescription: string
  userId?: string
  sessionId?: string
  resolver?: LlmRequirementResolver
}): Promise<void> {
  const requirements = extractJobRequirements({ targetJobDescription: input.targetJobDescription })
  const resumeEvidence = extractResumeEvidence(input.cvState)
  const result = await classifyRequirementsWithLlm({
    requirements,
    resumeEvidence,
    userId: input.userId,
    sessionId: input.sessionId,
    resolver: input.resolver,
  })
  const supported = result.requirements.filter((requirement) => requirement.productGroup === 'supported').length
  const adjacent = result.requirements.filter((requirement) => requirement.productGroup === 'adjacent').length
  const unsupported = result.requirements.filter((requirement) => requirement.productGroup === 'unsupported').length

  logInfo('job_targeting.matcher.llm.shadow_completed', {
    workflowMode: 'job_targeting',
    userId: input.userId,
    sessionId: input.sessionId,
    requirements: requirements.length,
    supported,
    adjacent,
    unsupported,
    fallbackCount: result.metrics.fallbackCount,
    lowConfidenceCount: result.metrics.lowConfidenceCount,
    costUsd: result.metrics.costUsd,
    sessionWallClockLatencyMs: result.metrics.sessionWallClockLatencyMs,
  })
}
