import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import type {
  GapPresentation,
  GapPresentationGroup,
  JobCompatibilityGap,
} from '@/lib/agent/job-targeting/compatibility/types'

export const VERY_LOW_ADHERENCE_LABEL = 'Aderência muito baixa'
export const DISPLAY_SCORE_FLOOR = 5
export const MAX_CRITICAL_GAP_ITEMS = 5
export const MAX_REVIEW_NEEDED_GAP_ITEMS = 5

type GapCategory = 'tools' | 'domain' | 'education' | 'responsibility'
type GapLike = Pick<JobCompatibilityGap, 'signal' | 'kind'> & {
  prohibitedTerms?: string[]
}

const GAP_CATEGORY_TITLES: Record<GapCategory, string> = {
  tools: 'Ferramentas específicas não evidenciadas',
  domain: 'Experiência de domínio não evidenciada',
  education: 'Formação ou certificações não evidenciadas',
  responsibility: 'Responsabilidades-chave não evidenciadas',
}

export function buildAssessmentDisplayScore(technicalScore: number): {
  displayScore: number
  scoreLabel?: string
} {
  if (technicalScore <= 0) {
    return {
      displayScore: DISPLAY_SCORE_FLOOR,
      scoreLabel: VERY_LOW_ADHERENCE_LABEL,
    }
  }

  return { displayScore: technicalScore }
}

export function buildGapPresentation(params: {
  criticalGaps: JobCompatibilityGap[]
  reviewNeededGaps: JobCompatibilityGap[]
  maxCriticalItems?: number
  maxReviewNeededItems?: number
}): GapPresentation {
  return {
    criticalGroups: groupGaps(params.criticalGaps, params.maxCriticalItems ?? MAX_CRITICAL_GAP_ITEMS),
    reviewNeededGroups: groupGaps(params.reviewNeededGaps, params.maxReviewNeededItems ?? MAX_REVIEW_NEEDED_GAP_ITEMS),
  }
}

export function buildGapPresentationFromSignals(params: {
  criticalSignals: string[]
  reviewNeededSignals?: string[]
  maxCriticalItems?: number
  maxReviewNeededItems?: number
}): GapPresentation {
  return {
    criticalGroups: groupGaps(
      params.criticalSignals.map(signalToGap),
      params.maxCriticalItems ?? MAX_CRITICAL_GAP_ITEMS,
    ),
    reviewNeededGroups: groupGaps(
      (params.reviewNeededSignals ?? []).map(signalToGap),
      params.maxReviewNeededItems ?? MAX_REVIEW_NEEDED_GAP_ITEMS,
    ),
  }
}

export function displayGapSignal(value: string): string {
  const cleaned = value.replace(/\s+/gu, ' ').trim()
  return cleaned ? `${cleaned.charAt(0).toLocaleUpperCase('pt-BR')}${cleaned.slice(1)}` : cleaned
}

function groupGaps(gaps: GapLike[], maxItems: number): GapPresentationGroup[] {
  const groups = new Map<GapCategory, string[]>()
  const seen = new Set<string>()
  let remaining = Math.max(0, maxItems)

  for (const gap of gaps) {
    if (remaining <= 0) {
      break
    }

    const item = displayGapSignal(gap.signal)
    const key = buildCanonicalSignal(item)

    if (!item || !key || seen.has(key)) {
      continue
    }

    seen.add(key)
    const category = classifyGap(gap)
    groups.set(category, [...(groups.get(category) ?? []), item])
    remaining -= 1
  }

  return (['tools', 'domain', 'education', 'responsibility'] as GapCategory[])
    .map((category) => ({
      title: GAP_CATEGORY_TITLES[category],
      items: groups.get(category) ?? [],
    }))
    .filter((group) => group.items.length > 0)
}

function classifyGap(gap: GapLike): GapCategory {
  if (gap.kind === 'tool' || gap.kind === 'platform' || gap.kind === 'methodology') {
    return 'tools'
  }

  if (gap.kind === 'education' || gap.kind === 'certification') {
    return 'education'
  }

  if (gap.kind === 'industry' || gap.kind === 'business_domain') {
    return 'domain'
  }

  const canonical = buildCanonicalSignal([
    gap.signal,
    ...(gap.prohibitedTerms ?? []),
  ].join(' '))

  if (/\b(?:ferramenta|ferramentas|plataforma|plataformas|sistema|sistemas|software|dashboard|dashboards|relatorio|relatorios|automacao|integracao|api|apis|linguagem|linguagens|stack|tecnologia|tecnologias)\b/u.test(canonical)) {
    return 'tools'
  }

  if (/\b(?:financeir|contabil|contabilidade|controladoria|juridic|legal|saude|hospital|rh|recursos humanos|marketing|vendas|logistica|operacoes|manufatura|industrial|indicadores financeiros|demonstracoes financeiras)\b/u.test(canonical)) {
    return 'domain'
  }

  if (/\b(?:formacao|graduacao|bacharel|superior|certificacao|certificado|mba|pos graduacao)\b/u.test(canonical)) {
    return 'education'
  }

  return 'responsibility'
}

function signalToGap(signal: string): GapLike {
  return {
    signal,
    kind: 'unknown',
    prohibitedTerms: [],
  }
}
