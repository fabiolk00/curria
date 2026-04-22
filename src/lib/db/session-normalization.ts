import type {
  AgentState,
  AgentStatePatch,
  GeneratedOutput,
  Phase,
  Session,
  ToolPatch,
} from '@/types/agent'
import { CVStateSchema } from '@/lib/cv/schema'
import { normalizeCvHighlightState } from '@/lib/resume/cv-highlight-artifact'
import type { ATSScoreResult, CVState } from '@/types/cv'

// Increment only when the top-level session state bundle shape or interpretation changes.
export const CURRENT_SESSION_STATE_VERSION = 2

const EMPTY_CV_STATE: CVState = {
  fullName: '',
  email: '',
  phone: '',
  summary: '',
  experience: [],
  skills: [],
  education: [],
}

const EMPTY_AGENT_STATE: AgentState = {
  parseStatus: 'empty',
  rewriteHistory: {},
}

const EMPTY_GENERATED_OUTPUT: GeneratedOutput = {
  status: 'idle',
}

export type SessionRow = {
  id: string
  user_id: string
  state_version?: number | null
  phase: string
  cv_state: unknown
  agent_state: unknown
  generated_output: unknown
  ats_score: ATSScoreResult | null
  credits_used: number
  message_count?: number | null
  credit_consumed?: boolean | null
  created_at: string
  updated_at: string
}

export function cloneCvState(value?: CVState): CVState {
  if (!value) {
    return {
      ...EMPTY_CV_STATE,
      experience: [],
      skills: [],
      education: [],
    }
  }

  return {
    ...value,
    experience: Array.isArray(value.experience) ? [...value.experience] : [],
    skills: Array.isArray(value.skills) ? [...value.skills] : [],
    education: Array.isArray(value.education) ? [...value.education] : [],
    certifications: Array.isArray(value.certifications) ? [...value.certifications] : undefined,
  }
}

export function normalizeAgentState(value: unknown): AgentState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...EMPTY_AGENT_STATE,
      rewriteHistory: {},
    }
  }

  return {
    ...EMPTY_AGENT_STATE,
    ...(value as Partial<AgentState>),
    highlightState: normalizeCvHighlightState((value as Partial<AgentState>).highlightState),
    rewriteHistory: {
      ...EMPTY_AGENT_STATE.rewriteHistory,
      ...((value as Partial<AgentState>).rewriteHistory ?? {}),
    },
  }
}

export function normalizeGeneratedOutput(value: unknown): GeneratedOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...EMPTY_GENERATED_OUTPUT,
    }
  }

  return {
    ...EMPTY_GENERATED_OUTPUT,
    ...(value as Partial<GeneratedOutput>),
  }
}

export function normalizeStateVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return CURRENT_SESSION_STATE_VERSION
  }

  return value
}

export function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    stateVersion: normalizeStateVersion(row.state_version),
    phase: row.phase as Phase,
    cvState: cloneCvState(row.cv_state == null ? EMPTY_CV_STATE : CVStateSchema.parse(row.cv_state)),
    agentState: normalizeAgentState(row.agent_state),
    generatedOutput: normalizeGeneratedOutput(row.generated_output),
    internalHeuristicAtsScore: row.ats_score ?? undefined,
    creditsUsed: row.credits_used,
    messageCount: row.message_count ?? 0,
    creditConsumed: row.credit_consumed ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mergeAgentState(current: AgentState, patch: AgentStatePatch): AgentState {
  return {
    ...current,
    ...patch,
    attachedFile:
      patch.attachedFile === undefined
        ? current.attachedFile
        : {
            ...(current.attachedFile ?? {}),
            ...patch.attachedFile,
          },
    rewriteHistory: {
      ...current.rewriteHistory,
      ...(patch.rewriteHistory ?? {}),
    },
    phaseMeta:
      patch.phaseMeta === undefined
        ? current.phaseMeta
        : {
            ...(current.phaseMeta ?? {}),
            ...patch.phaseMeta,
          },
  }
}

export function mergeToolPatch(session: Session, patch: ToolPatch): Session {
  const nextCvState =
    patch.cvState === undefined
      ? cloneCvState(session.cvState)
      : cloneCvState({
          ...session.cvState,
          ...patch.cvState,
        })

  const nextAgentState =
    patch.agentState === undefined
      ? normalizeAgentState(session.agentState)
      : normalizeAgentState(mergeAgentState(session.agentState, patch.agentState))

  if (patch.atsReadiness !== undefined) {
    nextAgentState.atsReadiness = patch.atsReadiness
  }

  const nextGeneratedOutput =
    patch.generatedOutput === undefined
      ? normalizeGeneratedOutput(session.generatedOutput)
      : normalizeGeneratedOutput({
          ...session.generatedOutput,
          ...patch.generatedOutput,
        })

  return {
    ...session,
    stateVersion: session.stateVersion,
    phase: patch.phase ?? session.phase,
    cvState: nextCvState,
    agentState: nextAgentState,
    generatedOutput: nextGeneratedOutput,
    internalHeuristicAtsScore: patch.internalHeuristicAtsScore ?? session.internalHeuristicAtsScore,
    updatedAt: new Date(),
  }
}
