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
  }
  highlight?: {
    gate: 'allowed' | 'blocked_validation_failed' | 'blocked_unchanged_cv_state'
    generated: boolean
    highlightSource?: 'job_targeting' | 'ats_enhancement'
    jobKeywordsCount: number
  }
  error?: string
}
