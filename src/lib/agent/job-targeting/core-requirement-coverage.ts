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
const CORE_LINE_RE = /\b(obrigatori[oa]s?|required|must|dominio|experience with|experi[eê]ncia com|experi[eê]ncia forte|strong experience|profissional com|conhecimento em|conhecimento com|viv[eê]ncia em|viv[eê]ncia com|ser[aá] respons[aá]vel por|atuar[aá] com|mais de \d+ anos|\d+\+?\s*(?:anos|years))\b/i
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
const REQUIREMENT_PREFIX_RE = /^(?:experi[eê]ncia(?:\s+forte)?\s+(?:com|em)|experience\s+with|strong\s+experience\s+with|viv[eê]ncia\s+(?:com|em)|conhecimento\s+(?:em|com)|dom[ií]nio\s+(?:de|em)|profissional\s+com|atua[cç][aã]o\s+com|atuar[aá]?\s+com|ser[aá]\s+respons[aá]vel\s+por|respons[aá]vel\s+por|constru[cç][aã]o\s+e\s+manuten[cç][aã]o\s+de|manuten[cç][aã]o\s+de|desenvolvimento\s+de|mais\s+de\s+\d+\s+anos\s+de\s+experi[eê]ncia\s+(?:em|com))\s+/iu
const YEARS_PREFIX_RE = /(?:mais\s+de\s+)?(\d+)\+?\s*(?:anos|years)(?:\s+de\s+experi[eê]ncia)?\s+(?:em|com|with)\s+(.+)/iu
const YEARS_SUFFIX_RE = /^(.+?)\s+com\s+(?:mais\s+de\s+)?(\d+)\+?\s*(?:anos|years)(?:\s+de\s+experi[eê]ncia)?$/iu
const PARENS_RE = /\(([^)]+)\)/u
const MAX_DISPLAY_REQUIREMENTS = 8
const WEAK_DISPLAY_SIGNAL_PATTERNS = [
  /^atribuicoes$/i,
  /^atribuições$/i,
  /^promocional$/i,
  /^externos$/i,
  /^institucionais$/i,
  /^fazer o acompanhamento$/i,
  /^acompanhamento$/i,
]
const STANDALONE_MODIFIER_TOKENS = new Set([
  'administrativo',
  'administrativos',
  'analitico',
  'analiticos',
  'comercial',
  'comerciais',
  'corporativo',
  'corporativos',
  'digital',
  'digitais',
  'estrategico',
  'estrategicos',
  'externo',
  'externos',
  'gerencial',
  'gerenciais',
  'interno',
  'internos',
  'institucional',
  'institucionais',
  'legal',
  'legais',
  'operacional',
  'operacionais',
  'promocional',
  'promocionais',
  'tecnico',
  'tecnicos',
])
const ACTION_VERB_RE = /\b(acompanhar|analisar|apoiar|build|criar|define|definir|develop|desenvolver|elaborar|execute|executar|gerenciar|implement|implementar|integrar|lead|liderar|maintain|manter|manage|optimize|otimizar|planejar|support)\b/iu
const SEMANTIC_OBJECT_RE = /[A-Z]{2,}|[a-z]+(?:[/.-][a-z0-9]+)+|\b[\p{L}\p{N}]{3,}\b/iu

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

