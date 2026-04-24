import { createHash } from 'crypto'

import { TOOL_ERROR_CODES, type ToolErrorCode, toolFailure } from '@/lib/agent/tool-errors'
import {
  createSignedResumeArtifactUrlsBestEffort,
  generateFile,
  validateGenerationCvState,
  type GenerateFileExecutionResult,
} from '@/lib/agent/tools/generate-file'
import {
  checkUserQuota,
  consumeCreditForGeneration,
  finalizeCreditReservation,
  getUserBillingPlan,
  releaseCreditReservation,
  reserveCreditForGenerationIntent,
} from '@/lib/asaas/quota'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
import { markCreditReservationReconciliation } from '@/lib/db/credit-reservations'
import {
  applyPreviewAccessToGeneratedOutput,
  applyPreviewAccessToPatch,
  assertNoRealArtifactForLockedPreview,
  buildLockedPreviewAccess,
  buildLockedPreviewPdfUrl,
  canViewRealPreview,
} from '@/lib/generated-preview/locked-preview'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import {
  createPendingResumeGeneration,
  getLatestCompletedResumeGenerationForScope,
  getResumeGenerationByIdempotencyKey,
  PendingResumeGenerationPersistenceError,
  updateResumeGeneration,
} from '@/lib/db/resume-generations'
import { buildResumeGenerationHistoryMetadata } from '@/lib/resume-history/resume-generation-history'
import type { ResumeGenerationHistoryContext } from '@/lib/resume-history/resume-generation-history.types'
import { getSession } from '@/lib/db/sessions'
import { resolveExportGenerationConfig } from '@/lib/jobs/config'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { getRequestQueryContext } from '@/lib/observability/request-query-context'
import { logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import { withTimedOperation } from '@/lib/observability/timed-operation'
import type {
  GenerateFileInput,
  GenerateFileOutput,
  GeneratedOutput,
  ResumeGeneration,
  ResumeGenerationType,
  ToolPatch,
} from '@/types/agent'

type ArtifactScope =
  | { type: 'session' }
  | { type: 'target'; targetId: string }

export type BillableResumeStage =
  | 'validate_cv_state'
  | 'lookup_completed_generation'
  | 'lookup_idempotent_generation'
  | 'lookup_latest_version'
  | 'reuse_pending_generation'
  | 'create_pending_generation'
  | 'reserve_credit'
  | 'render_artifact'
  | 'release_credit'
  | 'finalize_credit'
  | 'persist_completed_generation'
  | 'persist_failed_generation'
  | 'reconciliation_marking'

type BillableGenerationResult = {
  output: GenerateFileOutput
  patch?: ToolPatch
  generatedOutput?: GeneratedOutput
  resumeGeneration?: ResumeGeneration
  processingStage?: string
  needsReconciliation?: boolean
}

type ResumeGenerationPersistenceResult = {
  resumeGeneration?: ResumeGeneration
  resumeGenerationId?: string
}

type BillableStageFailureMetric =
  | 'architecture.generate_resume.stage_failure.lookup_completed_generation'
  | 'architecture.generate_resume.stage_failure.lookup_idempotent_generation'
  | 'architecture.generate_resume.stage_failure.lookup_latest_version'
  | 'architecture.generate_resume.stage_failure.reuse_pending_generation'
  | 'architecture.generate_resume.stage_failure.create_pending_generation'
  | 'architecture.generate_resume.stage_failure.reserve_credit'
  | 'architecture.generate_resume.stage_failure.render_artifact'
  | 'architecture.generate_resume.stage_failure.finalize_credit'
  | 'architecture.generate_resume.stage_failure.release_credit'
  | 'architecture.generate_resume.stage_failure.persist_completed_generation'
  | 'architecture.generate_resume.stage_failure.persist_failed_generation'
  | 'architecture.generate_resume.stage_failure.reconciliation_marking'

type BillableStageState = {
  currentStage: BillableResumeStage
  generationIntentKey?: string
  resumeGenerationId?: string
}

type BillableStageContext = {
  userId: string
  sessionId: string
  targetId?: string
  generationType: ResumeGenerationType
}

type BillableStageQuerySnapshot = {
  requestId?: string
  queryCount: number
}

type BillableResumeErrorInput = {
  code: ToolErrorCode
  message: string
  billableStage: BillableResumeStage
  resumeGenerationId?: string
  generationIntentKey?: string
  cause?: unknown
}

export const BILLABLE_CV_VERSION_SOURCES = new Set(['rewrite', 'ats-enhancement', 'job-targeting', 'target-derived'])

const BILLABLE_STAGE_FAILURE_METRICS: Readonly<Record<BillableResumeStage, BillableStageFailureMetric>> = {
  validate_cv_state: 'architecture.generate_resume.stage_failure.lookup_latest_version',
  lookup_completed_generation: 'architecture.generate_resume.stage_failure.lookup_completed_generation',
  lookup_idempotent_generation: 'architecture.generate_resume.stage_failure.lookup_idempotent_generation',
  lookup_latest_version: 'architecture.generate_resume.stage_failure.lookup_latest_version',
  reuse_pending_generation: 'architecture.generate_resume.stage_failure.reuse_pending_generation',
  create_pending_generation: 'architecture.generate_resume.stage_failure.create_pending_generation',
  reserve_credit: 'architecture.generate_resume.stage_failure.reserve_credit',
  render_artifact: 'architecture.generate_resume.stage_failure.render_artifact',
  release_credit: 'architecture.generate_resume.stage_failure.release_credit',
  finalize_credit: 'architecture.generate_resume.stage_failure.finalize_credit',
  persist_completed_generation: 'architecture.generate_resume.stage_failure.persist_completed_generation',
  persist_failed_generation: 'architecture.generate_resume.stage_failure.persist_failed_generation',
  reconciliation_marking: 'architecture.generate_resume.stage_failure.reconciliation_marking',
}

export class BillableResumeError extends Error {
  readonly code: ToolErrorCode
  readonly billableStage: BillableResumeStage
  readonly resumeGenerationId?: string
  readonly generationIntentKey?: string

  constructor(input: BillableResumeErrorInput) {
    super(input.message, input.cause ? { cause: input.cause } : undefined)
    this.name = 'BillableResumeError'
    this.code = input.code
    this.billableStage = input.billableStage
    this.resumeGenerationId = input.resumeGenerationId
    this.generationIntentKey = input.generationIntentKey
  }
}

export function getBillableResumeErrorMetadata(error: unknown): {
  billableStage?: BillableResumeStage
  resumeGenerationId?: string
  generationIntentKey?: string
} {
  if (error instanceof BillableResumeError) {
    return {
      billableStage: error.billableStage,
      resumeGenerationId: error.resumeGenerationId,
      generationIntentKey: error.generationIntentKey,
    }
  }

  if (typeof error !== 'object' || error === null) {
    return {}
  }

  const candidate = error as {
    billableStage?: unknown
    resumeGenerationId?: unknown
    generationIntentKey?: unknown
  }

  return {
    billableStage: typeof candidate.billableStage === 'string'
      ? candidate.billableStage as BillableResumeStage
      : undefined,
    resumeGenerationId: typeof candidate.resumeGenerationId === 'string'
      ? candidate.resumeGenerationId
      : undefined,
    generationIntentKey: typeof candidate.generationIntentKey === 'string'
      ? candidate.generationIntentKey
      : undefined,
  }
}

function buildBillableStageLogFields(
  context: BillableStageContext,
  state: BillableStageState,
  stage: BillableResumeStage,
): Record<string, string | undefined> {
  return {
    sessionId: context.sessionId,
    appUserId: context.userId,
    targetId: context.targetId,
    generationType: context.generationType,
    generationIntentKey: state.generationIntentKey,
    resumeGenerationId: state.resumeGenerationId,
    stage,
  }
}

function captureBillableStageQuerySnapshot(): BillableStageQuerySnapshot {
  const requestQueryContext = getRequestQueryContext()

  return {
    requestId: requestQueryContext?.requestId,
    queryCount: requestQueryContext?.queryCount ?? 0,
  }
}

function buildBillableStageQueryLogFields(
  started: BillableStageQuerySnapshot,
): {
  requestId?: string
  stageQueryCount?: number
  requestQueryCount?: number
} {
  const requestQueryContext = getRequestQueryContext()
  if (!requestQueryContext) {
    return {}
  }

  return {
    requestId: requestQueryContext.requestId,
    stageQueryCount: Math.max(0, requestQueryContext.queryCount - started.queryCount),
    requestQueryCount: requestQueryContext.queryCount,
  }
}

function wrapBillableResumeError(
  error: unknown,
  input: Omit<BillableResumeErrorInput, 'message'> & { message?: string },
): BillableResumeError {
  if (error instanceof BillableResumeError) {
    return error
  }

  const fallbackMessage = error instanceof Error
    ? error.message
    : 'Billable resume generation failed.'

  return new BillableResumeError({
    ...input,
    message: input.message ?? fallbackMessage,
    cause: error,
  })
}

function getBillableFailureReason(error: unknown): string {
  if (error instanceof BillableResumeError && error.cause instanceof Error) {
    return error.cause.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolvePendingGenerationFailureCode(
  error: PendingResumeGenerationPersistenceError,
): ToolErrorCode {
  if (error.dbCode === '23505') {
    return TOOL_ERROR_CODES.GENERATE_RESUME_PENDING_GENERATION_CONSTRAINT_FAILED
  }

  return error.operation === 'reuse'
    ? TOOL_ERROR_CODES.GENERATE_RESUME_PENDING_GENERATION_REUSE_FAILED
    : TOOL_ERROR_CODES.GENERATE_RESUME_PENDING_GENERATION_CREATE_FAILED
}

function logPendingGenerationPersistenceFailure(input: {
  userId: string
  sessionId: string
  targetId?: string
  generationIntentKey?: string
  resumeGenerationId?: string
  latestVersionId?: string
  sourceScope?: string
  branch: 'create' | 'reuse'
  error: PendingResumeGenerationPersistenceError
}): void {
  logWarn('resume_generation.pending_generation.persistence_failed', {
    sessionId: input.sessionId,
    appUserId: input.userId,
    targetId: input.targetId,
    generationIntentKey: input.generationIntentKey,
    resumeGenerationId: input.resumeGenerationId,
    latestVersionId: input.latestVersionId,
    sourceScope: input.sourceScope,
    branch: input.branch,
    errorName: input.error.name,
    errorMessage: input.error.message,
    errorCause: input.error.causeMessage,
    dbCode: input.error.dbCode,
    dbDetails: input.error.dbDetails,
    dbHint: input.error.dbHint,
  })
}

function recordBillableStageFailure(
  context: BillableStageContext,
  state: BillableStageState,
  stage: BillableResumeStage,
  failureCode: ToolErrorCode,
): void {
  recordMetricCounter(BILLABLE_STAGE_FAILURE_METRICS[stage], {
    appUserId: context.userId,
    sessionId: context.sessionId,
    targetId: context.targetId,
    generationType: context.generationType,
    generationIntentKey: state.generationIntentKey,
    resumeGenerationId: state.resumeGenerationId,
    failureCode,
  })
}

async function runBillableStage<T>(
  context: BillableStageContext,
  state: BillableStageState,
  stage: BillableResumeStage,
  run: () => Promise<T>,
  options?: {
    failureCode?: ToolErrorCode
    failureMessage?: string
  },
): Promise<T> {
  state.currentStage = stage
  const startedAt = Date.now()
  const stageQuerySnapshot = captureBillableStageQuerySnapshot()

  logInfo('resume_generation.stage.started', buildBillableStageLogFields(context, state, stage))

  try {
    const result = await run()

    logInfo('resume_generation.stage.completed', {
      ...buildBillableStageLogFields(context, state, stage),
      latencyMs: Date.now() - startedAt,
      ...buildBillableStageQueryLogFields(stageQuerySnapshot),
    })

    return result
  } catch (error) {
    const wrapped = wrapBillableResumeError(error, {
      code: options?.failureCode ?? TOOL_ERROR_CODES.INTERNAL_ERROR,
      message: options?.failureMessage,
      billableStage: stage,
      generationIntentKey: state.generationIntentKey,
      resumeGenerationId: state.resumeGenerationId,
    })
    const effectiveStage = wrapped.billableStage ?? stage
    state.currentStage = effectiveStage

    logWarn('resume_generation.stage.failed', {
      ...buildBillableStageLogFields(context, state, effectiveStage),
      latencyMs: Date.now() - startedAt,
      failureCode: wrapped.code,
      ...buildBillableStageQueryLogFields(stageQuerySnapshot),
      ...serializeError(wrapped),
    })
    recordBillableStageFailure(context, state, effectiveStage, wrapped.code)

    throw wrapped
  }
}

function isMissingResumeGenerationSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return (
    message.includes('does not exist')
    && (
      message.includes('resume_generations')
      || message.includes('credit_consumptions')
      || message.includes('resume_generation_type')
    )
  )
}

function resolveGenerationType(scope: ArtifactScope): ResumeGenerationType {
  return scope.type === 'target' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT'
}

function buildCompletedGenerationArtifacts(existing: ResumeGeneration): Pick<BillableGenerationResult, 'generatedOutput' | 'patch'> | null {
  if (existing.status !== 'completed' || !existing.outputPdfPath) {
    return null
  }

  return {
    generatedOutput: {
      status: 'ready',
      pdfPath: existing.outputPdfPath,
      docxPath: existing.outputDocxPath,
      generatedAt: existing.updatedAt.toISOString(),
    },
    patch: {
      generatedOutput: {
        status: 'ready',
        pdfPath: existing.outputPdfPath,
        docxPath: existing.outputDocxPath,
        generatedAt: existing.updatedAt.toISOString(),
      },
    },
  }
}

function buildPendingGenerationInProgressResult(existing: ResumeGeneration): BillableGenerationResult {
  return {
    output: {
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: existing.id,
      inProgress: true,
    },
    generatedOutput: {
      status: 'generating',
    },
    patch: {
      generatedOutput: {
        status: 'generating',
        error: undefined,
      },
    },
    resumeGeneration: existing,
    processingStage: 'reserve_credit',
  }
}

function areCvStatesEqual(left: GenerateFileInput['cv_state'], right?: GenerateFileInput['cv_state']): boolean {
  return Boolean(right) && JSON.stringify(left) === JSON.stringify(right)
}

async function safeUpdateResumeGeneration(
  input: Parameters<typeof updateResumeGeneration>[0],
): Promise<ResumeGeneration | null> {
  try {
    return await updateResumeGeneration(input)
  } catch (error) {
    logWarn('resume_generation.persistence_failed', {
      resumeGenerationId: input.id,
      status: input.status,
      stage: 'persistence',
      ...serializeError(error),
    })
    return null
  }
}

function logGenerationStageWarning(input: {
  event:
    | 'resume_generation.render_failed'
    | 'resume_generation.billing_failed'
    | 'resume_generation.billing_reconciliation_required'
  userId: string
  sessionId: string
  targetId?: string
  resumeGenerationId?: string
  generationIntentKey?: string
  type: ResumeGenerationType
  error?: string
  code?: string
  stage?: string
}): void {
  logWarn(input.event, {
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
    resumeGenerationId: input.resumeGenerationId,
    generationIntentKey: input.generationIntentKey,
    generationType: input.type,
    stage: input.stage ?? 'billing',
    errorMessage: input.error,
    errorCode: input.code,
  })
}

async function completeResumeGenerationBestEffort(input: {
  resumeGeneration: ResumeGeneration
  sourceCvState: GenerateFileInput['cv_state']
  generationResult: GenerateFileExecutionResult
  historyMetadata: ReturnType<typeof buildResumeGenerationHistoryMetadata>
}): Promise<ResumeGenerationPersistenceResult> {
  const completedGeneration = await safeUpdateResumeGeneration({
    id: input.resumeGeneration.id,
    status: 'completed',
    generatedCvState: input.sourceCvState,
    outputPdfPath: input.generationResult.generatedOutput?.pdfPath,
    outputDocxPath: input.generationResult.generatedOutput?.docxPath,
    historyKind: input.historyMetadata.historyKind,
    historyTitle: input.historyMetadata.historyTitle,
    historyDescription: input.historyMetadata.historyDescription,
    targetRole: input.historyMetadata.targetRole,
    targetJobSnippet: input.historyMetadata.targetJobSnippet,
    errorMessage: null,
    completedAt: new Date(),
    failedAt: null,
  })

  if (!completedGeneration) {
    return {}
  }

  return {
    resumeGeneration: completedGeneration,
    resumeGenerationId: completedGeneration.id,
  }
}

async function generateWithoutResumeGenerationPersistence(input: {
  userId: string
  sessionId: string
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  generationType: ResumeGenerationType
  idempotencyKey?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
}): Promise<BillableGenerationResult> {
  const scope: ArtifactScope = input.targetId
    ? { type: 'target', targetId: input.targetId }
    : { type: 'session' }
  const fallbackFingerprint = input.idempotencyKey
    ?? createHash('sha256').update(JSON.stringify(input.sourceCvState)).digest('hex')
  const legacyGenerationId = [
    'legacy',
    input.sessionId,
    input.targetId ?? 'base',
    fallbackFingerprint,
  ].join(':')

  const generationResult = await generateFile(
    {
      cv_state: input.sourceCvState,
      target_id: input.targetId,
    },
    input.userId,
    input.sessionId,
    scope,
    input.templateTargetSource,
  )

  if (!generationResult.output.success) {
    return generationResult
  }

  const creditConsumed = await consumeCreditForGeneration(
    input.userId,
    legacyGenerationId,
    input.generationType,
  )

  if (!creditConsumed) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
        'Seus créditos acabaram antes de concluir esta geração. Tente novamente após recarregar seu saldo.',
      ),
      generatedOutput: {
        status: 'failed',
        error: 'No credits available to finalize this generation.',
      },
      processingStage: 'billing_failed',
    }
  }

  return {
    ...generationResult,
    output: {
      ...generationResult.output,
      creditsUsed: 1,
    },
    processingStage: 'completed',
  }
}

