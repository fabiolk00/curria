import {
  buildCoreRequirementOverviewSignals,
  buildPreferredRequirementDisplaySignals,
} from '@/lib/agent/job-targeting/core-requirement-coverage'
import {
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  buildExperienceBulletHighlightItemIds,
  createSummaryHighlightItemId,
  canonicalizeHighlightIdentityText,
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

  const ignore = new Set(['profissional', 'experiência', 'atuação', 'resumo']
    .map((item) => item.normalize('NFD').replace(/[\u0300-\u036f]/gu, '')))
  const picked = Array.from(candidates)
    .map((item) => item.replace(/[.]+$/u, '').trim())
    .filter((item) => {
      const normalizedItem = item
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
      return item && !ignore.has(normalizedItem)
    })
    .slice(0, 7)

  return picked.length > 0
    ? picked.join(', ')
    : 'experiência analítica e técnica comprovada no currículo original'
}

function isTechnicalEvidenceWarning(issue: ValidationIssue): boolean {
  const message = `${issue.issueType ?? ''} ${issue.message ?? ''}`.toLocaleLowerCase('pt-BR')
  return issue.issueType === 'summary_skill_without_evidence'
    || issue.issueType === 'target_role_overclaim'
    || issue.issueType === 'unsupported_claim'
    || message.includes('skill sem evid')
    || message.includes('cargo alvo sem evid')
}

function hasLowFitMismatchContext(params: {
  session: Session
  issues: ValidationIssue[]
  unsupportedRequirements: string[]
}): boolean {
  const validationOverride = params.session.agentState.validationOverride
  const targetingPlan = params.session.agentState.targetingPlan
  const lowFitGate = targetingPlan?.lowFitWarningGate
  const targetRolePermission = targetingPlan?.targetRolePositioning?.permission
  const acceptedLowFit = validationOverride?.acceptedLowFit === true
  const distantFamily = lowFitGate?.familyDistance === 'distant'
  const unsupportedGapHigh = (lowFitGate?.unsupportedGapRatio ?? 0) >= 0.7
  const noExplicitEvidence = (lowFitGate?.explicitEvidenceRatio ?? 1) === 0
  const cannotClaimTargetRole = targetRolePermission === 'must_not_claim_target_role'
  const hasCoreGaps = (lowFitGate?.coreRequirementCoverage.unsupported ?? 0) > 0
    || params.unsupportedRequirements.length > 0
  const hasTechnicalWarning = params.issues.some(isTechnicalEvidenceWarning)

  return acceptedLowFit
    && hasCoreGaps
    && (
      distantFamily
      || unsupportedGapHigh
      || noExplicitEvidence
      || cannotClaimTargetRole
      || hasTechnicalWarning
    )
}

