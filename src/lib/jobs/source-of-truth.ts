import type { ResumeGeneration, ResumeTarget } from '@/types/agent'
import type { JobInputRef, JobResultRef } from '@/types/jobs'
import type { CVState } from '@/types/cv'

type SessionResumeSource = {
  id: string
  cvState: CVState
  agentState: {
    optimizedCvState?: CVState
  }
}
type ResumeTargetSource = Pick<ResumeTarget, 'id' | 'sessionId' | 'derivedCvState'>
type ResumeGenerationSource = Pick<
  ResumeGeneration,
  'id' | 'sessionId' | 'resumeTargetId' | 'versionNumber'
>

export type ResolvedResumeSource = {
  cvState: CVState
  ref: JobInputRef
}

export function resolveCanonicalResumeSource(
  session: SessionResumeSource,
): ResolvedResumeSource {
  return {
    cvState: structuredClone(session.cvState),
    ref: {
      kind: 'session_cv_state',
      sessionId: session.id,
      snapshotSource: 'base',
    },
  }
}

export function resolveEffectiveResumeSource(
  session: SessionResumeSource,
  resumeTarget?: ResumeTargetSource | null,
): ResolvedResumeSource {
  if (resumeTarget) {
    return {
      cvState: structuredClone(resumeTarget.derivedCvState),
      ref: {
        kind: 'resume_target_cv_state',
        sessionId: resumeTarget.sessionId,
        resumeTargetId: resumeTarget.id,
        snapshotSource: 'target_derived',
      },
    }
  }

  if (session.agentState.optimizedCvState) {
    return {
      cvState: structuredClone(session.agentState.optimizedCvState),
      ref: {
        kind: 'session_cv_state',
        sessionId: session.id,
        snapshotSource: 'optimized',
      },
    }
  }

  return resolveCanonicalResumeSource(session)
}

export function buildSnapshotResultRef(input: {
  sessionId: string
  resumeTargetId?: string
  snapshotSource: 'base' | 'optimized' | 'target_derived'
}): JobResultRef {
  if (input.snapshotSource === 'target_derived') {
    if (!input.resumeTargetId) {
      throw new Error('Target-derived snapshot refs require a resumeTargetId.')
    }

    return {
      kind: 'resume_target_cv_state',
      sessionId: input.sessionId,
      resumeTargetId: input.resumeTargetId,
      snapshotSource: 'target_derived',
    }
  }

  return {
    kind: 'session_cv_state',
    sessionId: input.sessionId,
    snapshotSource: input.snapshotSource,
  }
}

export function buildResumeGenerationResultRef(
  generation: ResumeGenerationSource,
  snapshotSource: 'source' | 'generated' = 'generated',
): JobResultRef {
  return {
    kind: 'resume_generation',
    resumeGenerationId: generation.id,
    sessionId: generation.sessionId ?? undefined,
    resumeTargetId: generation.resumeTargetId ?? undefined,
    versionNumber: generation.versionNumber,
    snapshotSource,
  }
}
