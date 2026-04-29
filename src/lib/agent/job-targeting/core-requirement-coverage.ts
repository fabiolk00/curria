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

type RequirementSection = 'requirements' | 'responsibilities' | 'differential' | 'benefits'

const CORE_HEADING_RE = /^(requisitos?(?:\s+obrigatorios)?|requirements?|must(?:\s+have)?|mandatory|qualificacoes|qualifications|pre[\s-]?requisitos?|o que esperamos de voce)\b/i
const DIFFERENTIAL_HEADING_RE = /^(diferenciais?|sera(?:o)?\s+um\s+diferencial|ser[aã]o\s+diferenciais|desejavel|desejaveis|differentials?|nice\s+to\s+have|plus|diferencial\s+competitivo)\b/i
const SECONDARY_HEADING_RE = /^(responsabilidades?|atividades|atribuicoes|responsibilities|what\s+you(?:'ll|\s+will)?\s+do|e o seu dia a dia como sera)\b/i
const CORE_LINE_RE = /\b(obrigatori[oa]s?|required|must|dominio|experience with|experi[eê]ncia com|experi[eê]ncia forte|strong experience|profissional com|conhecimento em|conhecimento com|viv[eê]ncia em|viv[eê]ncia com|ser[aá] respons[aá]vel por|atuar[aá] com|mais de \d+ anos|\d+\+?\s*(?:anos|years))\b/i
const BENEFITS_HEADING_RE = /^(o que temos (?:pra|para) te oferecer|o que oferecemos|beneficios?(?: e vantagens)?|por que trabalhar conosco|nosso plano de carreira|mais do que um plano de carreira|cultura|sobre nos|quem somos)\b/i
const SUPPORTED_CORE_LEVELS = new Set<EvidenceLevel>([
  'explicit',
  'normalized_alias',
  'technical_equivalent',
])
const SECTION_HEADING_PATTERNS = [
  /^about the job$/i,
  /^responsabilidades?\s+d[ae]\s+posicao$/i,
  /^requisitos$/i,
  /^qualificacoes$/i,
  /^requisitos e qualificacoes$/i,
  /^responsabilidades$/i,
  /^sobre a vaga$/i,
  /^atividades$/i,
  /^atribuicoes$/i,
  /^descricao da vaga$/i,
  /^sobre a posicao$/i,
  /^descricao$/i,
  /^diferenciais$/i,
  /^sera um diferencial$/i,
  /^desejavel$/i,
  /^pre[\s-]?requisitos$/i,
  /^conhecimentos$/i,
  /^experiencias$/i,
  /^perfil$/i,
  /^requisitos?\s+d[oe]\s+perfil$/i,
  /^requirements?$/i,
  /^qualifications?$/i,
  /^responsibilities$/i,
  /^what you will do$/i,
  /^what you ll do$/i,
  /^o que esperamos de voce$/i,
  /^e o seu dia a dia como sera$/i,
  /^o que temos (?:pra|para) te oferecer$/i,
  /^o que oferecemos$/i,
  /^beneficios?(?: e vantagens)?$/i,
  /^por que trabalhar conosco$/i,
  /^nosso plano de carreira$/i,
  /^mais do que um plano de carreira$/i,
  /^cultura$/i,
  /^sobre nos$/i,
  /^quem somos$/i,
]
const GENERIC_REQUIREMENT_PATTERNS = [
  /^boas praticas de desenvolvimento$/i,
  /^boas praticas$/i,
  /^desenvolvimento$/i,
  /^experiencia comprovada$/i,
  /^experiencia profissional$/i,
  /^vivencia profissional$/i,
  /^perfil analitico$/i,
  /^previsao de inicio\b.*$/i,
  /^mais do que um plano de carreira!?$/i,
  /^carreira tecnica\b.*$/i,
  /^carreira de lideranca\b.*$/i,
  /^experiencia internacional\b.*$/i,
  /^empreendedorismo\b.*$/i,
  /^innovation hub\b.*$/i,
]
const REQUIREMENT_PREFIX_RE = /^(?:experi[eê]ncia(?:\s+forte)?\s+(?:com|em)|experience\s+with|strong\s+experience\s+with|viv[eê]ncia\s+(?:com|em)|conhecimento\s+(?:em|com)|dom[ií]nio\s+(?:de|em)|profissional\s+com|atua[cç][aã]o\s+com|atuar[aá]?\s+com|ser[aá]\s+respons[aá]vel\s+por|respons[aá]vel\s+por|constru[cç][aã]o\s+e\s+manuten[cç][aã]o\s+de|manuten[cç][aã]o\s+de|desenvolvimento\s+de|mais\s+de\s+\d+\s+anos\s+de\s+experi[eê]ncia\s+(?:em|com))\s+/iu
const YEARS_PREFIX_RE = /(?:mais\s+de\s+)?(\d+)\+?\s*(?:anos|years)(?:\s+de\s+experi[eê]ncia)?\s+(?:em|com|with)\s+(.+)/iu
const YEARS_SUFFIX_RE = /^(.+?)\s+com\s+(?:mais\s+de\s+)?(\d+)\+?\s*(?:anos|years)(?:\s+de\s+experi[eê]ncia)?$/iu
const MAX_DISPLAY_REQUIREMENTS = 16
const WEAK_DISPLAY_SIGNAL_PATTERNS = [
  /^atribuicoes$/i,
  /^atribuições$/i,
 /^[\p{L}\p{N}\s]+ndo\s+conforme\b.*$/iu,
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
const ACTION_VERB_RE = /\b(acompanhar|adaptar|analisar|apoiar|atuar|automatizar|atualizar|build|comunicar|contribuir|criar|define|definir|develop|desenvolver|elaborar|evitar|execute|executar|fechar|garantir|gerenciar|identificar|implement|implementar|integrar|lead|levantar|liderar|maintain|manter|mapear|manage|modelar|negociar|optimize|otimizar|planejar|prospectar|realizar|support|trabalhar|traduzir|tratar)\b/iu
const SEMANTIC_OBJECT_RE = /[A-Z]{2,}|[a-z]+(?:[/.-][a-z0-9]+)+|\b[\p{L}\p{N}]{3,}\b/iu
const TECH_STACK_INTRO_RE = /^(?:experi[eê]ncia|conhecimento|viv[eê]ncia)\s+com\s+/iu
const LIST_PRESERVING_REQUIREMENT_RE = /\b(?:bacharelado|curso|forma[cç][aã]o|gradua[cç][aã]o|licenciatura|superior)\b/iu
const LIST_COMPLETION_CONTEXT_RE = /\b(?:[aá]reas?\s+(?:afins|correlatas|relacionadas)|correlatas?|relacionadas?)\b/iu
const INCOMPLETE_FRAGMENT_SUFFIX_RE = /(?:\bde|\bda|\bdo|\bdos|\bdas|\bem|\bna|\bno|\bnas|\bnos|\bpara|\bcom)\s*$/iu
const LIST_COMPLEMENT_PREFIX_RE = /^(?:e\s+)?(?:de|da|do|das|dos|em|na|no|nas|nos|para|com)\b/iu
const TRAILING_AREA_CONTEXT_RE = /\s+d[ao]?\s+sua\s+[a-z\u00c0-\u024f]+(?:\s+[a-z\u00c0-\u024f]+){0,2}$/iu

function isLikelyTechnicalSignal(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^[A-Z]{2,}(?:[/-][A-Z0-9]{2,})*$/u.test(trimmed)) return true
  if (/^[A-Z][A-Za-z0-9]{1,}(?:[/-][A-Za-z0-9]{2,})*$/u.test(trimmed)) {
    const uppercaseCount = [...trimmed].filter((char) => /[A-Z]/u.test(char)).length
    if (uppercaseCount >= 2) return true
  }
  if (/[+#/]/u.test(trimmed)) return true
  if (/^[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*$/u.test(trimmed)) return true
  return /\b[\p{L}\p{N}]{2,}[-/][\p{L}\p{N}]{2,}\b/u.test(trimmed)
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function isPureSectionHeading(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  return SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(normalized))
}

function containsEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text)
}

function isLikelyIntroductoryHeading(text: string): boolean {
  const trimmed = text.trim()
  const normalized = normalizeSemanticText(trimmed)
  const words = normalized.split(/\s+/u).filter(Boolean)
  if (!normalized) return true
  if (isLikelyTechnicalSignal(trimmed)) return false
  if (trimmed.endsWith('?')) return true
  if (containsEmoji(trimmed) && words.length <= 8) return true
  if (isPureSectionHeading(trimmed)) return true

  const hasOperationalSignal = hasActionVerb(trimmed)
    || CORE_LINE_RE.test(normalized)
    || /\b(?:experiencia|conhecimento|vivencia|formacao|graduacao|curso|bacharelado)\b/iu.test(normalized)
  const isShortTitleCase = words.length <= 5
    && !/[.;:]/u.test(trimmed)
    && trimmed.split(/\s+/u).filter(Boolean).every((word) => /^[A-ZÀ-Þ0-9]/u.test(word) || /^(?:e|and|da|de|do|das|dos)$/iu.test(word))

  return isShortTitleCase && !hasOperationalSignal
}

function isGenericRequirement(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  return GENERIC_REQUIREMENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isWeakDisplaySignal(text: string): boolean {
  const normalized = normalizeSemanticText(text)
  const words = normalized.split(/\s+/u).filter(Boolean)

  if (isPureSectionHeading(text) || isIncompleteFragment(text)) return true
  if (words.length === 1 && !isLikelyTechnicalSignal(text)) return true

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

export function normalizeRequirementForDisplay(text: string): string {
  const withoutParens = text.replace(/\([^)]*\)/gu, ' ')
  return withoutParens
    .replace(/^essencial\s+/iu, '')
    .replace(/^[\-•*]\s*/u, '')
    .replace(/,\s*visando\b.*$/iu, '')
    .replace(/\bvisando\b.*$/iu, '')
    .replace(/^assegurar\s+(?:a|o)\s+correta\s+/iu, '')
    .replace(/^utiliza[cç][aã]o\s+dos\s+/iu, 'Utilização de ')
    .replace(/^manter\s+os\s+/iu, 'Manter ')
    .replace(/\b(?:da|do|das|dos)\s+sua\s+[a-z\u00c0-\u024f]+(?:\s+[a-z\u00c0-\u024f]+){0,2}$/iu, '')
    .replace(/\bcadastros?\s+dos\s+/iu, 'cadastros de ')
    .replace(/\bestrat[eé]gias?\s+de\s+repasse\s+de\s+pre[cç]o.*$/iu, 'estratégias de repasse de preço')
    .replace(/\b(cumprir|executar|negociar|assegurar|implementar)\s+(?:as|os|a|o)\b/giu, '$1')
    .replace(/\b(?:as|os)\s+estrat[eé]gias\b/iu, 'estratégias')
    .replace(/\bconstruir\s+um\s+relacionamento\s+sustent[aá]vel\s+com\s+os\s+clientes\s+de\s+sua\s+carteira\b/iu, 'Construir relacionamento com clientes')
    .replace(/\bplanos\s+acordados\s+com\s+os\s+clientes\b/iu, 'planos acordados com clientes')
    .replace(/,\s*para\s+apresenta[cç][oõ]es?\b.*$/iu, '')
    .replace(/^conhecimento\s+em\s+(.+)/iu, 'Conhecimento em $1')
    .replace(/^experi[eê]ncia\s+com\s+gest[aã]o\s+de\s+(.+)/iu, 'Gestão de $1')
    .replace(/^experi[eê]ncia\s+s[oó]lida\s+com\s+/iu, '')
    .replace(/^dom[ií]nio\s+de\s+/iu, '')
    .replace(/^como\s+([A-Z].*)$/u, '$1')
    .replace(/^experi[eê]ncia\s+com\s+storytelling\b/iu, 'Storytelling')
    .replace(/^experi[eê]ncia\s+com\s+tratamento\s+e\s+integra[cç][aã]o\s+de\s+dados\b.*$/iu, 'Tratamento e integração de dados')
    .replace(/^gest[aã]o\s+de\s+(.+)/iu, 'Gestão de $1')
    .replace(/^autonomia\s+e\s+hands?\s+on$/iu, 'Autonomia e postura hands-on')
    .replace(/\s+/gu, ' ')
    .replace(/[,:;.-]+$/u, '')
    .trim()
}

function canMergeAsComplement(previous: string, current: string): boolean {
  const previousNormalized = normalizeSemanticText(previous)
  const currentNormalized = normalizeSemanticText(current)

  if (!previousNormalized || !currentNormalized) return false
  if (hasActionVerb(current) || isPureSectionHeading(current) || isWeakDisplaySignal(current)) return false

  const previousLooksOpenList = previous.includes(',')
    || INCOMPLETE_FRAGMENT_SUFFIX_RE.test(previousNormalized)
  const currentLooksComplement = LIST_COMPLEMENT_PREFIX_RE.test(currentNormalized)
    || TRAILING_AREA_CONTEXT_RE.test(currentNormalized)
    || /^[a-z\u00c0-\u024f]/u.test(current.trim())

  return hasActionVerb(previous) && previousLooksOpenList && currentLooksComplement
}

export function mergeComplementaryFragments(signals: string[]): string[] {
  const merged: string[] = []

  signals.forEach((signal) => {
    const cleanedSignal = normalizeRequirementForDisplay(signal)
    const previous = merged.at(-1)

    if (previous && canMergeAsComplement(previous, cleanedSignal)) {
      merged[merged.length - 1] = normalizeRequirementForDisplay(`${previous} e ${cleanedSignal}`)
      return
    }

    merged.push(cleanedSignal)
  })

  return merged.filter((signal) => !isWeakDisplaySignal(signal))
}

export function isIncompleteFragment(text: string): boolean {
  const cleaned = text.trim()
  const normalized = normalizeSemanticText(cleaned)
  if (!normalized) return true
  if (cleaned.includes('(') && !cleaned.includes(')')) return true
  if (/^(?:visando|para|com|de|da|do|dos|das)\b/iu.test(normalized)) return true
  return INCOMPLETE_FRAGMENT_SUFFIX_RE.test(normalized)
}

function cleanDisplaySignal(signal: string): string | null {
  const cleaned = normalizeRequirementForDisplay(signal)

  if (
    !cleaned
    || isPureSectionHeading(cleaned)
    || isLikelyIntroductoryHeading(cleaned)
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
  if (isLikelyTechnicalSignal(signal)) score += 12
  if (hasActionVerb(signal)) score += 8
  if (hasSemanticObject(signal)) score += 6
  if (/^(?:experi[eê]ncia|conhecimento|viv[eê]ncia|forma[cç][aã]o|gradua[cç][aã]o|curso|bacharelado)\b/iu.test(signal)) score += 7
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

  const sortedSignals = Array.from(strongestByCanonical.values())
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.signal)
  return mergeComplementaryFragments(sortedSignals)
    .slice(0, MAX_DISPLAY_REQUIREMENTS)
}

export function buildCoreRequirementOverviewSignals(requirements: CoreRequirement[]): string[] {
  const candidates = requirements
    .filter((requirement) => requirement.importance === 'core')
    .map((requirement, index) => ({
      signal: cleanDisplaySignal(requirement.signal),
      score: scoreDisplaySignal(requirement) + (SUPPORTED_CORE_LEVELS.has(requirement.evidenceLevel) ? 6 : 0),
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

  return mergeComplementaryFragments(Array.from(strongestByCanonical.values())
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.signal))
    .slice(0, MAX_DISPLAY_REQUIREMENTS)
}

export function buildPreferredRequirementDisplaySignals(requirements: CoreRequirement[]): string[] {
  const candidates = requirements
    .filter((requirement) => requirement.importance === 'differential')
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

  return mergeComplementaryFragments(Array.from(strongestByCanonical.values())
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.signal))
    .slice(0, 8)
}

function normalizeRequirementSignal(value: string): string {
  const trimmed = value.trim()
  const prefixMatch = trimmed.match(/^(conhecimento\s+em|experi[eê]ncia\s+com|experi[eê]ncia\s+em|viv[eê]ncia\s+com|viv[eê]ncia\s+em)\s+(.+)$/iu)
  if (prefixMatch) {
    const prefix = prefixMatch[1] ?? ''
    const remainder = (prefixMatch[2] ?? '').trim()
    const remainderWords = remainder.split(/\s+/u).filter(Boolean)
    const isShortTechnicalListItem = remainderWords.length <= 3 && isLikelyTechnicalSignal(remainder)
    if (!isShortTechnicalListItem && remainderWords.length > 1) {
      return `${prefix} ${remainder}`
    .replace(/^[\-â€¢*]\s*/u, '')
    .replace(/^essencial\s+/iu, '')
        .replace(/\s+(?:obrigatorio|obrigatoria|required)$/iu, '')
        .replace(/[.]+$/u, '')
        .trim()
    }
  }

  return trimmed
    .replace(/^experi[eê]ncia\s+s[oó]lida\s+com\s+/iu, '')
    .replace(/^dom[ií]nio\s+de\s+/iu, '')
    .replace(/^como\s+([A-Z].*)$/u, '$1')
    .replace(/^construcao\s+e\s+manutencao\s+de\s+/iu, '')
    .replace(/^constru[cç][aã]o\s+de\s+/iu, '')
    .replace(/^[\-•*]\s*/u, '')
    .replace(REQUIREMENT_PREFIX_RE, '')
    .replace(/^([A-Z]{2,}(?:\s+[A-Z][\p{L}\p{N}]+){0,2})\s+para\b.*$/u, '$1')
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

  if (isLikelyTechnicalSignal(leftSignal) && isLikelyTechnicalSignal(rightSignal)) {
    return true
  }

  if (!isStandaloneRequirement(leftSignal) || !isStandaloneRequirement(rightSignal)) {
    return false
  }

  if (isStandaloneModifier(leftSignal) || isStandaloneModifier(rightSignal)) {
    return false
  }

  if (hasActionVerb(leftSignal) || hasActionVerb(rightSignal)) {
    return false
  }
  if (!hasActionVerb(leftSignal) && !hasActionVerb(rightSignal) && (wordCount(leftSignal) > 1 || wordCount(rightSignal) > 1)) {
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

function splitCommaFragments(fragment: string): string[] {
  const trimmed = fragment.trim()
  if (!trimmed) return []
  if (!trimmed.includes(',')) return [trimmed]
  if (/[()]/u.test(trimmed) && TECH_STACK_INTRO_RE.test(trimmed)) {
    const parenthetical = trimmed.match(/\(([^)]+)\)/u)?.[1]?.trim()
    const withoutParens = trimmed.replace(/\([^)]*\)/gu, '').replace(/\s+/gu, ' ').trim()
    return [
      ...withoutParens.split(/,\s*/u).map((part) => part.trim()).filter(Boolean),
      parenthetical ?? '',
    ].filter(Boolean)
  }
  if (/[()]/u.test(trimmed)) {
    return [trimmed]
  }

  const parts = trimmed.split(/,\s*/u).map((part) => part.trim()).filter(Boolean)
  if (
    parts.length > 1
    && hasActionVerb(parts[0] ?? '')
    && !/\b(?:instala[cç][aã]o|equipamentos)\b/iu.test(parts[0] ?? '')
  ) {
    return [trimmed]
  }
  const hasPreservedEnumeration = LIST_PRESERVING_REQUIREMENT_RE.test(trimmed)
    && parts.length > 1
    && (
      LIST_COMPLETION_CONTEXT_RE.test(trimmed)
      || /\bou\b/iu.test(parts.at(-1) ?? '')
      || /\be\b/iu.test(parts.at(-1) ?? '')
    )
    && parts.slice(1).every((part) => part.split(/\s+/u).filter(Boolean).length <= 6)
  if (hasPreservedEnumeration) {
    return [trimmed]
  }
  if (parts.length === 2 && hasActionVerb(parts[0] ?? '') && !hasActionVerb(parts[1] ?? '')) {
    return [trimmed]
  }
  const hasLongClause = trimmed.split(/\s+/u).length > 8
  const looksTechnicalList = TECH_STACK_INTRO_RE.test(trimmed)
    || parts.every((part) => part.split(/\s+/u).length <= 3)
  const looksEnumeratedObjects = parts.length > 1 && parts.slice(1).every((part) => part.split(/\s+/u).length <= 6)

  if (hasLongClause && !looksTechnicalList && !looksEnumeratedObjects) {
    return [trimmed]
  }

  return looksTechnicalList || looksEnumeratedObjects ? parts : [trimmed]
}

function splitCompositeFragments(line: string): string[] {
  return line
    .replace(/[•·]/gu, ',')
    .split(/[;\n]|(?<=[\p{L}\p{N}\)])\.\s+/u)
    .flatMap((fragment) => splitCommaFragments(fragment))
    .flatMap((fragment) => (
      /\b(?:constru[cç][aã]o|construction)\s+\b(?:e|and)\b\s+\b(?:manuten[cç][aã]o|maintenance)\b\s+\bde\b/iu.test(fragment)
        ? [fragment]
        : splitOnIndependentConjunction(fragment)
    ))
    .map((fragment) => fragment.trim())
    .filter(Boolean)
}

function extractParentheticalSignals(fragment: string): string[] {
  const match = fragment.match(/\(([^)]+)\)/u)
  if (!match) {
    return [fragment]
  }

  const withoutParens = fragment.replace(/\([^)]*\)/gu, '').trim().replace(/[,:-]+$/u, '').trim()
  const outerTechnicalSignal = withoutParens.match(/\b(?:com|em|de)\s+([A-Z][\p{L}\p{N}]+(?:\s+[A-Z]{2,}){0,2})$/u)?.[1]
  const innerText = match[1] ?? ''
  const explicitInnerSignals = [
    ...Array.from(innerText.matchAll(/\b[A-Z]{2,}(?:[/-][A-Z0-9]{2,})*\b/gu)).map((item) => item[0]),
    ...Array.from(innerText.matchAll(/\b(?:constru[cç][aã]o|cria[cç][aã]o)\s+de\s+([\p{L}\p{N}/+.-]+(?:\s+[\p{L}\p{N}/+.-]+){0,3})/giu)).map((item) => item[1] ?? ''),
  ].filter(Boolean)
  const innerSignals = splitCompositeFragments(match[1] ?? '')
    .filter((item) => {
      const trimmed = item.trim()
      if (!trimmed) return false
      const words = trimmed.split(/\s+/u).length
      return /[\/+#]/u.test(trimmed)
        || /^[A-Z]{2,}(?:[/-][A-Z0-9]{2,})*$/u.test(trimmed)
        || (words <= 3 && /^[A-Z][\p{L}\p{N}]+(?:\s+[A-Z][\p{L}\p{N}]+)*$/u.test(trimmed))
    })

  return dedupe([withoutParens, outerTechnicalSignal ?? '', ...innerSignals, ...explicitInnerSignals]).filter(Boolean)
}

function extractActionObjects(fragment: string): string[] {
  const normalized = normalizeRequirementSignal(fragment)
  const parts = normalized.split(/,\s*/u).map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) {
    return [normalized]
  }

  const first = parts[0] ?? ''
  if (!/\b(?:instala[cç][aã]o|equipamentos)\b/iu.test(first)) {
    return [normalized]
  }

  const rest = parts.slice(1).flatMap((part) => splitOnIndependentConjunction(part))
  return [first, ...rest].map((value) => value.trim()).filter(Boolean)
}

function extractYearsSignals(fragment: string): string[] {
  const prefixMatch = fragment.match(YEARS_PREFIX_RE)
  if (prefixMatch) {
    const years = prefixMatch[1]
    const roleOrTech = normalizeRequirementSignal(prefixMatch[2] ?? '')
    return dedupe([
      roleOrTech,
      years && roleOrTech ? `${years}+ anos de ${roleOrTech}` : '',
    ])
  }

  const suffixMatch = fragment.match(YEARS_SUFFIX_RE)
  if (suffixMatch) {
    const roleOrTech = normalizeRequirementSignal(suffixMatch[1] ?? '')
    const years = suffixMatch[2]
    return dedupe([
      roleOrTech,
      years && roleOrTech ? `${years}+ anos de ${roleOrTech}` : '',
    ])
  }

  return [normalizeRequirementSignal(fragment)]
}

function extractRequirementFragments(line: string): string[] {
  if (isLikelyIntroductoryHeading(line)) {
    return []
  }

  const sanitized = line
    .replace(/^[^:]{0,40}:\s*/u, '')
    .trim()

  return dedupe(
    splitCompositeFragments(sanitized)
      .flatMap(extractParentheticalSignals)
      .flatMap(extractActionObjects)
      .flatMap(extractYearsSignals)
      .map(normalizeRequirementSignal)
      .map(normalizeRequirementForDisplay)
      .filter((fragment) => (
        fragment.length >= 2
        && fragment.split(/\s+/u).length <= 18
        && !isIncompleteFragment(fragment)
        && !isPureSectionHeading(fragment)
        && !isLikelyIntroductoryHeading(fragment)
        && !isGenericRequirement(fragment)
      )),
  )
}

function mergeContinuationLines(lines: string[]): string[] {
  const merged: string[] = []

  lines.forEach((line) => {
    const previous = merged.at(-1)
    const isLowercaseContinuation = /^[a-z\u00c0-\u024f]/u.test(line.trim())
    if (previous && isLowercaseContinuation && hasActionVerb(previous) && previous.includes(',')) {
      merged[merged.length - 1] = `${previous} e ${line.trim()}`
      return
    }

    merged.push(line)
  })

  return merged
}

function inferImportance(params: {
  line: string
  activeSection?: RequirementSection
  isTargetRoleLine: boolean
  fragment: string
}): CoreRequirement['importance'] {
  if (params.isTargetRoleLine) {
    return 'core'
  }

  if (params.activeSection === 'requirements' || params.activeSection === 'responsibilities') {
    return 'core'
  }

  if (params.activeSection === 'differential') {
    return 'differential'
  }

  if (CORE_LINE_RE.test(params.line) || /\d+\+?\s*(?:anos|years)/iu.test(params.fragment)) {
    return 'core'
  }

  return 'secondary'
}

function inferRequirementKind(params: {
  line: string
  activeSection?: RequirementSection
  isTargetRoleLine: boolean
}): CoreRequirement['requirementKind'] {
  if (params.isTargetRoleLine) return 'required'
  if (params.activeSection === 'responsibilities') return 'responsibility'
  if (params.activeSection === 'requirements') return 'required'
  if (params.activeSection === 'differential') return 'preferred'
  if (CORE_LINE_RE.test(params.line)) return 'required'
  return undefined
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

  if (
    importanceOrder[requirement.importance] === importanceOrder[current.importance]
    && requirement.evidenceLevel === current.evidenceLevel
    && wordCount(requirement.signal) < wordCount(current.signal)
    && (isLikelyTechnicalSignal(requirement.signal) || wordCount(requirement.signal) <= 4)
  ) {
    bucket.set(canonical, requirement)
    return
  }

  if (current.evidenceLevel === 'unsupported_gap' && requirement.evidenceLevel !== 'unsupported_gap') {
    bucket.set(canonical, requirement)
  }
}

function shouldAddMissingCannotInventSignal(params: {
  signal: string
  normalizedJobDescription: string
  existingRequirement?: CoreRequirement
}): boolean {
  if (params.existingRequirement?.importance === 'differential') {
    return false
  }

  const normalizedSignal = normalizeSemanticText(params.signal)
  if (!normalizedSignal) return false
  if (includesNormalizedPhrase(params.normalizedJobDescription, normalizedSignal)) {
    return true
  }

  const likelyDerivedEnglish = /\b(?:api integrations?|consultative|data storytelling|financial|metrics?|requirements gathering)\b/iu.test(params.signal)
  return !likelyDerivedEnglish
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
  const normalizedJobDescription = normalizeSemanticText(shapedJobDescription)
  const lines = mergeContinuationLines(shapedJobDescription
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean))

  const requirements = new Map<string, CoreRequirement>()
  let activeSection: RequirementSection | undefined

  lines.forEach((line) => {
    const normalizedLine = normalizeSemanticText(line)

    if (BENEFITS_HEADING_RE.test(normalizedLine)) {
      activeSection = 'benefits'
    } else if (CORE_HEADING_RE.test(normalizedLine)) {
      activeSection = 'requirements'
    } else if (DIFFERENTIAL_HEADING_RE.test(normalizedLine)) {
      activeSection = 'differential'
    } else if (SECONDARY_HEADING_RE.test(normalizedLine)) {
      activeSection = 'responsibilities'
    }

    if (activeSection === 'benefits') {
      return
    }

    if (isPureSectionHeading(line) || isLikelyIntroductoryHeading(line)) {
      return
    }

    const isTargetRoleLine = /^(cargo|position|role|vaga|titulo|title)\s*:/iu.test(line)
    const fragments = extractRequirementFragments(line)

    fragments.forEach((fragment) => {
      const evidence = findMatchingEvidence(fragment, params.targetEvidence)
      const importance = inferImportance({
        line,
        activeSection,
        isTargetRoleLine,
        fragment,
      })
      const requirementKind = inferRequirementKind({
        line,
        activeSection,
        isTargetRoleLine,
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
        requirementKind,
        evidenceLevel: roleRequirement?.evidenceLevel ?? evidence?.evidenceLevel ?? 'unsupported_gap',
        rewritePermission: roleRequirement?.rewritePermission ?? evidence?.rewritePermission ?? 'must_not_claim',
      })
    })
  })

  params.missingButCannotInvent.forEach((signal) => {
    const canonical = buildCanonicalSignal(signal)
    const existingRequirement = canonical ? requirements.get(canonical) : undefined
    if (!shouldAddMissingCannotInventSignal({ signal, normalizedJobDescription, existingRequirement })) {
      return
    }

    const evidence = findMatchingEvidence(signal, params.targetEvidence)
    upsertRequirement(requirements, {
      signal,
      importance: 'core',
      requirementKind: 'required',
      evidenceLevel: evidence?.evidenceLevel ?? 'unsupported_gap',
      rewritePermission: evidence?.rewritePermission ?? 'must_not_claim',
    })
  })

  const requirementList = Array.from(requirements.values()).slice(0, 40)
  const coreRequirements = requirementList.filter((requirement) => requirement.importance === 'core')
  const supportedCoreRequirements = coreRequirements.filter((requirement) => (
    SUPPORTED_CORE_LEVELS.has(requirement.evidenceLevel)
    && requirement.rewritePermission !== 'must_not_claim'
  ))
  const unsupportedSignals = coreRequirements
    .filter((requirement) => !supportedCoreRequirements.includes(requirement))
    .map((requirement) => requirement.signal)
  const topUnsupportedSignalsForDisplay = buildCoreRequirementDisplaySignals(coreRequirements)
  const preferredSignalsForDisplay = buildPreferredRequirementDisplaySignals(requirementList)

  return {
    requirements: requirementList,
    total: coreRequirements.length,
    supported: supportedCoreRequirements.length,
    unsupported: unsupportedSignals.length,
    unsupportedSignals,
    topUnsupportedSignalsForDisplay,
    preferredSignalsForDisplay,
  }
}
