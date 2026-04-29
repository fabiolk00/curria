import { normalizeSemanticText } from '@/lib/agent/job-targeting/semantic-normalization'
import type {
  CoreRequirement,
  RewriteChangeSection,
  RewriteChangeSummary,
} from '@/types/agent'
import type { CVState, CertificationEntry, EducationEntry, ExperienceEntry } from '@/types/cv'

export type BuildRewriteChangeSummaryInput = {
  beforeCvState: CVState
  afterCvState: CVState
  coreRequirements: CoreRequirement[]
  preferredRequirements: CoreRequirement[]
  targetRole?: string
}

const SECTION_LABELS: Record<RewriteChangeSection, string> = {
  summary: 'Resumo',
  experience: 'Experiência',
  skills: 'Skills',
  education: 'Educação',
  certifications: 'Certificações',
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeComparable(value: string | undefined): string {
  return normalizeSemanticText(value ?? '')
}

function textContainsRequirement(text: string, requirement: string): boolean {
  const normalizedText = normalizeComparable(text)
  const normalizedRequirement = normalizeComparable(requirement)

  return Boolean(
    normalizedRequirement
    && normalizedText
    && (
      normalizedText.includes(normalizedRequirement)
      || normalizedRequirement.includes(normalizedText)
    ),
  )
}

function formatList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? ''
  }

  if (values.length === 2) {
    return `${values[0]} e ${values[1]}`
  }

  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`
}

function formatExperienceEntry(entry: ExperienceEntry): string {
  const header = `${entry.title} - ${entry.company} (${entry.startDate} - ${entry.endDate})`
  const bullets = entry.bullets.map((bullet) => `- ${normalizeText(bullet)}`)

  return [header, ...bullets].join('\n')
}

function formatEducationEntry(entry: EducationEntry): string {
  return normalizeText(`${entry.degree} - ${entry.institution}${entry.year ? ` (${entry.year})` : ''}`)
}

function formatCertificationEntry(entry: CertificationEntry): string {
  return normalizeText(`${entry.name} - ${entry.issuer}${entry.year ? ` (${entry.year})` : ''}`)
}

function formatSectionText(cvState: CVState, section: RewriteChangeSection): string {
  switch (section) {
    case 'summary':
      return normalizeText(cvState.summary)
    case 'experience':
      return cvState.experience.map(formatExperienceEntry).join('\n\n')
    case 'skills':
      return cvState.skills.map(normalizeText).filter(Boolean).join(', ')
    case 'education':
      return cvState.education.map(formatEducationEntry).join('\n')
    case 'certifications':
      return (cvState.certifications ?? []).map(formatCertificationEntry).join('\n')
  }
}

function buildExperienceMatchKey(entry: ExperienceEntry): string {
  return [
    normalizeComparable(entry.company),
    normalizeComparable(entry.title),
    normalizeComparable(entry.startDate),
    normalizeComparable(entry.endDate),
  ].join('::')
}

function matchExperienceEntries(
  before: ExperienceEntry[],
  after: ExperienceEntry[],
): Array<{ before?: ExperienceEntry; after?: ExperienceEntry }> {
  const beforeByKey = new Map(before.map((entry) => [buildExperienceMatchKey(entry), entry]))
  const matchedBefore = new Set<ExperienceEntry>()

  const matches: Array<{ before?: ExperienceEntry; after?: ExperienceEntry }> = after.map((afterEntry, index) => {
    const exactBefore = beforeByKey.get(buildExperienceMatchKey(afterEntry))
    if (exactBefore) {
      matchedBefore.add(exactBefore)
      return { before: exactBefore, after: afterEntry }
    }

    const fallbackBefore = before[index]
    if (fallbackBefore && !matchedBefore.has(fallbackBefore)) {
      matchedBefore.add(fallbackBefore)
      return { before: fallbackBefore, after: afterEntry }
    }

    return { after: afterEntry }
  })

  before.forEach((beforeEntry) => {
    if (!matchedBefore.has(beforeEntry)) {
      matches.push({ before: beforeEntry })
    }
  })

  return matches
}

function sectionChanged(params: {
  section: RewriteChangeSection
  beforeCvState: CVState
  afterCvState: CVState
  beforeText: string
  afterText: string
}): boolean {
  if (params.section === 'experience') {
    return matchExperienceEntries(params.beforeCvState.experience, params.afterCvState.experience)
      .some((match) => JSON.stringify(match.before ?? null) !== JSON.stringify(match.after ?? null))
  }

  return params.beforeText !== params.afterText
}

function inferRelatedRequirements(params: {
  beforeText: string
  afterText: string
  requirements: CoreRequirement[]
}): string[] {
  return params.requirements
    .filter((requirement) => (
      textContainsRequirement(params.afterText, requirement.signal)
      || textContainsRequirement(params.beforeText, requirement.signal)
    ))
    .map((requirement) => requirement.signal)
    .slice(0, 5)
}

function hasBusinessImpactLanguage(text: string): boolean {
  return /\b(tomada de decis[aã]o|indicadores?|kpis?|neg[oó]cio|stakeholders?|areas? de neg[oó]cio|resultado|impacto|decision|business)\b/iu.test(text)
}

function inferChangeReasons(params: {
  section: RewriteChangeSection
  beforeText: string
  afterText: string
  requirements: CoreRequirement[]
}): string[] {
  if (params.beforeText === params.afterText) {
    return []
  }

  const highlightedRequirements = params.requirements
    .filter((requirement) => (
      textContainsRequirement(params.afterText, requirement.signal)
      && !textContainsRequirement(params.beforeText, requirement.signal)
    ))
    .map((requirement) => requirement.signal)
    .slice(0, 4)
  const reasons: string[] = []

  if (highlightedRequirements.length > 0) {
    reasons.push(`Destacou requisito relevante da vaga: ${formatList(highlightedRequirements)}.`)
  }

  if (
    (params.section === 'summary' || params.section === 'experience')
    && hasBusinessImpactLanguage(params.afterText)
    && !hasBusinessImpactLanguage(params.beforeText)
  ) {
    reasons.push('Aproximou a experiência das responsabilidades da vaga e do impacto de negócio.')
  }

  if (params.section === 'skills') {
    reasons.push('Priorizou competências mais aderentes à vaga sem adicionar skills sem evidência.')
  }

  if (params.section === 'experience' && reasons.length === 0) {
    reasons.push('Reescreveu bullets para deixar responsabilidades, contexto e resultado mais claros.')
  }

  if (params.section === 'summary' && reasons.length === 0) {
    reasons.push('Reposicionou o resumo para a vaga preservando apenas evidências reais.')
  }

  return Array.from(new Set(reasons))
}

function buildSafetyNotes(params: {
  afterText: string
  requirements: CoreRequirement[]
}): string[] {
  return params.requirements
    .filter((requirement) => requirement.rewritePermission === 'must_not_claim')
    .filter((requirement) => !textContainsRequirement(params.afterText, requirement.signal))
    .map((requirement) => `Não adicionamos ${requirement.signal} como experiência direta porque não havia evidência suficiente no currículo original.`)
    .slice(0, 4)
}

function inferChangeIntensity(params: {
  changed: boolean
  beforeText: string
  afterText: string
}): RewriteChangeSummary['changeIntensity'] {
  if (!params.changed) {
    return 'none'
  }

  const beforeTokens = normalizeComparable(params.beforeText).split(' ').filter(Boolean)
  const afterTokens = normalizeComparable(params.afterText).split(' ').filter(Boolean)
  const maxLength = Math.max(beforeTokens.length, afterTokens.length, 1)
  const beforeSet = new Set(beforeTokens)
  const changedTokenCount = afterTokens.filter((token) => !beforeSet.has(token)).length
  const ratio = changedTokenCount / maxLength

  if (ratio >= 0.35) {
    return 'strong'
  }

  if (ratio >= 0.18) {
    return 'moderate'
  }

  return 'light'
}

function buildSectionChange(params: {
  section: RewriteChangeSection
  beforeCvState: CVState
  afterCvState: CVState
  requirements: CoreRequirement[]
}): RewriteChangeSummary {
  const beforeText = formatSectionText(params.beforeCvState, params.section)
  const afterText = formatSectionText(params.afterCvState, params.section)
  const changed = sectionChanged({
    section: params.section,
    beforeCvState: params.beforeCvState,
    afterCvState: params.afterCvState,
    beforeText,
    afterText,
  })

  return {
    id: `rewrite-change-${params.section}`,
    section: params.section,
    sectionLabel: SECTION_LABELS[params.section],
    changed,
    beforeText,
    afterText,
    relatedJobRequirements: changed
      ? inferRelatedRequirements({
          beforeText,
          afterText,
          requirements: params.requirements,
        })
      : [],
    changeReasons: changed
      ? inferChangeReasons({
          section: params.section,
          beforeText,
          afterText,
          requirements: params.requirements,
        })
      : [],
    safetyNotes: buildSafetyNotes({
      afterText,
      requirements: params.requirements,
    }),
    changeIntensity: inferChangeIntensity({
      changed,
      beforeText,
      afterText,
    }),
  }
}

export function buildRewriteChangeSummary(
  input: BuildRewriteChangeSummaryInput,
): RewriteChangeSummary[] {
  const requirements = [
    ...input.coreRequirements,
    ...input.preferredRequirements,
  ]
  const sections: RewriteChangeSection[] = [
    'summary',
    'experience',
    'skills',
    'education',
    'certifications',
  ]

  return sections.map((section) => buildSectionChange({
    section,
    beforeCvState: input.beforeCvState,
    afterCvState: input.afterCvState,
    requirements,
  }))
}