function buildLowFitTargetMismatchReviewItem(params: {
  targetRole?: string
  originalProfileLabel: string
  jobRequirements: string[]
  preferredRequirements: string[]
  unsupportedRequirements: string[]
  sourceIssueCount: number
  hasSupportedCoreEvidence: boolean
}): ReviewWarningItem {
  const jobRequirements = (params.jobRequirements.length > 0
    ? params.jobRequirements
    : params.unsupportedRequirements).slice(0, 12)
  const unsupportedRequirements = params.unsupportedRequirements.slice(0, 8)
  const preferredRequirements = params.preferredRequirements.slice(0, 8)
  const provenProfile = params.originalProfileLabel
    || 'O currículo original não deixou claro um perfil diretamente alinhado a esta vaga.'

  const partialFit = params.hasSupportedCoreEvidence
  const title = partialFit
    ? 'Esta vaga tem aderência parcial com seu currículo'
    : 'Esta vaga parece distante do seu currículo atual'
  const summary = partialFit
    ? 'Encontramos pontos relevantes de aderência, mas alguns requisitos principais ainda pedem revisão cuidadosa.'
    : 'A geração foi feita após seu aceite, mas a aderência entre a vaga e o histórico original exige uma revisão cuidadosa.'
  const explanation = partialFit
    ? 'A vaga tem requisitos principais parcialmente comprovados no currículo original, junto com lacunas que não devem ser apresentadas como experiência direta.'
    : 'A vaga pede responsabilidades e requisitos que não aparecem com evidência suficiente no currículo original.'
  const whyItMatters = partialFit
    ? 'Quando existem pontos comprovados e gaps ao mesmo tempo, a versão gerada precisa preservar o que é real sem transformar diferenciais ou lacunas em experiência direta.'
    : 'A versão gerada pode aproximar seu currículo de uma função que o histórico original não comprova diretamente. Isso pode fazer o currículo parecer artificial ou sugerir experiência sem sustentação no documento original.'

  const dedupedReviewItems = dedupeReviewItems(reviewItems)
  const highlightRangeCount = Array.from(highlights.values()).reduce((total, highlight) => total + highlight.ranges.length, 0)

  return {
    id: `review-low-fit-target-mismatch-${params.targetRole ?? 'target-role'}`.slice(0, 120),
    kind: 'low_fit_target_mismatch',
    severity: partialFit ? 'review' : 'risk',
    section: 'general',
    sectionLabel: 'Diagnóstico da vaga',
    title,
    summary,
    explanation,
    whyItMatters,
    suggestedAction: 'Revise o resumo e as experiências antes de enviar. Mantenha sua identidade profissional real e destaque apenas habilidades transferíveis comprovadas.',
    message: `Diagnóstico consolidado de baixa aderência a partir de ${params.sourceIssueCount} ponto(s) de validação.`,
    issueType: 'low_fit_target_mismatch',
    targetRole: params.targetRole,
    provenProfile,
    originalProfileLabel: provenProfile,
    jobRequirements,
    preferredRequirements,
    unsupportedRequirements,
    missingEvidence: unsupportedRequirements,
    inline: false,
  }
}

function reviewItemRichness(item: ReviewWarningItem): number {
  return [
    item.targetRole,
    item.jobRequirements?.length,
    item.provenProfile || item.originalProfileLabel,
    item.missingEvidence?.length || item.unsupportedRequirements?.length,
    item.whyItMatters,
    item.suggestedAction,
  ].reduce<number>((score, value) => score + (value ? 1 : 0), 0)
}

function reviewItemSignature(item: ReviewWarningItem): string {
  return [
    item.kind ?? item.issueType ?? 'generic',
    canonicalizeHighlightIdentityText(item.targetRole ?? ''),
    canonicalizeHighlightIdentityText((item.jobRequirements ?? []).slice(0, 5).join('|')),
  ].join(':')
}

function dedupeReviewItems(items: ReviewWarningItem[]): ReviewWarningItem[] {
  const bySignature = new Map<string, ReviewWarningItem>()

  items.forEach((item) => {
    const signature = reviewItemSignature(item)
    const current = bySignature.get(signature)
    if (!current || reviewItemRichness(item) > reviewItemRichness(current)) {
      bySignature.set(signature, item)
    }
  })

  return Array.from(bySignature.values())
}

