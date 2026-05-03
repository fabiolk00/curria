import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

type GapAnalysisSource = 'provided' | 'synthetic' | 'real_llm'
type PipelineRepresentativeness = 'full' | 'partial'
type RewriteValidationCoverage = 'none' | 'partial' | 'full'

type ShadowRunConfigRecord = {
  allowLlm?: boolean
  useRealGapAnalysis?: boolean
  includeRewriteValidation?: boolean
  dryRunRewriteValidation?: boolean
  persist?: boolean
  concurrency?: number
  limit?: number
  inputPathHash?: string
  totalInputCases?: number
  confirmLlmCost?: boolean
  maxLlmCases?: number
  maxEstimatedCostUsd?: number
  reuseCachedLlmResults?: boolean
  llmCacheDir?: string
  providerCooldownMs?: number
  maxProviderRetries?: number
  stopOnProviderCircuitOpen?: boolean
  resumeFailedFrom?: string
  skipSuccessfulFrom?: string
}

export type ShadowComparisonRecord = {
  caseId?: string
  domain?: string
  requirementType?: string
  gapAnalysisSource?: GapAnalysisSource
  runConfig?: ShadowRunConfigRecord
  legacyScore?: number
  assessmentScore?: number
  scoreDelta?: number
  legacyCriticalGapsCount?: number
  assessmentCriticalGapsCount?: number
  criticalGapDelta?: number
  legacyLowFitTriggered?: boolean
  assessmentLowFitTriggered?: boolean
  lowFitDelta?: boolean
  legacyUnsupportedCount?: number
  assessmentUnsupportedCount?: number
  unsupportedDelta?: number
  assessmentSupportedCount?: number
  assessmentAdjacentCount?: number
  assessmentForbiddenClaimCount?: number
  event?: string
  name?: string
  runtime?: {
    success?: boolean
    error?: string
  }
  comparison?: {
    scoreDelta?: number
    lowFitDelta?: boolean
    criticalGapDelta?: number
    unsupportedDelta?: number
  }
  legacy?: {
    score?: number
    lowFitTriggered?: boolean
    unsupportedCount?: number
    criticalGaps?: string[]
  }
  assessment?: {
    score?: number
    lowFitTriggered?: boolean
    supportedCount?: number
    adjacentCount?: number
    unsupportedCount?: number
    forbiddenClaimCount?: number
    criticalGaps?: string[]
  }
  validation?: {
    executed?: boolean
    mode?: 'real_llm' | 'dry_run'
    blocked?: boolean
    issueTypes?: string[]
    factualViolation?: boolean
    operationalFailure?: boolean
    providerIssueType?: string
    generatedClaimTraceCount?: number
    missingTraceCount?: number
  }
  llmUsage?: {
    gapAnalysisCalled?: boolean
    rewriteCalled?: boolean
    cacheHit?: boolean
    cacheHits?: number
    cacheMisses?: number
    providerRetryCount?: number
    providerCooldownMs?: number
    estimatedCostUsd?: number
    actualInputTokens?: number
    actualOutputTokens?: number
    actualCostUsd?: number
  }
}

