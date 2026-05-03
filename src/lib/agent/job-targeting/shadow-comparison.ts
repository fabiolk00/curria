import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
import type {
  ShadowAssessmentSnapshot,
  ShadowBatchResult,
  ShadowBatchRunConfig,
  ShadowComparisonSnapshot,
  ShadowGapAnalysisSource,
  ShadowLegacySnapshot,
} from '@/lib/agent/job-targeting/shadow-case-types'

export function buildCatalogVersionString(assessment: Pick<JobCompatibilityAssessment, 'catalog'>): string {
  return Object.entries(assessment.catalog.catalogVersions)
    .map(([id, version]) => `${id}@${version}`)
    .join(',')
}

export function snapshotAssessment(
  assessment: JobCompatibilityAssessment,
): ShadowAssessmentSnapshot {
  return {
    score: assessment.scoreBreakdown.total,
    lowFitTriggered: assessment.lowFit.triggered,
    supportedCount: assessment.supportedRequirements.length,
    adjacentCount: assessment.adjacentRequirements.length,
    unsupportedCount: assessment.unsupportedRequirements.length,
    forbiddenClaimCount: assessment.claimPolicy.forbiddenClaims.length,
    criticalGaps: assessment.criticalGaps.map((gap) => gap.signal),
    reviewNeededGaps: assessment.reviewNeededGaps.map((gap) => gap.signal),
    assessmentVersion: assessment.audit.assessmentVersion,
    scoreVersion: assessment.audit.scoreVersion,
    catalogVersion: buildCatalogVersionString(assessment),
  }
}

export function compareShadowSnapshots(params: {
  legacy: ShadowLegacySnapshot
  assessment: ShadowAssessmentSnapshot
}): ShadowComparisonSnapshot {
  return {
    scoreDelta: params.assessment.score - (params.legacy.score ?? 0),
    lowFitDelta: Boolean(params.legacy.lowFitTriggered) !== params.assessment.lowFitTriggered,
    criticalGapDelta: params.assessment.criticalGaps.length - (params.legacy.criticalGaps?.length ?? 0),
    unsupportedDelta: params.assessment.unsupportedCount - (params.legacy.unsupportedCount ?? 0),
  }
}

export function buildShadowBatchResult(params: {
  caseId: string
  domain?: string
  source?: ShadowBatchResult['source']
  gapAnalysisSource: ShadowGapAnalysisSource
  runConfig: ShadowBatchRunConfig
  legacy: ShadowLegacySnapshot
  assessment: ShadowAssessmentSnapshot
  validation?: ShadowBatchResult['validation']
  llmUsage?: ShadowBatchResult['llmUsage']
  startedAt: string
  completedAt: string
  error?: string
}): ShadowBatchResult {
  return {
    caseId: params.caseId,
    ...(params.domain === undefined ? {} : { domain: params.domain }),
    ...(params.source === undefined ? {} : { source: params.source }),
    gapAnalysisSource: params.gapAnalysisSource,
    runConfig: params.runConfig,
    legacy: params.legacy,
    assessment: params.assessment,
    comparison: compareShadowSnapshots({
      legacy: params.legacy,
      assessment: params.assessment,
    }),
    ...(params.validation === undefined ? {} : { validation: params.validation }),
    ...(params.llmUsage === undefined ? {} : { llmUsage: params.llmUsage }),
    runtime: {
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      latencyMs: Math.max(0, Date.parse(params.completedAt) - Date.parse(params.startedAt)),
      success: params.error === undefined,
      ...(params.error === undefined ? {} : { error: params.error }),
    },
  }
}
