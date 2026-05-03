import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
import type { TargetingPlan } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

export type ShadowGapAnalysisSource = 'provided' | 'synthetic' | 'real_llm'

export type ShadowBatchRunConfig = {
  allowLlm: boolean
  useRealGapAnalysis: boolean
  includeRewriteValidation: boolean
  dryRunRewriteValidation?: boolean
  persist: boolean
  concurrency: number
  limit?: number
  inputPathHash?: string
  totalInputCases?: number
  confirmLlmCost?: boolean
  maxLlmCases?: number
  maxEstimatedCostUsd?: number
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
}

export type JobTargetingShadowCase = {
  id: string
  source: 'real_anonymized' | 'synthetic' | 'golden' | 'manual_review'
  domain?: string
  cvState: CVState
  targetJobDescription: string
  gapAnalysis?: GapAnalysisResult
  expected?: {
    notes?: string
    knownStrongSignals?: string[]
    knownGaps?: string[]
    shouldNotClaim?: string[]
  }
  metadata?: {
    originalSessionId?: string
    createdAt?: string
    anonymized: boolean
  }
}

export type ShadowLegacySnapshot = {
  score?: number
  lowFitTriggered?: boolean
  unsupportedCount?: number
  criticalGaps?: string[]
}

export type ShadowAssessmentSnapshot = {
  score: number
  lowFitTriggered: boolean
  supportedCount: number
  adjacentCount: number
  unsupportedCount: number
  forbiddenClaimCount: number
  criticalGaps: string[]
  reviewNeededGaps: string[]
  assessmentVersion: string
  scoreVersion: string
  catalogVersion: string
}

export type ShadowComparisonSnapshot = {
  scoreDelta: number
  lowFitDelta: boolean
  criticalGapDelta: number
  unsupportedDelta: number
}

export type ShadowValidationSnapshot = {
  executed: boolean
  mode?: 'real_llm' | 'dry_run'
  blocked: boolean
  issueTypes: string[]
  factualViolation: boolean
  generatedClaimTraceCount?: number
  missingTraceCount?: number
  rewriteSucceeded?: boolean
  errorCode?: string
  safeErrorCode?: string
  rewriteErrorCode?: string
  rewriteErrorMessage?: string
  failedSection?: string
  retryAttempted?: boolean
  fallbackUsed?: boolean
  cacheHit?: boolean
  hasOptimizedCvState?: boolean
  hasSectionRewritePlans?: boolean
  traceFallbackUsed?: boolean
}

export type ShadowLlmUsageSnapshot = {
  gapAnalysisCalled: boolean
  rewriteCalled: boolean
  cacheHit: boolean
  cacheHits?: number
  cacheMisses?: number
  estimatedCostUsd: number
  actualInputTokens?: number
  actualOutputTokens?: number
  actualCostUsd?: number
}

export type ShadowBatchResult = {
  caseId: string
  domain?: string
  source?: JobTargetingShadowCase['source']
  gapAnalysisSource: ShadowGapAnalysisSource
  runConfig: ShadowBatchRunConfig
  legacy: ShadowLegacySnapshot
  assessment: ShadowAssessmentSnapshot
  comparison: ShadowComparisonSnapshot
  validation?: ShadowValidationSnapshot
  llmUsage?: ShadowLlmUsageSnapshot
  runtime: {
    startedAt: string
    completedAt: string
    latencyMs: number
    success: boolean
    error?: string
  }
}

export type ShadowBatchLegacyContext = {
  targetingPlan: TargetingPlan
  score: number
}

export type ShadowComparisonPersistenceInput = {
  userId?: string
  sessionId?: string
  caseId?: string
  source?: string
  legacy: ShadowLegacySnapshot
  assessment: JobCompatibilityAssessment
}
