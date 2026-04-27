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

const CORE_HEADING_RE = /^(requisitos?(?:\s+obrigatorios)?|requirements?|must(?:\s+have)?|mandatory|qualificacoes|qualifications|pre[\s-]?requisitos?)\b/i
const DIFFERENTIAL_HEADING_RE = /^(desejavel|desejaveis|differentials?|nice\s+to\s+have|plus)\b/i
const SECONDARY_HEADING_RE = /^(responsabilidades?|atividades|atribuicoes|responsibilities|what\s+you(?:'ll|\s+will)?\s+do)\b/i
const CORE_LINE_RE = /\b(obrigatori[oa]s?|required|must|dominio|experience with|experi[eê]ncia com|experi[eê]ncia forte|strong experience|profissional com|mais de \d+ anos|\d+\+?\s*(?:anos|years))\b/i
const SUPPORTED_CORE_LEVELS = new Set<EvidenceLevel>([
  'explicit',
  'normalized_alias',
  'technical_equivalent',
])
const SECTION_HEADING_PATTERNS = [
  /^requisitos$/i,
  /^qualificacoes$/i,
  /^requisitos e qualificacoes$/i,
  /^responsabilidades$/i,
  /^atividades$/i,
  /^descricao$/i,
  /^diferenciais$/i,
  /^desejavel$/i,
  /^pre[\s-]?requisitos$/i,
  /^conhecimentos$/i,
  /^experiencias$/i,
  /^perfil$/i,
  /^requirements?$/i,
  /^qualifications?$/i,
  /^responsibilities$/i,
]
const GENERIC_REQUIREMENT_PATTERNS = [
  /^boas praticas de desenvolvimento$/i,
  /^boas praticas$/i,
  /^desenvolvimento$/i,
  /^experiencia comprovada$/i,
  /^experiencia profissional$/i,
  /^vivencia profissional$/i,
  /^perfil analitico$/i,
]
const REQUIREMENT_PREFIX_RE = /^(?:experi[eê]ncia(?:\s+forte)?\s+(?:com|em)|experience\s+with|strong\s+experience\s+with|viv[eê]ncia\s+com|conhecimento\s+(?:em|com)|dom[ií]nio\s+(?:de|em)|profissional\s+com|atua[cç][aã]o\s+com|constru[cç][aã]o\s+e\s+manuten[cç][aã]o\s+de|manuten[cç][aã]o\s+de|desenvolvimento\s+de|mais\s+de\s+\d+\s+anos\s+de\s+experi[eê]ncia\s+(?:em|com))\s+/iu
const YEARS_PREFIX_RE = /(?:mais\s+de\s+)?(\d+)\+?\s*(?:anos|years)(?:\s+de\s+experi[eê]ncia)?\s+(?:em|com|with)\s+(.+)/iu
const YEARS_SUFFIX_RE = /^(.+?)\s+com\s+(?:mais\s+de\s+)?(\d+)\+?\s*(?:anos|years)(?:\s+de\s+experi[eê]ncia)?$/iu
const PARENS_RE = /\(([^)]+)\)/u

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function isPureSectionHeading(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  return SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isGenericRequirement(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  return GENERIC_REQUIREMENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

function normalizeRequirementSignal(value: string): string {
  return value
    .replace(/^[\-•*]\s*/u, '')
    .replace(REQUIREMENT_PREFIX_RE, '')
    .replace(/\s+(?:obrigatorio|obrigatoria|required)$/iu, '')
    .replace(/[.]+$/u, '')
    .trim()
}

function splitCompositeFragments(line: string): string[] {
  return line
    .replace(/[•·]/gu, ',')
    .split(/[;\n]/u)
    .flatMap((fragment) => fragment.split(/,\s*/u))
    .flatMap((fragment) => (
      /\b(?:constru[cç][aã]o|construction)\s+\b(?:e|and)\b\s+\b(?:manuten[cç][aã]o|maintenance)\b\s+\bde\b/iu.test(fragment)
        ? [fragment]
        : fragment.split(/\s+\b(?:e|and)\b\s+/iu)
    ))
    .map((fragment) => fragment.trim())
    .filter(Boolean)
}

function extractParentheticalSignals(fragment: string): string[] {
  const match = fragment.match(PARENS_RE)
  if (!match) {
    return [fragment]
  }

  const withoutParens = fragment.replace(PARENS_RE, '').trim().replace(/[,:-]+$/u, '').trim()
  const innerSignals = splitCompositeFragments(match[1] ?? '')
  return dedupe([
    withoutParens,
    ...innerSignals,
  ]).filter(Boolean)
}

function extractYearsSignals(fragment: string): string[] {
  const normalized = normalizeRequirementSignal(fragment)
  const prefixMatch = normalized.match(YEARS_PREFIX_RE)
  if (prefixMatch) {
    const years = prefixMatch[1]
    const roleOrTech = normalizeRequirementSignal(prefixMatch[2] ?? '')
    return dedupe([
      roleOrTech,
      years && roleOrTech ? `${years}+ anos de ${roleOrTech}` : '',
    ])
  }

  const suffixMatch = normalized.match(YEARS_SUFFIX_RE)
  if (suffixMatch) {
    const roleOrTech = normalizeRequirementSignal(suffixMatch[1] ?? '')
    const years = suffixMatch[2]
    return dedupe([
      roleOrTech,
      years && roleOrTech ? `${years}+ anos de ${roleOrTech}` : '',
    ])
  }

  return [normalized]
}

function extractRequirementFragments(line: string): string[] {
  const sanitized = line
    .replace(/^[^:]{0,40}:\s*/u, '')
    .trim()

  return dedupe(
    splitCompositeFragments(sanitized)
      .flatMap(extractParentheticalSignals)
      .flatMap(extractYearsSignals)
      .map(normalizeRequirementSignal)
      .filter((fragment) => (
        fragment.length >= 2
        && fragment.split(/\s+/u).length <= 8
        && !isPureSectionHeading(fragment)
        && !isGenericRequirement(fragment)
      )),
  )
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
    const candidates = [
      evidence.jobSignal,
      evidence.canonicalSignal,
      ...evidence.allowedRewriteForms,
      ...evidence.forbiddenRewriteForms,
      ...evidence.matchedResumeTerms,
    ]

    return candidates.some((candidate) => {
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

function upsertRequirement(bucket: Map<string, CoreRequirement>, requirement: CoreRequirement): void {
  const canonical = buildCanonicalSignal(requirement.signal)
  if (!canonical || isPureSectionHeading(requirement.signal) || isGenericRequirement(requirement.signal)) {
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

  if (current.evidenceLevel === 'unsupported_gap' && requirement.evidenceLevel !== 'unsupported_gap') {
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

    if (isPureSectionHeading(line)) {
      return
    }

    const isTargetRoleLine = /^(cargo|position|role|vaga|titulo|title)\s*:/iu.test(line)
    const fragments = extractRequirementFragments(line)

    fragments.forEach((fragment) => {
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
  const topUnsupportedSignalsForDisplay = unsupportedSignals.slice(0, 6)

  return {
    requirements: requirementList,
    total: coreRequirements.length,
    supported: supportedCoreRequirements.length,
    unsupported: unsupportedSignals.length,
    unsupportedSignals,
    topUnsupportedSignalsForDisplay,
  }
}
