import {
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  buildExperienceBulletHighlightItemIds,
  createSummaryHighlightItemId,
  type CvHighlightReason,
  type ReviewWarningItem,
  type CvHighlightState,
  type CvResolvedHighlight,
} from '@/lib/resume/cv-highlight-artifact'
import type { Session, ValidationIssue } from '@/types/agent'
import type { CVState } from '@/types/cv'

type ReviewSeverity = 'caution' | 'risk'

function findRange(text: string, fragment: string): { start: number; end: number } | null {
  const normalizedText = text.toLocaleLowerCase()
  const normalizedFragment = fragment.trim().toLocaleLowerCase()
  if (normalizedFragment.length < 3) {
    return null
  }

  const start = normalizedText.indexOf(normalizedFragment)
  return start >= 0 ? { start, end: start + fragment.trim().length } : null
}

function addRange(
  highlights: Map<string, CvResolvedHighlight>,
  input: {
    itemId: string
    section: 'summary' | 'experience'
    text: string
    fragment: string
    reason: CvHighlightReason
  },
): boolean {
  const range = findRange(input.text, input.fragment)
  if (!range) {
    return false
  }

  const existing = highlights.get(input.itemId) ?? {
    itemId: input.itemId,
    section: input.section,
    ranges: [],
  }

  if (!existing.ranges.some((item) => item.start === range.start && item.end === range.end)) {
    existing.ranges.push({
      ...range,
      reason: input.reason,
    })
  }

  highlights.set(input.itemId, existing)
  return true
}

function addFragmentHighlights(params: {
  cvState: CVState
  highlights: Map<string, CvResolvedHighlight>
  fragments: string[]
  severity: ReviewSeverity
}): number {
  let count = 0
  const reason = params.severity
  const bulletItemIds = params.cvState.experience.map((entry) => buildExperienceBulletHighlightItemIds(entry))

  params.fragments.forEach((fragment) => {
    const trimmed = fragment.trim()
    if (!trimmed) {
      return
    }

    if (addRange(params.highlights, {
      itemId: createSummaryHighlightItemId(),
      section: 'summary',
      text: params.cvState.summary ?? '',
      fragment: trimmed,
      reason,
    })) {
      count += 1
      return
    }

    params.cvState.experience.some((entry, experienceIndex) => (
      entry.bullets.some((bullet, bulletIndex) => {
        const added = addRange(params.highlights, {
          itemId: bulletItemIds[experienceIndex]?.[bulletIndex] ?? '',
          section: 'experience',
          text: bullet,
          fragment: trimmed,
          reason,
        })
        if (added) {
          count += 1
        }
        return added
      })
    ))
  })

  return count
}

function mapIssueSection(section?: string): ReviewWarningItem['section'] {
  if (
    section === 'summary'
    || section === 'experience'
    || section === 'skills'
    || section === 'education'
    || section === 'certifications'
  ) {
    return section
  }
  return 'general'
}

export function buildOriginalProfileLabel(cvState: CVState): string {
  const candidates = new Set<string>()
  const pushCSV = (value?: string) => {
    if (!value) return
    value
      .split(/[,/]| e /iu)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3 && item.length <= 48)
      .forEach((item) => candidates.add(item))
  }

  pushCSV(cvState.summary)
  cvState.experience.slice(0, 3).forEach((item) => pushCSV(item.title))
  cvState.skills.slice(0, 8).forEach((skill) => candidates.add(skill.trim()))

  const ignore = new Set(['profissional', 'experiencia', 'experiência', 'atuacao', 'atuação', 'resumo'])
  const picked = Array.from(candidates)
    .map((item) => item.replace(/[.]+$/u, '').trim())
    .filter((item) => item && !ignore.has(item.toLocaleLowerCase('pt-BR')))
    .slice(0, 7)

  return picked.length > 0
    ? picked.join(', ')
    : 'experiência analítica e técnica comprovada no currículo original'
}

