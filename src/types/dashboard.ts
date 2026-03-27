import type { GeneratedOutput, Phase } from '@/types/agent'
import type {
  ATSScoreResult,
  CVState,
  CVStateDiff,
  GapAnalysisResult,
} from '@/types/cv'

export type SerializedTimelineEntry = {
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

export type CompareSnapshotRef =
  | { kind: 'base' }
  | { kind: 'version'; id: string }
  | { kind: 'target'; id: string }

export type CompareSnapshotsResponse = {
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
