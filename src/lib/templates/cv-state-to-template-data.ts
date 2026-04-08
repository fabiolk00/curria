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
  }>
  languages: Array<{
    language: string
    level: string
  }>
  hasCertifications: boolean
  hasLanguages: boolean
}

type TemplateSource = Pick<AgentState, 'targetJobDescription'> | string | null | undefined

type ExtractedTechStack = {
  techStack: string
  bullets: string[]
}

const LANGUAGE_ALIASES: Array<{
  canonical: string
  pattern: RegExp
}> = [
  { canonical: 'English', pattern: /^(?:english|ingl[eê]s)\b/i },
  { canonical: 'Portuguese', pattern: /^(?:portuguese|portugu[eê]s)\b/i },
  { canonical: 'Spanish', pattern: /^(?:spanish|espanhol)\b/i },
  { canonical: 'French', pattern: /^(?:french|franc[eê]s)\b/i },
  { canonical: 'German', pattern: /^(?:german|alem[aã]o)\b/i },
  { canonical: 'Italian', pattern: /^(?:italian|italiano)\b/i },
  { canonical: 'Dutch', pattern: /^(?:dutch|holand[eê]s)\b/i },
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

function extractTechStackAndBullets(bullets: string[]): ExtractedTechStack {
  if (bullets.length === 0) {
    return { techStack: '', bullets: [] }
  }

  const [firstBullet, ...remainingBullets] = bullets
  const parts = firstBullet
    .split(/[,|/;]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const looksLikeTechStack =
    parts.length >= 2 &&
    parts.every((part) => /[A-Za-z]/.test(part)) &&
    parts.some((part) => part.length <= 30)

  if (!looksLikeTechStack) {
    return { techStack: '', bullets }
  }

  return {
    techStack: firstBullet.trim(),
    bullets: remainingBullets,
  }
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
      const level = remainder.replace(/^[-–:|]+/, '').trim()

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

function formatPeriod(startDate: string, endDate: string | 'present'): string {
  const normalizedEndDate = endDate?.trim()

  if (!normalizedEndDate || normalizedEndDate.toLowerCase() === 'present') {
    return `${startDate} – Presente`
  }

  return `${startDate} – ${normalizedEndDate}`
}

export function cvStateToTemplateData(
  cvState: CVState,
  source?: TemplateSource,
): TemplateData {
  const targetJobDescription = resolveTargetJobDescription(source)
  const skills = reorderSkillsByRelevance(cvState.skills, targetJobDescription)

  const experiences = cvState.experience.map((experience) => {
    const extracted = extractTechStackAndBullets(experience.bullets)
    const orderedBullets = reorderBulletsByRelevance(extracted.bullets, targetJobDescription)

    return {
      title: experience.title,
      company: experience.company,
      location: experience.location ?? '',
      period: formatPeriod(experience.startDate, experience.endDate),
      techStack: extracted.techStack,
      bullets: orderedBullets.map((bullet) => ({ text: bullet })),
    }
  })

  const education = cvState.education
    .map((entry) => ({
      degree: entry.degree.trim(),
      institution: entry.institution.trim(),
      period: entry.year.trim(),
    }))
    .filter((entry) => entry.degree.length > 0)

  const certifications = (cvState.certifications ?? [])
    .map((entry) => ({
      name: entry.name.trim(),
    }))
    .filter((entry) => entry.name.length > 0)

  const languages = extractLanguages(cvState.skills)

  return {
    fullName: cvState.fullName.trim(),
    jobTitle: cvState.experience[0]?.title.trim() ?? '',
    email: cvState.email.trim(),
    phone: cvState.phone.trim(),
    location: cvState.location?.trim() ?? '',
    linkedin: cvState.linkedin?.trim() ?? '',
    summary: cvState.summary.trim(),
    skills: skills.join(', '),
    experiences,
    education,
    certifications,
    languages,
    hasCertifications: certifications.length > 0,
    hasLanguages: languages.length > 0,
  }
}
