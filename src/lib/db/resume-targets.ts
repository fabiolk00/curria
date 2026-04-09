import { CVStateSchema, GapAnalysisResultSchema } from '@/lib/cv/schema'
import { normalizeGeneratedOutput } from '@/lib/db/sessions'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type { GapAnalysisResult } from '@/types/cv'
import type { GeneratedOutput, ResumeTarget } from '@/types/agent'
import type { CVState } from '@/types/cv'

type ResumeTargetRow = {
  id: string
  session_id: string
  target_job_description: string
  derived_cv_state: unknown
  gap_analysis?: unknown
  generated_output?: unknown
  created_at: string
  updated_at: string
}

function cloneCvState(snapshot: CVState): CVState {
  return structuredClone(snapshot)
}

function cloneGapAnalysis(gapAnalysis?: GapAnalysisResult): GapAnalysisResult | undefined {
  return gapAnalysis ? structuredClone(gapAnalysis) : undefined
}

function cloneGeneratedOutput(generatedOutput?: GeneratedOutput): GeneratedOutput | undefined {
  return generatedOutput ? structuredClone(generatedOutput) : undefined
}

function mapResumeTargetRow(row: ResumeTargetRow): ResumeTarget {
  return {
    id: row.id,
    sessionId: row.session_id,
    targetJobDescription: row.target_job_description,
    derivedCvState: cloneCvState(CVStateSchema.parse(row.derived_cv_state)),
    gapAnalysis: row.gap_analysis === undefined || row.gap_analysis === null
      ? undefined
      : cloneGapAnalysis(GapAnalysisResultSchema.parse(row.gap_analysis)),
    generatedOutput: row.generated_output === undefined || row.generated_output === null
      ? undefined
      : cloneGeneratedOutput(normalizeGeneratedOutput(row.generated_output)),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export async function createResumeTarget(input: {
  sessionId: string
  userId: string
  targetJobDescription: string
  derivedCvState: CVState
  gapAnalysis?: GapAnalysisResult
}): Promise<ResumeTarget> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.rpc('create_resume_target_with_version', {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_target_job_description: input.targetJobDescription,
    p_derived_cv_state: cloneCvState(input.derivedCvState),
    p_gap_analysis: cloneGapAnalysis(input.gapAnalysis) ?? null,
  })

  if (error || !data) {
    throw new Error(`Failed to create resume target: ${error?.message}`)
  }

  return mapResumeTargetRow(data as ResumeTargetRow)
}

export async function updateResumeTargetCvStateWithVersion(input: {
  sessionId: string
  userId: string
  targetId: string
  derivedCvState: CVState
}): Promise<ResumeTarget> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.rpc('update_resume_target_with_version', {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_target_id: input.targetId,
    p_derived_cv_state: cloneCvState(input.derivedCvState),
  })

  if (error || !data) {
    throw new Error(`Failed to update resume target: ${error?.message}`)
  }

  return mapResumeTargetRow(data as ResumeTargetRow)
}

export async function getResumeTargetsForSession(sessionId: string): Promise<ResumeTarget[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('resume_targets')
    .select('*')
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: false })
    .returns<ResumeTargetRow[]>()

  if (error || !data) {
    throw new Error(`Failed to load resume targets: ${error?.message}`)
  }

  return data.map(mapResumeTargetRow)
}

export async function getResumeTargetForSession(sessionId: string, targetId: string): Promise<ResumeTarget | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('resume_targets')
    .select('*')
    .eq('session_id', sessionId)
    .eq('id', targetId)
    .maybeSingle<ResumeTargetRow>()

  if (error) {
    throw new Error(`Failed to load resume target: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapResumeTargetRow(data)
}

export async function updateResumeTargetGeneratedOutput(
  sessionId: string,
  targetId: string,
  generatedOutput: GeneratedOutput,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('resume_targets')
    .update({
      generated_output: cloneGeneratedOutput(generatedOutput) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('id', targetId)

  if (error) {
    throw new Error(`Failed to update resume target artifacts: ${error.message}`)
  }
}
