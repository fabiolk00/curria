import type {
  ATSScoreResult,
  CVState,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  GapAnalysisResult,
  Phase,
} from './cv'
import type { AtsReadinessScoreContract } from '@/lib/ats/scoring/types'
import type { CvHighlightState } from '@/lib/resume/cv-highlight-artifact'
import type { ToolErrorCode, ToolFailure } from '@/lib/agent/tool-errors'

export type { Phase }
export type {
  AgentActionType,
  DurableJobDispatchPayload,
  ExecutionMode,
  JobErrorRef,
  JobInputRef,
  JobProgress,
  JobResultRef,
  JobStatus,
  JobStatusSnapshot,
  JobType,
  SyncActionType,
} from './jobs'

export type WorkflowMode =
  | 'resume_review'
  | 'ats_enhancement'
  | 'job_targeting'

export type RewriteStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'
export type AtsWorkflowStage =
  | 'gap_analysis'
  | 'analysis'
  | 'targeting_plan'
  | 'rewrite_plan'
  | 'rewrite_section'
  | 'validation'
  | 'persist_version'

export type AtsWorkflowRun = {
  status: 'idle' | 'running' | 'completed' | 'failed'
  currentStage?: AtsWorkflowStage
  currentSection?: RewriteSectionInput['section']
  attemptCount: number
  retriedSections: RewriteSectionInput['section'][]
  compactedSections: RewriteSectionInput['section'][]
  sectionAttempts: Partial<Record<RewriteSectionInput['section'], number>>
  usageTotals?: {
    sectionAttempts: number
    retriedSections: number
    compactedSections: number
  }
  lastFailureStage?: AtsWorkflowStage
  lastFailureSection?: RewriteSectionInput['section']
  lastFailureReason?: string
  updatedAt: string
}

export type AtsAnalysisSection =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'certifications'

export type AtsAnalysisIssue = {
  code: string
  severity: 'low' | 'medium' | 'high'
  message: string
  section?: AtsAnalysisSection
}

export type AtsAnalysisResult = {
  // Internal heuristic analyzer output only. This is not the ATS Readiness product score.
  overallScore: number
  structureScore: number
  clarityScore: number
  impactScore: number
  keywordCoverageScore: number
  atsReadabilityScore: number
  issues: AtsAnalysisIssue[]
  recommendations: string[]
}

export type RewriteValidationResult = {
  valid: boolean
  issues: Array<{
    severity: 'high' | 'medium'
    message: string
    section?: string
  }>
}

export type TargetingPlan = {
  targetRole: string
  targetRoleConfidence: 'high' | 'low'
  focusKeywords: string[]
  mustEmphasize: string[]
  shouldDeemphasize: string[]
  missingButCannotInvent: string[]
  sectionStrategy: {
    summary: string[]
    experience: string[]
    skills: string[]
    education: string[]
    certifications: string[]
  }
}

export type AgentState = {
  sourceResumeText?: string
  workflowMode?: WorkflowMode
  targetJobDescription?: string
  targetFitAssessment?: TargetFitAssessment
  parseConfidenceScore?: number
  parseStatus: 'empty' | 'attached' | 'parsed' | 'failed'
  parseError?: string
  attachedFile?: {
    mimeType?: ParseFileInput['mime_type']
    receivedAt?: string
  }
  rewriteHistory: Partial<Record<
    RewriteSectionInput['section'],
    {
      rewrittenContent: string
      keywordsAdded: string[]
      changesMade: string[]
      updatedAt: string
    }
  >>
  gapAnalysis?: {
    result: GapAnalysisResult
    analyzedAt: string
  }
  targetingPlan?: TargetingPlan
  atsAnalysis?: {
    result: AtsAnalysisResult
    analyzedAt: string
  }
  atsReadiness?: AtsReadinessScoreContract
  rewriteStatus?: RewriteStatus
  atsWorkflowRun?: AtsWorkflowRun
  optimizedCvState?: CVState
  highlightState?: CvHighlightState
  optimizedAt?: string
  optimizationSummary?: {
    changedSections: RewriteSectionInput['section'][]
    notes: string[]
    keywordCoverageImprovement?: string[]
  }
  lastRewriteMode?: Extract<WorkflowMode, 'ats_enhancement' | 'job_targeting'>
  rewriteValidation?: RewriteValidationResult
  phaseMeta?: {
    analysisCompletedAt?: string
    confirmRequestedAt?: string
    generationConfirmedAt?: string
    careerFitWarningIssuedAt?: string
    careerFitWarningTargetJobDescription?: string
    careerFitOverrideConfirmedAt?: string
    careerFitOverrideTargetJobDescription?: string
  }
}

