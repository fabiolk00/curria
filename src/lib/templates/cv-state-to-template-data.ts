import type { AgentState } from '@/types/agent'
import type { CVState } from '@/types/cv'

export type TemplateData = {
  fullName: string
  jobTitle: string
  email: string
  phone: string
  location: string
  linkedin: string
  summary: string
  skills: string
  skillGroups: Array<{
    label: string
    items: string[]
  }>
  experiences: Array<{
    title: string
    company: string
    location: string
    period: string
    techStack: string
    bullets: Array<{ text: string }>
  }>
  education: Array<{
    degree: string
    institution: string
    period: string
  }>
  certifications: Array<{
    name: string
    issuer: string
    period: string
  }>
  languages: Array<{
    language: string
    level: string
  }>
  hasCertifications: boolean
  hasLanguages: boolean
}

export const ATS_SECTION_HEADINGS = {
  summary: 'Resumo Profissional',
  skills: 'Habilidades',
  experience: 'Experiencia Profissional',
  education: 'Educacao',
  certifications: 'Certificacoes',
  languages: 'Idiomas',
} as const

type TemplateSource = Pick<AgentState, 'targetJobDescription'> | string | null | undefined

type SkillGroupDefinition = {
  label: string
  patterns: RegExp[]
}

const LANGUAGE_ALIASES: Array<{
  canonical: string
  pattern: RegExp
}> = [
  { canonical: 'Ingles', pattern: /^(?:english|ingles)\b/i },
  { canonical: 'Portugues', pattern: /^(?:portuguese|portugues)\b/i },
  { canonical: 'Espanhol', pattern: /^(?:spanish|espanhol)\b/i },
  { canonical: 'Frances', pattern: /^(?:french|frances)\b/i },
  { canonical: 'Alemao', pattern: /^(?:german|alemao)\b/i },
  { canonical: 'Italiano', pattern: /^(?:italian|italiano)\b/i },
  { canonical: 'Holandes', pattern: /^(?:dutch|holandes)\b/i },
]

const SKILL_GROUP_DEFINITIONS: SkillGroupDefinition[] = [
  {
    label: 'Analise de Dados',
    patterns: [
      /\bsql\b/i,
      /postgres/i,
      /mysql/i,
      /bigquery/i,
      /snowflake/i,
      /redshift/i,
      /analytics?/i,
      /analise/i,
      /data analysis/i,
      /data modeling/i,
      /modelagem/i,
      /report/i,
      /reporting/i,
    ],
  },
  {
    label: 'Business Intelligence',
    patterns: [
      /\bbi\b/i,
      /power bi/i,
      /qlik/i,
      /tableau/i,
      /looker/i,
      /metabase/i,
      /dashboard/i,
      /visualiza/i,
    ],
  },
  {
    label: 'Cloud',
    patterns: [
      /\baws\b/i,
      /\bazure\b/i,
      /\bgcp\b/i,
      /google cloud/i,
      /\bcloud\b/i,
    ],
  },
  {
    label: 'Programacao',
    patterns: [
      /python/i,
      /pyspark/i,
      /\bspark\b/i,
      /scala/i,
      /java/i,
      /typescript/i,
      /javascript/i,
      /node/i,
      /react/i,
      /\.net/i,
      /c#/i,
    ],
  },
  {
    label: 'Engenharia de Dados',
    patterns: [
      /\betl\b/i,
      /\belt\b/i,
      /data pipeline/i,
      /pipeline/i,
      /airflow/i,
      /\bdbt\b/i,
      /orchestration/i,
      /kafka/i,
      /data engineering/i,
      /engenharia de dados/i,
      /performance/i,
      /optimization/i,
      /otimiz/i,
    ],
  },
  {
    label: 'Ferramentas e Plataformas',
    patterns: [
      /excel/i,
      /github/i,
      /\bgit\b/i,
      /jira/i,
      /confluence/i,
      /salesforce/i,
      /sap/i,
      /crm/i,
      /erp/i,
    ],
  },
  {
    label: 'Metodologias e Colaboracao',
    patterns: [
      /agile/i,
      /scrum/i,
      /kanban/i,
      /stakeholder/i,
      /governance/i,
      /governanca/i,
      /lgpd/i,
      /product/i,
      /negocio/i,
    ],
  },
]

