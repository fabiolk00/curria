import type { CVState } from '@/types/cv'

export type AtsBaseReadiness = {
  isReady: boolean
  reasons: string[]
}

function hasAnyExperienceContent(cvState: CVState): boolean {
  return cvState.experience.some((entry) =>
    Boolean(entry.title.trim() || entry.company.trim() || entry.bullets.some((bullet) => bullet.trim())),
  )
}

function hasAnyExperienceEntryData(entry: CVState['experience'][number]): boolean {
  return Boolean(
    entry.title.trim()
    || entry.company.trim()
    || entry.location?.trim()
    || entry.startDate.trim()
    || entry.endDate.trim()
    || entry.bullets.some((bullet) => bullet.trim()),
  )
}

export function assessAtsEnhancementReadiness(cvState: CVState): AtsBaseReadiness {
  const hasPersonalData = Boolean(
    cvState.fullName.trim()
    && (cvState.email.trim() || cvState.phone.trim() || cvState.linkedin?.trim() || cvState.location?.trim()),
  )
  const hasSummaryOrExperience = Boolean(
    cvState.summary.trim()
    || hasAnyExperienceContent(cvState),
  )
  const hasExperience = hasAnyExperienceContent(cvState)
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

export function getAtsEnhancementBlockingItems(cvState: CVState): string[] {
  const items: string[] = []

  if (!cvState.fullName.trim()) {
    items.push('Dados pessoais: adicione seu nome completo.')
  }

  if (!cvState.email.trim() && !cvState.phone.trim() && !cvState.linkedin?.trim() && !cvState.location?.trim()) {
    items.push('Dados pessoais: informe pelo menos email, telefone, LinkedIn ou localizacao.')
  }

  if (!cvState.summary.trim() && !hasAnyExperienceContent(cvState)) {
    items.push('Resumo ou experiencia: preencha pelo menos uma dessas secoes.')
  }

  const experienceEntries = cvState.experience.filter(hasAnyExperienceEntryData)

  if (experienceEntries.length === 0) {
    items.push('Experiencia: inclua pelo menos uma experiencia profissional.')
  }

  for (const [index, entry] of experienceEntries.entries()) {
    const itemNumber = index + 1

    if (!entry.title.trim()) {
      items.push(`Experiencia ${itemNumber}: adicione o cargo.`)
    }

    if (!entry.company.trim()) {
      items.push(`Experiencia ${itemNumber}: adicione a empresa.`)
    }

    if (!entry.startDate.trim()) {
      items.push(`Experiencia ${itemNumber}: adicione a data de inicio.`)
    }

    if (!entry.endDate.trim()) {
      items.push(`Experiencia ${itemNumber}: adicione a data de termino ou marque como atual.`)
    }

    if (!entry.bullets.some((bullet) => bullet.trim())) {
      items.push(`Experiencia ${itemNumber}: adicione pelo menos um resultado ou responsabilidade.`)
    }
  }

  if (cvState.skills.filter((skill) => skill.trim().length > 0).length < 3) {
    items.push('Skills: adicione pelo menos 3 skills relevantes.')
  }

  const educationEntries = cvState.education.filter((entry) =>
    Boolean(entry.degree.trim() || entry.institution.trim() || entry.year.trim() || entry.gpa?.trim()),
  )

  for (const [index, entry] of educationEntries.entries()) {
    const itemNumber = index + 1

    if (!entry.degree.trim()) {
      items.push(`Formacao ${itemNumber}: adicione o curso ou graduacao.`)
    }

    if (!entry.institution.trim()) {
      items.push(`Formacao ${itemNumber}: adicione a instituicao.`)
    }

    if (!entry.year.trim()) {
      items.push(`Formacao ${itemNumber}: adicione o ano principal.`)
    }
  }

  const certificationEntries = (cvState.certifications ?? []).filter((entry) =>
    Boolean(entry.name.trim() || entry.issuer.trim() || entry.year?.trim()),
  )

  for (const [index, entry] of certificationEntries.entries()) {
    const itemNumber = index + 1

    if (!entry.name.trim()) {
      items.push(`Certificacao ${itemNumber}: adicione o nome.`)
    }

    if (!entry.issuer.trim()) {
      items.push(`Certificacao ${itemNumber}: adicione o emissor.`)
    }
  }

  return Array.from(new Set(items))
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