export type ShadowDivergenceReport = {
  CUTOVER_READY: boolean
  cutoverReasons: string[]
  runConfig: {
    allowLlm: boolean
    useRealGapAnalysis: boolean
    includeRewriteValidation: boolean
    dryRunRewriteValidation: boolean
    persist: boolean
    limit?: number
    concurrency: number
    totalInputCases: number
    processedCases: number
    confirmLlmCost: boolean
    maxLlmCases?: number
    maxEstimatedCostUsd?: number
    reuseCachedLlmResults: boolean
    llmCacheDir?: string
    providerCooldownMs?: number
    maxProviderRetries?: number
    stopOnProviderCircuitOpen: boolean
    resumeFailedFrom?: string
    skipSuccessfulFrom?: string
    gapAnalysisSources: {
      provided: number
      synthetic: number
      realLlm: number
    }
    pipelineRepresentativeness: PipelineRepresentativeness
    rewriteValidationCoverage: RewriteValidationCoverage
  }
  cost: {
    estimatedCostUsd: number
    actualCostUsd?: number
    llmCases: number
    gapAnalysisCalls: number
    rewriteCalls: number
    cacheHits: number
    cacheMisses: number
    providerRetryCount: number
    providerCooldownMs?: number
  }
  totalCases: number
  successfulCases: number
  failedCases: number
  scoreDelta: {
    meanAbsolute: number
    p50: number
    p90: number
    p95: number
  }
  lowFitDivergentCount: number
  criticalGapDivergentCount: number
  possibleFalsePositiveCandidates: number
  possibleFalseNegativeCandidates: number
  factualValidationViolations: number
  rewriteValidationBlockedCases: number
  rewriteValidationOperationalIssueCases: number
  providerOperationalFailures: number
  providerRateLimitedCases: number
  providerCircuitOpenCases: number
  providerShortCircuitedCases: number
  confirmedFalsePositiveForbiddenClaims: number
  confirmedFalseNegativeCoreExplicit: number
  top30LargestScoreDivergences: Array<{
    caseId: string
    domain: string
    scoreDelta: number
    absoluteScoreDelta: number
  }>
  topDivergencesByDomain: Array<{ key: string; count: number; meanAbsoluteScoreDelta: number }>
  topDivergencesByRequirementKind: Array<{ key: string; count: number; meanAbsoluteScoreDelta: number }>
}

const EVENT_NAME = 'job_targeting.compatibility.shadow_comparison'

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function hasRewriteOperationalIssue(record: ShadowComparisonRecord): boolean {
  return Boolean(record.validation?.issueTypes?.some((issueType: string) => (
    /^rewrite_/u.test(issueType)
    || issueType === 'shadow_trace_fallback_used'
    || isProviderIssueType(issueType)
  )))
}

function isProviderIssueType(issueType: string): boolean {
  return issueType === 'provider_rate_limited'
    || issueType === 'provider_circuit_open'
    || issueType === 'provider_short_circuited'
    || issueType === 'provider_temporary_failure'
}

function hasProviderOperationalFailure(record: ShadowComparisonRecord): boolean {
  return record.validation?.operationalFailure === true
    || Boolean(record.validation?.issueTypes?.some(isProviderIssueType))
}

export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  )

  return sorted[index] ?? 0
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function readRecordScoreDelta(record: ShadowComparisonRecord): number {
  return record.comparison?.scoreDelta
    ?? record.scoreDelta
    ?? ((record.assessment?.score ?? record.assessmentScore ?? 0) - (record.legacy?.score ?? record.legacyScore ?? 0))
}

function readLowFitDelta(record: ShadowComparisonRecord): boolean {
  return record.comparison?.lowFitDelta
    ?? record.lowFitDelta
    ?? (Boolean(record.legacy?.lowFitTriggered ?? record.legacyLowFitTriggered)
      !== Boolean(record.assessment?.lowFitTriggered ?? record.assessmentLowFitTriggered))
}

function readCriticalGapDelta(record: ShadowComparisonRecord): number {
  const legacyCount = record.legacy?.criticalGaps?.length ?? record.legacyCriticalGapsCount ?? 0
  const assessmentCount = record.assessment?.criticalGaps?.length ?? record.assessmentCriticalGapsCount ?? 0

  return record.comparison?.criticalGapDelta
    ?? record.criticalGapDelta
    ?? (assessmentCount - legacyCount)
}

function readUnsupportedDelta(record: ShadowComparisonRecord): number {
  return record.comparison?.unsupportedDelta
    ?? record.unsupportedDelta
    ?? ((record.assessment?.unsupportedCount ?? record.assessmentUnsupportedCount ?? 0)
      - (record.legacy?.unsupportedCount ?? record.legacyUnsupportedCount ?? 0))
}

function isSuccessful(record: ShadowComparisonRecord): boolean {
  return record.runtime?.success !== false
}

