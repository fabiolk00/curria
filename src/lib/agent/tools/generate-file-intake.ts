import { TOOL_ERROR_CODES, toolFailure, type ToolFailure } from '@/lib/agent/tool-errors'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import { resolveEffectiveResumeSource } from '@/lib/jobs/source-of-truth'
import { BILLABLE_CV_VERSION_SOURCES } from '@/lib/resume-generation/generate-billable-resume'
import type { GenerateFileInput, Session } from '@/types/agent'
import type { CVState } from '@/types/cv'

export type GenerateFileSourceScope = 'base' | 'optimized' | 'target'

export type GenerateFileExecutionContext = {
  sessionId: string
  appUserId: string
  sourceScope: GenerateFileSourceScope
  targetId?: string
  idempotencyKey?: string
  requestedCvState: GenerateFileInput['cv_state']
  resolvedCvState: CVState
  latestAllowedVersionId?: string | null
  templateTargetSource: Session['agentState'] | string | undefined
}

export type GenerateFileExecutionDiagnostics = {
  sessionId: string
  appUserId: string
  targetId?: string
  resolvedSourceScope: GenerateFileSourceScope
  requestedCvStateProvided: boolean
  payloadMatchesResolvedSource: boolean
  latestVersionId?: string | null
  latestVersionSource?: string | null
  latestVersionFound: boolean
}

type GenerateFileExecutionContextResult =
  | { kind: 'ok'; context: GenerateFileExecutionContext; diagnostics: GenerateFileExecutionDiagnostics }
  | { kind: 'error'; failure: ToolFailure; diagnostics: GenerateFileExecutionDiagnostics }

function areCvStatesEqual(left: CVState, right: CVState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function resolveGenerateFileSourceScope(
  effectiveSource: ReturnType<typeof resolveEffectiveResumeSource>,
): GenerateFileSourceScope {
  if (effectiveSource.ref.snapshotSource === 'target_derived') {
    return 'target'
  }

  if (effectiveSource.ref.snapshotSource === 'optimized') {
    return 'optimized'
  }

  return 'base'
}

function buildGenerateFileMismatchMessage(sourceScope: GenerateFileSourceScope): string {
  switch (sourceScope) {
    case 'optimized':
      return 'The requested resume snapshot no longer matches the authoritative optimized source for this session.'
    case 'target':
      return 'The requested resume snapshot no longer matches the authoritative target resume source for this session.'
    case 'base':
      return 'The requested resume snapshot no longer matches the authoritative base resume source for this session.'
    default:
      return 'The requested resume snapshot no longer matches the authoritative resume source for this session.'
  }
}

export async function resolveGenerateFileExecutionContext(
  input: GenerateFileInput,
  session: Session,
): Promise<GenerateFileExecutionContextResult> {
  const targetId = typeof input.target_id === 'string' ? input.target_id : undefined
  const idempotencyKey = typeof input.idempotency_key === 'string' ? input.idempotency_key : undefined
  const target = targetId
    ? await getResumeTargetForSession(session.id, targetId)
    : null

  if (targetId && !target) {
    const diagnostics: GenerateFileExecutionDiagnostics = {
      sessionId: session.id,
      appUserId: session.userId,
      targetId,
      resolvedSourceScope: 'target',
      requestedCvStateProvided: input.cv_state !== undefined,
      payloadMatchesResolvedSource: false,
      latestVersionId: null,
      latestVersionSource: null,
      latestVersionFound: false,
    }

    return {
      kind: 'error',
      failure: toolFailure(TOOL_ERROR_CODES.NOT_FOUND, 'Target resume not found.'),
      diagnostics,
    }
  }

  const effectiveSource = resolveEffectiveResumeSource(session, target)
  const sourceScope = resolveGenerateFileSourceScope(effectiveSource)
  const payloadMatchesResolvedSource = areCvStatesEqual(input.cv_state, effectiveSource.cvState)
  const latestCvVersion = await getLatestCvVersionForScope(session.id, targetId)
  const diagnostics: GenerateFileExecutionDiagnostics = {
    sessionId: session.id,
    appUserId: session.userId,
    targetId,
    resolvedSourceScope: sourceScope,
    requestedCvStateProvided: input.cv_state !== undefined,
    payloadMatchesResolvedSource,
    latestVersionId: latestCvVersion?.id ?? null,
    latestVersionSource: latestCvVersion?.source ?? null,
    latestVersionFound: latestCvVersion !== null && latestCvVersion !== undefined,
  }

  if (!payloadMatchesResolvedSource) {
    return {
      kind: 'error',
      failure: toolFailure(
        TOOL_ERROR_CODES.GENERATE_FILE_SESSION_SOURCE_MISMATCH,
        buildGenerateFileMismatchMessage(sourceScope),
      ),
      diagnostics,
    }
  }

  if (!latestCvVersion || !BILLABLE_CV_VERSION_SOURCES.has(latestCvVersion.source)) {
    return {
      kind: 'error',
      failure: toolFailure(
        TOOL_ERROR_CODES.GENERATE_FILE_LATEST_VERSION_MISSING,
        'Gere uma nova versão otimizada pela IA antes de exportar este currículo.',
      ),
      diagnostics,
    }
  }

  return {
    kind: 'ok',
    context: {
      sessionId: session.id,
      appUserId: session.userId,
      sourceScope,
      targetId,
      idempotencyKey,
      requestedCvState: input.cv_state,
      resolvedCvState: effectiveSource.cvState,
      latestAllowedVersionId: latestCvVersion.id,
      templateTargetSource: target?.targetJobDescription ?? session.agentState,
    },
    diagnostics,
  }
}