function buildIssueReviewItem(params: {
  issue: ValidationIssue
  inline: boolean
  targetRole?: string
  originalProfileLabel: string
  topUnsupportedSignalsForDisplay: string[]
}): ReviewWarningItem {
  const { issue } = params
  const targetRole = params.targetRole ?? 'da vaga'
  const offendingSignal = issue.offendingSignal?.trim()
  const replacement = issue.suggestedReplacement?.trim()
  const defaults = {
    severity: 'risk' as const,
    section: mapIssueSection(issue.section),
    title: 'Ponto para revisar',
    explanation: issue.userFacingExplanation?.trim() || 'Esta versão contém um ponto que merece revisão antes do envio.',
    whyItMatters: 'Ajustes de linguagem ajudam seu currículo a permanecer fiel ao que está comprovado no histórico.',
    suggestedAction: 'Revise este trecho e prefira uma formulação alinhada ao seu currículo original.',
  }

  if (issue.issueType === 'summary_skill_without_evidence') {
    const explanation = offendingSignal
      ? `O resumo pode mencionar “${offendingSignal}”, mas essa habilidade não aparece claramente no currículo original.`
      : 'O resumo pode mencionar uma habilidade que não aparece claramente no currículo original.'
    return {
      ...defaults,
      id: `warning-${issue.issueType}-${issue.offendingText ?? issue.message}`.slice(0, 120),
      title: 'Skill sem comprovação clara',
      explanation,
      whyItMatters: 'Quando uma habilidade aparece no resumo, recrutadores podem entender que você tem experiência direta nela.',
      suggestedAction: replacement
        ? `Mantenha apenas habilidades comprovadas no currículo. Sugestão: use “${replacement}” em vez disso.`
        : 'Mantenha apenas habilidades comprovadas no currículo ou adicione essa experiência ao perfil original antes de gerar novamente.',
      message: issue.userFacingExplanation ?? issue.message,
      issueType: issue.issueType,
      offendingSignal,
      offendingText: issue.offendingText ?? issue.offendingSignal,
      replacementSuggestion: replacement,
      inline: params.inline,
    }
  }

  if (issue.issueType === 'target_role_overclaim' || issue.issueType === 'low_fit_target_role') {
    const missingEvidence = params.topUnsupportedSignalsForDisplay.slice(0, 6)
    const hasMissingEvidence = missingEvidence.length > 0
    return {
      ...defaults,
      id: `warning-${issue.issueType}-${targetRole}`.slice(0, 120),
      title: hasMissingEvidence
        ? 'Requisitos da vaga sem evidência suficiente'
        : 'Cargo da vaga assumido com pouca evidência',
      explanation: hasMissingEvidence
        ? `A vaga “${targetRole}” exige pontos que ainda não aparecem com evidência forte no seu currículo original.`
        : `A versão gerada pode estar se aproximando demais do cargo “${targetRole}”.`,
      whyItMatters: hasMissingEvidence
        ? `Seu perfil comprovado hoje está mais alinhado com ${params.originalProfileLabel}. Se os requisitos centrais da vaga não estiverem claros no histórico, o encaixe pode parecer artificial para recrutadores.`
        : `Seu currículo original comprova melhor uma trajetória em ${params.originalProfileLabel}. Se o resumo se apresentar diretamente como “${targetRole}”, pode parecer que você já atuou nessa função.`,
      suggestedAction: hasMissingEvidence
        ? 'Use os requisitos sem evidência como plano de transição e ajuste o resumo para destacar somente competências já comprovadas.'
        : 'Revise o resumo para manter sua identidade profissional real e usar a vaga apenas como direcionamento.',
      message: issue.userFacingExplanation ?? issue.message,
      issueType: issue.issueType,
      offendingSignal,
      offendingText: issue.offendingText ?? issue.offendingSignal,
      missingEvidence,
      targetRole,
      originalProfileLabel: params.originalProfileLabel,
      inline: params.inline,
    }
  }

  if (issue.issueType === 'unsupported_claim') {
    return {
      ...defaults,
      id: `warning-${issue.issueType}-${issue.offendingText ?? issue.message}`.slice(0, 120),
      title: 'Experiência declarada sem base suficiente',
      explanation: offendingSignal
        ? `A versão pode ter declarado “${offendingSignal}” como experiência direta, mas não encontramos evidência suficiente no currículo original.`
        : 'A versão pode ter declarado uma experiência como direta sem evidência suficiente no currículo original.',
      suggestedAction: replacement
        ? `Troque por uma formulação mais segura baseada em experiências comprovadas: “${replacement}”.`
        : 'Troque por uma formulação mais segura, baseada no que já está comprovado no currículo.',
      message: issue.userFacingExplanation ?? issue.message,
      issueType: issue.issueType,
      offendingSignal,
      offendingText: issue.offendingText ?? issue.offendingSignal,
      replacementSuggestion: replacement,
      inline: params.inline,
    }
  }

  if (issue.issueType === 'seniority_inflation') {
    return {
      ...defaults,
      id: `warning-${issue.issueType}-${issue.message}`.slice(0, 120),
      title: 'Nível de senioridade pode estar exagerado',
      explanation: 'A versão usa uma linguagem que pode sugerir domínio avançado, liderança ou especialização maior do que o currículo original comprova.',
      suggestedAction: 'Prefira uma formulação mais neutra, como “experiência com”, “atuação em” ou “participação em”.',
      message: issue.userFacingExplanation ?? issue.message,
      issueType: issue.issueType,
      offendingSignal,
      offendingText: issue.offendingText ?? issue.offendingSignal,
      inline: params.inline,
    }
  }

  return {
    ...defaults,
    id: `warning-${issue.issueType ?? 'generic'}-${issue.message}`.slice(0, 120),
    message: issue.userFacingExplanation ?? issue.message,
    issueType: issue.issueType,
    offendingSignal,
    offendingText: issue.offendingText ?? issue.offendingSignal,
    inline: params.inline,
  }
}

