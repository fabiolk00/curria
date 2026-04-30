import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import type {
  CoreRequirement,
  JobTargetingScoreBreakdown,
  JobTargetingScoreBreakdownItem,
  TargetEvidence,
  TargetingPlan,
} from '@/types/agent'
import type { CVState } from '@/types/cv'

type ScoreDimension = JobTargetingScoreBreakdownItem['id']

type BuildJobTargetingScoreBreakdownInput = {
  coreRequirements: CoreRequirement[]
  preferredRequirements: CoreRequirement[]
  targetEvidence?: TargetEvidence[]
  cvState: CVState
  criticalGapSignals?: string[]
}

const DIRECTLY_SUPPORTED_LEVELS = new Set<TargetEvidence['evidenceLevel']>([
  'explicit',
  'normalized_alias',
  'technical_equivalent',
])

const DIMENSION_LABELS: Record<ScoreDimension, JobTargetingScoreBreakdownItem['label']> = {
  skills: 'Habilidades',
  experience: 'Experiência',
  education: 'Formação',
}

const DIMENSION_WEIGHTS: Record<ScoreDimension, number> = {
  skills: 0.34,
  experience: 0.46,
  education: 0.2,
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 1
  }

  return Math.min(100, Math.max(1, Math.round(score)))
}

function normalizeSignal(value: string): string {
  return buildCanonicalSignal(value).replace(/\s+/g, ' ').trim()
}

function cleanupGapLabel(value: string): string {
  const cleaned = value
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^tamb[eé]m\s+ser[aá]\s+respons[aá]vel\s+por\s+/iu, '')
    .replace(/^ser[aá]\s+respons[aá]vel\s+por\s+/iu, '')
    .replace(/^tem\s+experi[eê]ncia\s+com\s+/iu, '')
    .trim()

  if (!cleaned) {
    return ''
  }

  return `${cleaned.charAt(0).toLocaleUpperCase('pt-BR')}${cleaned.slice(1)}`
}

function classifyRequirement(signal: string): ScoreDimension {
  const normalized = normalizeSignal(signal)

  if (/\b(?:forma[cç][aã]o|gradua[cç][aã]o|bacharel|superior|ensino|faculdade|universidade|mba|p[oó]s gradua[cç][aã]o|certifica[cç][aã]o|certificado|certified|degree|education)\b/iu.test(normalized)) {
    return 'education'
  }

  if (/\b(?:sql|python|power bi|dax|excel|sap|salesforce|jira|scrum|kanban|agil|metodologia|ferramenta|cloud|aws|azure|gcp|linguagem|stack|dados|bi|dashboard|etl|api|sistema)\b/iu.test(normalized)) {
    return 'skills'
  }

  return 'experience'
}

function findEvidenceForRequirement(
  requirement: CoreRequirement,
  targetEvidence: TargetEvidence[],
): TargetEvidence | undefined {
  const requirementSignal = normalizeSignal(requirement.signal)

  return targetEvidence.find((evidence) => {
    const candidates = [
      evidence.jobSignal,
      evidence.canonicalSignal,
      ...evidence.matchedResumeTerms,
      ...evidence.allowedRewriteForms,
    ].map(normalizeSignal)

    return candidates.some((candidate) => (
      candidate === requirementSignal
      || candidate.includes(requirementSignal)
      || requirementSignal.includes(candidate)
    ))
  })
}

function evidenceScore(requirement: CoreRequirement, evidence?: TargetEvidence): number {
  const evidenceLevel = evidence?.evidenceLevel ?? requirement.evidenceLevel
  const rewritePermission = evidence?.rewritePermission ?? requirement.rewritePermission

  if (DIRECTLY_SUPPORTED_LEVELS.has(evidenceLevel) && rewritePermission !== 'must_not_claim') {
    return 96
  }

  if (rewritePermission === 'can_claim_directly' || rewritePermission === 'can_claim_normalized') {
    return 90
  }

  if (evidenceLevel === 'strong_contextual_inference') {
    return 74
  }

  if (evidenceLevel === 'semantic_bridge_only' || rewritePermission === 'can_bridge_carefully') {
    return 56
  }

  if (rewritePermission === 'can_mention_as_related_context') {
    return 48
  }

  return 20
}