function everyRecord(records: ShadowComparisonRecord[], predicate: (record: ShadowComparisonRecord) => boolean): boolean {
  return records.length > 0 && records.every(predicate)
}

function groupTop(
  records: ShadowComparisonRecord[],
  getKey: (record: ShadowComparisonRecord) => string | undefined,
): Array<{ key: string; count: number; meanAbsoluteScoreDelta: number }> {
  const groups = new Map<string, number[]>()

  records.forEach((record) => {
    const groupKey = getKey(record)?.trim() || 'unknown'
    const delta = Math.abs(readRecordScoreDelta(record))

    groups.set(groupKey, [...(groups.get(groupKey) ?? []), delta])
  })

  return [...groups.entries()]
    .map(([groupKey, values]) => ({
      key: groupKey,
      count: values.length,
      meanAbsoluteScoreDelta: round(average(values)),
    }))
    .sort((left, right) => right.meanAbsoluteScoreDelta - left.meanAbsoluteScoreDelta || right.count - left.count)
    .slice(0, 10)
}

function shouldKeepRecord(record: ShadowComparisonRecord): boolean {
  const eventName = record.event ?? record.name
  return eventName === undefined || eventName === EVENT_NAME
}

export function parseShadowComparisonInput(source: string): ShadowComparisonRecord[] {
  const trimmed = source.trim()
  if (!trimmed) {
    return []
  }

  const rawRecords = trimmed.startsWith('[')
    ? JSON.parse(trimmed) as unknown[]
    : trimmed
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as unknown)

  return rawRecords
    .filter((record): record is ShadowComparisonRecord => Boolean(record) && typeof record === 'object')
    .filter(shouldKeepRecord)
}

function buildRunConfig(records: ShadowComparisonRecord[]): ShadowDivergenceReport['runConfig'] {
  const processedCases = records.length
  const successfulRecords = records.filter(isSuccessful)
  const provided = records.filter((record) => record.gapAnalysisSource === 'provided').length
  const synthetic = records.filter((record) => record.gapAnalysisSource === 'synthetic' || record.gapAnalysisSource === undefined).length
  const realLlm = records.filter((record) => record.gapAnalysisSource === 'real_llm').length
  const useRealGapAnalysis = everyRecord(records, (record) => record.runConfig?.useRealGapAnalysis === true)
  const includeRewriteValidation = everyRecord(records, (record) => record.runConfig?.includeRewriteValidation === true)
  const dryRunRewriteValidation = everyRecord(records, (record) => record.runConfig?.dryRunRewriteValidation === true)
  const persist = everyRecord(records, (record) => record.runConfig?.persist === true)
  const confirmLlmCost = everyRecord(records, (record) => record.runConfig?.confirmLlmCost === true)
  const reuseCachedLlmResults = everyRecord(records, (record) => record.runConfig?.reuseCachedLlmResults === true)
  const validationExecutedCount = successfulRecords.filter((record) => record.validation?.executed === true).length
  const rewriteValidationCoverage: RewriteValidationCoverage = validationExecutedCount === 0
    ? 'none'
    : validationExecutedCount === successfulRecords.length
      ? 'full'
      : 'partial'
  const pipelineRepresentativeness: PipelineRepresentativeness = processedCases > 0
  && (useRealGapAnalysis || provided === processedCases)
    ? 'full'
    : 'partial'
  const limits = new Set(records.map((record) => record.runConfig?.limit).filter((value): value is number => typeof value === 'number'))
  const maxLlmCases = new Set(records.map((record) => record.runConfig?.maxLlmCases).filter((value): value is number => typeof value === 'number'))
  const maxEstimatedCostUsd = new Set(records.map((record) => record.runConfig?.maxEstimatedCostUsd).filter((value): value is number => typeof value === 'number'))
  const providerCooldownMs = new Set(records.map((record) => record.runConfig?.providerCooldownMs).filter((value): value is number => typeof value === 'number'))
  const maxProviderRetries = new Set(records.map((record) => record.runConfig?.maxProviderRetries).filter((value): value is number => typeof value === 'number'))
  const llmCacheDirs = new Set(records.map((record) => record.runConfig?.llmCacheDir).filter((value): value is string => typeof value === 'string' && value.length > 0))
  const resumeFailedFrom = new Set(records.map((record) => record.runConfig?.resumeFailedFrom).filter((value): value is string => typeof value === 'string' && value.length > 0))
  const skipSuccessfulFrom = new Set(records.map((record) => record.runConfig?.skipSuccessfulFrom).filter((value): value is string => typeof value === 'string' && value.length > 0))
  const totalInputCases = Math.max(
    processedCases,
    ...records.map((record) => record.runConfig?.totalInputCases ?? 0),
  )

  return {
    allowLlm: everyRecord(records, (record) => record.runConfig?.allowLlm === true),
    useRealGapAnalysis,
    includeRewriteValidation,
    dryRunRewriteValidation,
    persist,
    ...(limits.size === 1 ? { limit: [...limits][0] } : {}),
    concurrency: Math.max(0, ...records.map((record) => record.runConfig?.concurrency ?? 0)),
    totalInputCases,
    processedCases,
    confirmLlmCost,
    ...(maxLlmCases.size === 1 ? { maxLlmCases: [...maxLlmCases][0] } : {}),
    ...(maxEstimatedCostUsd.size === 1 ? { maxEstimatedCostUsd: [...maxEstimatedCostUsd][0] } : {}),
    reuseCachedLlmResults,
    ...(llmCacheDirs.size === 1 ? { llmCacheDir: [...llmCacheDirs][0] } : {}),
    ...(providerCooldownMs.size === 1 ? { providerCooldownMs: [...providerCooldownMs][0] } : {}),
    ...(maxProviderRetries.size === 1 ? { maxProviderRetries: [...maxProviderRetries][0] } : {}),
    stopOnProviderCircuitOpen: everyRecord(records, (record) => record.runConfig?.stopOnProviderCircuitOpen !== false),
    ...(resumeFailedFrom.size === 1 ? { resumeFailedFrom: [...resumeFailedFrom][0] } : {}),
    ...(skipSuccessfulFrom.size === 1 ? { skipSuccessfulFrom: [...skipSuccessfulFrom][0] } : {}),
    gapAnalysisSources: {
      provided,
      synthetic,
      realLlm,
    },
    pipelineRepresentativeness,
    rewriteValidationCoverage,
  }
}

