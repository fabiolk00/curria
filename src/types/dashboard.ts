import type {
  AtsAnalysisResult,
  AtsWorkflowRun,
  GeneratedOutput,
  JobProgress,
  JobStatusSnapshot,
  JobTargetingExplanation,
  CareerFitCheckpoint,
  Phase,
  PreviewAccessReason,
  RewriteValidationResult,
  ResumeGenerationType,
  RewriteStatus,
  RecoverableValidationBlock,
  TargetingPlan,
  WorkflowMode,
} from '@/types/agent'
import type {
  ATSScoreResult,
  CVStateDiff,
  CVState,
  GapAnalysisResult,
} from '@/types/cv'
import type { BillingHistoryResponse as SerializedBillingHistoryResponse } from '@/types/billing'
import type { AtsReadinessScoreContract } from '@/lib/ats/scoring/types'
import type { ResumeGenerationHistoryResponse as SerializedResumeGenerationHistoryResponse } from '@/lib/resume-history/resume-generation-history.types'
import type { CvHighlightState } from '@/lib/resume/cv-highlight-artifact'
import type { PlanSlug } from '@/lib/plans'

export type PreviewLockSummary = {
  locked: true
  blurred: true
  reason: Exclude<PreviewAccessReason, 'full_access'>
  requiresUpgrade: boolean
  requiresPaidRegeneration: boolean
  message: string
}

type SerializedTimelineEntry = {
  id: string
  sessionId: string
  targetResumeId?: string
  snapshot?: CVState
  source: 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived'
  label: string
  timestamp: string
  scope: 'base' | 'target-derived'
  createdAt: string
  previewLocked: boolean
  blurred: boolean
  canViewRealContent: boolean
  requiresUpgrade: boolean
  requiresRegenerationAfterUnlock: boolean
  previewLock?: PreviewLockSummary
}

export type SerializedResumeTarget = {
  id: string
  sessionId: string
  targetJobDescription: string
  derivedCvState: CVState
  gapAnalysis?: GapAnalysisResult
  generatedOutput?: GeneratedOutput
  createdAt: string
  updatedAt: string
}

export type JobApplicationStatus = 'entrevista' | 'aguardando' | 'sem_retorno' | 'negativa'

export type JobApplicationBenefit = {
  name: string
  value?: string
}

export type JobApplication = {
  id: string
  userId: string
  role: string
  company: string
  status: JobApplicationStatus
  salary?: string
  location?: string
  benefits: JobApplicationBenefit[]
  resumeVersionLabel: string
  jobDescription?: string
  notes?: string
  appliedAt: Date
  createdAt: Date
  updatedAt: Date
}

export type SerializedJobApplication = Omit<
  JobApplication,
  'appliedAt' | 'createdAt' | 'updatedAt'
> & {
  appliedAt: string
  createdAt: string
  updatedAt: string
}

export type JobApplicationFormInput = {
  role: string
  company: string
  status: JobApplicationStatus
  salary?: string
  location?: string
  benefits: JobApplicationBenefit[]
  resumeVersionLabel: string
  jobDescription?: string
  notes?: string
  appliedAt?: string
}

export type CreateJobApplicationInput = {
  userId: string
  role: string
  company: string
  status?: JobApplicationStatus
  salary?: string
  location?: string
  benefits?: JobApplicationBenefit[]
  resumeVersionLabel: string
  jobDescription?: string
  notes?: string
  appliedAt?: Date | string
}

export type UpdateJobApplicationInput = Partial<{
  role: string
  company: string
  status: JobApplicationStatus
  salary: string
  location: string
  benefits: JobApplicationBenefit[]
  resumeVersionLabel: string
  jobDescription: string
  notes: string
  appliedAt: Date | string
}>

export type JobApplicationSummary = {
  total: number
  byStatus: Record<JobApplicationStatus, number>
}