export type CVVersionSource = 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived'
export type CVVersionScope = 'base' | 'target-derived'
export type ResumeGenerationType = 'ATS_ENHANCEMENT' | 'JOB_TARGETING'
export type ResumeGenerationStatus = 'pending' | 'completed' | 'failed'
export type ResumeGenerationHistoryKind = 'chat' | 'ats_enhancement' | 'target_job'
export type PreviewAccessReason =
  | 'free_trial_locked'
  | 'payment_required'
  | 'manual_source_not_billable'
  | 'full_access'

export type PreviewAccess = {
  locked: boolean
  blurred: boolean
  canViewRealContent: boolean
  requiresUpgrade: boolean
  requiresRegenerationAfterUnlock: boolean
  reason: PreviewAccessReason
  lockedAt?: string
  message?: string
}

export type CVVersion = {
  id: string
  sessionId: string
  targetResumeId?: string
  snapshot: CVState
  source: CVVersionSource
  createdAt: Date
}

export type CVTimelineEntry = CVVersion & {
  label: string
  timestamp: string
  scope: CVVersionScope
}

export type ResumeTarget = {
  id: string
  sessionId: string
  targetJobDescription: string
  derivedCvState: CVState
  gapAnalysis?: GapAnalysisResult
  generatedOutput?: GeneratedOutput
  createdAt: Date
  updatedAt: Date
}

export type ResumeGeneration = {
  id: string
  userId: string
  sessionId?: string
  resumeTargetId?: string
  type: ResumeGenerationType
  status: ResumeGenerationStatus
  idempotencyKey?: string
  historyKind?: ResumeGenerationHistoryKind
  historyTitle?: string
  historyDescription?: string
  targetRole?: string
  targetJobSnippet?: string
  sourceCvSnapshot: CVState
  generatedCvState?: CVState
  outputPdfPath?: string
  outputDocxPath?: string
  failureReason?: string
  errorMessage?: string
  versionNumber: number
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  failedAt?: Date
}

export type CreditConsumption = {
  id: string
  userId: string
  resumeGenerationId: string
  type: ResumeGenerationType
  creditsUsed: number
  createdAt: Date
}