function buildCostSummary(records: ShadowComparisonRecord[]): ShadowDivergenceReport['cost'] {
  const estimatedCostUsd = round(sum(records.map((record) => record.llmUsage?.estimatedCostUsd ?? 0)))
  const actualCosts = records
    .map((record) => record.llmUsage?.actualCostUsd)
    .filter((value): value is number => typeof value === 'number')
  const gapAnalysisCalls = records.filter((record) => record.llmUsage?.gapAnalysisCalled === true).length
  const rewriteCalls = records.filter((record) => record.llmUsage?.rewriteCalled === true).length
  const cacheHits = sum(records.map((record) => (
    typeof record.llmUsage?.cacheHits === 'number'
      ? record.llmUsage.cacheHits
      : record.llmUsage?.cacheHit
        ? 1
        : 0
  )))
  const cacheMisses = sum(records.map((record) => record.llmUsage?.cacheMisses ?? 0))
  const providerRetryCount = sum(records.map((record) => record.llmUsage?.providerRetryCount ?? 0))
  const providerCooldownValues = records
    .map((record) => record.llmUsage?.providerCooldownMs)
    .filter((value): value is number => typeof value === 'number')

  return {
    estimatedCostUsd,
    ...(actualCosts.length > 0 ? { actualCostUsd: round(sum(actualCosts)) } : {}),
    llmCases: records.filter((record) => (
      record.llmUsage?.gapAnalysisCalled === true || record.llmUsage?.rewriteCalled === true
    )).length,
    gapAnalysisCalls,
    rewriteCalls,
    cacheHits,
    cacheMisses,
    providerRetryCount,
    ...(providerCooldownValues.length > 0
      ? { providerCooldownMs: Math.max(...providerCooldownValues) }
      : {}),
  }
}