function buildIssueReviewItem(params: {
  issue: ValidationIssue
  inline: boolean
  targetRole?: string
  originalProfileLabel: string
  unsupportedRequirements: string[]
}): ReviewWarningItem {
  const { issue } = params
  const targetRole = params.targetRole
  const offendingSignal = issue.offendingSignal?.trim()
  const replacement = issue.suggestedReplacement?.trim()
  const defaults = {
    severity: 'risk' as const,
    section: mapIssueSection(issue.section),
    title: 'Revise este ponto antes de enviar',
    explanation: issue.userFacingExplanation?.trim() || 'Identificamos um ponto que merece revisão para manter seu currículo fiel ao histórico original.',
    whyItMatters: 'Quando o texto sugere experiências não comprovadas, o currículo pode parecer artificial para recrutadores.',
    suggestedAction: 'Ajuste a redação para manter apenas afirmações sustentadas pelo currículo original.',
    summary: issue.userFacingExplanation?.trim() || issue.message,
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
    const unsupportedRequirements = params.unsupportedRequirements.slice(0, 8)
    const hasUnsupportedRequirements = unsupportedRequirements.length > 0
    const provenProfile = params.originalProfileLabel
      || 'O currículo original não deixou claro um perfil diretamente alinhado a esta vaga.'
    return {
      ...defaults,
      id: `warning-${issue.issueType}-${targetRole ?? 'target-role'}`.slice(0, 120),
      title: 'Esta vaga parece distante do seu currículo atual',
      summary: hasUnsupportedRequirements
        ? 'Esta versão foi gerada com distância relevante entre os requisitos da vaga e as evidências do currículo original.'
        : 'Esta versão foi gerada para uma vaga com sinais limitados de aderência no currículo original.',
      explanation: hasUnsupportedRequirements
        ? 'A vaga exige responsabilidades e requisitos que ainda não aparecem com evidência suficiente no seu histórico.'
        : 'A vaga escolhida pode não estar diretamente alinhada com as experiências comprovadas no seu currículo original.',
      whyItMatters: `Seu perfil comprovado hoje está mais alinhado com ${provenProfile}. Quando requisitos centrais da vaga não aparecem no histórico original, o currículo pode parecer artificial ou sugerir experiência não comprovada.`,
      suggestedAction: hasUnsupportedRequirements
        ? 'Revise se faz sentido se apresentar diretamente para esta vaga. Se decidir seguir, mantenha sua identidade profissional real e destaque apenas habilidades transferíveis comprovadas antes de enviar.'
        : 'Revise o posicionamento para manter sua identidade profissional real e destacar apenas competências comprovadas antes de enviar.',
      message: issue.userFacingExplanation ?? issue.message,
      issueType: issue.issueType,
      offendingSignal,
      offendingText: issue.offendingText ?? issue.offendingSignal,
      targetRole,
      provenProfile,
      originalProfileLabel: provenProfile,
      unsupportedRequirements,
      missingEvidence: unsupportedRequirements,
      jobRequirements: unsupportedRequirements,
      sectionLabel: 'Resumo',
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
  const coreRequirementCoverage = targetingPlan?.lowFitWarningGate?.coreRequirementCoverage
    ?? targetingPlan?.coreRequirementCoverage
  const unsupportedRequirements = coreRequirementCoverage?.topUnsupportedSignalsForDisplay
    ?? []
  const requirementItems = coreRequirementCoverage?.requirements ?? []
  const jobRequirements = requirementItems.length > 0
    ? buildCoreRequirementOverviewSignals(requirementItems)
    : unsupportedRequirements
  const preferredRequirements = coreRequirementCoverage?.preferredSignalsForDisplay
    ?? (requirementItems.length > 0 ? buildPreferredRequirementDisplaySignals(requirementItems) : [])
  const hasSupportedCoreEvidence = (coreRequirementCoverage?.supported ?? 0) > 0

  if (hasLowFitMismatchContext({ session: params.session, issues, unsupportedRequirements })) {
    reviewItems.push(buildLowFitTargetMismatchReviewItem({
      targetRole,
      originalProfileLabel,
      jobRequirements,
      preferredRequirements,
      unsupportedRequirements,
      sourceIssueCount: issues.length,
      hasSupportedCoreEvidence,
    }))
  } else {
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
        unsupportedRequirements,
      }))
    })
  }

  return {
    source: 'rewritten_cv_state',
    version: CV_HIGHLIGHT_ARTIFACT_VERSION,
    resolvedHighlights: Array.from(highlights.values()).map((highlight) => ({
      ...highlight,
      ranges: highlight.ranges.sort((left, right) => left.start - right.start),
    })),
    highlightSource: 'job_targeting',
    highlightMode: 'override_review',
    reviewItems: dedupedReviewItems,
    reviewCardCount: dedupedReviewItems.length,
    highlightRangeCount,
    compatibilityStatus: dedupedReviewItems.length > 0 ? 'likely_with_gaps' : 'compatible',
    highlightGeneratedAt: generatedAt,
    generatedAt,
  }
}
