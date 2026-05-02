import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import { validateGeneratedClaims } from '@/lib/agent/job-targeting/compatibility/structured-validation'
import {
  buildShadowBatchResult,
  snapshotAssessment,
} from '@/lib/agent/job-targeting/shadow-comparison'
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
import { createJobCompatibilityShadowComparison } from '@/lib/db/job-compatibility-shadow-comparison'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
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
}

export type RunShadowBatchSummary = {
  total: number
  successful: number
  failed: number
  outputPath: string
}

function hashInputPath(inputPath: string): string {
  return createHash('sha256')
    .update(path.resolve(inputPath))
    .digest('hex')
    .slice(0, 16)
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
}): Promise<{
  gapAnalysis: GapAnalysisResult
  gapAnalysisSource: ShadowGapAnalysisSource
}> {
  if (params.useRealGapAnalysis) {
    const execution = await analyzeGap(
      params.testCase.cvState,
      params.testCase.targetJobDescription,
      'shadow_batch',
      `shadow_case_${params.testCase.id}`,
    )

    if (!execution.result) {
      throw new Error(execution.output.success ? 'Real gap analysis returned no result.' : execution.output.error)
    }

    return {
      gapAnalysis: execution.result,
      gapAnalysisSource: 'real_llm',
    }
  }

  if (params.testCase.gapAnalysis) {
    return {
      gapAnalysis: params.testCase.gapAnalysis,
      gapAnalysisSource: 'provided',
    }
  }

  return {
    gapAnalysis: buildBatchGapAnalysis(params.testCase),
    gapAnalysisSource: 'synthetic',
  }
}

async function runRewriteValidation(params: {
  testCase: JobTargetingShadowCase
  gapAnalysis: GapAnalysisResult
  targetingPlan: TargetingPlan
  assessment: JobCompatibilityAssessment
  allowLlm: boolean
}): Promise<ShadowValidationSnapshot> {
  if (!params.allowLlm) {
    return {
      executed: true,
      blocked: true,
      issueTypes: ['rewrite_validation_requires_llm'],
      factualViolation: false,
      generatedClaimTraceCount: 0,
      missingTraceCount: 0,
    }
  }

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
    return {
      executed: true,
      blocked: true,
      issueTypes: ['rewrite_failed'],
      factualViolation: false,
      generatedClaimTraceCount: rewrite.generatedClaimTrace?.length ?? 0,
      missingTraceCount: 0,
    }
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

  return {
    executed: true,
    blocked: validation.blocked,
    issueTypes,
    factualViolation: validation.blocked,
    generatedClaimTraceCount: rewrite.generatedClaimTrace?.length ?? 0,
    missingTraceCount,
  }
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
    const validation = params.includeRewriteValidation
      ? await runRewriteValidation({
          testCase: params.testCase,
          gapAnalysis,
          targetingPlan,
          assessment,
          allowLlm: !(params.disableLlm ?? true),
        })
      : undefined

    if (params.persist) {
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
  const effectiveConcurrency = Math.max(1, options.concurrency ?? (
    options.includeRewriteValidation
      ? 1
      : options.useRealGapAnalysis
        ? 2
        : 3
  ))
  const runConfig: ShadowBatchRunConfig = {
    allowLlm: !(options.disableLlm ?? true) || (options.useRealGapAnalysis ?? false),
    useRealGapAnalysis: options.useRealGapAnalysis ?? false,
    includeRewriteValidation: options.includeRewriteValidation ?? false,
    persist: options.persist ?? false,
    concurrency: effectiveConcurrency,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    inputPathHash: hashInputPath(options.inputPath),
    totalInputCases: cases.length,
  }
  const results = await runWithConcurrency(
    selectedCases,
    effectiveConcurrency,
    (testCase) => processShadowCase({
      testCase,
      runConfig,
      persist: options.persist ?? false,
      disableLlm: options.disableLlm ?? true,
      useRealGapAnalysis: options.useRealGapAnalysis ?? false,
      includeRewriteValidation: options.includeRewriteValidation ?? false,
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
