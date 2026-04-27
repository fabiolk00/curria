import type { EvidenceLevel } from '@/types/agent'

export type JobTargetingTrace = {
  sessionId: string
  userId: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'failed' | 'blocked'
  extraction?: {
    targetRole: string
    targetRoleConfidence: 'high' | 'medium' | 'low'
    targetRoleSource: 'heuristic' | 'llm' | 'fallback'
    extractionWarning?: 'low_confidence_role'
    jobKeywordsCount: number
    targetEvidenceCount?: number
    evidenceLevelCounts?: Partial<Record<EvidenceLevel, number>>
  }
  gapAnalysis?: {
    matchScore: number
    missingSkillsCount: number
    weakAreasCount: number
    repairAttempted: boolean
  }
  rewrite?: {
    sectionsAttempted: string[]
    sectionsChanged: string[]
    sectionsRetried: string[]
    sectionsCompacted: string[]
    skippedReason?: 'pre_rewrite_low_fit_block'
    summaryRetryAttempted?: boolean
    summaryRetrySucceeded?: boolean
    summaryRetryReason?: string
  }
  validation?: {
    blocked: boolean
    hardIssuesCount: number
    softWarningsCount: number
    hardIssues: Array<{
      section?: string
      message: string
    }>
    softWarnings: Array<{
      section?: string
      message: string
    }>
    failureStage?: string
    recoverable?: boolean
    promotedWarnings?: Array<{
      from: 'soft'
      to: 'recoverable_hard'
      issueType: string
      reason: string
    }>
  }
  lowFitGate?: {
    evaluated: boolean
    triggered: boolean
    reason?: string
    acceptedByUser?: boolean
    blockingSkipped?: boolean
    matchScore: number
    riskLevel?: string
    familyDistance?: string
    explicitEvidenceCount: number
    unsupportedGapCount: number
    unsupportedGapRatio: number
    explicitEvidenceRatio: number
    preRewriteBlocked?: boolean
    preRewriteBlockReason?: string
    coreRequirementCoverage: {
      total: number
      supported: number
      unsupported: number
      unsupportedSignals: string[]
      topUnsupportedSignalsForDisplay: string[]
    }
  }
  highlight?: {
    gate: 'allowed' | 'blocked_validation_failed' | 'blocked_unchanged_cv_state' | 'blocked_low_fit' | 'skipped_after_override'
    generated: boolean
    highlightSource?: 'job_targeting' | 'ats_enhancement'
    jobKeywordsCount: number
  }
  error?: string
}