function resolveTargetJobDescription(source: TemplateSource): string | null {
  if (typeof source === 'string') {
    return source.trim() || null
  }

  return source?.targetJobDescription?.trim() || null
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compactForComparison(value: string): string {
  return normalizeForComparison(value).replace(/\s+/g, '')
}

function buildTargetTokens(targetJobDescription: string | null): string[] {
  if (!targetJobDescription) {
    return []
  }

  const tokens = normalizeForComparison(targetJobDescription)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)

  return Array.from(new Set(tokens))
}

function matchesSkillRelevance(skill: string, targetJobDescription: string | null): boolean {
  if (!targetJobDescription) {
    return false
  }

  const normalizedSkill = normalizeForComparison(skill)
  const compactSkill = compactForComparison(skill)
  const normalizedTarget = normalizeForComparison(targetJobDescription)
  const compactTarget = compactForComparison(targetJobDescription)

  return (
    normalizedSkill.length > 0 &&
    (
      normalizedTarget.includes(normalizedSkill) ||
      compactTarget.includes(compactSkill)
    )
  )
}

function scoreBulletRelevance(bullet: string, targetTokens: string[]): number {
  if (targetTokens.length === 0) {
    return 0
  }

  const normalizedBullet = normalizeForComparison(bullet)
  const compactBullet = normalizedBullet.replace(/\s+/g, '')

  return targetTokens.reduce((score, token) => {
    const compactToken = compactForComparison(token)

    if (
      normalizedBullet.includes(token) ||
      compactBullet.includes(compactToken)
    ) {
      return score + 1
    }

    return score
  }, 0)
}

function reorderSkillsByRelevance(skills: string[], targetJobDescription: string | null): string[] {
  if (skills.length === 0 || !targetJobDescription) {
    return skills
  }

  const rankedSkills = skills.map((skill, index) => ({
    skill,
    index,
    score: matchesSkillRelevance(skill, targetJobDescription) ? 1 : 0,
  }))

  rankedSkills.sort((left, right) => right.score - left.score || left.index - right.index)
  return rankedSkills.map(({ skill }) => skill)
}

function reorderBulletsByRelevance(bullets: string[], targetJobDescription: string | null): string[] {
  if (bullets.length === 0 || !targetJobDescription) {
    return bullets
  }

  const targetTokens = buildTargetTokens(targetJobDescription)
  const rankedBullets = bullets.map((bullet, index) => ({
    bullet,
    index,
    score: scoreBulletRelevance(bullet, targetTokens),
  }))

  rankedBullets.sort((left, right) => right.score - left.score || left.index - right.index)
  return rankedBullets.map(({ bullet }) => bullet)
}

function extractLanguages(skills: string[]): Array<{ language: string; level: string }> {
  return skills.flatMap((skill) => {
    const trimmedSkill = skill.trim()
    if (!trimmedSkill) {
      return []
    }

    for (const alias of LANGUAGE_ALIASES) {
      if (!alias.pattern.test(trimmedSkill)) {
        continue
      }

      const remainder = trimmedSkill.replace(alias.pattern, '').trim()
      const level = normalizeLanguageLevel(remainder.replace(/^[-:|]+/, '').trim())

      return [
        {
          language: alias.canonical,
          level,
        },
      ]
    }

    return []
  })
}

function normalizeLanguageLevel(level: string): string {
  const normalizedLevel = normalizeForComparison(level)

  if (!normalizedLevel) {
    return ''
  }

  if (/^(native|native speaker|mother tongue)$/.test(normalizedLevel)) {
    return 'Nativo'
  }

  if (/^(fluent|fluency)$/.test(normalizedLevel)) {
    return 'Fluente'
  }

  if (/^(advanced)$/.test(normalizedLevel)) {
    return 'Avancado'
  }

  if (/^(intermediate)$/.test(normalizedLevel)) {
    return 'Intermediario'
  }

  if (/^(basic|beginner|elementary)$/.test(normalizedLevel)) {
    return 'Basico'
  }

  if (/^(proficient|proficiency)$/.test(normalizedLevel)) {
    return 'Proficiente'
  }

  return level
}

function splitLanguagesFromSkills(skills: string[]): {
  languages: Array<{ language: string; level: string }>
  remainingSkills: string[]
} {
  const languages = extractLanguages(skills)
  const remainingSkills = skills.filter((skill) => {
    const trimmedSkill = skill.trim()
    if (!trimmedSkill) {
      return false
    }

    return !LANGUAGE_ALIASES.some((alias) => alias.pattern.test(trimmedSkill))
  })

  return {
    languages,
    remainingSkills,
  }
}