export type SessionWorkspace = {
  session: {
    id: string
    phase: Phase
    stateVersion: number
    cvState: CVState
    agentState: {
      workflowMode?: WorkflowMode
      parseStatus: 'empty' | 'attached' | 'parsed' | 'failed'
      parseError?: string
      parseConfidenceScore?: number
      targetJobDescription?: string
      targetFitAssessment?: {
        level: 'strong' | 'partial' | 'weak'
        summary: string
        reasons: string[]
        assessedAt: string
      }
      careerFitCheckpoint?: CareerFitCheckpoint | null
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
      atsWorkflowRun?: AtsWorkflowRun
      rewriteStatus?: RewriteStatus
      optimizedCvState?: CVState
      highlightState?: CvHighlightState
      jobTargetingExplanation?: JobTargetingExplanation
      optimizedAt?: string
      optimizationSummary?: {
        changedSections: Array<'summary' | 'experience' | 'skills' | 'education' | 'certifications'>
        notes: string[]
        keywordCoverageImprovement?: string[]
      }
      lastRewriteMode?: 'ats_enhancement' | 'job_targeting'
      rewriteValidation?: RewriteValidationResult
      recoverableValidationBlock?: RecoverableValidationBlock
    }
    generatedOutput: GeneratedOutput
    atsReadiness?: AtsReadinessScoreContract
    // Legacy raw heuristic diagnostic field kept only for compatibility. Main product surfaces must read atsReadiness instead.
    atsScore?: ATSScoreResult
    messageCount: number
    creditConsumed: boolean
    createdAt: string
    updatedAt: string
  }
  jobs: JobStatusSnapshot[]
  targets: SerializedResumeTarget[]
}

export type GenerateResumeResponse = {
  success: true
  scope: 'base' | 'target'
  targetId?: string
  creditsUsed: number
  generationType: ResumeGenerationType
  jobId: string
  inProgress?: boolean
  resumeGenerationId?: string
}

export type ArtifactStatusSummary = {
  generationStatus: GeneratedOutput['status']
  jobId?: string
  stage?: string
  progress?: JobProgress
  errorMessage?: string
  artifactStale?: {
    reason: 'manual_edit_saved_while_export_active'
    message: string
    staleSince?: string
    pendingJobId?: string
  }
  previewLock?: PreviewLockSummary
  reconciliation?: {
    required: boolean
    status: 'pending' | 'manual_review' | 'repaired'
    reason?: string
  }
}

export type DownloadUrlsResponse = {
  docxUrl: string | null
  pdfUrl: string | null
  pdfFileName?: string | null
  available: boolean
  generationStatus: ArtifactStatusSummary['generationStatus']
  jobId?: string
  stage?: string
  progress?: JobProgress
  errorMessage?: string
  artifactStale?: ArtifactStatusSummary['artifactStale']
  previewLock?: PreviewLockSummary
  reconciliation?: ArtifactStatusSummary['reconciliation']
}

export type BillingHistoryResponse = SerializedBillingHistoryResponse
export type ResumeGenerationHistoryResponse = SerializedResumeGenerationHistoryResponse

export type BillingSummaryResponse = {
  currentCredits: number
  maxCredits?: number
  currentPlan?: PlanSlug | null
  activeRecurringPlan?: PlanSlug | null
  billingNotice?: string | null
}

export type ResumeComparisonResponse = {
  sessionId: string
  workflowMode?: WorkflowMode
  generationType: ResumeGenerationType
  targetJobDescription?: string
  originalCvState: CVState
  optimizedCvState: CVState
  highlightState?: CvHighlightState
  jobTargetingExplanation?: JobTargetingExplanation
  previewLock?: PreviewLockSummary
  optimizationSummary?: {
    changedSections: Array<'summary' | 'experience' | 'skills' | 'education' | 'certifications'>
    notes: string[]
    keywordCoverageImprovement?: string[]
  }
}

type CompareSnapshotRef =
  | { kind: 'base' }
  | { kind: 'version'; id: string }
  | { kind: 'target'; id: string }

type CompareSnapshotsResponse = {
  sessionId: string
  locked?: boolean
  reason?: 'preview_locked'
  left: {
    kind: 'base' | 'version' | 'target'
    id?: string
    label: string
    source?: 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived' | 'target'
    timestamp?: string
    previewLocked?: boolean
    previewLock?: PreviewLockSummary
  }
  right: {
    kind: 'base' | 'version' | 'target'
    id?: string
    label: string
    source?: 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived' | 'target'
    timestamp?: string
    previewLocked?: boolean
    previewLock?: PreviewLockSummary
  }
  diff?: CVStateDiff
}
