import type { GeneratedOutput, ResumeTarget, Session, WorkflowMode } from '@/types/agent'

export type AgentContextWorkflowMode =
  | WorkflowMode
  | 'chat_lightweight'
  | 'artifact_support'

export type AgentContextActionType =
  | 'chat'
  | 'analyze_resume'
  | 'rewrite_resume_for_ats'
  | 'rewrite_resume_for_job_target'
  | 'validate_rewrite'
  | 'explain_changes'
  | 'prepare_generation_support'

export type AgentContextBlockKey =
  | 'preloaded_resume'
  | 'session_phase'
  | 'session_state'
  | 'workflow_rules'
  | 'action_contract'
  | 'output_contract'
  | 'canonical_resume'
  | 'optimized_resume'
  | 'resume_text'
  | 'target_job'
  | 'analysis_snapshot'
  | 'validation_snapshot'
  | 'rewrite_history'
  | 'generated_output'
  | 'profile_audit'
  | 'career_fit_guardrail'

export type AgentContextBlock = {
  key: AgentContextBlockKey
  heading: string
  body: string
  minChars?: number
}

export type AgentContextDebug = {
  workflowMode: AgentContextWorkflowMode
  actionType: AgentContextActionType
  sessionPhase: Session['phase']
  selectedSnapshotSource: 'base' | 'optimized' | 'target_derived' | 'none'
  includedBlocks: AgentContextBlockKey[]
  includesTargetJob: boolean
  includesOptimizedCvState: boolean
  includesGeneratedOutput: boolean
  includesValidation: boolean
  includesOutputSchema: boolean
}

export type AgentContextResumeTarget = Pick<
  ResumeTarget,
  'id' | 'sessionId' | 'targetJobDescription' | 'derivedCvState' | 'generatedOutput'
>

export type BuildAgentContextInput = {
  session: Session
  userMessage?: string
  workflowMode?: AgentContextWorkflowMode
  actionType?: AgentContextActionType
  resumeTarget?: AgentContextResumeTarget | null
  generatedOutputOverride?: GeneratedOutput
}

export type AgentContextResult = {
  systemPrompt: string
  debug: AgentContextDebug
}
