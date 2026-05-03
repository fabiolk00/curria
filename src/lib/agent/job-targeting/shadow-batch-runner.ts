import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import {
  buildGeneratedClaimTraceFromSectionPlans,
  buildSectionRewritePlan,
} from '@/lib/agent/job-targeting/compatibility/rewrite-trace'
import { validateGeneratedClaims } from '@/lib/agent/job-targeting/compatibility/structured-validation'
import {
  buildShadowBatchResult,
  snapshotAssessment,
} from '@/lib/agent/job-targeting/shadow-comparison'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import type {
  JobTargetingShadowCase,
  ShadowBatchResult,
  ShadowBatchRunConfig,
  ShadowGapAnalysisSource,
  ShadowLegacySnapshot,
  ShadowValidationSnapshot,
} from '@/lib/agent/job-targeting/shadow-case-types'
import { buildJobTargetingScoreBreakdownFromPlan } from '@/lib/agent/job-targeting/score-breakdown'
import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { buildTargetedRewritePlan } from '@/lib/agent/tools/build-targeting-plan'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import type {
  GeneratedClaimTraceSection,
  JobCompatibilityAssessment,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { ToolErrorCode } from '@/lib/agent/tool-errors'
import type { TargetingPlan } from '@/types/agent'
import type { GapAnalysisResult } from '@/types/cv'

export type RunShadowBatchOptions = {
  inputPath: string
  outputPath: string
  limit?: number
  concurrency?: number
  persist?: boolean
  disableLlm?: boolean
  useRealGapAnalysis?: boolean
  includeRewriteValidation?: boolean
  confirmLlmCost?: boolean
  maxLlmCases?: number
  maxEstimatedCostUsd?: number
  dryRunRewriteValidation?: boolean
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
  enforceCostGuards?: boolean
}

export type RunShadowBatchSummary = {
  total: number
  successful: number
  failed: number
  outputPath: string
}

export const SHADOW_BATCH_ESTIMATED_COST_USD = {
  gapAnalysisPerCase: 0.01,
  rewriteValidationPerCase: 0.05,
} as const

const SHADOW_BATCH_PROMPT_VERSION = 'shadow-batch-rewrite-validation-v1'

function hashInputPath(inputPath: string): string {
  return createHash('sha256')
    .update(path.resolve(inputPath))
    .digest('hex')
    .slice(0, 16)
}

function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 32)
}

function assertLocalCacheDir(cacheDir: string): string {
  const resolved = path.resolve(cacheDir)
  const localRoot = path.resolve('.local')

  if (resolved !== localRoot && !resolved.startsWith(`${localRoot}${path.sep}`)) {
    throw new Error('LLM cache dir must be inside .local/.')
  }

  return resolved
}