function issueFragments(issues: ValidationIssue[]): string[] {
  return issues.flatMap((issue) => [
    issue.offendingText,
    issue.offendingSignal,
  ]).filter((value): value is string => Boolean(value?.trim()))
}

export function shouldUseOverrideReviewHighlight(session: Session): boolean {
  const validationOverride = session.agentState.validationOverride
  return validationOverride?.enabled === true
    || validationOverride?.acceptedLowFit === true
    || validationOverride?.fallbackUsed === true
}

export function buildOverrideReviewHighlightState(params: {
  session: Session
  cvState: CVState
  generatedAt?: string
}): CvHighlightState {
  const generatedAt = params.generatedAt ?? new Date().toISOString()
  const validationOverride = params.session.agentState.validationOverride
  const targetingPlan = params.session.agentState.targetingPlan
  const highlights = new Map<string, CvResolvedHighlight>()
  const reviewItems: ReviewWarningItem[] = []

  const supportedFragments = [
    ...(targetingPlan?.safeTargetingEmphasis?.safeDirectEmphasis ?? []),
    ...(targetingPlan?.rewritePermissions?.directClaimsAllowed ?? []),
  ]
  const cautionFragments = [
    ...(targetingPlan?.safeTargetingEmphasis?.cautiousBridgeEmphasis.map((bridge) => bridge.safeWording) ?? []),
    ...(targetingPlan?.rewritePermissions?.bridgeClaimsAllowed.map((bridge) => bridge.safeBridge) ?? []),
  ]
  const issues = validationOverride?.issues ?? params.session.agentState.rewriteValidation?.issues ?? []

  addFragmentHighlights({
    cvState: params.cvState,
    highlights,
    fragments: cautionFragments,
    severity: 'caution',
  })
  addFragmentHighlights({
    cvState: params.cvState,
    highlights,
    fragments: issueFragments(issues),
    severity: 'risk',
  })

  const targetRole = validationOverride?.targetRole ?? targetingPlan?.targetRole
  const originalProfileLabel = buildOriginalProfileLabel(params.session.cvState)
  const topUnsupportedSignalsForDisplay = targetingPlan?.lowFitWarningGate?.coreRequirementCoverage?.topUnsupportedSignalsForDisplay
    ?? targetingPlan?.coreRequirementCoverage?.topUnsupportedSignalsForDisplay
    ?? []

  issues.forEach((issue) => {
    const fragments = issueFragments([issue])
    const inline = fragments.some((fragment) => (
      findRange(params.cvState.summary ?? '', fragment)
      || params.cvState.experience.some((entry) => entry.bullets.some((bullet) => findRange(bullet, fragment)))
    ))
    reviewItems.push(buildIssueReviewItem({
      issue,
      inline,
      targetRole,
      originalProfileLabel,
      topUnsupportedSignalsForDisplay,
    }))
  })

  return {
    source: 'rewritten_cv_state',
    version: CV_HIGHLIGHT_ARTIFACT_VERSION,
    resolvedHighlights: Array.from(highlights.values()).map((highlight) => ({
      ...highlight,
      ranges: highlight.ranges.sort((left, right) => left.start - right.start),
    })),
    highlightSource: 'job_targeting',
    highlightMode: 'override_review',
    reviewItems,
    highlightGeneratedAt: generatedAt,
    generatedAt,
  }
}