function resolveGenerationIntentKey(input: {
  idempotencyKey?: string
  resumeGeneration: ResumeGeneration
}): string {
  return input.idempotencyKey ?? input.resumeGeneration.id
}

async function resolvePreviewAccessForCompletedGeneration(
  userId: string,
): Promise<GeneratedOutput['previewAccess'] | undefined> {
  const billingPlan = await getUserBillingPlan(userId)

  if (billingPlan === 'free') {
    return buildLockedPreviewAccess()
  }

  return undefined
}

async function resolvePersistedReplayPreviewAccess(input: {
  userId: string
  sessionId: string
  targetId?: string
}): Promise<GeneratedOutput['previewAccess'] | undefined> {
  if (input.targetId) {
    const target = await getResumeTargetForSession(input.sessionId, input.targetId)
    return target?.generatedOutput?.previewAccess
  }

  const session = await getSession(input.sessionId, input.userId)
  return session?.generatedOutput?.previewAccess
}

async function resolveReplayPreviewAccess(input: {
  userId: string
  sessionId: string
  targetId?: string
}): Promise<GeneratedOutput['previewAccess'] | undefined> {
  // Historical preview locks are the source of truth for replayed artifacts.
  // A later plan upgrade only affects new generations; replay must not reinterpret
  // an older locked artifact as viewable unless a new unlocked generation is created.
  const persistedPreviewAccess = await resolvePersistedReplayPreviewAccess(input)

  if (persistedPreviewAccess) {
    const billingPlan = await getUserBillingPlan(input.userId)
    if (persistedPreviewAccess.locked && billingPlan && billingPlan !== 'free') {
      recordMetricCounter('architecture.smart_generation.replay_locked_after_upgrade', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
      })
    }

    return persistedPreviewAccess
  }

  return resolvePreviewAccessForCompletedGeneration(input.userId)
}

