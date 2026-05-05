import { logInfo } from '@/lib/observability/structured-log'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'

import {
  buildJobCompatibilityAssessmentFromRequirements,
  type CompatibilityGapAnalysisInput,
} from './assessment'
import { extractResumeEvidence } from './evidence-extraction'
import { extractJobRequirements } from './requirement-extraction'
import {
  classifyRequirementsWithLlm,
  type LlmRequirementResolver,
} from './llm-matcher'
import {
  JOB_MATCHER_LLM_MODEL,
  JOB_MATCHER_PROMPT_VERSION,
} from './llm-config'

type JobCompatibilityLlmAssessmentInput = {
  cvState: CVState
  targetJobDescription: string
  gapAnalysis?: CompatibilityGapAnalysisInput
  userId?: string
  sessionId?: string
  resolver?: LlmRequirementResolver
}

async function evaluateJobCompatibilityWithLlm(input: JobCompatibilityLlmAssessmentInput): Promise<{
  assessment: JobCompatibilityAssessment
  requirementsCount: number
  fallbackCount: number
  lowConfidenceCount: number
  costUsd: number
  sessionWallClockLatencyMs: number
}> {
  const requirements = extractJobRequirements({ targetJobDescription: input.targetJobDescription })
  const resumeEvidence = extractResumeEvidence(input.cvState)
  const result = await classifyRequirementsWithLlm({
    requirements,
    resumeEvidence,
    userId: input.userId,
    sessionId: input.sessionId,
    resolver: input.resolver,
  })

  const assessment = buildJobCompatibilityAssessmentFromRequirements({
    targetJobDescription: input.targetJobDescription,
    requirements: result.requirements,
    resumeEvidenceCount: resumeEvidence.length,
    gapAnalysis: input.gapAnalysis,
    catalog: {
      catalogIds: [],
      catalogVersions: {},
    },
    matcherVersion: JOB_MATCHER_PROMPT_VERSION,
    auditWarnings: [
      ...(result.metrics.fallbackCount > 0 ? ['llm_requirement_fallbacks_present'] : []),
      ...(result.metrics.lowConfidenceCount > 0 ? ['llm_low_confidence_reclassifications_present'] : []),
    ],
    userId: input.userId,
    sessionId: input.sessionId,
  })

  return {
    assessment,
    requirementsCount: requirements.length,
    fallbackCount: result.metrics.fallbackCount,
    lowConfidenceCount: result.metrics.lowConfidenceCount,
    costUsd: result.metrics.costUsd,
    sessionWallClockLatencyMs: result.metrics.sessionWallClockLatencyMs,
  }
}

export async function runJobCompatibilityLlmAssessment(
  input: JobCompatibilityLlmAssessmentInput,
): Promise<JobCompatibilityAssessment> {
  return (await evaluateJobCompatibilityWithLlm(input)).assessment
}

export async function runJobCompatibilityLlmShadow(input: JobCompatibilityLlmAssessmentInput): Promise<void> {
  const result = await evaluateJobCompatibilityWithLlm(input)
  const supported = result.assessment.supportedRequirements.length
  const adjacent = result.assessment.adjacentRequirements.length
  const unsupported = result.assessment.unsupportedRequirements.length

  logInfo('job_targeting.matcher.llm.shadow_completed', {
    workflowMode: 'job_targeting',
    userId: input.userId,
    sessionId: input.sessionId,
    model: JOB_MATCHER_LLM_MODEL,
    promptVersion: JOB_MATCHER_PROMPT_VERSION,
    requirements: result.requirementsCount,
    supported,
    adjacent,
    unsupported,
    fallbackCount: result.fallbackCount,
    lowConfidenceCount: result.lowConfidenceCount,
    costUsd: result.costUsd,
    sessionWallClockLatencyMs: result.sessionWallClockLatencyMs,
  })
}