export function buildShadowDivergenceReport(records: ShadowComparisonRecord[]): ShadowDivergenceReport {
  const successfulRecords = records.filter(isSuccessful)
  const failedCases = records.length - successfulRecords.length
  const deltas = successfulRecords.map((record) => Math.abs(readRecordScoreDelta(record)))
  const runConfig = buildRunConfig(records)
  const cost = buildCostSummary(records)
  const factualValidationViolations = successfulRecords.filter((record) => record.validation?.factualViolation).length
  const rewriteValidationBlockedCases = successfulRecords.filter((record) => record.validation?.blocked).length
  const rewriteValidationOperationalIssueCases = successfulRecords.filter(hasRewriteOperationalIssue).length
  const providerOperationalFailures = successfulRecords.filter(hasProviderOperationalFailure).length
  const providerRateLimitedCases = successfulRecords.filter((record) => record.validation?.issueTypes?.includes('provider_rate_limited')).length
  const providerCircuitOpenCases = successfulRecords.filter((record) => record.validation?.issueTypes?.includes('provider_circuit_open')).length
  const providerShortCircuitedCases = successfulRecords.filter((record) => record.validation?.issueTypes?.includes('provider_short_circuited')).length
  const confirmedFalsePositiveForbiddenClaims = successfulRecords.filter((record) => (
    record.validation?.issueTypes?.some((issueType) => /forbidden|unsupported|unsafe_direct_claim/u.test(issueType))
  )).length
  const confirmedFalseNegativeCoreExplicit = successfulRecords.filter((record) => (
    record.validation?.issueTypes?.some((issueType) => /false_negative_core_explicit/u.test(issueType))
  )).length
  const meanAbsolute = round(average(deltas))
  const p95 = percentile(deltas, 95)
  const cutoverReasons: string[] = []

  if (successfulRecords.length < 500) {
    cutoverReasons.push('successful_cases_below_500')
  }
  if (meanAbsolute > 15) {
    cutoverReasons.push('mean_absolute_score_delta_above_15')
  }
  if (p95 > 30) {
    cutoverReasons.push('p95_score_delta_above_30')
  }
  if (runConfig.pipelineRepresentativeness === 'partial') {
    cutoverReasons.push('pipeline_representativeness_partial')
  }
  if (runConfig.rewriteValidationCoverage !== 'full') {
    cutoverReasons.push('rewrite_validation_not_executed')
  }
  if (
    runConfig.rewriteValidationCoverage !== 'none'
    && successfulRecords.every((record) => record.validation?.mode === 'dry_run')
  ) {
    cutoverReasons.push('rewrite_validation_dry_run_only')
  }
  if (!runConfig.persist) {
    cutoverReasons.push('shadow_results_not_persisted')
  }
  if (factualValidationViolations > 0) {
    cutoverReasons.push('factual_validation_violations_present')
  }
  if (rewriteValidationBlockedCases > 0) {
    cutoverReasons.push('rewrite_validation_blocked_cases_present')
  }
  if (rewriteValidationOperationalIssueCases > 0) {
    cutoverReasons.push('rewrite_validation_operational_issues_present')
  }
  if (providerOperationalFailures > 0) {
    cutoverReasons.push('provider_operational_failures_present')
  }
  if (confirmedFalsePositiveForbiddenClaims > 0) {
    cutoverReasons.push('confirmed_false_positive_forbidden_claims_present')
  }
  if (confirmedFalseNegativeCoreExplicit > 0) {
    cutoverReasons.push('confirmed_false_negative_core_explicit_present')
  }
  if (failedCases > 0) {
    cutoverReasons.push('failed_cases_present')
  }

  return {
    CUTOVER_READY: cutoverReasons.length === 0,
    cutoverReasons,
    runConfig,
    cost,
    totalCases: records.length,
    successfulCases: successfulRecords.length,
    failedCases,
    scoreDelta: {
      meanAbsolute,
      p50: percentile(deltas, 50),
      p90: percentile(deltas, 90),
      p95,
    },
    lowFitDivergentCount: successfulRecords.filter(readLowFitDelta).length,
    criticalGapDivergentCount: successfulRecords.filter((record) => readCriticalGapDelta(record) !== 0).length,
    possibleFalsePositiveCandidates: successfulRecords.filter((record) => (
      readRecordScoreDelta(record) > 0 && readUnsupportedDelta(record) < 0
    )).length,
    possibleFalseNegativeCandidates: successfulRecords.filter((record) => (
      readRecordScoreDelta(record) < 0 && readUnsupportedDelta(record) > 0
    )).length,
    factualValidationViolations,
    rewriteValidationBlockedCases,
    rewriteValidationOperationalIssueCases,
    providerOperationalFailures,
    providerRateLimitedCases,
    providerCircuitOpenCases,
    providerShortCircuitedCases,
    confirmedFalsePositiveForbiddenClaims,
    confirmedFalseNegativeCoreExplicit,
    top30LargestScoreDivergences: successfulRecords
      .map((record) => ({
        caseId: record.caseId ?? 'unknown',
        domain: record.domain ?? 'unknown',
        scoreDelta: readRecordScoreDelta(record),
        absoluteScoreDelta: Math.abs(readRecordScoreDelta(record)),
      }))
      .sort((left, right) => right.absoluteScoreDelta - left.absoluteScoreDelta)
      .slice(0, 30),
    topDivergencesByDomain: groupTop(successfulRecords, (record) => record.domain),
    topDivergencesByRequirementKind: groupTop(successfulRecords, (record) => record.requirementType),
  }
}