export type GeneratedOutput = {
  status: 'idle' | 'generating' | 'ready' | 'failed'
  docxPath?: string
  pdfPath?: string
  generatedAt?: string
  error?: string
  previewAccess?: PreviewAccess
  staleArtifact?: {
    reason: 'manual_edit_saved_while_export_active'
    staleSince: string
    pendingJobId?: string
  }
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export type Session = {
  id: string
  userId: string
  stateVersion: number
  phase: Phase
  cvState: CVState
  agentState: AgentState
  generatedOutput: GeneratedOutput
  // Internal heuristic diagnostic only. Do not use as the ATS Readiness product score.
  internalHeuristicAtsScore?: ATSScoreResult
  creditsUsed: number
  messageCount: number
  creditConsumed: boolean
  createdAt: Date
  updatedAt: Date
}

export type AgentStatePatch = Partial<Omit<AgentState, 'attachedFile' | 'phaseMeta'>> & {
  attachedFile?: Partial<NonNullable<AgentState['attachedFile']>>
  phaseMeta?: Partial<NonNullable<AgentState['phaseMeta']>>
}

export type ToolPatch = Partial<{
  phase: Session['phase']
  cvState: Partial<CVState>
  agentState: AgentStatePatch
  generatedOutput: Partial<GeneratedOutput>
  // Internal heuristic diagnostic only. Do not use as the ATS Readiness product score.
  internalHeuristicAtsScore: ATSScoreResult
  atsReadiness: AtsReadinessScoreContract
}>

export type TargetFitAssessment = {
  level: 'strong' | 'partial' | 'weak'
  summary: string
  reasons: string[]
  assessedAt: string
}

export type CareerFitCheckpoint = {
  status: 'pending_confirmation'
  targetJobDescription: string
  summary: string
  reasons: string[]
  nextSteps: string[]
  assessedAt: string
}

export type { ToolErrorCode, ToolFailure }

// ── Tool input/output types ───────────────────────────────────────────

export type ParseFileInput = {
  file_base64: string
  mime_type:
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'image/png'
    | 'image/jpeg'
}

export type ParseFileOutput =
  | { success: true; text: string; pageCount: number }
  | ToolFailure

export type ScoreATSInput = {
  resume_text: string
  job_description?: string
}

type ScoreATSOutput =
  | { success: true; result: ATSScoreResult }
  | ToolFailure

export type AnalyzeGapInput = {
  target_job_description: string
}

export type AnalyzeGapOutput =
  | { success: true; result: GapAnalysisResult }
  | ToolFailure

export type ApplyGapActionInput = {
  item_type: 'missing_skill' | 'weak_area' | 'suggestion'
  item_value: string
}

export type ApplyGapActionOutput =
  | ({
      success: true
      section: RewriteSectionInput['section']
      item_type: ApplyGapActionInput['item_type']
      item_value: string
    } & Extract<RewriteSectionOutput, { success: true }>)
  | ToolFailure

export type RewriteSectionInput = {
  section: 'summary' | 'experience' | 'skills' | 'education' | 'certifications'
  current_content: string
  instructions: string
  target_keywords?: string[]
}

export type RewriteSectionData =
  | string
  | string[]
  | ExperienceEntry[]
  | EducationEntry[]
  | CertificationEntry[]

export type RewriteSectionOutput =
  | {
      success: true
      rewritten_content: string
      section_data: RewriteSectionData
      keywords_added: string[]
      changes_made: string[]
    }
  | ToolFailure

export type SetPhaseInput = {
  phase: Phase
  reason?: string
}

type SetPhaseOutput =
  | { success: true; phase: Phase }
  | ToolFailure

export type GenerateFileInput = {
  cv_state: CVState
  target_id?: string
  idempotency_key?: string
}

export type GenerateFileOutput =
  | {
      success: true
      pdfUrl: string | null
      docxUrl?: string | null
      warnings?: string[]
      creditsUsed?: number
      resumeGenerationId?: string
      inProgress?: boolean
    }
  | ToolFailure

export type ManualEditSection = 'contact' | RewriteSectionInput['section']

export type ManualEditSectionData =
  | Pick<CVState, 'fullName' | 'email' | 'phone' | 'linkedin' | 'location'>
  | string
  | string[]
  | ExperienceEntry[]
  | EducationEntry[]
  | CertificationEntry[]

export type ManualEditInput =
  | {
      section: 'contact'
      value: Pick<CVState, 'fullName' | 'email' | 'phone' | 'linkedin' | 'location'>
    }
  | {
      section: 'summary'
      value: string
    }
  | {
      section: 'skills'
      value: string[]
    }
  | {
      section: 'experience'
      value: ExperienceEntry[]
    }
  | {
      section: 'education'
      value: EducationEntry[]
    }
  | {
      section: 'certifications'
      value: CertificationEntry[]
    }

export type ResumeEditorSaveInput =
  | {
      scope: 'base'
      cvState: CVState
    }
  | {
      scope: 'optimized'
      cvState: CVState
    }
  | {
      scope: 'target'
      targetId: string
      cvState: CVState
    }

export type ManualEditOutput =
  | {
      success: true
      section: ManualEditSection
      section_data: ManualEditSectionData
    }
  | ToolFailure

export type ResumeEditorSaveOutput =
    | {
        success: true
        changed: boolean
        scope: 'base' | 'optimized' | 'target'
        targetId?: string
        artifactRefreshDeferred?: boolean
        artifactStalePreserved?: boolean
      }
  | ToolFailure
  | ToolFailure

export type CreateTargetResumeInput = {
  target_job_description: string
}

type CreateTargetResumeOutput =
  | {
      success: true
      targetId: string
      targetJobDescription: string
      derivedCvState: CVState
      gapAnalysis?: GapAnalysisResult
    }
  | ToolFailure

// ── Agent API request/response ────────────────────────────────────────

type AgentRequest = {
  sessionId: string
  message: string
  file?: string   // base64
  fileMime?: ParseFileInput['mime_type']
}

export type AgentSessionCreatedChunk = {
  type: 'sessionCreated'
  sessionId: string
}

export type AgentTextChunk = {
  type: 'text'
  content: string
}

export type AgentToolStartChunk = {
  type: 'toolStart'
  toolName: string
}

export type AgentToolResultChunk = {
  type: 'toolResult'
  toolName: string
  output: unknown
}

export type AgentPatchChunk = {
  type: 'patch'
  patch: ToolPatch
  phase: Phase
}

export type AgentDoneChunk = {
  type: 'done'
  sessionId: string
  phase: Phase
  // Internal heuristic diagnostic only. Product UI must prefer atsReadiness.
  internalHeuristicAtsScore?: ATSScoreResult
  // Deprecated compatibility field. Do not use as the ATS Readiness product score.
  atsScore?: ATSScoreResult
  atsReadiness?: AtsReadinessScoreContract
  messageCount?: number
  maxMessages?: number
  isNewSession?: boolean
  requestId?: string
  toolIterations?: number
}

export type AgentErrorChunk = {
  type: 'error'
  error: string
  code?: ToolErrorCode
  action?: string
  messageCount?: number
  maxMessages?: number
  upgradeUrl?: string
  requestId?: string
}

export type AgentStreamChunk =
  | AgentSessionCreatedChunk
  | AgentTextChunk
  | AgentToolStartChunk
  | AgentToolResultChunk
  | AgentPatchChunk
  | AgentDoneChunk
  | AgentErrorChunk