function requirementWeight(requirement: CoreRequirement): number {
  if (requirement.importance === 'core') {
    return 1.25
  }

  if (requirement.importance === 'differential') {
    return 0.85
  }

  return 1
}

function fallbackScoreForDimension(dimension: ScoreDimension, cvState: CVState): number {
  if (dimension === 'skills') {
    return cvState.skills.length >= 6 ? 70 : cvState.skills.length >= 3 ? 58 : 30
  }

  if (dimension === 'experience') {
    const bulletCount = cvState.experience.reduce((total, entry) => total + entry.bullets.length, 0)
    return bulletCount >= 6 ? 72 : bulletCount >= 2 ? 58 : 28
  }

  return cvState.education.length > 0 ? 68 : 24
}

function scoreDimension(params: {
  dimension: ScoreDimension
  requirements: CoreRequirement[]
  targetEvidence: TargetEvidence[]
  cvState: CVState
}): JobTargetingScoreBreakdownItem {
  const scopedRequirements = params.requirements.filter((requirement) => (
    classifyRequirement(requirement.signal) === params.dimension
  ))

  if (scopedRequirements.length === 0) {
    return {
      id: params.dimension,
      label: DIMENSION_LABELS[params.dimension],
      score: clampScore(fallbackScoreForDimension(params.dimension, params.cvState)),
      max: 100,
    }
  }

  const weighted = scopedRequirements.reduce((total, requirement) => {
    const weight = requirementWeight(requirement)
    const evidence = findEvidenceForRequirement(requirement, params.targetEvidence)

    return {
      score: total.score + evidenceScore(requirement, evidence) * weight,
      weight: total.weight + weight,
    }
  }, { score: 0, weight: 0 })

  return {
    id: params.dimension,
    label: DIMENSION_LABELS[params.dimension],
    score: clampScore(weighted.score / Math.max(1, weighted.weight)),
    max: 100,
  }
}

function dedupeGaps(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = cleanupGapLabel(value)
    const key = normalizeSignal(cleaned)

    if (!cleaned || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(cleaned)
  }

  return result.slice(0, 3)
}

export function buildJobTargetingScoreBreakdown(
  input: BuildJobTargetingScoreBreakdownInput,
): JobTargetingScoreBreakdown {
  const requirements = [...input.coreRequirements, ...input.preferredRequirements]
  const targetEvidence = input.targetEvidence ?? []
  const items: JobTargetingScoreBreakdownItem[] = [
    scoreDimension({ dimension: 'skills', requirements, targetEvidence, cvState: input.cvState }),
    scoreDimension({ dimension: 'experience', requirements, targetEvidence, cvState: input.cvState }),
    scoreDimension({ dimension: 'education', requirements, targetEvidence, cvState: input.cvState }),
  ]
  const total = items.reduce((sum, item) => sum + item.score * DIMENSION_WEIGHTS[item.id], 0)
  const unsupportedSignals = input.criticalGapSignals
    ?? requirements
      .filter((requirement) => evidenceScore(
        requirement,
        findEvidenceForRequirement(requirement, targetEvidence),
      ) <= 25)
      .map((requirement) => requirement.signal)

  return {
    total: clampScore(total),
    maxTotal: 100,
    items,
    criticalGaps: dedupeGaps(unsupportedSignals),
  }
}

export function buildJobTargetingScoreBreakdownFromPlan(input: {
  targetingPlan: TargetingPlan
  cvState: CVState
}): JobTargetingScoreBreakdown {
  const requirements = input.targetingPlan.coreRequirementCoverage?.requirements ?? []

  return buildJobTargetingScoreBreakdown({
    cvState: input.cvState,
    coreRequirements: requirements.filter((requirement) => requirement.importance === 'core'),
    preferredRequirements: requirements.filter((requirement) => (
      requirement.importance === 'differential'
      || requirement.requirementKind === 'preferred'
      || requirement.requirementKind === 'nice_to_have'
    )),
    targetEvidence: input.targetingPlan.targetEvidence,
    criticalGapSignals: input.targetingPlan.coreRequirementCoverage?.topUnsupportedSignalsForDisplay,
  })
}