export function renderShadowDivergenceMarkdown(report: ShadowDivergenceReport): string {
  return [
    '# Job Targeting Shadow Divergence Report',
    '',
    `CUTOVER_READY=${report.CUTOVER_READY ? 'true' : 'false'}`,
    '',
    `- Total cases: ${report.totalCases}`,
    `- Successful cases: ${report.successfulCases}`,
    `- Failed cases: ${report.failedCases}`,
    `- Mean absolute score delta: ${report.scoreDelta.meanAbsolute}`,
    `- P50/P90/P95 score delta: ${report.scoreDelta.p50}/${report.scoreDelta.p90}/${report.scoreDelta.p95}`,
    `- Low-fit divergent count: ${report.lowFitDivergentCount}`,
    `- Critical gap divergent count: ${report.criticalGapDivergentCount}`,
    `- Factual validation violations: ${report.factualValidationViolations}`,
    `- Rewrite validation operational issue cases: ${report.rewriteValidationOperationalIssueCases}`,
    `- Provider operational failures: ${report.providerOperationalFailures}`,
    `- Provider rate-limited cases: ${report.providerRateLimitedCases}`,
    `- Provider circuit-open cases: ${report.providerCircuitOpenCases}`,
    `- Provider short-circuited cases: ${report.providerShortCircuitedCases}`,
    `- Pipeline representativeness: ${report.runConfig.pipelineRepresentativeness}`,
    `- Rewrite validation coverage: ${report.runConfig.rewriteValidationCoverage}`,
    `- Persisted shadow results: ${report.runConfig.persist}`,
    '',
    '## Run Config',
    '',
    `- allowLlm: ${report.runConfig.allowLlm}`,
    `- useRealGapAnalysis: ${report.runConfig.useRealGapAnalysis}`,
    `- includeRewriteValidation: ${report.runConfig.includeRewriteValidation}`,
    `- dryRunRewriteValidation: ${report.runConfig.dryRunRewriteValidation}`,
    `- confirmLlmCost: ${report.runConfig.confirmLlmCost}`,
    `- maxLlmCases: ${report.runConfig.maxLlmCases ?? 'none'}`,
    `- maxEstimatedCostUsd: ${report.runConfig.maxEstimatedCostUsd ?? 'none'}`,
    `- reuseCachedLlmResults: ${report.runConfig.reuseCachedLlmResults}`,
    `- llmCacheDir: ${report.runConfig.llmCacheDir ?? 'none'}`,
    `- providerCooldownMs: ${report.runConfig.providerCooldownMs ?? 'none'}`,
    `- maxProviderRetries: ${report.runConfig.maxProviderRetries ?? 'none'}`,
    `- stopOnProviderCircuitOpen: ${report.runConfig.stopOnProviderCircuitOpen}`,
    `- resumeFailedFrom: ${report.runConfig.resumeFailedFrom ?? 'none'}`,
    `- skipSuccessfulFrom: ${report.runConfig.skipSuccessfulFrom ?? 'none'}`,
    `- concurrency: ${report.runConfig.concurrency}`,
    `- limit: ${report.runConfig.limit ?? 'none'}`,
    `- totalInputCases: ${report.runConfig.totalInputCases}`,
    `- processedCases: ${report.runConfig.processedCases}`,
    `- gapAnalysisSources: provided=${report.runConfig.gapAnalysisSources.provided}, synthetic=${report.runConfig.gapAnalysisSources.synthetic}, realLlm=${report.runConfig.gapAnalysisSources.realLlm}`,
    '',
    '## Cost / LLM Usage',
    '',
    `- Estimated cost: $${report.cost.estimatedCostUsd.toFixed(2)}`,
    `- Actual cost: ${typeof report.cost.actualCostUsd === 'number' ? `$${report.cost.actualCostUsd.toFixed(2)}` : 'unknown'}`,
    `- LLM cases: ${report.cost.llmCases}`,
    `- Gap analysis calls: ${report.cost.gapAnalysisCalls}`,
    `- Rewrite calls: ${report.cost.rewriteCalls}`,
    `- Cache hits: ${report.cost.cacheHits}`,
    `- Cache misses: ${report.cost.cacheMisses}`,
    `- Provider retry count: ${report.cost.providerRetryCount}`,
    `- Provider cooldown ms: ${report.cost.providerCooldownMs ?? 'none'}`,
    '',
    '## Cutover Reasons',
    '',
    ...(report.cutoverReasons.length > 0
      ? report.cutoverReasons.map((reason) => `- ${reason}`)
      : ['- none']),
    '',
    '## Largest Score Divergences',
    '',
    ...report.top30LargestScoreDivergences.map((item) => (
      `- ${item.caseId} (${item.domain}): delta=${item.scoreDelta}, abs=${item.absoluteScoreDelta}`
    )),
    '',
  ].join('\n')
}

