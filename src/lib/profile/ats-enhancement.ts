import type { CVState } from '@/types/cv'

export type AtsBaseReadiness = {
  isReady: boolean
  reasons: string[]
}

export function assessAtsEnhancementReadiness(cvState: CVState): AtsBaseReadiness {
  const hasPersonalData = Boolean(
    cvState.fullName.trim()
    && (cvState.email.trim() || cvState.phone.trim() || cvState.linkedin?.trim() || cvState.location?.trim()),
  )
  const hasSummaryOrExperience = Boolean(
    cvState.summary.trim()
    || cvState.experience.some((entry) =>
      Boolean(entry.title.trim() || entry.company.trim() || entry.bullets.some((bullet) => bullet.trim())),
    ),
  )
  const hasExperience = cvState.experience.some((entry) =>
    Boolean(entry.title.trim() || entry.company.trim() || entry.bullets.some((bullet) => bullet.trim())),
  )
  const hasSkills = cvState.skills.filter((skill) => skill.trim().length > 0).length >= 3

  const reasons: string[] = []

  if (!hasPersonalData) {
    reasons.push('Adicione seus dados pessoais basicos.')
  }

  if (!hasSummaryOrExperience) {
    reasons.push('Preencha o resumo ou a experiencia profissional.')
  }

  if (!hasExperience) {
    reasons.push('Inclua pelo menos uma experiencia.')
  }

  if (!hasSkills) {
    reasons.push('Adicione pelo menos algumas skills relevantes.')
  }

  return {
    isReady: reasons.length === 0,
    reasons,
  }
}

export function buildResumeTextFromCvState(cvState: CVState): string {
  const lines: string[] = []

  if (cvState.fullName.trim()) {
    lines.push(cvState.fullName.trim())
  }

  const contactLine = [
    cvState.email?.trim(),
    cvState.phone?.trim(),
    cvState.linkedin?.trim(),
    cvState.location?.trim(),
  ].filter((value): value is string => Boolean(value))

  if (contactLine.length > 0) {
    lines.push(contactLine.join(' | '))
  }

  if (cvState.summary.trim()) {
    lines.push('Resumo')
    lines.push(cvState.summary.trim())
  }

  if (cvState.skills.length > 0) {
    lines.push('Skills')
    lines.push(cvState.skills.join(', '))
  }

  if (cvState.experience.length > 0) {
    lines.push('Experiencia')
    for (const experience of cvState.experience) {
      lines.push(`${experience.title} - ${experience.company}`)
      for (const bullet of experience.bullets) {
        if (bullet.trim()) {
          lines.push(`- ${bullet.trim()}`)
        }
      }
    }
  }

  if (cvState.education.length > 0) {
    lines.push('Educacao')
    for (const education of cvState.education) {
      lines.push(`${education.degree} - ${education.institution} (${education.year})`)
    }
  }

  return lines.join('\n').trim()
}
