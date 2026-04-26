import type { RewriteValidationResult, WorkflowMode, TargetingPlan } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function isLikelySectionHeading(value: string): boolean {
  const normalized = normalize(value).replace(/[:\-]+$/g, '').trim()

  return /^(requisitos(?:\s+obrigatorios)?|responsabilidades?(?:\s+e\s+atribuicoes)?|atribuicoes|qualificacoes|desejavel|diferenciais|beneficios|sobre\s+a?\s*vaga|sobre\s+o\s+time|descricao|resumo|atividades|about\s+the\s+job|about\s+the\s+role|job\s+description|responsibilities|requirements|qualifications|vaga\s+alvo)$/i.test(normalized)
}

function isUsableTargetRole(value: string): boolean {
  if (!value || isLikelySectionHeading(value)) {
    return false
  }

  return /\b(analista|engenheir[oa]|developer|desenvolvedor(?:a)?|cientista|gerente|coordenador(?:a)?|consultor(?:a)?|product manager|designer|arquiteto(?:a)?|devops|sre|qa|analytics engineer|data engineer|data analyst|business intelligence|bi)\b/i.test(value)
}

function extractNumbers(text: string): string[] {
  return Array.from(text.match(/\d+(?:[.,]\d+)?%?/g) ?? [])
}

function buildEvidenceText(cvState: CVState): string {
  return [
    cvState.summary,
    cvState.skills.join(' '),
    ...cvState.experience.flatMap((entry) => [entry.title, entry.company, ...entry.bullets]),
  ].join(' ').toLowerCase()
}

function toSkillSet(cvState: CVState): Set<string> {
  return new Set(cvState.skills.map((skill) => normalize(skill)).filter(Boolean))
}

