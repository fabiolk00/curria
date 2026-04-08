import type {
  ATSScoreResult,
  CVState,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  GapAnalysisResult,
  Phase,
} from './cv'
import type { ToolErrorCode, ToolFailure } from '@/lib/agent/tool-errors'

export type { Phase }

export type AgentState = {
  sourceResumeText?: string
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
  phaseMeta?: {
    analysisCompletedAt?: string
    confirmRequestedAt?: string
    generationConfirmedAt?: string
  }
}

export type CVVersionSource = 'ingestion' | 'rewrite' | 'manual' | 'target-derived'
export type CVVersionScope = 'base' | 'target-derived'

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

export type GeneratedOutput = {
  status: 'idle' | 'generating' | 'ready' | 'failed'
  docxPath?: string
  pdfPath?: string
  generatedAt?: string
  error?: string
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
  atsScore?: ATSScoreResult
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
  atsScore: ATSScoreResult
}>

export type TargetFitAssessment = {
  level: 'strong' | 'partial' | 'weak'
  summary: string
  reasons: string[]
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

export type ScoreATSOutput =
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

export type SetPhaseOutput =
  | { success: true; phase: Phase }
  | ToolFailure

export type GenerateFileInput = {
  cv_state: CVState
  target_id?: string
}

export type GenerateFileOutput =
  | { success: true; docxUrl: string; pdfUrl: string }
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

export type ManualEditOutput =
  | {
      success: true
      section: ManualEditSection
      section_data: ManualEditSectionData
    }
  | ToolFailure

export type CreateTargetResumeInput = {
  target_job_description: string
}

export type CreateTargetResumeOutput =
  | {
      success: true
      targetId: string
      targetJobDescription: string
      derivedCvState: CVState
      gapAnalysis?: GapAnalysisResult
    }
  | ToolFailure

// ── Agent API request/response ────────────────────────────────────────

export type AgentRequest = {
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
  atsScore?: ATSScoreResult
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