function isWeakDisplaySignal(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  return normalized.length < 2
    || WEAK_DISPLAY_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

function wordCount(text: string): number {
  return normalizeSemanticText(text).split(/\s+/u).filter(Boolean).length
}

function isStandaloneModifier(text: string): boolean {
  const tokens = normalizeSemanticText(text).split(/\s+/u).filter(Boolean)
  return tokens.length > 0 && tokens.length <= 2 && tokens.every((token) => STANDALONE_MODIFIER_TOKENS.has(token))
}

function hasActionVerb(text: string): boolean {
  return ACTION_VERB_RE.test(normalizeSemanticText(text))
}

function hasSemanticObject(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  return SEMANTIC_OBJECT_RE.test(text) || normalized.split(/\s+/u).filter(Boolean).length > 1
}

function cleanDisplaySignal(signal: string): string | null {
  const cleaned = signal
    .replace(/^[\-•*]\s*/u, '')
    .replace(/\s+/gu, ' ')
    .replace(/[.]+$/u, '')
    .trim()

  if (
    !cleaned
    || isPureSectionHeading(cleaned)
    || isGenericRequirement(cleaned)
    || isWeakDisplaySignal(cleaned)
    || isStandaloneModifier(cleaned)
  ) {
    return null
  }

  return cleaned.charAt(0).toLocaleUpperCase('pt-BR') + cleaned.slice(1)
}

function scoreDisplaySignal(requirement: CoreRequirement): number {
  const signal = requirement.signal
  const words = wordCount(signal)
  let score = 0

  if (requirement.importance === 'core') score += 30
  if (requirement.evidenceLevel === 'unsupported_gap') score += 10
  if (requirement.rewritePermission === 'must_not_claim') score += 5
  if (words >= 2 && words <= 8) score += 10
  if (hasActionVerb(signal)) score += 8
  if (hasSemanticObject(signal)) score += 6
  if (words === 1) score -= 4
  if (isWeakDisplaySignal(signal)) score -= 20
  if (isStandaloneModifier(signal)) score -= 30
  if (isPureSectionHeading(signal)) score -= 100
  if (isGenericRequirement(signal)) score -= 100

  return score
}

export function buildCoreRequirementDisplaySignals(requirements: CoreRequirement[]): string[] {
  const candidates = requirements
    .filter((requirement) => requirement.importance === 'core')
    .filter((requirement) => !SUPPORTED_CORE_LEVELS.has(requirement.evidenceLevel)
      || requirement.rewritePermission === 'must_not_claim')
    .map((requirement, index) => ({
      signal: cleanDisplaySignal(requirement.signal),
      score: scoreDisplaySignal(requirement),
      canonical: buildCanonicalSignal(requirement.signal),
      index,
    }))
    .filter((entry): entry is { signal: string; score: number; canonical: string; index: number } => (
      Boolean(entry.signal) && Boolean(entry.canonical) && entry.score > 0
    ))

  const strongestByCanonical = new Map<string, { signal: string; score: number; index: number }>()
  candidates.forEach((candidate) => {
    const current = strongestByCanonical.get(candidate.canonical)
    if (!current || candidate.score > current.score || (candidate.score === current.score && candidate.index < current.index)) {
      strongestByCanonical.set(candidate.canonical, candidate)
    }
  })

  return Array.from(strongestByCanonical.values())
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.signal)
    .slice(0, MAX_DISPLAY_REQUIREMENTS)
}

function normalizeRequirementSignal(value: string): string {
  return value
    .replace(/^[\-•*]\s*/u, '')
    .replace(REQUIREMENT_PREFIX_RE, '')
    .replace(/\s+(?:obrigatorio|obrigatoria|required)$/iu, '')
    .replace(/[.]+$/u, '')
    .trim()
}

function isStandaloneRequirement(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  if (
    !normalized
    || isPureSectionHeading(text)
    || isGenericRequirement(text)
    || isWeakDisplaySignal(text)
    || isStandaloneModifier(text)
  ) {
    return false
  }

  return normalized.length >= 2 && wordCount(text) <= 8
}

function shouldSplitOnConjunction(left: string, right: string): boolean {
  const leftSignal = normalizeRequirementSignal(left)
  const rightSignal = normalizeRequirementSignal(right)

  if (!isStandaloneRequirement(leftSignal) || !isStandaloneRequirement(rightSignal)) {
    return false
  }

  if (isStandaloneModifier(leftSignal) || isStandaloneModifier(rightSignal)) {
    return false
  }

  if (hasActionVerb(leftSignal) && !hasActionVerb(rightSignal) && wordCount(rightSignal) === 1) {
    return false
  }

  return true
}

function splitOnIndependentConjunction(fragment: string): string[] {
  const parts = fragment.split(/\s+\b(?:e|and)\b\s+/iu).map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) {
    return [fragment.trim()].filter(Boolean)
  }

  const result: string[] = []
  let current = parts[0] ?? ''

  parts.slice(1).forEach((part) => {
    if (shouldSplitOnConjunction(current, part)) {
      result.push(current)
      current = part
    } else {
      current = `${current} e ${part}`
    }
  })

  return [...result, current].map((part) => part.trim()).filter(Boolean)
}

function splitCompositeFragments(line: string): string[] {
  return line
    .replace(/[•·]/gu, ',')
    .split(/[;\n]/u)
    .flatMap((fragment) => fragment.split(/,\s*/u))
    .flatMap((fragment) => (
      /\b(?:constru[cç][aã]o|construction)\s+\b(?:e|and)\b\s+\b(?:manuten[cç][aã]o|maintenance)\b\s+\bde\b/iu.test(fragment)
        ? [fragment]
        : splitOnIndependentConjunction(fragment)
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
      activeHeading = 'core'
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
  const topUnsupportedSignalsForDisplay = buildCoreRequirementDisplaySignals(coreRequirements)

  return {
    requirements: requirementList,
    total: coreRequirements.length,
    supported: supportedCoreRequirements.length,
    unsupported: unsupportedSignals.length,
    unsupportedSignals,
    topUnsupportedSignalsForDisplay,
  }
}
