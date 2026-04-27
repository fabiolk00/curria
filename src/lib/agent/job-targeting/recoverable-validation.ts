import { randomUUID } from 'crypto'

import { repairUtf8Mojibake } from '@/lib/text/repair-utf8-mojibake'
import type {
  BlockedTargetedRewriteDraft,
  RecoverableValidationBlockKind,
  RewriteValidationResult,
  Session,
  TargetEvidence,
  TargetingPlan,
  TargetRolePositioning,
  UserFacingValidationModalPayload,
  ValidationIssue,
  ValidationOverrideMetadata,
} from '@/types/agent'
import type { CVState } from '@/types/cv'

const RECOVERABLE_DRAFT_TTL_MS = 1000 * 60 * 20
const RECOVERABLE_VALIDATION_ISSUE_TYPES = new Set<NonNullable<ValidationIssue['issueType']>>([
  'unsupported_claim',
  'unsupported_skill',
  'target_role_overclaim',
  'seniority_inflation',
  'ungrounded_bridge',
  'forbidden_claim',
  'summary_skill_without_evidence',
  'low_fit_target_role',
])

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function listToSentence(values: string[]): string {
  if (values.length === 0) {
    return ''
  }

  if (values.length === 1) {
    return values[0]
  }

  if (values.length === 2) {
    return `${values[0]} e ${values[1]}`
  }

  return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`
}

export function sanitizeText(value: string): string {
  return repairUtf8Mojibake(value)
}

export function sanitizeValidationIssue(issue: ValidationIssue): ValidationIssue {
  return {
    ...issue,
    message: sanitizeText(issue.message),
    offendingSignal: issue.offendingSignal ? sanitizeText(issue.offendingSignal) : issue.offendingSignal,
    suggestedReplacement: issue.suggestedReplacement ? sanitizeText(issue.suggestedReplacement) : issue.suggestedReplacement,
    userFacingTitle: issue.userFacingTitle ? sanitizeText(issue.userFacingTitle) : issue.userFacingTitle,
    userFacingExplanation: issue.userFacingExplanation ? sanitizeText(issue.userFacingExplanation) : issue.userFacingExplanation,
  }
}

export function sanitizeModalPayload(payload: UserFacingValidationModalPayload): UserFacingValidationModalPayload {
  const sanitizedRecommendation = payload.recommendation
    ? sanitizeText(payload.recommendation)
    : undefined
  const sanitizedPrimaryAction = payload.actions.primary
    ? {
        ...payload.actions.primary,
        label: sanitizeText(payload.actions.primary.label) as 'Gerar mesmo assim (1 crédito)',
      }
    : undefined

  return {
    ...payload,
    title: sanitizeText(payload.title),
    description: sanitizeText(payload.description),
    primaryProblem: sanitizeText(payload.primaryProblem),
    problemBullets: payload.problemBullets.map(sanitizeText),
    reassurance: sanitizeText(payload.reassurance),
    recommendation: sanitizedRecommendation,
    actions: {
      secondary: {
        ...payload.actions.secondary,
        label: sanitizeText(payload.actions.secondary.label) as 'Fechar',
      },
      primary: sanitizedPrimaryAction,
    },
  }
}

export function sanitizeValidationResultForLogging(result: RewriteValidationResult): RewriteValidationResult {
  return {
    ...result,
    hardIssues: result.hardIssues.map(sanitizeValidationIssue),
    softWarnings: result.softWarnings.map(sanitizeValidationIssue),
    issues: result.issues.map(sanitizeValidationIssue),
    promotedWarnings: result.promotedWarnings
      ? result.promotedWarnings.map((warning) => ({
          ...warning,
          issueType: sanitizeText(warning.issueType),
          reason: sanitizeText(warning.reason),
        }))
      : result.promotedWarnings,
  }
}

function findStrongestAnchors(params: {
  directClaimsAllowed?: string[]
  mustEmphasize?: string[]
}): string[] {
  return dedupe([
    ...(params.directClaimsAllowed ?? []),
    ...(params.mustEmphasize ?? []),
  ]).slice(0, 4)
}

export function buildTargetRolePositioning(params: {
  targetRole: string
  targetEvidence?: TargetEvidence[]
  mustEmphasize?: string[]
  directClaimsAllowed?: string[]
  careerFitEvaluation?: Session['agentState']['careerFitEvaluation']
}): TargetRolePositioning {
  const targetEvidence = params.targetEvidence ?? []
  const unsupportedGapCount = targetEvidence.filter((evidence) => evidence.evidenceLevel === 'unsupported_gap').length
  const unsupportedGapRatio = targetEvidence.length > 0
    ? unsupportedGapCount / targetEvidence.length
    : 0
  const anchors = findStrongestAnchors({
    directClaimsAllowed: params.directClaimsAllowed,
    mustEmphasize: params.mustEmphasize,
  })

  const safeRolePositioning = anchors.length > 0
    ? `Profissional com experiência em ${listToSentence(anchors)}.`
    : 'Profissional com experiência técnica aderente às principais responsabilidades da vaga.'

  const riskLevel = params.careerFitEvaluation?.riskLevel
  const familyDistance = params.careerFitEvaluation?.signals.familyDistance

  if (
    riskLevel === 'high'
    || familyDistance === 'distant'
    || unsupportedGapRatio >= 0.5
  ) {
    return {
      targetRole: params.targetRole,
      permission: 'must_not_claim_target_role',
      reason: riskLevel === 'high'
        ? 'career_fit_high_risk'
        : familyDistance === 'distant'
          ? 'career_family_distance_distant'
          : 'unsupported_gap_ratio_high',
      safeRolePositioning,
      forbiddenRoleClaims: dedupe([
        params.targetRole,
        `experiência direta como ${params.targetRole}`,
      ]),
    }
  }

  if (unsupportedGapRatio >= 0.25 || familyDistance === 'adjacent') {
    return {
      targetRole: params.targetRole,
      permission: 'can_bridge_to_target_role',
      reason: familyDistance === 'adjacent'
        ? 'career_family_distance_adjacent'
        : 'unsupported_gap_ratio_medium',
      safeRolePositioning,
      forbiddenRoleClaims: [params.targetRole],
    }
  }

  return {
    targetRole: params.targetRole,
    permission: 'can_claim_target_role',
    reason: 'target_role_supported',
    safeRolePositioning,
    forbiddenRoleClaims: [],
  }
}

export function isSummaryOnlyRecoverableValidation(
  validation?: Session['agentState']['rewriteValidation'],
): boolean {
  if (!validation?.blocked || validation.hardIssues.length === 0) {
    return false
  }

  return validation.hardIssues.every((issue) =>
    issue.section === 'summary'
    && (
      issue.issueType === 'unsupported_claim'
      || issue.issueType === 'target_role_overclaim'
      || issue.issueType === 'summary_skill_without_evidence'
    ))
}

export function isRecoverableValidationBlock(
  validation?: Session['agentState']['rewriteValidation'],
): boolean {
  if (!validation?.blocked || validation.hardIssues.length === 0) {
    return false
  }

  return validation.hardIssues.every((issue) =>
    issue.issueType !== undefined && RECOVERABLE_VALIDATION_ISSUE_TYPES.has(issue.issueType))
}

function extractProblemBullets(issues: ValidationIssue[]): string[] {
  return dedupe(
    issues
      .map((issue) => sanitizeValidationIssue(issue))
      .map((issue) => issue.userFacingExplanation ?? issue.suggestedReplacement ?? issue.offendingSignal ?? issue.message)
      .filter(Boolean),
  ).slice(0, 3)
}

function buildOriginalProfileLabel(targetEvidence?: TargetEvidence[]): string | undefined {
  const strongestSignals = (targetEvidence ?? [])
    .filter((evidence) =>
      evidence.rewritePermission === 'can_claim_directly'
      || evidence.rewritePermission === 'can_claim_normalized')
    .map((evidence) => evidence.canonicalSignal)
    .slice(0, 4)

  return strongestSignals.length > 0
    ? listToSentence(strongestSignals)
    : undefined
}

export function buildUserFacingValidationBlockModal(args: {
  targetRole?: string
  validationIssues: ValidationIssue[]
  targetEvidence?: TargetEvidence[]
  originalProfileLabel?: string
  lowFitWarningGate?: TargetingPlan['lowFitWarningGate']
  directClaimsAllowed?: string[]
}): UserFacingValidationModalPayload {
  const sanitizedIssues = args.validationIssues.map(sanitizeValidationIssue)
  const primaryIssue = sanitizedIssues.find((issue) => issue.issueType === 'target_role_overclaim')
    ?? sanitizedIssues.find((issue) => issue.issueType === 'unsupported_claim')
    ?? sanitizedIssues[0]
  const targetRole = args.targetRole?.trim()
  const originalProfileLabel = args.originalProfileLabel ?? buildOriginalProfileLabel(args.targetEvidence)
  const nearbySignals = dedupe([
    ...(args.directClaimsAllowed ?? []),
    ...(args.targetEvidence ?? [])
      .filter((evidence) =>
        evidence.rewritePermission === 'can_claim_directly'
        || evidence.rewritePermission === 'can_claim_normalized')
      .map((evidence) => evidence.canonicalSignal),
  ]).slice(0, 4)

  if (args.lowFitWarningGate?.triggered) {
    const unsupportedSignals = args.lowFitWarningGate.coreRequirementCoverage.topUnsupportedSignalsForDisplay
      ?? args.lowFitWarningGate.coreRequirementCoverage.unsupportedSignals.slice(0, 6)
    const targetRoleLabel = targetRole ? ` como ${targetRole}` : ''

    return sanitizeModalPayload({
      title: 'Esta vaga parece muito distante do seu currículo atual',
      description: 'Encontramos poucos pontos comprovados no seu currículo para os requisitos principais desta vaga.',
      primaryProblem: unsupportedSignals.length > 0
        ? `A vaga pede ${listToSentence(unsupportedSignals)}, mas seu histórico atual sustenta melhor outra trajetória profissional.`
        : targetRole
          ? `Não encontramos comprovação suficiente para sustentar uma apresentação direta como ${targetRole}.`
          : 'Não encontramos comprovação suficiente para sustentar uma apresentação direta para esta vaga.',
      problemBullets: [
        originalProfileLabel
          ? `Seu currículo comprova melhor experiência em ${originalProfileLabel}.`
          : '',
        nearbySignals.length > 0
          ? `Encontramos alguns pontos próximos, como ${listToSentence(nearbySignals)}, mas eles não sustentam uma apresentação direta${targetRoleLabel}.`
          : '',
        ...extractProblemBullets(sanitizedIssues),
      ].filter(Boolean).slice(0, 3),
      reassurance: 'Isso não significa que você não pode se candidatar. Significa apenas que essa versão pode ficar pouco aderente ou parecer forçada.',
      recommendation: 'Você pode gerar mesmo assim e revisar manualmente antes de enviar.',
      actions: {
        secondary: {
          label: 'Fechar',
          action: 'close',
        },
        primary: {
          label: 'Gerar mesmo assim (1 crédito)',
          action: 'override_generate',
          creditCost: 1,
        },
      },
    })
  }

  if (primaryIssue?.issueType === 'target_role_overclaim' && targetRole) {
    return sanitizeModalPayload({
      title: 'O resumo ficou agressivo demais para esta vaga',
      description: `A versão gerada tentou se aproximar diretamente do cargo "${targetRole}", mas seu currículo comprova melhor outra trajetória profissional.`,
      primaryProblem: originalProfileLabel
        ? `Seu histórico mostra principalmente experiência em ${originalProfileLabel}. A vaga pede ${targetRole}.`
        : `O resumo tentou se apresentar diretamente como "${targetRole}", sem evidência suficiente no seu currículo original.`,
      problemBullets: extractProblemBullets(sanitizedIssues),
      reassurance: 'Isso não significa que você não pode se candidatar. Significa apenas que recomendamos revisar esse trecho para evitar que o currículo pareça declarar uma experiência direta que não está comprovada.',
      recommendation: 'Você pode gerar mesmo assim, mas recomendamos revisar o resumo antes de enviar.',
      actions: {
        secondary: {
          label: 'Fechar',
          action: 'close',
        },
        primary: {
          label: 'Gerar mesmo assim (1 crédito)',
          action: 'override_generate',
          creditCost: 1,
        },
      },
    })
  }

  if (primaryIssue?.offendingSignal) {
    return sanitizeModalPayload({
      title: 'A versão gerada declarou uma experiência sem comprovação suficiente',
      description: primaryIssue.suggestedReplacement
        ? `A adaptação tentou usar "${primaryIssue.offendingSignal}" como experiência direta, mas seu currículo sustenta melhor: ${primaryIssue.suggestedReplacement}.`
        : `A adaptação tentou usar "${primaryIssue.offendingSignal}" como experiência direta sem evidência suficiente no currículo original.`,
      primaryProblem: primaryIssue.userFacingExplanation
        ?? 'Encontramos um trecho que pode exagerar sua experiência em relação ao que o currículo original comprova.',
      problemBullets: extractProblemBullets(sanitizedIssues),
      reassurance: 'Isso não significa que você não pode se candidatar. Significa apenas que essa versão pode precisar de revisão para ficar fiel ao seu histórico.',
      recommendation: 'Você pode gerar mesmo assim, mas recomendamos revisar esse trecho antes de enviar o currículo.',
      actions: {
        secondary: {
          label: 'Fechar',
          action: 'close',
        },
        primary: {
          label: 'Gerar mesmo assim (1 crédito)',
          action: 'override_generate',
          creditCost: 1,
        },
      },
    })
  }

  return sanitizeModalPayload({
    title: 'Encontramos pontos que podem exagerar sua experiência',
    description: 'A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.',
    primaryProblem: targetRole
      ? `Geramos uma versão alinhada à vaga "${targetRole}", mas alguns trechos podem ter se aproximado demais de experiências que o seu currículo ainda não comprova diretamente.`
      : 'O currículo gerado pode ter declarado como experiência direta alguns requisitos da vaga que aparecem apenas como experiências próximas no seu histórico.',
    problemBullets: extractProblemBullets(sanitizedIssues),
    reassurance: 'Isso não significa que você não pode se candidatar. Significa apenas que recomendamos revisar esses pontos para evitar que o currículo pareça declarar algo que ainda não está no seu currículo original.',
    recommendation: 'Você pode gerar mesmo assim, mas recomendamos revisar esses pontos antes de enviar.',
    actions: {
      secondary: {
        label: 'Fechar',
        action: 'close',
      },
      primary: {
        label: 'Gerar mesmo assim (1 crédito)',
        action: 'override_generate',
        creditCost: 1,
      },
    },
  })
}

export function createBlockedTargetedRewriteDraft(params: {
  sessionId: string
  userId: string
  kind?: RecoverableValidationBlockKind
  optimizedCvState?: CVState
  originalCvState: CVState
  optimizationSummary?: BlockedTargetedRewriteDraft['optimizationSummary']
  targetJobDescription: string
  targetRole?: string
  validationIssues: ValidationIssue[]
  lowFitGate?: BlockedTargetedRewriteDraft['lowFitGate']
  targetEvidence?: BlockedTargetedRewriteDraft['targetEvidence']
  safeTargetingEmphasis?: BlockedTargetedRewriteDraft['safeTargetingEmphasis']
  coreRequirementCoverage?: BlockedTargetedRewriteDraft['coreRequirementCoverage']
  recoverable: boolean
}): BlockedTargetedRewriteDraft {
  const createdAt = new Date().toISOString()
  return {
    id: randomUUID(),
    token: randomUUID(),
    sessionId: params.sessionId,
    userId: params.userId,
    kind: params.kind ?? 'post_rewrite_validation_block',
    optimizedCvState: params.optimizedCvState
      ? structuredClone(params.optimizedCvState)
      : undefined,
    originalCvState: structuredClone(params.originalCvState),
    optimizationSummary: params.optimizationSummary
      ? structuredClone(params.optimizationSummary)
      : undefined,
    targetJobDescription: params.targetJobDescription,
    targetRole: params.targetRole,
    validationIssues: structuredClone(params.validationIssues.map(sanitizeValidationIssue)),
    lowFitGate: params.lowFitGate
      ? structuredClone(params.lowFitGate)
      : undefined,
    targetEvidence: params.targetEvidence
      ? structuredClone(params.targetEvidence)
      : undefined,
    safeTargetingEmphasis: params.safeTargetingEmphasis
      ? structuredClone(params.safeTargetingEmphasis)
      : undefined,
    coreRequirementCoverage: params.coreRequirementCoverage
      ? structuredClone(params.coreRequirementCoverage)
      : undefined,
    recoverable: params.recoverable,
    createdAt,
    expiresAt: new Date(Date.now() + RECOVERABLE_DRAFT_TTL_MS).toISOString(),
  }
}

export function buildSummaryRetryInstructions(targetingPlan: TargetingPlan): string {
  const permissions = targetingPlan.rewritePermissions
  const directClaimsAllowed = permissions?.directClaimsAllowed.join(', ') || 'none'
  const normalizedClaimsAllowed = permissions?.normalizedClaimsAllowed.join(', ') || 'none'
  const safeDirectEmphasis = targetingPlan.safeTargetingEmphasis?.safeDirectEmphasis.join(', ') || 'none'
  const forbiddenClaims = permissions?.forbiddenClaims.join(', ') || 'none'
  const bridgeClaimsAllowed = permissions?.bridgeClaimsAllowed
    .map((claim) => `${claim.jobSignal}: ${claim.safeBridge}`)
    .join(' | ') || 'none'
  const cautiousBridgeEmphasis = targetingPlan.safeTargetingEmphasis?.cautiousBridgeEmphasis
    .map((claim) => `${claim.jobSignal}: ${claim.safeWording}`)
    .join(' | ') || 'none'
  const targetRolePositioning = targetingPlan.targetRolePositioning

  return [
    'The previous targeted summary failed factual validation.',
    'Rewrite only the professional summary.',
    targetRolePositioning?.permission === 'must_not_claim_target_role'
      ? `Do not present the candidate directly as: "${targetRolePositioning.targetRole}".`
      : '',
    targetRolePositioning?.safeRolePositioning
      ? `Use this safer positioning: "${targetRolePositioning.safeRolePositioning}".`
      : '',
    `Do not directly claim unsupported requirements: ${forbiddenClaims}.`,
    `Allowed direct claims: ${directClaimsAllowed}.`,
    `Allowed normalized claims: ${normalizedClaimsAllowed}.`,
    `Prioritize these proven aligned signals: ${safeDirectEmphasis}.`,
    `Allowed bridges: ${bridgeClaimsAllowed}.`,
    `Preferred cautious bridge wording: ${cautiousBridgeEmphasis}.`,
    'Rules:',
    '- Keep the candidate real professional identity.',
    '- Do not invent experience in the target role.',
    '- Do not claim unsupported tools, certifications, industries, or responsibilities.',
    '- Use bridges only with cautious language.',
    '- Do not use seniority inflation such as specialist, expert, advanced, lead, owner, certified, authority, domínio, especialista, referência, unless supported by original evidence.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildValidationOverrideMetadata(params: {
  userId: string
  targetRole?: string
  validationIssues: ValidationIssue[]
  acceptedLowFit?: boolean
  fallbackUsed?: boolean
  overrideRequestId?: string
  overrideTokenHash?: string
  cvVersionId?: string
  resumeGenerationId?: string
}): ValidationOverrideMetadata {
  return {
    enabled: true,
    acceptedAt: new Date().toISOString(),
    acceptedByUserId: params.userId,
    validationIssueCount: params.validationIssues.length,
    hardIssueCount: params.validationIssues.filter((issue) => issue.severity === 'high').length,
    issues: structuredClone(params.validationIssues.map(sanitizeValidationIssue)),
    issueTypes: dedupe(
      params.validationIssues
        .map((issue) => issue.issueType)
        .filter(isDefined),
    ),
    targetRole: params.targetRole,
    acceptedLowFit: params.acceptedLowFit,
    fallbackUsed: params.fallbackUsed,
    overrideRequestId: params.overrideRequestId,
    overrideTokenHash: params.overrideTokenHash,
    cvVersionId: params.cvVersionId,
    resumeGenerationId: params.resumeGenerationId,
  }
}
