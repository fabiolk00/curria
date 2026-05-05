import type {
  JobCompatibilityAssessment,
  JobCompatibilityGap,
  RequirementEvidence,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'
import { includesNormalizedPhrase } from '@/lib/agent/job-targeting/semantic-normalization'

import {
  buildJobCompatibilityClaimPolicy,
  JOB_COMPATIBILITY_CLAIM_POLICY_VERSION,
} from './claim-policy'
import {
  EVIDENCE_EXTRACTION_VERSION,
  extractResumeEvidence,
} from './evidence-extraction'
import {
  classifyRequirementsWithLlm,
  type LlmRequirementResolver,
} from './llm-matcher'
import {
  JOB_MATCHER_LLM_MODEL,
  JOB_MATCHER_PROMPT_VERSION,
} from './llm-config'
import {
  extractJobRequirements,
  REQUIREMENT_EXTRACTION_VERSION,
} from './requirement-extraction'
import {
  calculateJobCompatibilityScore,
  JOB_COMPATIBILITY_SCORE_VERSION,
} from './score'
import {
  buildAssessmentDisplayScore,
  buildGapPresentation,
} from './presentation'

export const JOB_COMPATIBILITY_ASSESSMENT_VERSION = 'job-compat-assessment-v1'
const FALLBACK_TARGET_ROLE = 'Vaga Alvo'
const TARGET_ROLE_MAX_LENGTH = 90
const TARGET_ROLE_MAX_WORDS = 12

export interface CompatibilityGapAnalysisInput {
  criticalGaps?: Array<{ id?: string; text: string }>
  reviewNeededGaps?: Array<{ id?: string; text: string }>
  missingSkills?: string[]
  weakAreas?: string[]
  improvementSuggestions?: string[]
  matchScore?: number
}

export interface EvaluateJobCompatibilityInput {
  cvState: CVState
  targetJobDescription: string
  gapAnalysis?: CompatibilityGapAnalysisInput
  catalog?: unknown
  matcherEngine?: 'legacy' | 'llm'
  llmResolver?: LlmRequirementResolver
  userId?: string
  sessionId?: string
}

export async function evaluateJobCompatibility({
  cvState,
  targetJobDescription,
  gapAnalysis,
  catalog,
  matcherEngine = 'legacy',
  llmResolver,
  userId,
  sessionId,
}: EvaluateJobCompatibilityInput): Promise<JobCompatibilityAssessment> {
  const targetRole = extractTargetRole(targetJobDescription)
  const extractedRequirements = extractJobRequirements({ targetJobDescription })
  const resumeEvidence = extractResumeEvidence(cvState)

  if (matcherEngine === 'llm') {
    const result = await classifyRequirementsWithLlm({
      requirements: extractedRequirements,
      resumeEvidence,
      userId,
      sessionId,
      resolver: llmResolver,
    })

    return buildJobCompatibilityAssessment({
      targetRole,
      requirements: result.requirements,
      resumeEvidenceCount: resumeEvidence.length,
      gapAnalysis,
      userId,
      sessionId,
      matcherEngine,
      catalogIds: [],
      catalogVersions: {},
      matcherVersion: JOB_MATCHER_PROMPT_VERSION,
      matcherModel: JOB_MATCHER_LLM_MODEL,
      matcherPromptVersion: JOB_MATCHER_PROMPT_VERSION,
    })
  }

  const requirements = extractedRequirements.map((requirement) => classifyRequirementEvidenceWithoutCatalog(
    requirement,
    resumeEvidence,
  ))

  return buildJobCompatibilityAssessment({
    targetRole,
    requirements,
    resumeEvidenceCount: resumeEvidence.length,
    gapAnalysis,
    userId,
    sessionId,
    matcherEngine,
    catalogIds: [],
    catalogVersions: {},
    matcherVersion: 'job-compat-matcher-no-catalog-v1',
  })
}

function classifyRequirementEvidenceWithoutCatalog(
  requirement: ReturnType<typeof extractJobRequirements>[number],
  resumeEvidence: ReturnType<typeof extractResumeEvidence>,
): RequirementEvidence {
  const requirementTokens = meaningfulTokens(requirement.text)
  const matches = resumeEvidence
    .map((item) => ({
      item,
      overlap: requirementTokens.filter((token) => meaningfulTokens(item.text).includes(token)).length,
    }))
    .filter((item) => item.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
  const bestMatch = matches[0]
  const supported = Boolean(
    bestMatch
    && (
      includesNormalizedPhrase(normalize(requirement.text), normalize(bestMatch.item.text))
      || includesNormalizedPhrase(normalize(bestMatch.item.text), normalize(requirement.text))
      || bestMatch.overlap >= Math.min(2, requirementTokens.length)
    )
  )
  const adjacent = !supported && Boolean(bestMatch)
  const productGroup = supported ? 'supported' : adjacent ? 'adjacent' : 'unsupported'
  const evidenceLevel = supported
    ? 'strong_contextual_inference'
    : adjacent
      ? 'semantic_bridge_only'
      : 'unsupported_gap'
  const rewritePermission = supported
    ? 'can_claim_directly'
    : adjacent
      ? 'can_bridge_carefully'
      : 'must_not_claim'
  const supportingEvidence = productGroup === 'unsupported'
    ? []
    : matches.slice(0, 3).map(({ item }) => item)

  return {
    id: requirement.id,
    originalRequirement: requirement.text,
    normalizedRequirement: requirement.normalizedText,
    extractedSignals: [requirement.text],
    kind: requirement.kind,
    importance: requirement.importance,
    productGroup,
    evidenceLevel,
    rewritePermission,
    matchedResumeTerms: supportingEvidence.map((item) => item.text),
    supportingResumeSpans: supportingEvidence.map((item) => ({
      id: item.id,
      text: item.text,
      section: item.section,
      sourceKind: item.sourceKind,
      cvPath: item.cvPath,
    })),
    confidence: supported ? 0.72 : adjacent ? 0.52 : 0,
    rationale: supported ? 'no_catalog_text_match' : adjacent ? 'no_catalog_text_overlap' : 'unsupported_fallback',
    source: supported ? 'exact' : adjacent ? 'composite_decomposition' : 'fallback',
    catalogTermIds: [],
    catalogCategoryIds: [],
    prohibitedTerms: productGroup === 'unsupported' ? [requirement.text] : [],
    audit: {
      matcherVersion: 'job-compat-matcher-no-catalog-v1',
      precedence: ['exact', 'composite_decomposition', 'fallback'],
      catalogIds: [],
      catalogVersions: {},
      catalogTermIds: [],
      catalogCategoryIds: [],
    },
  }
}

function buildJobCompatibilityAssessment({
  targetRole,
  requirements,
  resumeEvidenceCount,
  gapAnalysis,
  userId,
  sessionId,
  matcherEngine,
  catalogIds,
  catalogVersions,
  matcherVersion,
  matcherModel,
  matcherPromptVersion,
}: {
  targetRole: Pick<JobCompatibilityAssessment, 'targetRole' | 'targetRoleConfidence' | 'targetRoleSource'>
  requirements: RequirementEvidence[]
  resumeEvidenceCount: number
  gapAnalysis?: CompatibilityGapAnalysisInput
  userId?: string
  sessionId?: string
  matcherEngine: 'legacy' | 'llm'
  catalogIds: string[]
  catalogVersions: Record<string, string>
  matcherVersion: string
  matcherModel?: string
  matcherPromptVersion?: string
}): JobCompatibilityAssessment {
  const supportedRequirements = requirements.filter((requirement) => requirement.productGroup === 'supported')
  const adjacentRequirements = requirements.filter((requirement) => requirement.productGroup === 'adjacent')
  const unsupportedRequirements = requirements.filter((requirement) => requirement.productGroup === 'unsupported')
  const claimPolicy = buildJobCompatibilityClaimPolicy(requirements)
  const scoreBreakdown = calculateJobCompatibilityScore(requirements)
  const criticalGaps = buildGaps({
    requirements,
    gapAnalysis,
    severity: 'critical',
  })
  const reviewNeededGaps = buildGaps({
    requirements,
    gapAnalysis,
    severity: 'review',
  })
  const displayScore = buildAssessmentDisplayScore(scoreBreakdown.total)
  const gapPresentation = buildGapPresentation({
    criticalGaps,
    reviewNeededGaps,
  })

  return {
    version: JOB_COMPATIBILITY_ASSESSMENT_VERSION,
    ...targetRole,
    requirements,
    supportedRequirements,
    adjacentRequirements,
    unsupportedRequirements,
    claimPolicy,
    scoreBreakdown,
    ...displayScore,
    gapPresentation,
    criticalGaps,
    reviewNeededGaps,
    lowFit: calculateLowFitState(requirements, scoreBreakdown.total),
    catalog: {
      catalogIds,
      catalogVersions,
    },
    audit: {
      generatedAt: new Date().toISOString(),
      assessmentVersion: JOB_COMPATIBILITY_ASSESSMENT_VERSION,
      requirementExtractionVersion: REQUIREMENT_EXTRACTION_VERSION,
      evidenceExtractionVersion: EVIDENCE_EXTRACTION_VERSION,
      matcherVersion,
      claimPolicyVersion: JOB_COMPATIBILITY_CLAIM_POLICY_VERSION,
      scoreVersion: JOB_COMPATIBILITY_SCORE_VERSION,
      matcherEngine,
      ...(matcherModel === undefined ? {} : { matcherModel }),
      ...(matcherPromptVersion === undefined ? {} : { matcherPromptVersion }),
      counters: {
        requirements: requirements.length,
        resumeEvidence: resumeEvidenceCount,
        supported: supportedRequirements.length,
        adjacent: adjacentRequirements.length,
        unsupported: unsupportedRequirements.length,
        allowedClaims: claimPolicy.allowedClaims.length,
        cautiousClaims: claimPolicy.cautiousClaims.length,
        forbiddenClaims: claimPolicy.forbiddenClaims.length,
        criticalGaps: criticalGaps.length,
        reviewNeededGaps: reviewNeededGaps.length,
      },
      warnings: scoreBreakdown.warnings,
      ...buildRunIds({ userId, sessionId }),
    },
  }
}

function extractTargetRole(
  targetJobDescription: string,
): Pick<JobCompatibilityAssessment, 'targetRole' | 'targetRoleConfidence' | 'targetRoleSource'> {
  const explicitLabelPattern = /^\s*(?:role|title|position|job\s*title|target\s*role|cargo|vaga|t[ií]tulo|nome\s+da\s+vaga)\s*[:=-]\s*(.+?)\s*$/iu
  const lines = targetJobDescription
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const candidate = line.match(explicitLabelPattern)?.[1]
    const targetRole = candidate === undefined ? '' : cleanTargetRole(candidate)

    if (targetRole && !isGenericSectionLabel(targetRole)) {
      return {
        targetRole,
        targetRoleConfidence: 'high',
        targetRoleSource: 'heuristic',
      }
    }
  }

  const titleLikeLine = lines.find(isTitleLikeTargetRoleLine)
  if (titleLikeLine !== undefined) {
    return {
      targetRole: cleanTargetRole(titleLikeLine),
      targetRoleConfidence: 'medium',
      targetRoleSource: 'heuristic',
    }
  }

  return {
    targetRole: FALLBACK_TARGET_ROLE,
    targetRoleConfidence: 'low',
    targetRoleSource: 'fallback',
  }
}

function cleanTargetRole(value: string): string {
  return value
    .replace(/^[\-*\u2022]\s*/u, '')
    .replace(/\s+/gu, ' ')
    .replace(/[.;|]+$/u, '')
    .trim()
}

function isGenericSectionLabel(value: string): boolean {
  const normalizedValue = normalize(value)

  return /^(?:requirements?|required qualifications?|preferred qualifications?|responsabilidades?|requisitos?|qualificacoes?|atividades|descricao|about the role|about the job|job description|sobre a vaga|sobre nos|quem somos|o que buscamos|beneficios?)$/iu
    .test(normalizedValue)
}

function isTitleLikeTargetRoleLine(line: string): boolean {
  const targetRole = cleanTargetRole(line)
  const wordCount = targetRole.split(/\s+/u).filter(Boolean).length

  if (!targetRole || isGenericSectionLabel(targetRole)) {
    return false
  }

  if (targetRole.length > TARGET_ROLE_MAX_LENGTH || wordCount < 2 || wordCount > TARGET_ROLE_MAX_WORDS) {
    return false
  }

  if (/^\s*(?:[-*]|\d+[.)])\s+/u.test(line) || /[:.!?]/u.test(targetRole)) {
    return false
  }

  return !/^(?:we|we're|we are|looking for|somos|buscamos|procuramos|estamos)\b/iu
    .test(normalize(targetRole))
}

function buildGaps({
  requirements,
  gapAnalysis,
  severity,
}: {
  requirements: RequirementEvidence[]
  gapAnalysis?: CompatibilityGapAnalysisInput
  severity: JobCompatibilityGap['severity']
}): JobCompatibilityGap[] {
  const explicitGaps = severity === 'critical'
    ? gapAnalysis?.criticalGaps
    : gapAnalysis?.reviewNeededGaps

  if (explicitGaps !== undefined) {
    return explicitGaps.map((gap, index) => toGap({
      id: gap.id ?? `${severity}-gap-${index + 1}`,
      signal: gap.text,
      requirements,
      severity,
      rationale: severity === 'critical' ? 'external_critical_gap' : 'external_review_gap',
    }))
  }

  if (severity === 'critical' && gapAnalysis?.missingSkills !== undefined) {
    return gapAnalysis.missingSkills.map((signal, index) => toGap({
      id: `critical-gap-${index + 1}`,
      signal,
      requirements,
      severity,
      rationale: 'missing_skill_gap',
    }))
  }

  if (severity === 'review' && gapAnalysis?.weakAreas !== undefined) {
    return gapAnalysis.weakAreas.map((signal, index) => toGap({
      id: `review-gap-${index + 1}`,
      signal,
      requirements,
      severity,
      rationale: 'weak_area_gap',
    }))
  }

  return requirements
    .filter((requirement) => (
      requirement.productGroup === 'unsupported'
      && (severity === 'critical'
        ? requirement.importance === 'core'
        : requirement.importance !== 'core')
    ))
    .map((requirement) => toGap({
      id: `${severity}-gap-${requirement.id}`,
      signal: requirement.extractedSignals[0] ?? requirement.originalRequirement,
      requirements: [requirement],
      severity,
      rationale: severity === 'critical' ? 'unsupported_core_requirement' : 'unsupported_non_core_requirement',
    }))
}

function toGap({
  id,
  signal,
  requirements,
  severity,
  rationale,
}: {
  id: string
  signal: string
  requirements: RequirementEvidence[]
  severity: JobCompatibilityGap['severity']
  rationale: string
}): JobCompatibilityGap {
  const relatedRequirements = findRelatedRequirements(signal, requirements)
  const primaryRequirement = relatedRequirements[0]

  return {
    id,
    signal,
    kind: primaryRequirement?.kind ?? 'unknown',
    importance: primaryRequirement?.importance ?? 'secondary',
    severity,
    rationale,
    requirementIds: relatedRequirements.map((requirement) => requirement.id),
    prohibitedTerms: unique(relatedRequirements.flatMap((requirement) => requirement.prohibitedTerms)),
  }
}

function findRelatedRequirements(
  signal: string,
  requirements: RequirementEvidence[],
): RequirementEvidence[] {
  const normalizedSignal = normalize(signal)
  const matches = requirements.filter((requirement) => {
    const normalizedRequirement = normalize(requirement.originalRequirement)

    return normalizedRequirement.includes(normalizedSignal)
      || normalizedSignal.includes(normalizedRequirement)
      || requirement.extractedSignals.some((item) => normalizedSignal.includes(normalize(item)))
  })

  return matches.length > 0 ? matches : []
}

function calculateLowFitState(
  requirements: RequirementEvidence[],
  score: number,
): JobCompatibilityAssessment['lowFit'] {
  const coreRequirements = requirements.filter((requirement) => requirement.importance === 'core')
  const unsupportedCoreCount = coreRequirements.filter((requirement) => (
    requirement.productGroup === 'unsupported'
  )).length
  const totalCoreCount = coreRequirements.length
  const supportedOrAdjacentCount = requirements.filter((requirement) => (
    requirement.productGroup !== 'unsupported'
  )).length
  const unsupportedCoreRatio = totalCoreCount === 0 ? 0 : unsupportedCoreCount / totalCoreCount
  const minimumScore = 25
  const noRequirementsExtracted = requirements.length === 0
  const veryLowScoreWithSparseEvidence = score < minimumScore && supportedOrAdjacentCount <= 2
  const blocking = noRequirementsExtracted
    || veryLowScoreWithSparseEvidence
    || (unsupportedCoreCount >= 3 && supportedOrAdjacentCount <= 2)
  const reasons = [
    ...(noRequirementsExtracted ? ['no_requirements_extracted'] : []),
    ...(veryLowScoreWithSparseEvidence ? ['very_low_compatibility_score'] : []),
    ...(unsupportedCoreCount >= 3 && supportedOrAdjacentCount <= 2
      ? ['too_many_unsupported_core_requirements']
      : []),
  ]

  return {
    triggered: blocking,
    blocking,
    ...(reasons[0] === undefined ? {} : { reason: reasons[0] }),
    riskLevel: blocking ? 'high' : riskLevelFor({
      score,
      unsupportedCoreRatio,
    }),
    reasons,
    thresholdAudit: {
      score,
      minimumScore,
      unsupportedCoreCount,
      totalCoreCount,
      unsupportedCoreRatio,
      supportedOrAdjacentCount,
    },
  }
}

function riskLevelFor({
  score,
  unsupportedCoreRatio,
}: {
  score: number
  unsupportedCoreRatio: number
}): 'low' | 'medium' | 'high' {
  if (score < 50 || unsupportedCoreRatio >= 0.5) {
    return 'medium'
  }

  return 'low'
}

function buildRunIds({
  userId,
  sessionId,
}: {
  userId?: string
  sessionId?: string
}): Pick<JobCompatibilityAssessment['audit'], 'runIds'> | Record<string, never> {
  if (userId === undefined && sessionId === undefined) {
    return {}
  }

  return {
    runIds: {
      ...(userId === undefined ? {} : { userId }),
      ...(sessionId === undefined ? {} : { sessionId }),
    },
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function meaningfulTokens(value: string): string[] {
  const stopWords = new Set([
    'a',
    'as',
    'com',
    'da',
    'de',
    'do',
    'dos',
    'e',
    'em',
    'para',
    'por',
    'the',
    'to',
    'with',
  ])

  return normalize(value)
    .split(/\s+/u)
    .filter((token) => token && !stopWords.has(token))
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}
