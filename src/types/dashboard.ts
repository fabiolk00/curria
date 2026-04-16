import type {
  AtsAnalysisResult,
  AtsWorkflowRun,
  GeneratedOutput,
  Phase,
  ResumeGenerationType,
  RewriteStatus,
  TargetingPlan,
  WorkflowMode,
} from '@/types/agent'
import type {
  ATSScoreResult,
  CVState,
  CVStateDiff,
  GapAnalysisResult,
} from '@/types/cv'

type SerializedTimelineEntry = {
  id: string
  sessionId: string
  targetResumeId?: string
  snapshot: CVState
  source: 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived'
  label: string
  timestamp: string
  scope: 'base' | 'target-derived'
  createdAt: string
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
      gapAnalysis?: {
        result: GapAnalysisResult
        analyzedAt: string
      }
      targetingPlan?: TargetingPlan
      atsAnalysis?: {
        result: AtsAnalysisResult
        analyzedAt: string
      }
      atsWorkflowRun?: AtsWorkflowRun
      rewriteStatus?: RewriteStatus
      optimizedCvState?: CVState
      optimizedAt?: string
      optimizationSummary?: {
        changedSections: Array<'summary' | 'experience' | 'skills' | 'education' | 'certifications'>
        notes: string[]
        keywordCoverageImprovement?: string[]
      }
      lastRewriteMode?: 'ats_enhancement' | 'job_targeting'
      rewriteValidation?: {
        valid: boolean
        issues: Array<{
          severity: 'high' | 'medium'
          message: string
          section?: string
        }>
      }
    }
    generatedOutput: GeneratedOutput
    atsScore?: ATSScoreResult
    messageCount: number
    creditConsumed: boolean
    createdAt: string
    updatedAt: string
  }
  targets: SerializedResumeTarget[]
}

export type GenerateResumeResponse = {
  success: true
  scope: 'base' | 'target'
  targetId?: string
  creditsUsed: number
  generationType: ResumeGenerationType
  resumeGenerationId?: string
}

export type ResumeComparisonResponse = {
  sessionId: string
  workflowMode?: WorkflowMode
  generationType: ResumeGenerationType
  targetJobDescription?: string
  originalCvState: CVState
  optimizedCvState: CVState
  optimizationSummary?: {
    changedSections: Array<'summary' | 'experience' | 'skills' | 'education' | 'certifications'>
    notes: string[]
    keywordCoverageImprovement?: string[]
  }
  originalScore: {
    total: number
    label: string
  }
  optimizedScore: {
    total: number
    label: string
  }
}

type CompareSnapshotRef =
  | { kind: 'base' }
  | { kind: 'version'; id: string }
  | { kind: 'target'; id: string }

type CompareSnapshotsResponse = {
  sessionId: string
  left: {
    kind: 'base' | 'version' | 'target'
    id?: string
    label: string
    source?: 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived' | 'target'
    timestamp?: string
  }
  right: {
    kind: 'base' | 'version' | 'target'
    id?: string
    label: string
    source?: 'ingestion' | 'rewrite' | 'manual' | 'ats-enhancement' | 'job-targeting' | 'target-derived' | 'target'
    timestamp?: string
  }
  diff: CVStateDiff
}
