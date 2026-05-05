import { displayGapSignal } from '@/lib/agent/job-targeting/compatibility/presentation'
import type {
  JobCompatibilityAssessment,
  RequirementEvidence,
  RequirementEvidenceSpan,
} from '@/lib/agent/job-targeting/compatibility/types'

export type UserFriendlyRequirementStatus =
  | 'proven'
  | 'related'
  | 'needs_evidence'

export type UserFriendlyRequirementCard = {
  id: string
  label: string
  status: UserFriendlyRequirementStatus
  explanation: string
  foundEvidence: string[]
  safeSuggestion?: string
  canAddEvidence: boolean
}

export type UserFriendlyJobReview = {
  title: string
  description: string
  fitLevel: 'strong' | 'partial' | 'low'
  requirements: UserFriendlyRequirementCard[]
  canGenerateConservativeVersion: boolean
}

const MAX_REQUIREMENT_CARDS = 5
const MAX_EVIDENCE_ITEMS = 2
const ACTIONABLE_LABEL_PATTERNS = [
  /\bqlik\b/iu,
  /\blgpd\b|\bgdpr\b|\bprote[cç][aã]o\b|\bcompliance\b/iu,
  /\bhomologa[cç][aã]o\b|\bvalida[cç][aã]o\b|\btestes?\b/iu,
  /\bseguran[cç]a\b|\bprivacidade\b/iu,
]
const NOISY_LABELS = new Set([
  'atividades',
  'atividade',
  'identificar',
  'bi',
  'business intelligence bi',
  'dados ou areas correlatas',
  'areas correlatas',
  'requisitos',
  'responsabilidades',
])

type TargetingEvidenceLike = {
  jobSignal: string
  canonicalSignal?: string
  evidenceLevel: string
  rewritePermission: string
  matchedResumeTerms?: string[]
  supportingResumeSpans?: string[]
}

type TargetingReviewInput = {
  targetEvidence?: TargetingEvidenceLike[]
  lowFitWarningGate?: {
    triggered?: boolean
    matchScore?: number
  }
}

function normalizeForDedupe(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/+.-]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function isNoisyRequirementLabel(label: string, targetRole?: string): boolean {
  const key = normalizeForDedupe(label)
  const targetRoleKey = normalizeForDedupe(targetRole ?? '')

  if (!key) {
    return true
  }

  if (NOISY_LABELS.has(key)) {
    return true
  }

  if (targetRoleKey && key === targetRoleKey) {
    return true
  }

  return key.length < 4
}

function getActionablePriority(label: string): number {
  const index = ACTIONABLE_LABEL_PATTERNS.findIndex((pattern) => pattern.test(label))

  return index === -1 ? ACTIONABLE_LABEL_PATTERNS.length : index
}