async function buildReplayResultForViewer(input: {
  existing: ResumeGeneration
  userId: string
  sessionId: string
  targetId?: string
  signedUrlSource: 'existing_generation' | 'idempotent_generation'
}): Promise<BillableGenerationResult | null> {
  const artifacts = buildCompletedGenerationArtifacts(input.existing)
  if (!artifacts) {
    return null
  }

  const previewAccess = await resolveReplayPreviewAccess({
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
  })
  const generatedOutput = applyPreviewAccessToGeneratedOutput(
    artifacts.generatedOutput,
    previewAccess,
  )
  const patch = applyPreviewAccessToPatch(
    artifacts.patch,
    previewAccess,
  )

  const output: Extract<GenerateFileOutput, { success: true }> = {
    success: true,
    pdfUrl: null,
    docxUrl: null,
    creditsUsed: 0,
    resumeGenerationId: input.existing.id,
  }

  if (canViewRealPreview(generatedOutput)) {
    const signedUrls = await createSignedResumeArtifactUrlsBestEffort(
      input.existing.outputDocxPath,
      input.existing.outputPdfPath!,
      {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        pdfPath: input.existing.outputPdfPath!,
        source: input.signedUrlSource,
      },
    )

    output.pdfUrl = signedUrls.pdfUrl
    output.docxUrl = signedUrls.docxUrl ?? null
  }

  assertNoRealArtifactForLockedPreview({
    output,
    generatedOutput,
    patch,
    sessionId: input.sessionId,
    targetId: input.targetId,
  })

  return {
    output,
    generatedOutput,
    patch,
    resumeGeneration: input.existing,
    processingStage: 'completed',
  }
}

