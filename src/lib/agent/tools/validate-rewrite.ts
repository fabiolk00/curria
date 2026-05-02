import { buildTargetedRewritePermissionIssues } from '@/lib/agent/job-targeting/validation-policy'
import { buildTargetingPlanFromAssessment } from '@/lib/agent/job-targeting/compatibility/legacy-adapters'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
import { repairUtf8Mojibake } from '@/lib/text/repair-utf8-mojibake'
import type { RewriteValidationResult, TargetingPlan, ValidationIssue, WorkflowMode } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

type ValidateRewriteContext = {
  mode?: WorkflowMode
  targetJobDescription?: string
  gapAnalysis?: GapAnalysisResult
  targetingPlan?: TargetingPlan
  jobCompatibilityAssessment?: JobCompatibilityAssessment
}

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

function extractLeadingRoleClaim(summary: string): string | null {
  const match = summary.trim().match(/^([^\n.,;:]{3,80})/u)
  const candidate = normalize(match?.[1])

  return isUsableTargetRole(candidate) ? candidate : null
}

function extractRoleClaimsFromSummary(summary: string): string[] {
  return summary
    .split(/(?<=[.!?])\s+/u)
    .map(extractLeadingRoleClaim)
    .filter((value): value is string => Boolean(value))
}

function extractLikelySummaryClaimTerms(summary: string): string[] {
  const cues = Array.from(summary.matchAll(/(?:foco\s+em|com\s+foco\s+em|experiencia\s+em|experiência\s+em|experience\s+with|experience\s+in)\s+([^.!?]+)/giu))

  return Array.from(new Set(
    cues
      .flatMap((match) => (match[1] ?? '').split(/\b(?:e|and)\b|,/iu))
      .map((term) => term.split(/\b(?:para|for|with|using|com)\b/iu)[0] ?? term)
      .map((term) => normalize(term).replace(/^[^a-z0-9]+|[^a-z0-9+#./ -]+$/giu, '').trim())
      .map((term) => term.split(/\s+/u).slice(0, 3).join(' '))
      .filter((term) => term.length >= 3 && !isLikelySectionHeading(term)),
  ))
}

function extractNumbers(text: string): string[] {
  return Array.from(text.match(/\d+(?:[.,]\d+)?%?/g) ?? [])
}

function buildEvidenceText(cvState: CVState): string {
  return [
    cvState.fullName,
    cvState.email,
    cvState.phone,
    cvState.linkedin,
    cvState.location,
    cvState.summary,
    cvState.skills.join(' '),
    ...cvState.experience.flatMap((entry) => [entry.title, entry.company, ...entry.bullets]),
    ...cvState.education.flatMap((entry) => [entry.degree, entry.institution, entry.year, entry.gpa]),
    ...(cvState.certifications ?? []).flatMap((entry) => [entry.name, entry.issuer, entry.year]),
  ].join(' ').toLowerCase()
}

function toSkillSet(cvState: CVState): Set<string> {
  return new Set(cvState.skills.map((skill) => normalize(skill)).filter(Boolean))
}

function buildValidationResult(issues: ValidationIssue[]): RewriteValidationResult {
  const sanitizedIssues = issues.map((issue) => ({
    ...issue,
    message: repairUtf8Mojibake(issue.message).trim(),
  }))
  const hardIssues = sanitizedIssues.filter((issue) => issue.severity === 'high')
  const softWarnings = sanitizedIssues.filter((issue) => issue.severity === 'medium')

  return {
    blocked: hardIssues.length > 0,
    valid: sanitizedIssues.length === 0,
    hardIssues,
    softWarnings,
    issues: sanitizedIssues,
  }
}

function enrichValidationIssues(params: {
  issues: ValidationIssue[]
  optimizedCvState: CVState
  context?: ValidateRewriteContext
}): ValidationIssue[] {
  const targetRole = params.context?.targetingPlan?.targetRole
  const safeRolePositioning = params.context?.targetingPlan?.targetRolePositioning?.safeRolePositioning
  const firstStrongAnchor = params.context?.targetingPlan?.mustEmphasize[0]

  return params.issues.map((issue) => {
    const nextIssue: ValidationIssue = {
      ...issue,
      message: repairUtf8Mojibake(issue.message).trim(),
    }

    if (
      params.context?.mode === 'job_targeting'
      && nextIssue.section === 'summary'
      && nextIssue.message.toLowerCase().includes('cargo alvo')
    ) {
      nextIssue.severity = 'high'
      nextIssue.issueType ??= 'target_role_overclaim'
      nextIssue.offendingSignal ??= targetRole
      nextIssue.offendingText ??= params.optimizedCvState.summary
      nextIssue.suggestedReplacement ??= safeRolePositioning
      nextIssue.userFacingTitle ??= 'O resumo assumiu o cargo alvo diretamente'
      nextIssue.userFacingExplanation ??= targetRole
        ? `A vaga é para ${targetRole}, mas seu currículo comprova melhor outra trajetória profissional.`
        : 'O resumo tentou assumir diretamente o cargo alvo sem comprovação suficiente no currículo original.'
      return nextIssue
    }

    if (
      nextIssue.section === 'summary'
      && nextIssue.message.toLowerCase().includes('menciona skill sem evid')
    ) {
      if (params.context?.mode === 'job_targeting') {
        nextIssue.severity = 'high'
      }
      nextIssue.issueType ??= 'summary_skill_without_evidence'
      nextIssue.offendingText ??= params.optimizedCvState.summary
      nextIssue.suggestedReplacement ??= firstStrongAnchor
      nextIssue.userFacingTitle ??= 'O resumo declarou uma skill sem comprovação suficiente'
      nextIssue.userFacingExplanation ??= 'O resumo aproximou uma skill da vaga como experiência direta, mas ela não aparece comprovada no seu currículo original.'
      return nextIssue
    }

    if (nextIssue.message.toLowerCase().includes('requisito sem suporte factual')) {
      nextIssue.issueType ??= 'unsupported_claim'
      nextIssue.offendingText ??= params.optimizedCvState.summary
      nextIssue.suggestedReplacement ??= firstStrongAnchor
      nextIssue.userFacingTitle ??= 'A versão declarou uma experiência que não está comprovada'
      nextIssue.userFacingExplanation ??= 'A adaptação tratou um requisito da vaga como experiência direta sem evidência suficiente no currículo original.'
      return nextIssue
    }

    if (nextIssue.message.toLowerCase().includes('ponte sem')) {
      nextIssue.issueType ??= 'ungrounded_bridge'
      nextIssue.offendingText ??= params.optimizedCvState.summary
      nextIssue.suggestedReplacement ??= firstStrongAnchor
      nextIssue.userFacingTitle ??= 'A versão aproximou uma experiência sem base suficiente'
      nextIssue.userFacingExplanation ??= 'A adaptação tentou aproximar uma exigência da vaga sem apoio claro no seu histórico original.'
      return nextIssue
    }

    if (nextIssue.message.toLowerCase().includes('senioridade') || nextIssue.message.toLowerCase().includes('dominio')) {
      nextIssue.issueType ??= 'seniority_inflation'
      nextIssue.offendingText ??= params.optimizedCvState.summary
      nextIssue.suggestedReplacement ??= firstStrongAnchor
      nextIssue.userFacingTitle ??= 'A versão exagerou profundidade ou senioridade'
      nextIssue.userFacingExplanation ??= 'A adaptação elevou uma experiência próxima para um nível de domínio que o currículo original não comprova.'
      return nextIssue
    }

    if (nextIssue.section === 'skills' && nextIssue.message.toLowerCase().includes('skill')) {
      nextIssue.issueType ??= 'unsupported_skill'
      nextIssue.offendingText ??= params.optimizedCvState.skills.join(', ')
      nextIssue.suggestedReplacement ??= firstStrongAnchor
      nextIssue.userFacingTitle ??= 'A versão declarou uma skill sem comprovação suficiente'
      nextIssue.userFacingExplanation ??= 'A lista de skills trouxe um termo que não aparece com evidência suficiente no seu currículo original.'
      return nextIssue
    }

    if (nextIssue.message.toLowerCase().includes('gaps reais')) {
      nextIssue.issueType ??= 'forbidden_claim'
      nextIssue.offendingText ??= params.optimizedCvState.summary
      nextIssue.suggestedReplacement ??= firstStrongAnchor
      nextIssue.userFacingTitle ??= 'A versão declarou um requisito sem comprovação suficiente'
      nextIssue.userFacingExplanation ??= 'A adaptação transformou um gap real da vaga em alinhamento direto sem evidência suficiente no currículo original.'
    }

    return nextIssue
  })
}

export function validateRewrite(
  originalCvState: CVState,
  optimizedCvState: CVState,
  context?: ValidateRewriteContext,
): RewriteValidationResult {
  const issues: ValidationIssue[] = []
  const effectiveTargetingPlan = context?.targetingPlan
    ?? (context?.jobCompatibilityAssessment
      ? buildTargetingPlanFromAssessment(context.jobCompatibilityAssessment)
      : undefined)
  const originalEvidenceText = buildEvidenceText(originalCvState)
  const originalSummary = normalize(originalCvState.summary)
  const optimizedSummary = normalize(optimizedCvState.summary)

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
  const hasTargetEvidence = context?.mode === 'job_targeting'
    && (effectiveTargetingPlan?.targetEvidence?.length ?? 0) > 0

  if (!hasTargetEvidence && Array.from(optimizedSkillSet).some((skill) => !originalSkillSet.has(skill))) {
    issues.push({
      severity: 'medium',
      message: 'A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original.',
      section: 'skills',
    })
  }

  const summaryNumbers = extractNumbers(optimizedCvState.summary)
  const originalNumbers = new Set(extractNumbers(originalEvidenceText))
  if (summaryNumbers.some((value) => !originalNumbers.has(value))) {
    issues.push({
      severity: 'medium',
      message: 'O resumo otimizado adicionou claim numérico sem suporte no currículo original.',
      section: 'summary',
    })
  }

  const explicitlyAllowedSummaryClaims = new Set(
    (effectiveTargetingPlan?.targetEvidence ?? [])
      .flatMap((evidence) => [
        evidence.jobSignal,
        evidence.canonicalSignal,
        ...evidence.allowedRewriteForms,
      ])
      .map(normalize)
      .filter(Boolean),
  )
  const summaryClaimCandidates = Array.from(new Set([
    ...optimizedCvState.skills,
    ...extractLikelySummaryClaimTerms(optimizedCvState.summary),
  ]))
  const summarySkillMentionsWithoutOriginalEvidence = summaryClaimCandidates.filter((skill) => {
    const normalizedSkill = normalize(skill)
    const alreadyClaimedInOriginalSummary = originalSummary.includes(normalizedSkill)

    return optimizedSummary.includes(normalizedSkill)
      && !alreadyClaimedInOriginalSummary
      && !originalEvidenceText.includes(normalizedSkill)
      && !explicitlyAllowedSummaryClaims.has(normalizedSkill)
  })
  if (
    summarySkillMentionsWithoutOriginalEvidence.length > 0
    && optimizedCvState.experience.length > 0
  ) {
    issues.push({
      severity: 'medium',
      message: 'O resumo otimizado menciona skill sem evidência no currículo original.',
      section: 'summary',
    })
  }

  if (context?.mode === 'job_targeting') {
    const originalTitlesAndSummary = [
      originalCvState.summary,
      ...originalCvState.experience.map((entry) => entry.title),
    ].map(normalize)

    if (hasTargetEvidence) {
      issues.push(...buildTargetedRewritePermissionIssues({
        originalCvState,
        optimizedCvState,
        targetingPlan: effectiveTargetingPlan,
        jobCompatibilityAssessment: context.jobCompatibilityAssessment,
      }))

      const claimedRoles = extractRoleClaimsFromSummary(optimizedCvState.summary)
      const normalizedAllowedRoleClaims = new Set(
        (effectiveTargetingPlan?.targetEvidence ?? [])
          .filter((evidence) =>
            evidence.rewritePermission === 'can_claim_directly'
            || evidence.rewritePermission === 'can_claim_normalized')
          .flatMap((evidence) => [evidence.jobSignal, evidence.canonicalSignal])
          .map(normalize),
      )

      const unsupportedRoleClaim = claimedRoles.find((claimedRole) =>
        !normalizedAllowedRoleClaims.has(claimedRole)
        && !originalTitlesAndSummary.some((value) => value.includes(claimedRole) || claimedRole.includes(value)),
      )

      if (unsupportedRoleClaim) {
        issues.push({
          severity: 'medium',
          message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
          section: 'summary',
        })
      }

      return buildValidationResult(issues)
    }

    const targetRole = normalize(effectiveTargetingPlan?.targetRole)

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

    const missingButCannotInvent = (effectiveTargetingPlan?.missingButCannotInvent ?? context.gapAnalysis?.missingSkills ?? [])
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

  return buildValidationResult(enrichValidationIssues({
    issues,
    optimizedCvState,
    context: context
      ? {
        ...context,
        targetingPlan: effectiveTargetingPlan,
      }
      : undefined,
  }))
}
