import type { GeneratedOutput, Phase, ResumeGenerationType } from '@/types/agent'
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
  source: 'ingestion' | 'rewrite' | 'manual' | 'target-derived'
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
      parseStatus: 'empty' | 'attached' | 'parsed' | 'failed'
      parseError?: string
      parseConfidenceScore?: number
      targetJobDescription?: string
      gapAnalysis?: {
        result: GapAnalysisResult
        analyzedAt: string
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
    source?: 'ingestion' | 'rewrite' | 'manual' | 'target-derived' | 'target'
    timestamp?: string
  }
  right: {
    kind: 'base' | 'version' | 'target'
    id?: string
    label: string
    source?: 'ingestion' | 'rewrite' | 'manual' | 'target-derived' | 'target'
    timestamp?: string
  }
  diff: CVStateDiff
}
