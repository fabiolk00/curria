import { shapeTargetJobDescription } from '@/lib/agent/job-targeting-retry'
import {
  buildCanonicalSignal,
  hasLexicalAliasMatch,
  includesNormalizedPhrase,
  normalizeSemanticText,
} from '@/lib/agent/job-targeting/semantic-normalization'
import type {
  CoreRequirement,
  CoreRequirementCoverage,
  EvidenceLevel,
  RewritePermission,
  TargetEvidence,
  TargetRolePositioning,
} from '@/types/agent'

const CORE_HEADING_RE = /^(requisitos?(?:\s+obrigatorios)?|requirements?|must(?:\s+have)?|mandatory|qualificacoes|qualifications)\b/i
const DIFFERENTIAL_HEADING_RE = /^(desejavel|desejaveis|differentials?|nice\s+to\s+have|plus)\b/i
const SECONDARY_HEADING_RE = /^(responsabilidades?|atividades|atribuicoes|responsibilities|what\s+you(?:'ll|\s+will)?\s+do)\b/i
const CORE_LINE_RE = /\b(obrigatori[oa]s?|required|must|dominio|experience with|experiencia com|experiencia forte|strong experience|profissional com|mais de \d+ anos|\d+\+?\s*(?:anos|years))\b/i
const STOP_PHRASES = new Set([
  'responsabilidades',
  'requirements',
  'requisitos',
  'qualificacoes',
  'qualifications',
  'desejavel',
  'diferenciais',
  'about the job',
  'about the role',
])
const SUPPORTED_CORE_LEVELS = new Set<EvidenceLevel>([
  'explicit',
  'normalized_alias',
  'technical_equivalent',
])

function splitFragments(line: string): string[] {
  const sanitized = line
    .replace(/^[^:]{0,32}:\s*/u, '')
    .replace(/[•·]/gu, ',')
    .trim()

  return sanitized
    .split(/[;,]\s*/u)
    .flatMap((fragment) => (
      /\s+\be\b\s+/iu.test(fragment) && !/\d+\+?\s*(?:anos|years)/iu.test(fragment)
        ? fragment.split(/\s+\be\b\s+/iu)
        : [fragment]
    ))
    .map((fragment) => fragment.trim().replace(/^[\-–—]\s*/u, '').replace(/[.]+$/u, ''))
    .filter((fragment) => fragment.length >= 2 && fragment.split(/\s+/u).length <= 8)
}

function normalizeRequirementSignal(value: string): string {
  return value
    .replace(/^(?:experiencia\s+com|experience\s+with|dominio\s+em|strong\s+experience\s+with)\s+/iu, '')
    .replace(/\s+(?:obrigatorio|obrigatoria|required)$/iu, '')
    .trim()
}

function inferImportance(params: {
  line: string
  activeHeading?: 'core' | 'secondary' | 'differential'
  isTargetRoleLine: boolean
  fragment: string
}): CoreRequirement['importance'] {
  if (params.isTargetRoleLine) {
    return 'core'
  }

  if (params.activeHeading) {
    return params.activeHeading
  }

  if (CORE_LINE_RE.test(params.line) || /\d+\+?\s*(?:anos|years)/iu.test(params.fragment)) {
    return 'core'
  }

  return 'secondary'
}

function findMatchingEvidence(signal: string, targetEvidence: TargetEvidence[]): TargetEvidence | undefined {
  const normalizedSignal = normalizeSemanticText(signal)
  const canonicalSignal = buildCanonicalSignal(signal)

  return targetEvidence.find((evidence) => {
    const evidenceCandidates = [
      evidence.jobSignal,
      evidence.canonicalSignal,
      ...evidence.allowedRewriteForms,
      ...evidence.forbiddenRewriteForms,
      ...evidence.matchedResumeTerms,
    ]

    return evidenceCandidates.some((candidate) => {
      const normalizedCandidate = normalizeSemanticText(candidate)
      const canonicalCandidate = buildCanonicalSignal(candidate)

      return Boolean(
        normalizedCandidate
        && canonicalCandidate
        && (
          canonicalCandidate === canonicalSignal
          || includesNormalizedPhrase(normalizedSignal, normalizedCandidate)
          || includesNormalizedPhrase(normalizedCandidate, normalizedSignal)
          || hasLexicalAliasMatch(signal, candidate)
        ),
      )
    })
  })
}

function upsertRequirement(
  bucket: Map<string, CoreRequirement>,
  requirement: CoreRequirement,
): void {
  const canonical = buildCanonicalSignal(requirement.signal)
  if (!canonical || STOP_PHRASES.has(canonical)) {
    return
  }

  const current = bucket.get(canonical)
  if (!current) {
    bucket.set(canonical, requirement)
    return
  }

  const importanceOrder = {
    core: 3,
    secondary: 2,
    differential: 1,
  } as const

  if (importanceOrder[requirement.importance] > importanceOrder[current.importance]) {
    bucket.set(canonical, requirement)
    return
  }

  if (
    current.evidenceLevel === 'unsupported_gap'
    && requirement.evidenceLevel !== 'unsupported_gap'
  ) {
    bucket.set(canonical, requirement)
  }
}

function resolveRoleRequirement(params: {
  targetRole: string
  targetRolePositioning?: TargetRolePositioning
}): Pick<CoreRequirement, 'evidenceLevel' | 'rewritePermission'> {
  return params.targetRolePositioning?.permission === 'can_claim_target_role'
    ? {
        evidenceLevel: 'normalized_alias',
        rewritePermission: 'can_claim_normalized',
      }
    : {
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
      }
}

export function buildCoreRequirementCoverage(params: {
  targetJobDescription: string
  targetRole: string
  targetEvidence: TargetEvidence[]
  missingButCannotInvent: string[]
  targetRolePositioning?: TargetRolePositioning
}): CoreRequirementCoverage {
  const shapedJobDescription = shapeTargetJobDescription(params.targetJobDescription).content
  const lines = shapedJobDescription
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const requirements = new Map<string, CoreRequirement>()
  let activeHeading: 'core' | 'secondary' | 'differential' | undefined

  lines.forEach((line) => {
    const normalizedLine = normalizeSemanticText(line)

    if (CORE_HEADING_RE.test(normalizedLine)) {
      activeHeading = 'core'
    } else if (DIFFERENTIAL_HEADING_RE.test(normalizedLine)) {
      activeHeading = 'differential'
    } else if (SECONDARY_HEADING_RE.test(normalizedLine)) {
      activeHeading = 'secondary'
    }

    const isTargetRoleLine = /^(cargo|position|role|vaga|titulo|title)\s*:/iu.test(line)
    const fragments = splitFragments(line)

    fragments.forEach((rawFragment) => {
      const fragment = normalizeRequirementSignal(rawFragment)
      if (!fragment || STOP_PHRASES.has(buildCanonicalSignal(fragment))) {
        return
      }

      const evidence = findMatchingEvidence(fragment, params.targetEvidence)
      const importance = inferImportance({
        line,
        activeHeading,
        isTargetRoleLine,
        fragment,
      })
      const roleRequirement = isTargetRoleLine
        ? resolveRoleRequirement({
            targetRole: params.targetRole,
            targetRolePositioning: params.targetRolePositioning,
          })
        : undefined

      upsertRequirement(requirements, {
        signal: fragment,
        importance,
        evidenceLevel: roleRequirement?.evidenceLevel ?? evidence?.evidenceLevel ?? 'unsupported_gap',
        rewritePermission: roleRequirement?.rewritePermission ?? evidence?.rewritePermission ?? 'must_not_claim',
      })
    })
  })

  params.missingButCannotInvent.forEach((signal) => {
    const evidence = findMatchingEvidence(signal, params.targetEvidence)
    upsertRequirement(requirements, {
      signal,
      importance: 'core',
      evidenceLevel: evidence?.evidenceLevel ?? 'unsupported_gap',
      rewritePermission: evidence?.rewritePermission ?? 'must_not_claim',
    })
  })

  const requirementList = Array.from(requirements.values()).slice(0, 18)
  const coreRequirements = requirementList.filter((requirement) => requirement.importance === 'core')
  const supportedCoreRequirements = coreRequirements.filter((requirement) => (
    SUPPORTED_CORE_LEVELS.has(requirement.evidenceLevel)
    && requirement.rewritePermission !== 'must_not_claim'
  ))
  const unsupportedSignals = coreRequirements
    .filter((requirement) => !supportedCoreRequirements.includes(requirement))
    .map((requirement) => requirement.signal)

  return {
    requirements: requirementList,
    total: coreRequirements.length,
    supported: supportedCoreRequirements.length,
    unsupported: unsupportedSignals.length,
    unsupportedSignals,
  }
}
