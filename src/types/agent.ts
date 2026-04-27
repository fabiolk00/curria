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

export type ValidationIssue = {
  severity: 'high' | 'medium'
  message: string
  section?: string
  issueType?:
    | 'unsupported_claim'
    | 'unsupported_skill'
    | 'target_role_overclaim'
    | 'low_fit_target_role'
    | 'seniority_inflation'
    | 'ungrounded_bridge'
    | 'forbidden_claim'
    | 'summary_skill_without_evidence'
  offendingSignal?: string
  offendingText?: string
  evidenceLevel?: EvidenceLevel
  rewritePermission?: RewritePermission
  suggestedReplacement?: string
  userFacingTitle?: string
  userFacingExplanation?: string
}

export type RewriteValidationResult = {
  blocked: boolean
  valid: boolean
  hardIssues: ValidationIssue[]
  softWarnings: ValidationIssue[]
  issues: ValidationIssue[]
  recoverable?: boolean
  promotedWarnings?: Array<{
    from: 'soft'
    to: 'recoverable_hard'
    issueType: string
    reason: string
  }>
}

export type EvidenceLevel =
  | 'explicit'
  | 'normalized_alias'
  | 'technical_equivalent'
  | 'strong_contextual_inference'
  | 'semantic_bridge_only'
  | 'unsupported_gap'

export type RewritePermission =
  | 'can_claim_directly'
  | 'can_claim_normalized'
  | 'can_bridge_carefully'
  | 'can_mention_as_related_context'
  | 'must_not_claim'

export type TargetEvidence = {
  jobSignal: string
  canonicalSignal: string
  evidenceLevel: EvidenceLevel
  rewritePermission: RewritePermission
  matchedResumeTerms: string[]
  supportingResumeSpans: string[]
  rationale: string
  confidence: number
  allowedRewriteForms: string[]
  forbiddenRewriteForms: string[]
  validationSeverityIfViolated: 'none' | 'warning' | 'major' | 'critical'
}

export type BridgeClaimInstruction = {
  jobSignal: string
  safeBridge: string
  doNotSay: string[]
}

export type SafeTargetingEmphasis = {
  safeDirectEmphasis: string[]
  cautiousBridgeEmphasis: Array<{
    jobSignal: string
    safeWording: string
    supportingTerms: string[]
    forbiddenWording: string[]
  }>
  forbiddenDirectClaims: string[]
}

export type CoreRequirement = {
  signal: string
  importance: 'core' | 'secondary' | 'differential'
  evidenceLevel: EvidenceLevel
  rewritePermission: RewritePermission
}

export type CoreRequirementCoverage = {
  requirements: CoreRequirement[]
  total: number
  supported: number
  unsupported: number
  unsupportedSignals: string[]
}

export type LowFitWarningGate = {
  triggered: boolean
  reason?:
    | 'very_low_match_score'
    | 'too_many_unsupported_core_requirements'
    | 'target_role_not_supported'
    | 'explicit_evidence_too_low'
    | 'high_risk_off_target'
  matchScore: number
  riskLevel?: CareerFitRiskLevel
  familyDistance?: 'same' | 'adjacent' | 'distant' | 'unknown'
  explicitEvidenceCount: number
  unsupportedGapCount: number
  unsupportedGapRatio: number
  explicitEvidenceRatio: number
  coreRequirementCoverage: {
    total: number
    supported: number
    unsupported: number
    unsupportedSignals: string[]
  }
}

export type TargetRoleClaimPermission =
  | 'can_claim_target_role'
  | 'can_bridge_to_target_role'
  | 'must_not_claim_target_role'

export type TargetRolePositioning = {
  targetRole: string
  permission: TargetRoleClaimPermission
  reason: string
  safeRolePositioning: string
  forbiddenRoleClaims: string[]
}

export type TargetedRewritePermissions = {
  directClaimsAllowed: string[]
  normalizedClaimsAllowed: string[]
  bridgeClaimsAllowed: BridgeClaimInstruction[]
  relatedButNotClaimable: string[]
  forbiddenClaims: string[]
  skillsSurfaceAllowed: string[]
}

export type TargetingPlan = {
  targetRole: string
  targetRoleConfidence: 'high' | 'medium' | 'low'
  targetRoleSource: 'heuristic' | 'llm' | 'fallback'
  focusKeywords: string[]
  mustEmphasize: string[]
  shouldDeemphasize: string[]
  missingButCannotInvent: string[]
  targetEvidence?: TargetEvidence[]
  rewritePermissions?: TargetedRewritePermissions
  safeTargetingEmphasis?: SafeTargetingEmphasis
  coreRequirementCoverage?: CoreRequirementCoverage
  lowFitWarningGate?: LowFitWarningGate
  targetRolePositioning?: TargetRolePositioning
  sectionStrategy: {
    summary: string[]
    experience: string[]
    skills: string[]
    education: string[]
    certifications: string[]
  }
}

export type ValidationOverrideMetadata = {
  enabled: boolean
  acceptedAt: string
  acceptedByUserId: string
  validationIssueCount: number
  hardIssueCount: number
  issueTypes: string[]
  targetRole?: string
}

export type BlockedTargetedRewriteDraft = {
  id: string
  token: string
  sessionId: string
  userId: string
  optimizedCvState: CVState
  originalCvState: CVState
  optimizationSummary?: {
    changedSections: RewriteSectionInput['section'][]
    notes: string[]
    keywordCoverageImprovement?: string[]
  }
  targetJobDescription: string
  targetRole?: string
  validationIssues: ValidationIssue[]
  recoverable: boolean
  createdAt: string
  expiresAt: string
}

export type UserFacingValidationModalPayload = {
  title: string
  description: string
  primaryProblem: string
  problemBullets: string[]
  reassurance: string
  recommendation?: string
  actions: {
    secondary: {
      label: 'Fechar'
      action: 'close'
    }
    primary?: {
      label: 'Gerar mesmo assim (1 crédito)'
      action: 'override_generate'
      creditCost: 1
    }
  }
}

export type RecoverableValidationBlock = {
  status: 'validation_blocked_recoverable'
  overrideToken: string
  modal: UserFacingValidationModalPayload
  expiresAt: string
}

export type AgentState = {
  sourceResumeText?: string
  workflowMode?: WorkflowMode
  targetJobDescription?: string
  targetFitAssessment?: TargetFitAssessment
  careerFitEvaluation?: CareerFitEvaluation
  extractionWarning?: 'low_confidence_role'
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
  blockedTargetedRewriteDraft?: BlockedTargetedRewriteDraft
  validationOverride?: ValidationOverrideMetadata
  recoverableValidationBlock?: RecoverableValidationBlock
  phaseMeta?: {
    analysisCompletedAt?: string
    confirmRequestedAt?: string
    generationConfirmedAt?: string
    careerFitWarningIssuedAt?: string
    careerFitRiskLevelAtWarning?: CareerFitRiskLevel
    careerFitWarningJDFingerprint?: string
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
  metadata?: Record<string, unknown>
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

export type CareerFitRiskLevel = 'low' | 'medium' | 'high'

export type CareerFitEvaluation = {
  riskLevel: CareerFitRiskLevel
  needsExplicitConfirmation: boolean
  summary: string
  reasons: string[]
  riskPoints: number
  assessedAt: string
  signals: {
    matchScore?: number
    missingSkillsCount?: number
    weakAreasCount?: number
    familyDistance?: 'same' | 'adjacent' | 'distant' | 'unknown'
    seniorityGapMajor: boolean
  }
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
  careerFitCheckpoint?: CareerFitCheckpoint | null
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