async function generateFileWithTimeout(input: {
  userId: string
  sessionId: string
  scope: ArtifactScope
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
  generationIntentKey: string
}): Promise<GenerateFileExecutionResult> {
  const timeoutMs = resolveExportGenerationConfig().timeoutMs

  return withTimedOperation({
    operation: 'generateFile',
    generationIntentKey: input.generationIntentKey,
    appUserId: input.userId,
    run: async () => {
      const generationPromise = generateFile(
        {
          cv_state: input.sourceCvState,
          target_id: input.targetId,
        },
        input.userId,
        input.sessionId,
        input.scope,
        input.templateTargetSource,
      )

      const timeoutPromise = new Promise<GenerateFileExecutionResult>((resolve) => {
        setTimeout(() => {
          resolve({
            output: toolFailure(
              TOOL_ERROR_CODES.GENERATION_ERROR,
              'A geracao do PDF excedeu o tempo limite e foi interrompida.',
            ),
            generatedOutput: {
              status: 'failed',
              error: 'Export generation timed out.',
            },
          })
        }, timeoutMs)
      })

      return Promise.race([generationPromise, timeoutPromise])
    },
    onFailure: () => ({
      errorCategory: 'render_artifact',
    }),
  })
}

export async function generateBillableResume(input: {
  userId: string
  sessionId: string
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  idempotencyKey?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
  resumePendingGeneration?: boolean
  latestVersionId?: string
  latestVersionSource?: string
  sourceScope?: string
  historyContext?: ResumeGenerationHistoryContext
}): Promise<BillableGenerationResult> {
  const scope: ArtifactScope = input.targetId
    ? { type: 'target', targetId: input.targetId }
    : { type: 'session' }
  const generationType = resolveGenerationType(scope)
  const stageState: BillableStageState = {
    currentStage: 'validate_cv_state',
  }
  const stageContext: BillableStageContext = {
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
    generationType,
  }
  const historyMetadata = buildResumeGenerationHistoryMetadata({
    ...input.historyContext,
    idempotencyKey: input.idempotencyKey ?? input.historyContext?.idempotencyKey,
    resumeTargetId: input.targetId ?? input.historyContext?.resumeTargetId,
    generationType,
  })

  logInfo('resume_generation.stage.started', buildBillableStageLogFields(stageContext, stageState, 'validate_cv_state'))
  const validation = validateGenerationCvState(input.sourceCvState)
  if (!validation.success) {
    logWarn('resume_generation.stage.failed', {
      ...buildBillableStageLogFields(stageContext, stageState, 'validate_cv_state'),
      failureCode: TOOL_ERROR_CODES.VALIDATION_ERROR,
      errorMessage: validation.errorMessage,
    })
    recordBillableStageFailure(
      stageContext,
      stageState,
      'validate_cv_state',
      TOOL_ERROR_CODES.VALIDATION_ERROR,
    )
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.VALIDATION_ERROR,
        validation.errorMessage,
      ),
      generatedOutput: {
        status: 'failed',
        error: validation.errorMessage,
      },
      processingStage: 'validation_failed',
    }
  }
  logInfo('resume_generation.stage.completed', buildBillableStageLogFields(stageContext, stageState, 'validate_cv_state'))

  let resumeGeneration: ResumeGeneration | undefined
  let latestCompletedGeneration: ResumeGeneration | null = null
  let resumeGenerationSchemaUnavailable = false

  latestCompletedGeneration = await runBillableStage(
    stageContext,
    stageState,
    'lookup_completed_generation',
    async () => {
      try {
        return await getLatestCompletedResumeGenerationForScope({
          userId: input.userId,
          sessionId: input.sessionId,
          resumeTargetId: input.targetId,
          type: generationType,
        })
      } catch (error) {
        if (isMissingResumeGenerationSchemaError(error)) {
          logWarn('resume_generation.schema_unavailable', {
            userId: input.userId,
            sessionId: input.sessionId,
            targetId: input.targetId,
            stage: 'lookup_latest_completed',
            ...serializeError(error),
          })
          resumeGenerationSchemaUnavailable = true
          return null
        }

        throw error
      }
    },
    {
      failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
      failureMessage: 'Failed to look up the latest completed resume generation.',
    },
  )

  if (
    !resumeGenerationSchemaUnavailable
    && latestCompletedGeneration
    && areCvStatesEqual(input.sourceCvState, latestCompletedGeneration.generatedCvState ?? latestCompletedGeneration.sourceCvSnapshot)
  ) {
    const replayResult = await buildReplayResultForViewer({
      existing: latestCompletedGeneration,
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      signedUrlSource: 'existing_generation',
    })
    if (replayResult) {
      return replayResult
    }
  }

  if (input.idempotencyKey && !resumeGenerationSchemaUnavailable) {
    const existing = await runBillableStage(
      stageContext,
      stageState,
      'lookup_idempotent_generation',
      async () => {
        try {
          return await getResumeGenerationByIdempotencyKey(input.userId, input.idempotencyKey!)
        } catch (error) {
          if (isMissingResumeGenerationSchemaError(error)) {
            logWarn('resume_generation.schema_unavailable', {
              userId: input.userId,
              sessionId: input.sessionId,
              targetId: input.targetId,
              stage: 'lookup_idempotency',
              idempotencyKey: input.idempotencyKey,
              ...serializeError(error),
            })
            resumeGenerationSchemaUnavailable = true
            return null
          }

          throw error
        }
      },
      {
        failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
        failureMessage: 'Failed to look up the billable resume generation by idempotency key.',
      },
    )

    if (!resumeGenerationSchemaUnavailable && existing) {
      const replayResult = await buildReplayResultForViewer({
        existing,
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        signedUrlSource: 'idempotent_generation',
      })
      if (replayResult) {
        return replayResult
      }

      if (existing.status === 'failed') {
        return {
          output: toolFailure(
            TOOL_ERROR_CODES.GENERATION_ERROR,
            existing.failureReason ?? 'File generation failed.',
          ),
          generatedOutput: {
            status: 'failed',
            error: existing.failureReason,
          },
          resumeGeneration: existing,
          processingStage: 'generation_failed',
        }
      }

      if (existing.status === 'pending') {
        if (!input.resumePendingGeneration) {
          return buildPendingGenerationInProgressResult(existing)
        }
        resumeGeneration = existing
      }
    }
  }

  const trustedLatestCvVersion = (
    input.latestVersionId
    && input.latestVersionSource
    && BILLABLE_CV_VERSION_SOURCES.has(input.latestVersionSource)
  )
    ? {
        id: input.latestVersionId,
        source: input.latestVersionSource,
      }
    : null

  const latestCvVersion = await runBillableStage(
    stageContext,
    stageState,
    'lookup_latest_version',
    async () => trustedLatestCvVersion ?? getLatestCvVersionForScope(input.sessionId, input.targetId),
    {
      failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
      failureMessage: 'Failed to look up the latest billable CV version.',
    },
  )
  if (!latestCvVersion || !BILLABLE_CV_VERSION_SOURCES.has(latestCvVersion.source)) {
    recordBillableStageFailure(
      stageContext,
      stageState,
      'lookup_latest_version',
      TOOL_ERROR_CODES.GENERATE_RESUME_LATEST_VERSION_MISSING,
    )

    return {
      output: toolFailure(
        TOOL_ERROR_CODES.GENERATE_RESUME_LATEST_VERSION_MISSING,
        'Gere uma nova versão otimizada pela IA antes de exportar este currículo.',
      ),
      processingStage: 'validation_failed',
    }
  }

  const hasCredits = await checkUserQuota(input.userId)
  if (!hasCredits) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
        'Seus créditos acabaram. Gere um novo currículo quando houver saldo disponível.',
      ),
      processingStage: 'reserve_credit',
    }
  }

  if (resumeGenerationSchemaUnavailable) {
    return generateWithoutResumeGenerationPersistence({
      userId: input.userId,
      sessionId: input.sessionId,
      sourceCvState: input.sourceCvState,
      targetId: input.targetId,
      generationType,
      idempotencyKey: input.idempotencyKey,
      templateTargetSource: input.templateTargetSource,
    })
  }

  if (!resumeGeneration) {
    const pendingGeneration = await runBillableStage(
      stageContext,
      stageState,
      'create_pending_generation',
      async () => {
        try {
          return await createPendingResumeGeneration({
            userId: input.userId,
            sessionId: input.sessionId,
            resumeTargetId: input.targetId,
            type: generationType,
            idempotencyKey: input.idempotencyKey,
            historyKind: historyMetadata.historyKind,
            historyTitle: historyMetadata.historyTitle,
            historyDescription: historyMetadata.historyDescription,
            targetRole: historyMetadata.targetRole,
            targetJobSnippet: historyMetadata.targetJobSnippet,
            sourceCvSnapshot: input.sourceCvState,
          })
        } catch (error) {
          if (isMissingResumeGenerationSchemaError(error)) {
            logWarn('resume_generation.schema_unavailable', {
              userId: input.userId,
              sessionId: input.sessionId,
              targetId: input.targetId,
              stage: 'create_pending',
              idempotencyKey: input.idempotencyKey,
              ...serializeError(error),
            })
            resumeGenerationSchemaUnavailable = true
            return null
          }

          if (error instanceof PendingResumeGenerationPersistenceError) {
            const failureCode = resolvePendingGenerationFailureCode(error)
            const billableStage = error.operation === 'reuse'
              ? 'reuse_pending_generation'
              : 'create_pending_generation'

            logPendingGenerationPersistenceFailure({
              userId: input.userId,
              sessionId: input.sessionId,
              targetId: input.targetId,
              generationIntentKey: input.idempotencyKey,
              resumeGenerationId: stageState.resumeGenerationId,
              latestVersionId: input.latestVersionId,
              sourceScope: input.sourceScope,
              branch: error.operation,
              error,
            })

            throw new BillableResumeError({
              code: failureCode,
              message: error.message,
              billableStage,
              generationIntentKey: input.idempotencyKey,
              resumeGenerationId: stageState.resumeGenerationId,
              cause: error,
            })
          }

          throw error
        }
      },
      {
        failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PENDING_GENERATION_CREATE_FAILED,
        failureMessage: 'Failed to create a pending resume generation.',
      },
    )

    if (resumeGenerationSchemaUnavailable) {
      return generateWithoutResumeGenerationPersistence({
        userId: input.userId,
        sessionId: input.sessionId,
        sourceCvState: input.sourceCvState,
        targetId: input.targetId,
        generationType,
        idempotencyKey: input.idempotencyKey,
        templateTargetSource: input.templateTargetSource,
      })
    }

    if (!pendingGeneration) {
      recordBillableStageFailure(
        stageContext,
        stageState,
        'create_pending_generation',
        TOOL_ERROR_CODES.GENERATE_RESUME_PENDING_GENERATION_MISSING,
      )

      return {
        output: toolFailure(
          TOOL_ERROR_CODES.GENERATE_RESUME_PENDING_GENERATION_MISSING,
          'A geraÃ§Ã£o pendente esperada nÃ£o foi criada antes de continuar a exportaÃ§Ã£o.',
        ),
        generatedOutput: {
          status: 'failed',
          error: 'Pending generation was not created before continuing billable export flow.',
        },
        processingStage: 'validation_failed',
      }
    }

    resumeGeneration = pendingGeneration.generation
    stageState.resumeGenerationId = resumeGeneration.id

    if (!pendingGeneration.wasCreated && !input.resumePendingGeneration) {
      return buildPendingGenerationInProgressResult(resumeGeneration)
    }
  }

  const generationIntentKey = resolveGenerationIntentKey({
    idempotencyKey: input.idempotencyKey,
    resumeGeneration,
  })
  stageState.generationIntentKey = generationIntentKey
  stageState.resumeGenerationId = resumeGeneration.id

  const reservation = await runBillableStage(
    stageContext,
    stageState,
    'reserve_credit',
    () => withTimedOperation({
      operation: 'reserveCreditForGenerationIntent',
      generationIntentKey,
      appUserId: input.userId,
      run: () => reserveCreditForGenerationIntent({
        userId: input.userId,
        generationIntentKey,
        generationType,
        sessionId: input.sessionId,
        resumeTargetId: input.targetId,
        resumeGenerationId: resumeGeneration.id,
        metadata: {
          sessionId: input.sessionId,
          targetId: input.targetId ?? null,
          stage: 'reserve_credit',
          resumePendingGeneration: input.resumePendingGeneration ?? false,
        },
      }),
      onFailure: (error) => ({
        errorCategory: 'reserve_credit',
        errorCode: error instanceof Error ? 'reserve_failed' : 'reserve_failed_unknown',
      }),
    }),
    {
      failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_RESERVATION_FAILED,
      failureMessage: 'Failed to reserve credit before generating the billable resume.',
    },
  )

  logInfo('resume_generation.credit_reserved', {
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
    resumeGenerationId: resumeGeneration.id,
    generationIntentKey,
    generationType,
    stage: 'reserve_credit',
  })
  recordMetricCounter('billing.reservations.created', {
    appUserId: input.userId,
    generationIntentKey,
    generationType,
  })
  recordMetricCounter('exports.started', {
    appUserId: input.userId,
    generationIntentKey,
    generationType,
  })

  const generationResult = await runBillableStage(
    stageContext,
    stageState,
    'render_artifact',
    () => generateFileWithTimeout({
      userId: input.userId,
      sessionId: input.sessionId,
      scope,
      sourceCvState: input.sourceCvState,
      targetId: input.targetId,
      templateTargetSource: input.templateTargetSource,
      generationIntentKey,
    }),
    {
      failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_RENDER_FAILED,
      failureMessage: 'Failed while rendering the billable resume artifact.',
    },
  )

  if (!generationResult.output.success) {
    const generationFailureReason = generationResult.generatedOutput?.error ?? generationResult.output.error

    logGenerationStageWarning({
      event: 'resume_generation.render_failed',
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      generationIntentKey,
      type: generationType,
      error: generationFailureReason,
      code: generationResult.output.code,
      stage: 'render_artifact',
    })

    try {
      await runBillableStage(
        stageContext,
        stageState,
        'release_credit',
        () => withTimedOperation({
          operation: 'releaseCreditReservation',
          generationIntentKey,
          appUserId: input.userId,
          run: () => releaseCreditReservation({
            userId: input.userId,
            generationIntentKey,
            resumeGenerationId: resumeGeneration.id,
            metadata: {
              sessionId: input.sessionId,
              targetId: input.targetId ?? null,
              stage: 'release_credit',
              reason: generationFailureReason,
            },
          }),
          onFailure: () => ({
            errorCategory: 'release_credit',
            errorCode: 'release_failed',
          }),
        }),
        {
          failureCode: TOOL_ERROR_CODES.INTERNAL_ERROR,
          failureMessage: 'Failed to release the reserved credit after render failure.',
        },
      )
      logInfo('resume_generation.credit_released', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        resumeGenerationId: resumeGeneration.id,
        generationIntentKey,
        generationType,
        stage: 'release_credit',
      })
      recordMetricCounter('billing.reservations.released', {
        appUserId: input.userId,
        generationIntentKey,
        generationType,
      })
    } catch (error) {
      try {
        await runBillableStage(
          stageContext,
          stageState,
          'reconciliation_marking',
          () => markCreditReservationReconciliation({
            reservationId: reservation.id,
            status: 'needs_reconciliation',
            reconciliationStatus: 'pending',
            failureReason: getBillableFailureReason(error),
            metadata: {
              source: 'render_failure_release',
              generationIntentKey,
            },
          }),
          {
            failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
            failureMessage: 'Failed to mark the reservation for manual reconciliation after release failure.',
          },
        )
        recordMetricCounter('billing.reservations.needs_reconciliation', {
          appUserId: input.userId,
          generationIntentKey,
          generationType,
          source: 'render_failure_release',
        })
      } catch (markerError) {
        logWarn('resume_generation.reconciliation_marker_failed', {
          userId: input.userId,
          sessionId: input.sessionId,
          targetId: input.targetId,
          reservationId: reservation.id,
          resumeGenerationId: resumeGeneration.id,
          generationIntentKey,
          stage: 'release_credit',
          errorName: markerError instanceof BillableResumeError && markerError.cause instanceof Error
            ? markerError.cause.name
            : markerError instanceof Error
              ? markerError.name
              : 'Error',
          errorMessage: getBillableFailureReason(markerError),
        })
      }
      logGenerationStageWarning({
        event: 'resume_generation.billing_reconciliation_required',
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        resumeGenerationId: resumeGeneration.id,
        generationIntentKey,
        type: generationType,
        error: getBillableFailureReason(error),
        code: generationResult.output.code,
        stage: 'release_credit',
      })
    }

    stageState.currentStage = 'persist_failed_generation'
    logInfo('resume_generation.stage.started', buildBillableStageLogFields(stageContext, stageState, 'persist_failed_generation'))
    const failedPersistence = await safeUpdateResumeGeneration({
      id: resumeGeneration.id,
      status: 'failed',
      failureReason: generationFailureReason,
      historyKind: historyMetadata.historyKind,
      historyTitle: historyMetadata.historyTitle,
      historyDescription: historyMetadata.historyDescription,
      targetRole: historyMetadata.targetRole,
      targetJobSnippet: historyMetadata.targetJobSnippet,
      errorMessage: generationFailureReason,
      completedAt: null,
      failedAt: new Date(),
    })
    if (failedPersistence) {
      logInfo('resume_generation.stage.completed', buildBillableStageLogFields(stageContext, stageState, 'persist_failed_generation'))
    } else {
      logWarn('resume_generation.stage.failed', {
        ...buildBillableStageLogFields(stageContext, stageState, 'persist_failed_generation'),
        failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
        errorMessage: 'Failed to persist the failed resume generation.',
      })
      recordBillableStageFailure(
        stageContext,
        stageState,
        'persist_failed_generation',
        TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
      )
    }
    recordMetricCounter('exports.failed', {
      appUserId: input.userId,
      generationIntentKey,
      generationType,
      stage: 'render_artifact',
    })

    return {
      ...generationResult,
      resumeGeneration,
      processingStage: 'release_credit',
    }
  }

  const previewAccess = await resolvePreviewAccessForCompletedGeneration(input.userId)
  const generatedOutput = applyPreviewAccessToGeneratedOutput(
    generationResult.generatedOutput,
    previewAccess,
  )
  const patch = applyPreviewAccessToPatch(
    generationResult.patch,
    previewAccess,
  )

  let needsReconciliation = false
  try {
    await runBillableStage(
      stageContext,
      stageState,
      'finalize_credit',
      () => withTimedOperation({
        operation: 'finalizeCreditReservation',
        generationIntentKey,
        appUserId: input.userId,
        run: () => finalizeCreditReservation({
          userId: input.userId,
          generationIntentKey,
          resumeGenerationId: resumeGeneration.id,
          metadata: {
            sessionId: input.sessionId,
            targetId: input.targetId ?? null,
            stage: 'finalize_credit',
          },
        }),
        onFailure: () => ({
          errorCategory: 'finalize_credit',
          errorCode: 'finalize_failed',
        }),
      }),
      {
        failureCode: TOOL_ERROR_CODES.INTERNAL_ERROR,
        failureMessage: 'Failed to finalize the reserved credit after artifact success.',
      },
    )
    logInfo('resume_generation.credit_finalized', {
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      generationIntentKey,
      generationType,
      stage: 'finalize_credit',
    })
    recordMetricCounter('billing.reservations.finalized', {
      appUserId: input.userId,
      generationIntentKey,
      generationType,
    })
  } catch (error) {
    needsReconciliation = true
    try {
      await runBillableStage(
        stageContext,
        stageState,
        'reconciliation_marking',
        () => markCreditReservationReconciliation({
          reservationId: reservation.id,
          status: 'needs_reconciliation',
          reconciliationStatus: 'pending',
          failureReason: getBillableFailureReason(error),
          metadata: {
            source: 'artifact_success_finalize',
            generationIntentKey,
          },
        }),
        {
          failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
          failureMessage: 'Failed to mark the reservation for manual reconciliation after finalize failure.',
        },
      )
      recordMetricCounter('billing.reservations.needs_reconciliation', {
        appUserId: input.userId,
        generationIntentKey,
        generationType,
        source: 'artifact_success_finalize',
      })
    } catch (markerError) {
      logWarn('resume_generation.reconciliation_marker_failed', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        reservationId: reservation.id,
        resumeGenerationId: resumeGeneration.id,
        generationIntentKey,
        stage: 'finalize_credit',
        errorName: markerError instanceof BillableResumeError && markerError.cause instanceof Error
          ? markerError.cause.name
          : markerError instanceof Error
            ? markerError.name
            : 'Error',
        errorMessage: getBillableFailureReason(markerError),
      })
    }
    logGenerationStageWarning({
      event: 'resume_generation.billing_reconciliation_required',
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      generationIntentKey,
      type: generationType,
      error: getBillableFailureReason(error),
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      stage: 'finalize_credit',
    })
  }

  const persistence = await runBillableStage(
    stageContext,
    stageState,
    'persist_completed_generation',
    () => completeResumeGenerationBestEffort({
      resumeGeneration,
      sourceCvState: input.sourceCvState,
      generationResult,
      historyMetadata,
    }),
    {
      failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
      failureMessage: 'Failed to persist the completed resume generation.',
    },
  )
  if (!persistence.resumeGenerationId) {
    logWarn('resume_generation.stage.failed', {
      ...buildBillableStageLogFields(stageContext, stageState, 'persist_completed_generation'),
      failureCode: TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
      errorMessage: 'Completed artifact was returned, but resume generation persistence was unavailable.',
    })
    recordBillableStageFailure(
      stageContext,
      stageState,
      'persist_completed_generation',
      TOOL_ERROR_CODES.GENERATE_RESUME_PERSISTENCE_FAILED,
    )
  }

  recordMetricCounter('exports.completed', {
    appUserId: input.userId,
    generationIntentKey,
    generationType,
    needsReconciliation,
  })

  const output: Extract<GenerateFileOutput, { success: true }> = {
    ...generationResult.output,
    pdfUrl: previewAccess
      ? buildLockedPreviewPdfUrl(input.sessionId, input.targetId)
      : generationResult.output.pdfUrl,
    docxUrl: previewAccess ? null : generationResult.output.docxUrl ?? null,
    creditsUsed: 1,
    resumeGenerationId: persistence.resumeGenerationId,
  }

  assertNoRealArtifactForLockedPreview({
    output,
    generatedOutput,
    patch,
    sessionId: input.sessionId,
    targetId: input.targetId,
  })

  return {
    ...generationResult,
    patch,
    output,
    generatedOutput,
    resumeGeneration: persistence.resumeGeneration,
    processingStage: needsReconciliation ? 'needs_reconciliation' : 'finalize_credit',
    needsReconciliation,
  }
}