export function writeShadowDivergenceReport(params: {
  records: ShadowComparisonRecord[]
  outputDir: string
}): ShadowDivergenceReport {
  const report = buildShadowDivergenceReport(params.records)
  mkdirSync(params.outputDir, { recursive: true })
  writeFileSync(path.join(params.outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(path.join(params.outputDir, 'report.md'), renderShadowDivergenceMarkdown(report), 'utf8')
  return report
}

function parseCliArgs(args: string[]): { inputPaths: string[]; outputDir?: string } {
  const inputPaths: string[] = []
  let outputDir: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--output-dir') {
      outputDir = args[index + 1]
      index += 1
      continue
    }
    if (arg) {
      inputPaths.push(arg)
    }
  }

  return { inputPaths, outputDir }
}

function main() {
  const { inputPaths, outputDir } = parseCliArgs(process.argv.slice(2))
  if (inputPaths.length === 0) {
    console.error('Usage: tsx scripts/job-targeting/analyze-shadow-divergence.ts <jsonl-file...> [--output-dir .local/job-targeting-shadow-results]')
    process.exitCode = 1
    return
  }

  const records = inputPaths.flatMap((inputPath) => parseShadowComparisonInput(readFileSync(inputPath, 'utf8')))
  const report = outputDir
    ? writeShadowDivergenceReport({ records, outputDir })
    : buildShadowDivergenceReport(records)

  console.log(JSON.stringify(report, null, 2))
}

if (require.main === module) {
  main()
}