export function validateRewrite(
  originalCvState: CVState,
  optimizedCvState: CVState,
  context?: {
    mode?: WorkflowMode
    targetJobDescription?: string
    gapAnalysis?: GapAnalysisResult
    targetingPlan?: TargetingPlan
  },
): RewriteValidationResult {
  const issues: RewriteValidationResult['issues'] = []
  const originalEvidenceText = buildEvidenceText(originalCvState)
  const originalSummary = normalize(originalCvState.summary)
  const optimizedSummary = normalize(optimizedCvState.summary)
  const originalExperienceText = originalCvState.experience
    .flatMap((entry) => [entry.title, ...entry.bullets])
    .join(' ')
    .toLowerCase()

  const originalCompanies = new Set(originalCvState.experience.map((entry) => normalize(entry.company)))
  const originalTitleCompanyPairs = new Set(
    originalCvState.experience.map((entry) => `${normalize(entry.title)}::${normalize(entry.company)}`),
  )

  for (const entry of optimizedCvState.experience) {
    const company = normalize(entry.company)
    const titleCompany = `${normalize(entry.title)}::${company}`
    if (!originalCompanies.has(company) || !originalTitleCompanyPairs.has(titleCompany)) {
      issues.push({
        severity: 'high',
        message: 'A experiência otimizada introduziu empresa ou combinação cargo/empresa inexistente no currículo original.',
        section: 'experience',
      })
    }

    const originalMatch = originalCvState.experience.find((originalEntry) =>
      normalize(originalEntry.company) === company && normalize(originalEntry.title) === normalize(entry.title),
    )

    if (!originalMatch) {
      continue
    }

    if (normalize(originalMatch.startDate) !== normalize(entry.startDate) || normalize(originalMatch.endDate) !== normalize(entry.endDate)) {
      issues.push({
        severity: 'high',
        message: 'A experiência otimizada alterou datas de início ou término sem base no currículo original.',
        section: 'experience',
      })
    }

    const originalNumbers = new Set(originalMatch.bullets.flatMap(extractNumbers))
    const optimizedNumbers = entry.bullets.flatMap(extractNumbers)
    if (optimizedNumbers.some((value) => !originalNumbers.has(value))) {
      issues.push({
        severity: 'medium',
        message: 'A experiência otimizada adicionou claims numéricos que não aparecem no currículo original.',
        section: 'experience',
      })
    }
  }

  const originalCertificationSet = new Set(
    (originalCvState.certifications ?? []).map((entry) => `${normalize(entry.name)}::${normalize(entry.issuer)}::${normalize(entry.year)}`),
  )
  for (const certification of optimizedCvState.certifications ?? []) {
    const key = `${normalize(certification.name)}::${normalize(certification.issuer)}::${normalize(certification.year)}`
    if (!originalCertificationSet.has(key)) {
      issues.push({
        severity: 'high',
        message: 'A versão otimizada incluiu certificação não comprovada no currículo original.',
        section: 'certifications',
      })
    }
  }

  const originalSkillSet = toSkillSet(originalCvState)
  const optimizedSkillSet = toSkillSet(optimizedCvState)
  if (Array.from(optimizedSkillSet).some((skill) => !originalSkillSet.has(skill))) {
    issues.push({
      severity: 'medium',
      message: 'A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original.',
      section: 'skills',
    })
  }

  const summaryNumbers = extractNumbers(optimizedCvState.summary)
  const originalNumbers = new Set(extractNumbers(buildEvidenceText(originalCvState)))
  if (summaryNumbers.some((value) => !originalNumbers.has(value))) {
    issues.push({
      severity: 'medium',
      message: 'O resumo otimizado adicionou claim numérico sem suporte no currículo original.',
      section: 'summary',
    })
  }

  const unsupportedSummarySkills = optimizedCvState.skills.filter((skill) => {
    const normalizedSkill = normalize(skill)
    return optimizedSummary.includes(normalizedSkill) && !originalEvidenceText.includes(normalizedSkill)
  })
  if (unsupportedSummarySkills.length > 0) {
    issues.push({
      severity: 'medium',
      message: 'O resumo otimizado destaca habilidades que não aparecem com evidência no currículo original.',
      section: 'summary',
    })
  }

  const optimizedExperienceText = optimizedCvState.experience
    .flatMap((entry) => [entry.title, ...entry.bullets])
    .join(' ')
    .toLowerCase()
  const summarySkillMentionsWithoutExperience = optimizedCvState.skills.filter((skill) => {
    const normalizedSkill = normalize(skill)
    const alreadyClaimedInOriginalSummary = originalSummary.includes(normalizedSkill)
    const alreadySupportedInOriginalExperience = originalExperienceText.includes(normalizedSkill)

    return optimizedSummary.includes(normalizedSkill)
      && !optimizedExperienceText.includes(normalizedSkill)
      && !alreadyClaimedInOriginalSummary
      && !alreadySupportedInOriginalExperience
  })
  if (summarySkillMentionsWithoutExperience.length > 0 && optimizedCvState.experience.length > 0) {
    issues.push({
      severity: 'medium',
      message: 'O resumo otimizado menciona skills sem alinhamento com a experiência reescrita.',
      section: 'summary',
    })
  }

  if (context?.mode === 'job_targeting') {
    const originalTitlesAndSummary = [
      originalCvState.summary,
      ...originalCvState.experience.map((entry) => entry.title),
    ].map(normalize)
    const targetRole = normalize(context.targetingPlan?.targetRole)

    if (
      isUsableTargetRole(targetRole)
      && optimizedSummary.includes(targetRole)
      && !originalTitlesAndSummary.some((value) => value.includes(targetRole) || targetRole.includes(value))
    ) {
      issues.push({
        severity: 'medium',
        message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        section: 'summary',
      })
    }

    const missingButCannotInvent = (context.targetingPlan?.missingButCannotInvent ?? context.gapAnalysis?.missingSkills ?? [])
      .map(normalize)
      .filter(Boolean)
    const optimizedEvidenceText = buildEvidenceText(optimizedCvState)

    const newlyClaimedMissingItems = missingButCannotInvent.filter((item) =>
      optimizedEvidenceText.includes(item) && !originalEvidenceText.includes(item),
    )

    if (newlyClaimedMissingItems.length > 0) {
      issues.push({
        severity: 'high',
        message: 'A versão targetizada tentou apagar gaps reais adicionando alinhamento não comprovado com a vaga.',
        section: 'summary',
      })
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