function dedupe(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = value?.replace(/\s+/gu, ' ').trim()
    const key = normalizeForDedupe(cleaned ?? '')

    if (!cleaned || !key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function formatRequirementLabel(requirement: RequirementEvidence): string {
  return displayGapSignal(
    requirement.extractedSignals[0]
    ?? requirement.originalRequirement
    ?? requirement.normalizedRequirement,
  )
}

function formatEvidenceSpan(span: RequirementEvidenceSpan): string | undefined {
  return span.text?.replace(/\s+/gu, ' ').trim()
}

function collectFoundEvidence(requirement: RequirementEvidence): string[] {
  return dedupe([
    ...requirement.supportingResumeSpans.map(formatEvidenceSpan),
    ...requirement.matchedResumeTerms,
  ]).slice(0, MAX_EVIDENCE_ITEMS)
}

function buildSafeSuggestion(label: string, foundEvidence: string[]): string {
  const evidenceText = foundEvidence.length > 0
    ? foundEvidence[0]
    : 'as experiências próximas que já aparecem no seu currículo'

  return `Podemos mencionar ${evidenceText}, sem afirmar domínio específico de ${label} se isso não estiver claro.`
}

function toRequirementCard(requirement: RequirementEvidence): UserFriendlyRequirementCard {
  const label = formatRequirementLabel(requirement)
  const foundEvidence = collectFoundEvidence(requirement)

  if (requirement.productGroup === 'supported') {
    return {
      id: requirement.id,
      label,
      status: 'proven',
      explanation: 'Encontramos evidência suficiente no seu currículo para mencionar esse ponto com segurança.',
      foundEvidence,
      canAddEvidence: false,
    }
  }

  if (requirement.productGroup === 'adjacent') {
    return {
      id: requirement.id,
      label,
      status: 'related',
      explanation: 'Seu currículo mostra experiência próxima, mas ainda não comprova esse requisito de forma direta.',
      foundEvidence,
      safeSuggestion: buildSafeSuggestion(label, foundEvidence),
      canAddEvidence: true,
    }
  }

  return {
    id: requirement.id,
    label,
    status: 'needs_evidence',
    explanation: `A vaga pede ${label}, mas não encontramos essa experiência no seu currículo.`,
    foundEvidence: [],
    safeSuggestion: `Vamos gerar uma versão honesta, destacando experiências próximas sem afirmar ${label} diretamente.`,
    canAddEvidence: true,
  }
}

function sortRequirementCards(
  cards: UserFriendlyRequirementCard[],
  targetRole?: string,
): UserFriendlyRequirementCard[] {
  const order: Record<UserFriendlyRequirementStatus, number> = {
    needs_evidence: 0,
    related: 1,
    proven: 2,
  }

  return cards
    .filter((card) => !isNoisyRequirementLabel(card.label, targetRole))
    .sort((a, b) => {
      const priorityDelta = getActionablePriority(a.label) - getActionablePriority(b.label)

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return order[a.status] - order[b.status]
    })
}

function statusFromTargetingEvidence(evidence: TargetingEvidenceLike): UserFriendlyRequirementStatus {
  if (
    evidence.rewritePermission === 'can_claim_directly'
    || evidence.rewritePermission === 'can_claim_normalized'
  ) {
    return 'proven'
  }

  if (
    evidence.rewritePermission === 'can_bridge_carefully'
    || evidence.rewritePermission === 'can_mention_as_related_context'
    || evidence.evidenceLevel === 'semantic_bridge_only'
  ) {
    return 'related'
  }

  return 'needs_evidence'
}

function targetingEvidenceToCard(evidence: TargetingEvidenceLike, index: number): UserFriendlyRequirementCard {
  const label = displayGapSignal(evidence.jobSignal || evidence.canonicalSignal || `Requisito ${index + 1}`)
  const status = statusFromTargetingEvidence(evidence)
  const foundEvidence = dedupe([
    ...(evidence.supportingResumeSpans ?? []),
    ...(evidence.matchedResumeTerms ?? []),
  ]).slice(0, MAX_EVIDENCE_ITEMS)

  if (status === 'proven') {
    return {
      id: `target-evidence-${index}-${normalizeForDedupe(label)}`,
      label,
      status,
      explanation: 'Encontramos evidência suficiente no seu currículo para mencionar esse ponto com segurança.',
      foundEvidence,
      canAddEvidence: false,
    }
  }

  if (status === 'related') {
    return {
      id: `target-evidence-${index}-${normalizeForDedupe(label)}`,
      label,
      status,
      explanation: 'Seu currículo mostra experiência próxima, mas ainda não comprova esse requisito de forma direta.',
      foundEvidence,
      safeSuggestion: buildSafeSuggestion(label, foundEvidence),
      canAddEvidence: true,
    }
  }

  return {
    id: `target-evidence-${index}-${normalizeForDedupe(label)}`,
    label,
    status,
    explanation: `A vaga pede ${label}, mas não encontramos essa experiência no seu currículo.`,
    foundEvidence: [],
    safeSuggestion: `Vamos gerar uma versão honesta, destacando experiências próximas sem afirmar ${label} diretamente.`,
    canAddEvidence: true,
  }
}

function dedupeCards(cards: UserFriendlyRequirementCard[]): UserFriendlyRequirementCard[] {
  const seen = new Set<string>()
  const result: UserFriendlyRequirementCard[] = []

  for (const card of cards) {
    const key = normalizeForDedupe(card.label)

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(card)
  }

  return result
}

function resolveFitLevel(assessment: JobCompatibilityAssessment): UserFriendlyJobReview['fitLevel'] {
  const score = assessment.displayScore ?? assessment.scoreBreakdown.total

  if (assessment.lowFit.triggered || score < 50) {
    return 'low'
  }

  if (score >= 75) {
    return 'strong'
  }

  return 'partial'
}

function resolveTitle(fitLevel: UserFriendlyJobReview['fitLevel']): string {
  if (fitLevel === 'low') {
    return 'Essa vaga parece um pouco distante do seu currículo atual'
  }

  return 'Antes de gerar, precisamos revisar alguns pontos'
}

function resolveDescription(fitLevel: UserFriendlyJobReview['fitLevel']): string {
  if (fitLevel === 'low') {
    return 'Encontramos algumas experiências relacionadas, mas faltam requisitos importantes para afirmar uma aderência forte.'
  }

  return 'A vaga pede algumas experiências que ainda não aparecem claramente no seu currículo. Para proteger sua candidatura, não vamos afirmar algo sem evidência.'
}

export function buildUserFriendlyJobReviewFromAssessment(
  assessment: JobCompatibilityAssessment,
): UserFriendlyJobReview {
  const fitLevel = resolveFitLevel(assessment)
  const cards = dedupeCards(sortRequirementCards(
    assessment.requirements.map(toRequirementCard),
    assessment.targetRole,
  )).slice(0, MAX_REQUIREMENT_CARDS)

  return {
    title: resolveTitle(fitLevel),
    description: resolveDescription(fitLevel),
    fitLevel,
    requirements: cards,
    canGenerateConservativeVersion: fitLevel === 'low'
      || cards.some((card) => card.status !== 'proven'),
  }
}

export function buildUserFriendlyJobReviewFromTargetingEvidence(
  input: TargetingReviewInput,
): UserFriendlyJobReview | undefined {
  const evidence = input.targetEvidence ?? []

  if (evidence.length === 0) {
    return undefined
  }

  const fitLevel: UserFriendlyJobReview['fitLevel'] = input.lowFitWarningGate?.triggered
    || (input.lowFitWarningGate?.matchScore ?? 100) < 50
    ? 'low'
    : 'partial'
  const cards = dedupeCards(sortRequirementCards(
    evidence.map(targetingEvidenceToCard),
  )).slice(0, MAX_REQUIREMENT_CARDS)

  return {
    title: resolveTitle(fitLevel),
    description: resolveDescription(fitLevel),
    fitLevel,
    requirements: cards,
    canGenerateConservativeVersion: fitLevel === 'low'
      || cards.some((card) => card.status !== 'proven'),
  }
}