function buildSkillGroups(skills: string[]): Array<{ label: string; items: string[] }> {
  const grouped = new Map<string, string[]>()
  const uncategorized: string[] = []

  for (const skill of skills) {
    const trimmedSkill = skill.trim()
    if (!trimmedSkill) {
      continue
    }

    const matchingGroup = SKILL_GROUP_DEFINITIONS.find((group) =>
      group.patterns.some((pattern) => pattern.test(trimmedSkill)),
    )

    if (!matchingGroup) {
      uncategorized.push(trimmedSkill)
      continue
    }

    const currentItems = grouped.get(matchingGroup.label) ?? []
    currentItems.push(trimmedSkill)
    grouped.set(matchingGroup.label, currentItems)
  }

  const orderedGroups = SKILL_GROUP_DEFINITIONS
    .map((group) => ({
      label: group.label,
      items: grouped.get(group.label) ?? [],
    }))
    .filter((group) => group.items.length > 0)

  if (uncategorized.length > 0) {
    orderedGroups.push({
      label: 'Outras Competencias',
      items: uncategorized,
    })
  }

  return orderedGroups
}

function formatPeriod(startDate: string, endDate: string | 'present'): string {
  const normalizedStartDate = startDate.trim()
  const normalizedEndDate = endDate?.trim()

  if (/^(?:present|atual)$/i.test(normalizedEndDate)) {
    return `${normalizedStartDate} - Atual`
  }

  return normalizedEndDate
    ? `${normalizedStartDate} - ${normalizedEndDate}`
    : normalizedStartDate
}

function buildCertificationPeriod(value?: string): string {
  return value?.trim() ?? ''
}

function extractStructuredSummary(summary: string): string {
  const trimmed = summary.trim()
  if (!trimmed.startsWith('{')) {
    return trimmed
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>

    if (Array.isArray(parsed.items)) {
      const lines = parsed.items
        .flatMap((item) => {
          if (typeof item === 'string') {
            return item
          }

          if (!item || typeof item !== 'object') {
            return []
          }

          const record = item as Record<string, unknown>
          const content = [record.content, record.text]
            .find((candidate) => typeof candidate === 'string')

          return typeof content === 'string' ? content : []
        })
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)

      if (lines.length > 0) {
        return lines.join(' ')
      }
    }

    if (typeof parsed.content === 'string' && parsed.content.trim()) {
      return parsed.content.replace(/\s+/g, ' ').trim()
    }

    if (typeof parsed.profile === 'string' && parsed.profile.trim()) {
      return parsed.profile.replace(/\s+/g, ' ').trim()
    }
  } catch {
    return trimmed
  }

  return trimmed
}

export function cvStateToTemplateData(
  cvState: CVState,
  source?: TemplateSource,
): TemplateData {
  const targetJobDescription = resolveTargetJobDescription(source)
  const orderedSkills = reorderSkillsByRelevance(cvState.skills, targetJobDescription)
  const { languages, remainingSkills } = splitLanguagesFromSkills(orderedSkills)
  const skillGroups = buildSkillGroups(remainingSkills)

  const experiences = cvState.experience.map((experience) => ({
    title: experience.title.trim(),
    company: experience.company.trim(),
    location: experience.location?.trim() ?? '',
    period: formatPeriod(experience.startDate, experience.endDate),
    techStack: '',
    bullets: reorderBulletsByRelevance(experience.bullets, targetJobDescription)
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .map((bullet) => ({ text: bullet })),
  }))

  const education = cvState.education
    .map((entry) => ({
      degree: entry.degree.trim(),
      institution: entry.institution.trim(),
      period: entry.year.trim(),
    }))
    .filter((entry) => entry.degree.length > 0 || entry.institution.length > 0 || entry.period.length > 0)

  const certifications = (cvState.certifications ?? [])
    .map((entry) => ({
      name: entry.name.trim(),
      issuer: entry.issuer.trim(),
      period: buildCertificationPeriod(entry.year),
    }))
    .filter((entry) => entry.name.length > 0)

  return {
    fullName: cvState.fullName.trim(),
    jobTitle: cvState.experience[0]?.title.trim() ?? '',
    email: cvState.email.trim(),
    phone: cvState.phone.trim(),
    location: cvState.location?.trim() ?? '',
    linkedin: cvState.linkedin?.trim() ?? '',
    summary: extractStructuredSummary(cvState.summary),
    skills: remainingSkills.join(', '),
    skillGroups,
    experiences,
    education,
    certifications,
    languages,
    hasCertifications: certifications.length > 0,
    hasLanguages: languages.length > 0,
  }
}