async function readCache<T>(cacheDir: string | undefined, key: string): Promise<T | undefined> {
  if (!cacheDir) {
    return undefined
  }

  try {
    const filePath = path.join(assertLocalCacheDir(cacheDir), `${key}.json`)
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch {
    return undefined
  }
}

async function writeCache(cacheDir: string | undefined, key: string, value: unknown): Promise<void> {
  if (!cacheDir) {
    return
  }

  const resolvedCacheDir = assertLocalCacheDir(cacheDir)
  await mkdir(resolvedCacheDir, { recursive: true })
  await writeFile(path.join(resolvedCacheDir, `${key}.json`), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function estimateLlmCostUsd(params: {
  caseCount: number
  useRealGapAnalysis: boolean
  includeRewriteValidation: boolean
  dryRunRewriteValidation: boolean
}): number {
  const perCase = (params.useRealGapAnalysis ? SHADOW_BATCH_ESTIMATED_COST_USD.gapAnalysisPerCase : 0)
    + (params.includeRewriteValidation && !params.dryRunRewriteValidation
      ? SHADOW_BATCH_ESTIMATED_COST_USD.rewriteValidationPerCase
      : 0)

  return Math.round(params.caseCount * perCase * 100) / 100
}

function validateCostGuards(params: {
  caseCount: number
  useRealGapAnalysis: boolean
  includeRewriteValidation: boolean
  dryRunRewriteValidation: boolean
  confirmLlmCost?: boolean
  maxLlmCases?: number
  maxEstimatedCostUsd?: number
  enforceCostGuards: boolean
}): void {
  const usesLlm = params.useRealGapAnalysis
    || (params.includeRewriteValidation && !params.dryRunRewriteValidation)
  if (!usesLlm || !params.enforceCostGuards) {
    return
  }

  if (!params.confirmLlmCost) {
    throw new Error('LLM cost confirmation required. Re-run with --confirm-llm-cost to allow OpenAI API calls.')
  }

  if (typeof params.maxLlmCases !== 'number') {
    throw new Error('LLM max case limit required. Re-run with --max-llm-cases <number>.')
  }

  if (typeof params.maxEstimatedCostUsd !== 'number') {
    throw new Error('LLM max estimated cost budget required. Re-run with --max-estimated-cost-usd <amount>.')
  }

  if (params.caseCount > params.maxLlmCases) {
    throw new Error(`Refusing to run ${params.caseCount} LLM cases with maxLlmCases=${params.maxLlmCases}. Lower --limit or increase --max-llm-cases intentionally.`)
  }

  const estimatedCostUsd = estimateLlmCostUsd(params)
  if (estimatedCostUsd > params.maxEstimatedCostUsd) {
    throw new Error(`Estimated cost $${estimatedCostUsd.toFixed(2)} exceeds max budget $${params.maxEstimatedCostUsd.toFixed(2)}. Aborting before OpenAI calls.`)
  }
}

function parseJsonLines(source: string): unknown[] {
  const trimmed = source.trim()
  if (!trimmed) {
    return []
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown
    return Array.isArray(parsed) ? parsed : []
  }

  return trimmed
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
}

function assertShadowCase(value: unknown): JobTargetingShadowCase {
  if (!value || typeof value !== 'object') {
    throw new Error('Shadow case must be an object.')
  }

  const candidate = value as Partial<JobTargetingShadowCase>
  const allowedSources: JobTargetingShadowCase['source'][] = [
    'real_anonymized',
    'synthetic',
    'golden',
    'manual_review',
  ]
  if (!candidate.id || typeof candidate.id !== 'string') {
    throw new Error('Shadow case requires string id.')
  }

  if (!candidate.source || !allowedSources.includes(candidate.source)) {
    throw new Error(`Shadow case ${candidate.id} requires a valid source.`)
  }

  if (!candidate.cvState || typeof candidate.cvState !== 'object') {
    throw new Error(`Shadow case ${candidate.id} requires cvState.`)
  }

  if (!candidate.targetJobDescription || typeof candidate.targetJobDescription !== 'string') {
    throw new Error(`Shadow case ${candidate.id} requires targetJobDescription.`)
  }

  if (
    candidate.source === 'real_anonymized'
    && candidate.metadata?.anonymized !== true
  ) {
    throw new Error(`Real shadow case ${candidate.id} must be anonymized before batch execution.`)
  }

  return candidate as JobTargetingShadowCase
}

export async function loadShadowCases(inputPath: string): Promise<JobTargetingShadowCase[]> {
  const source = await readFile(inputPath, 'utf8')
  return parseJsonLines(source).map(assertShadowCase)
}

function buildBatchGapAnalysis(testCase: JobTargetingShadowCase): GapAnalysisResult {
  return {
    matchScore: 50,
    missingSkills: testCase.expected?.knownGaps ?? [],
    weakAreas: [],
    improvementSuggestions: [],
  }
}

async function runLegacyCompatibilityPath(params: {
  testCase: JobTargetingShadowCase
  gapAnalysis: GapAnalysisResult
  disableLlm: boolean
}): Promise<{
  legacy: ShadowLegacySnapshot
  targetingPlan: TargetingPlan
}> {
  const targetingPlan = await buildTargetedRewritePlan({
    cvState: params.testCase.cvState,
    targetJobDescription: params.testCase.targetJobDescription,
    gapAnalysis: params.gapAnalysis,
    mode: 'job_targeting',
    rewriteIntent: 'targeted_rewrite',
    sessionId: `shadow_case_${params.testCase.id}`,
    disableLlm: params.disableLlm,
  })
  const scoreBreakdown = buildJobTargetingScoreBreakdownFromPlan({
    cvState: params.testCase.cvState,
    targetingPlan,
  })

  return {
    legacy: {
      score: scoreBreakdown.total,
      lowFitTriggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
      unsupportedCount: targetingPlan.targetEvidence?.filter((item) => item.evidenceLevel === 'unsupported_gap').length ?? 0,
      criticalGaps: scoreBreakdown.criticalGaps,
    },
    targetingPlan,
  }
}

async function resolveGapAnalysis(params: {
  testCase: JobTargetingShadowCase
  useRealGapAnalysis: boolean
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
}): Promise<{
  gapAnalysis: GapAnalysisResult
  gapAnalysisSource: ShadowGapAnalysisSource
  llmCalled: boolean
  cacheHit: boolean
}> {
  if (params.useRealGapAnalysis) {
    const cacheKey = `gap-${hashJson({
      caseId: params.testCase.id,
      cvState: params.testCase.cvState,
      targetJobDescription: params.testCase.targetJobDescription,
      mode: 'real_gap_analysis',
      promptVersion: SHADOW_BATCH_PROMPT_VERSION,
    })}`
    if (params.reuseCachedLlmResults) {
      const cached = await readCache<GapAnalysisResult>(params.llmCacheDir, cacheKey)
      if (cached) {
        return {
          gapAnalysis: cached,
          gapAnalysisSource: 'real_llm',
          llmCalled: false,
          cacheHit: true,
        }
      }
    }

    const execution = await analyzeGap(
      params.testCase.cvState,
      params.testCase.targetJobDescription,
      'shadow_batch',
      `shadow_case_${params.testCase.id}`,
    )

    if (!execution.result) {
      throw new Error(execution.output.success ? 'Real gap analysis returned no result.' : execution.output.error)
    }

    await writeCache(params.llmCacheDir, cacheKey, execution.result)

    return {
      gapAnalysis: execution.result,
      gapAnalysisSource: 'real_llm',
      llmCalled: true,
      cacheHit: false,
    }
  }

  if (params.testCase.gapAnalysis) {
    return {
      gapAnalysis: params.testCase.gapAnalysis,
      gapAnalysisSource: 'provided',
      llmCalled: false,
      cacheHit: false,
    }
  }

  return {
    gapAnalysis: buildBatchGapAnalysis(params.testCase),
    gapAnalysisSource: 'synthetic',
    llmCalled: false,
    cacheHit: false,
  }
}

async function runRewriteValidation(params: {
  testCase: JobTargetingShadowCase
  gapAnalysis: GapAnalysisResult
  targetingPlan: TargetingPlan
  assessment: JobCompatibilityAssessment
  allowLlm: boolean
  dryRun?: boolean
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
}): Promise<ShadowValidationSnapshot> {
  if (params.dryRun) {
    return {
      mode: 'dry_run',
      ...validatePreservedCvStateTrace({
        testCase: params.testCase,
        targetingPlan: params.targetingPlan,
        assessment: params.assessment,
      }),
      executed: true,
      rewriteSucceeded: false,
      fallbackUsed: false,
      cacheHit: false,
      traceFallbackUsed: false,
      hasOptimizedCvState: false,
      hasSectionRewritePlans: true,
    }
  }

  if (!params.allowLlm) {
    return {
      executed: true,
      mode: 'real_llm',
      blocked: true,
      issueTypes: ['rewrite_validation_requires_llm'],
      factualViolation: false,
      generatedClaimTraceCount: 0,
      missingTraceCount: 0,
      rewriteSucceeded: false,
      hasOptimizedCvState: false,
      cacheHit: false,
      hasSectionRewritePlans: false,
    }
  }

  const cacheKey = `rewrite-${hashJson({
    caseId: params.testCase.id,
    cvState: params.testCase.cvState,
    targetJobDescription: params.testCase.targetJobDescription,
    assessmentVersion: params.assessment.audit.assessmentVersion,
    scoreVersion: params.assessment.audit.scoreVersion,
    catalogVersions: params.assessment.catalog.catalogVersions,
    promptVersion: SHADOW_BATCH_PROMPT_VERSION,
  })}`
  if (params.reuseCachedLlmResults) {
    const cached = await readCache<ShadowValidationSnapshot>(params.llmCacheDir, cacheKey)
    if (cached) {
      return { ...cached, cacheHit: true }
    }
  }

  logInfo('job_targeting.shadow_batch.rewrite_validation.started', {
    caseId: params.testCase.id,
    source: params.testCase.source,
    allowedClaimCount: params.assessment.claimPolicy.allowedClaims.length,
    cautiousClaimCount: params.assessment.claimPolicy.cautiousClaims.length,
    forbiddenClaimCount: params.assessment.claimPolicy.forbiddenClaims.length,
    supportedRequirementsCount: params.assessment.supportedRequirements.length,
    adjacentRequirementsCount: params.assessment.adjacentRequirements.length,
    unsupportedRequirementsCount: params.assessment.unsupportedRequirements.length,
  })

  const rewrite = await rewriteResumeFull({
    mode: 'job_targeting',
    cvState: params.testCase.cvState,
    targetJobDescription: params.testCase.targetJobDescription,
    gapAnalysis: params.gapAnalysis,
    targetingPlan: params.targetingPlan,
    jobCompatibilityAssessment: params.assessment,
    userId: 'shadow_batch',
    sessionId: `shadow_case_${params.testCase.id}`,
  })

  if (!rewrite.success || !rewrite.optimizedCvState) {
    const issueType = classifyRewriteValidationFailure({
      errorCode: rewrite.errorCode,
      errorMessage: rewrite.error,
      hasAssessment: Boolean(params.assessment),
      hasClaimPolicy: Boolean(params.assessment.claimPolicy),
    })
    const fallback = shouldUseSyntheticTraceFallback(params.testCase, issueType)
      ? validatePreservedCvStateTrace({
          testCase: params.testCase,
          targetingPlan: params.targetingPlan,
          assessment: params.assessment,
        })
      : undefined
    const issueTypes = uniqueStrings([
      issueType,
      ...(fallback?.issueTypes ?? []),
      ...(fallback ? ['shadow_trace_fallback_used'] : []),
    ])

    logWarn('job_targeting.shadow_batch.rewrite_validation.rewrite_failed', {
      caseId: params.testCase.id,
      source: params.testCase.source,
      rewriteSucceeded: false,
      errorCode: rewrite.errorCode,
      errorMessage: sanitizeDebugMessage(rewrite.error),
      failedSection: rewrite.failedSection,
      hasOptimizedCvState: Boolean(rewrite.optimizedCvState),
      hasSectionRewritePlans: Boolean(rewrite.sectionRewritePlans?.length),
      generatedClaimTraceCount: fallback?.generatedClaimTraceCount ?? rewrite.generatedClaimTrace?.length ?? 0,
      validationIssueTypes: issueTypes,
      validationBlocked: fallback?.blocked ?? true,
      traceFallbackUsed: Boolean(fallback),
    })

    const failureSnapshot: ShadowValidationSnapshot = {
      executed: true,
      mode: 'real_llm',
      blocked: fallback?.blocked ?? true,
      issueTypes,
      factualViolation: fallback?.factualViolation ?? false,
      generatedClaimTraceCount: fallback?.generatedClaimTraceCount ?? rewrite.generatedClaimTrace?.length ?? 0,
      missingTraceCount: fallback?.missingTraceCount ?? 0,
      rewriteSucceeded: false,
      errorCode: rewrite.errorCode,
      safeErrorCode: rewrite.errorCode,
      rewriteErrorCode: rewrite.errorCode,
      rewriteErrorMessage: sanitizeDebugMessage(rewrite.error),
      failedSection: rewrite.failedSection,
      retryAttempted: false,
      fallbackUsed: Boolean(fallback),
      cacheHit: false,
      hasOptimizedCvState: Boolean(rewrite.optimizedCvState),
      hasSectionRewritePlans: Boolean(rewrite.sectionRewritePlans?.length),
      traceFallbackUsed: Boolean(fallback),
    }
    await writeCache(params.llmCacheDir, cacheKey, failureSnapshot)
    return failureSnapshot
  }

  const validation = validateGeneratedClaims({
    generatedCvState: rewrite.optimizedCvState,
    generatedClaimTraces: rewrite.generatedClaimTrace,
    requireClaimTrace: true,
    claimPolicy: params.assessment.claimPolicy,
    targetRole: {
      value: params.assessment.targetRole,
      permission: params.targetingPlan.targetRolePositioning?.permission,
    },
  })
  const issueTypes = Array.from(new Set(validation.issues.map((issue) => issue.type)))
  const missingTraceCount = validation.issues.filter((issue) => issue.type === 'missing_claim_trace').length
  const generatedClaimTraceCount = rewrite.generatedClaimTrace?.length ?? 0

  logInfo('job_targeting.shadow_batch.rewrite_validation.completed', {
    caseId: params.testCase.id,
    source: params.testCase.source,
    rewriteSucceeded: true,
    hasOptimizedCvState: true,
    hasSectionRewritePlans: Boolean(rewrite.sectionRewritePlans?.length),
    generatedClaimTraceCount,
    validationIssueTypes: issueTypes,
    validationBlocked: validation.blocked,
    missingTraceCount,
  })

  const validationSnapshot: ShadowValidationSnapshot = {
    executed: true,
    mode: 'real_llm',
    blocked: validation.blocked,
    issueTypes,
    factualViolation: validation.blocked,
    generatedClaimTraceCount,
    missingTraceCount,
    rewriteSucceeded: true,
    retryAttempted: false,
    fallbackUsed: false,
    cacheHit: false,
    hasOptimizedCvState: true,
    hasSectionRewritePlans: Boolean(rewrite.sectionRewritePlans?.length),
    traceFallbackUsed: false,
  }
  await writeCache(params.llmCacheDir, cacheKey, validationSnapshot)
  return validationSnapshot
}

function classifyRewriteValidationFailure(params: {
  errorCode?: ToolErrorCode
  errorMessage?: string
  hasAssessment: boolean
  hasClaimPolicy: boolean
}): string {
  if (!params.hasAssessment) {
    return 'rewrite_missing_assessment'
  }

  if (!params.hasClaimPolicy) {
    return 'rewrite_missing_claim_policy'
  }

  if (params.errorCode === 'LLM_INVALID_OUTPUT') {
    return 'rewrite_structured_output_invalid'
  }

  if (params.errorCode === 'RATE_LIMITED' || params.errorCode === 'UNAUTHORIZED' || params.errorCode === 'GENERATION_ERROR') {
    return 'rewrite_model_call_failed'
  }

  if (/timeout|timed out|OPENAI_TIMEOUT/iu.test(params.errorMessage ?? '')) {
    return 'rewrite_timeout'
  }

  if (/trace/iu.test(params.errorMessage ?? '')) {
    return 'rewrite_missing_generated_trace'
  }

  return 'rewrite_failed'
}

function shouldUseSyntheticTraceFallback(
  testCase: JobTargetingShadowCase,
  issueType: string,
): boolean {
  return testCase.source === 'synthetic'
    && issueType === 'rewrite_model_call_failed'
}

function validatePreservedCvStateTrace(params: {
  testCase: JobTargetingShadowCase
  targetingPlan: TargetingPlan
  assessment: JobCompatibilityAssessment
}): Pick<ShadowValidationSnapshot, 'blocked' | 'issueTypes' | 'factualViolation' | 'generatedClaimTraceCount' | 'missingTraceCount'> {
  const sections: GeneratedClaimTraceSection[] = ['summary', 'experience', 'skills', 'education', 'certifications']
  const sectionRewritePlans = sections.map((section) => buildSectionRewritePlan({
    section,
    originalCvState: params.testCase.cvState,
    generatedCvState: params.testCase.cvState,
    claimPolicy: params.assessment.claimPolicy,
  }))
  const generatedClaimTraces = buildGeneratedClaimTraceFromSectionPlans(sectionRewritePlans)
  const validation = validateGeneratedClaims({
    generatedCvState: params.testCase.cvState,
    generatedClaimTraces,
    requireClaimTrace: true,
    claimPolicy: params.assessment.claimPolicy,
    targetRole: {
      value: params.assessment.targetRole,
      permission: params.targetingPlan.targetRolePositioning?.permission,
    },
  })
  const issueTypes = Array.from(new Set(validation.issues.map((issue) => issue.type)))
  const missingTraceCount = validation.issues.filter((issue) => issue.type === 'missing_claim_trace').length

  return {
    blocked: validation.blocked,
    issueTypes,
    factualViolation: false,
    generatedClaimTraceCount: generatedClaimTraces.length,
    missingTraceCount,
  }
}

function sanitizeDebugMessage(message: string | undefined): string | undefined {
  if (!message) {
    return undefined
  }

  return message
    .replace(/sk-[A-Za-z0-9_-]+/gu, '[redacted]')
    .slice(0, 240)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function errorResult(params: {
  testCase: JobTargetingShadowCase
  startedAt: string
  gapAnalysisSource: ShadowGapAnalysisSource
  runConfig: ShadowBatchRunConfig
  error: unknown
}): ShadowBatchResult {
  const completedAt = new Date().toISOString()
  const message = params.error instanceof Error ? params.error.message : String(params.error)

  return {
    caseId: params.testCase.id,
    ...(params.testCase.domain === undefined ? {} : { domain: params.testCase.domain }),
    source: params.testCase.source,
    gapAnalysisSource: params.gapAnalysisSource,
    runConfig: params.runConfig,
    legacy: {},
    assessment: {
      score: 0,
      lowFitTriggered: true,
      supportedCount: 0,
      adjacentCount: 0,
      unsupportedCount: 0,
      forbiddenClaimCount: 0,
      criticalGaps: [],
      reviewNeededGaps: [],
      assessmentVersion: 'unavailable',
      scoreVersion: 'unavailable',
      catalogVersion: 'unavailable',
    },
    comparison: {
      scoreDelta: 0,
      lowFitDelta: false,
      criticalGapDelta: 0,
      unsupportedDelta: 0,
    },
    runtime: {
      startedAt: params.startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - Date.parse(params.startedAt)),
      success: false,
      error: message,
    },
  }
}

export async function processShadowCase(params: {
  testCase: JobTargetingShadowCase
  runConfig: ShadowBatchRunConfig
  persist?: boolean
  disableLlm?: boolean
  useRealGapAnalysis?: boolean
  includeRewriteValidation?: boolean
  dryRunRewriteValidation?: boolean
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
}): Promise<ShadowBatchResult> {
  const startedAt = new Date().toISOString()
  let gapAnalysisSource: ShadowGapAnalysisSource = params.useRealGapAnalysis
    ? 'real_llm'
    : params.testCase.gapAnalysis
      ? 'provided'
      : 'synthetic'

  try {
    const resolvedGapAnalysis = await resolveGapAnalysis({
      testCase: params.testCase,
      useRealGapAnalysis: params.useRealGapAnalysis ?? false,
      reuseCachedLlmResults: params.reuseCachedLlmResults,
      llmCacheDir: params.llmCacheDir,
    })
    const gapAnalysis = resolvedGapAnalysis.gapAnalysis
    gapAnalysisSource = resolvedGapAnalysis.gapAnalysisSource
    const { legacy, targetingPlan } = await runLegacyCompatibilityPath({
      testCase: params.testCase,
      gapAnalysis,
      disableLlm: params.disableLlm ?? true,
    })
    const assessment = await evaluateJobCompatibility({
      cvState: params.testCase.cvState,
      targetJobDescription: params.testCase.targetJobDescription,
      gapAnalysis,
      sessionId: `shadow_case_${params.testCase.id}`,
    })
    const validationRequested = (params.includeRewriteValidation ?? false)
      || (params.dryRunRewriteValidation ?? false)
    const validation = validationRequested
      ? await runRewriteValidation({
          testCase: params.testCase,
          gapAnalysis,
          targetingPlan,
          assessment,
          allowLlm: !(params.disableLlm ?? true),
          dryRun: params.dryRunRewriteValidation ?? false,
          reuseCachedLlmResults: params.reuseCachedLlmResults,
          llmCacheDir: params.llmCacheDir,
        })
      : undefined
    const cacheHits = [
      resolvedGapAnalysis.cacheHit,
      validation?.cacheHit === true,
    ].filter(Boolean).length
    const cacheMisses = [
      params.useRealGapAnalysis === true && !resolvedGapAnalysis.cacheHit,
      params.includeRewriteValidation === true && params.dryRunRewriteValidation !== true && validation?.cacheHit !== true,
    ].filter(Boolean).length
    const rewriteCalled = Boolean(params.includeRewriteValidation && !(params.dryRunRewriteValidation ?? false) && validation?.cacheHit !== true)
    const estimatedIncurredCostUsd = Math.round((
      (resolvedGapAnalysis.llmCalled ? SHADOW_BATCH_ESTIMATED_COST_USD.gapAnalysisPerCase : 0)
      + (rewriteCalled ? SHADOW_BATCH_ESTIMATED_COST_USD.rewriteValidationPerCase : 0)
    ) * 100) / 100

    if (params.persist) {
      const { createJobCompatibilityShadowComparison } = await import('@/lib/db/job-compatibility-shadow-comparison')
      await createJobCompatibilityShadowComparison({
        caseId: params.testCase.id,
        source: 'batch',
        legacy,
        assessment,
      })
    }

    return buildShadowBatchResult({
      caseId: params.testCase.id,
      domain: params.testCase.domain,
      source: params.testCase.source,
      gapAnalysisSource,
      runConfig: params.runConfig,
      legacy,
      assessment: snapshotAssessment(assessment),
      validation,
      llmUsage: {
        gapAnalysisCalled: resolvedGapAnalysis.llmCalled,
        rewriteCalled,
        cacheHit: cacheHits > 0,
        cacheHits,
        cacheMisses,
        estimatedCostUsd: estimatedIncurredCostUsd,
      },
      startedAt,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    return errorResult({
      testCase: params.testCase,
      startedAt,
      gapAnalysisSource,
      runConfig: params.runConfig,
      error,
    })
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      const item = items[currentIndex]
      if (item === undefined) {
        continue
      }
      results[currentIndex] = await worker(item)
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, runWorker))
  return results
}

export async function writeShadowBatchResults(
  outputPath: string,
  results: ShadowBatchResult[],
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${results.map((result) => JSON.stringify(result)).join('\n')}\n`,
    'utf8',
  )
}

export async function runShadowBatch(options: RunShadowBatchOptions): Promise<RunShadowBatchSummary> {
  const cases = await loadShadowCases(options.inputPath)
  const selectedCases = cases.slice(0, options.limit ?? cases.length)
  const dryRunRewriteValidation = options.dryRunRewriteValidation ?? false
  const includeRewriteValidation = options.includeRewriteValidation ?? false
  const useRealGapAnalysis = options.useRealGapAnalysis ?? false
  validateCostGuards({
    caseCount: selectedCases.length,
    useRealGapAnalysis,
    includeRewriteValidation,
    dryRunRewriteValidation,
    confirmLlmCost: options.confirmLlmCost,
    maxLlmCases: options.maxLlmCases,
    maxEstimatedCostUsd: options.maxEstimatedCostUsd,
    enforceCostGuards: options.enforceCostGuards ?? process.env.NODE_ENV !== 'test',
  })
  if (options.reuseCachedLlmResults && options.llmCacheDir) {
    assertLocalCacheDir(options.llmCacheDir)
  }
  const effectiveConcurrency = Math.max(1, options.concurrency ?? (
    includeRewriteValidation
      ? 1
      : useRealGapAnalysis
        ? 2
        : 3
  ))
  const allowLlm = useRealGapAnalysis || (includeRewriteValidation && !dryRunRewriteValidation)
  const runConfig: ShadowBatchRunConfig = {
    allowLlm,
    useRealGapAnalysis,
    includeRewriteValidation: includeRewriteValidation || dryRunRewriteValidation,
    ...(dryRunRewriteValidation ? { dryRunRewriteValidation: true } : {}),
    persist: options.persist ?? false,
    concurrency: effectiveConcurrency,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    inputPathHash: hashInputPath(options.inputPath),
    totalInputCases: cases.length,
    ...(options.confirmLlmCost === undefined ? {} : { confirmLlmCost: options.confirmLlmCost }),
    ...(options.maxLlmCases === undefined ? {} : { maxLlmCases: options.maxLlmCases }),
    ...(options.maxEstimatedCostUsd === undefined ? {} : { maxEstimatedCostUsd: options.maxEstimatedCostUsd }),
    ...(options.reuseCachedLlmResults === undefined ? {} : { reuseCachedLlmResults: options.reuseCachedLlmResults }),
    ...(options.llmCacheDir === undefined ? {} : { llmCacheDir: options.llmCacheDir }),
  }
  const results = await runWithConcurrency(
    selectedCases,
    effectiveConcurrency,
    (testCase) => processShadowCase({
      testCase,
      runConfig,
      persist: options.persist ?? false,
      disableLlm: !allowLlm,
      useRealGapAnalysis,
      includeRewriteValidation,
      dryRunRewriteValidation,
      reuseCachedLlmResults: options.reuseCachedLlmResults ?? false,
      llmCacheDir: options.llmCacheDir,
    }),
  )

  await writeShadowBatchResults(options.outputPath, results)

  return {
    total: results.length,
    successful: results.filter((result) => result.runtime.success).length,
    failed: results.filter((result) => !result.runtime.success).length,
    outputPath: options.outputPath,
  }
}
