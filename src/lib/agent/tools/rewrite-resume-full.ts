import { executeWithStageRetry, shapeRewriteCurrentContent } from '@/lib/agent/ats-enhancement-retry'
import {
  executeWithStageRetry as executeJobTargetingWithRetry,
  shapeTargetJobDescription,
  shapeTargetingRewriteCurrentContent,
} from '@/lib/agent/job-targeting-retry'
import { buildActionContext } from '@/lib/agent/context/actions/build-action-context'
import { buildBaseGuardrails } from '@/lib/agent/context/base/build-base-guardrails'
import { buildBaseSystemContext } from '@/lib/agent/context/base/build-base-system-context'
import { buildOutputContractContext } from '@/lib/agent/context/schemas/build-output-contract-context'
import { buildWorkflowContext } from '@/lib/agent/context/workflows/build-workflow-context'
import { buildRewriteTargetPlan } from '@/lib/agent/job-targeting/rewrite-target-plan'
import { buildTargetedRewritePermissions } from '@/lib/agent/job-targeting/rewrite-permissions'
import {
  buildGeneratedClaimTraceFromSectionPlans,
  buildSectionRewritePlan,
} from '@/lib/agent/job-targeting/compatibility/rewrite-trace'
import { buildRewritePlan } from '@/lib/agent/tools/build-rewrite-plan'
import { formatResumeRewriteGuardrails } from '@/lib/agent/tools/resume-rewrite-guidelines'
import { buildTargetedRewritePlan } from '@/lib/agent/tools/build-targeting-plan'
import { rewriteSection } from '@/lib/agent/tools/rewrite-section'
import type { ToolErrorCode } from '@/lib/agent/tool-errors'
import type {
  AtsAnalysisResult,
  CoreRequirement,
  RewriteSectionInput,
  RewriteSectionOutput,
  TargetingPlan,
} from '@/types/agent'
import type {
  GeneratedClaimTrace,
  JobCompatibilityAssessment,
  SectionRewritePlan,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState, GapAnalysisResult } from '@/types/cv'

type RewriteSectionName = RewriteSectionInput['section']
type RewriteSectionFailureOutput = Extract<RewriteSectionOutput, { success: false }>

class RewriteSectionFailureError extends Error {
  readonly code: ToolErrorCode
  readonly section: RewriteSectionName

  constructor(section: RewriteSectionName, output: RewriteSectionFailureOutput) {
    super(output.error)
    this.name = 'RewriteSectionFailureError'
    this.code = output.code
    this.section = section
  }
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function matchesFocusSignal(value: string, signals: string[]): boolean {
  const normalizedValue = normalize(value)

  return signals.some((signal) => {
    const normalizedSignal = normalize(signal)
    return normalizedSignal.length >= 3
      && (normalizedValue.includes(normalizedSignal) || normalizedSignal.includes(normalizedValue))
  })
}

function normalizeForKeywordVisibility(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildKeywordSectionTexts(cvState: CVState): Record<'summary' | 'skills' | 'experience', string> {
  return {
    summary: normalizeForKeywordVisibility(cvState.summary),
    skills: normalizeForKeywordVisibility(cvState.skills.join(' ')),
    experience: normalizeForKeywordVisibility(
      cvState.experience
        .flatMap((entry) => [entry.title, ...entry.bullets])
        .join(' '),
    ),
  }
}

function collectKeywordVisibilityImprovement(
  originalCvState: CVState,
  optimizedCvState: CVState,
  focusSignals: string[],
): string[] {
  const originalSections = buildKeywordSectionTexts(originalCvState)
  const optimizedSections = buildKeywordSectionTexts(optimizedCvState)
  const sectionNames = Object.keys(originalSections) as Array<keyof typeof originalSections>

  return Array.from(new Set(focusSignals.map((signal) => signal.trim()).filter(Boolean)))
    .filter((signal) => normalizeForKeywordVisibility(signal).length >= 3)
    .filter((signal) => {
      const normalizedSignal = normalizeForKeywordVisibility(signal)
      const originalVisibility = sectionNames.filter((section) =>
        originalSections[section].includes(normalizedSignal)).length
      const optimizedVisibility = sectionNames.filter((section) =>
        optimizedSections[section].includes(normalizedSignal)).length

      return optimizedVisibility > originalVisibility
    })
    .slice(0, 8)
}

function sanitizeJobTargetedSkills(
  originalSkills: CVState['skills'],
  rewrittenSkills: CVState['skills'],
  targetingPlan: TargetingPlan,
): CVState['skills'] {
  const originalEntries = originalSkills.reduce<Array<{ value: string; normalized: string; originalIndex: number }>>((entries, skill, originalIndex) => {
    const normalized = normalize(skill)
    if (!normalized || entries.some((entry) => entry.normalized === normalized)) {
      return entries
    }

    entries.push({ value: skill, normalized, originalIndex })
    return entries
  }, [])

  const rewrittenOrder = new Map<string, number>()
  rewrittenSkills.forEach((skill, index) => {
    const normalized = normalize(skill)
    if (normalized && !rewrittenOrder.has(normalized)) {
      rewrittenOrder.set(normalized, index)
    }
  })
  const additionalAllowedSkills = new Map<string, string>()
  ;(targetingPlan.rewritePermissions?.skillsSurfaceAllowed ?? []).forEach((skill) => {
    const normalized = normalize(skill)
    if (normalized && !additionalAllowedSkills.has(normalized)) {
      additionalAllowedSkills.set(normalized, skill)
    }
  })

  rewrittenSkills.forEach((skill) => {
    const normalized = normalize(skill)
    if (!normalized || !additionalAllowedSkills.has(normalized)) {
      return
    }

    if (!originalEntries.some((entry) => entry.normalized === normalized)) {
      originalEntries.push({
        value: skill,
        normalized,
        originalIndex: Number.MAX_SAFE_INTEGER,
      })
    }
  })

  const focusSignals = targetingPlan.mustEmphasize.length > 0
    ? targetingPlan.mustEmphasize
    : targetingPlan.focusKeywords

  return [...originalEntries]
    .sort((left, right) => {
      const leftFocus = matchesFocusSignal(left.value, focusSignals) ? 1 : 0
      const rightFocus = matchesFocusSignal(right.value, focusSignals) ? 1 : 0
      if (leftFocus !== rightFocus) {
        return rightFocus - leftFocus
      }

      const leftRewrittenIndex = rewrittenOrder.get(left.normalized)
      const rightRewrittenIndex = rewrittenOrder.get(right.normalized)

      if (leftRewrittenIndex !== undefined && rightRewrittenIndex !== undefined) {
        return leftRewrittenIndex - rightRewrittenIndex
      }

      if (leftRewrittenIndex !== undefined || rightRewrittenIndex !== undefined) {
        return leftRewrittenIndex !== undefined ? -1 : 1
      }

      return left.originalIndex - right.originalIndex
    })
    .map((entry) => entry.value)
}

function buildTargetedPermissionInstructions(targetingPlan: TargetingPlan): string[] {
  const permissions = targetingPlan.rewritePermissions
    ?? buildTargetedRewritePermissions(targetingPlan.targetEvidence ?? [])
  const targetRolePositioning = targetingPlan.targetRolePositioning
  const safeTargetingEmphasis = targetingPlan.safeTargetingEmphasis

  const lines: string[] = [
    'Evidence-based targeted rewrite permissions apply only to this targeted rewrite.',
    permissions.directClaimsAllowed.length > 0
      ? `Direct claims allowed: ${permissions.directClaimsAllowed.join(', ')}.`
      : 'Direct claims allowed: none beyond the original resume wording.',
    permissions.normalizedClaimsAllowed.length > 0
      ? `Normalized or equivalent claims allowed: ${permissions.normalizedClaimsAllowed.join(', ')}.`
      : 'Normalized or equivalent claims allowed: none.',
  ]

  if ((safeTargetingEmphasis?.safeDirectEmphasis.length ?? 0) > 0) {
    lines.push(
      `Prioritize these proven aligned signals when they improve the resume truthfully: ${safeTargetingEmphasis?.safeDirectEmphasis.join(', ')}.`,
    )
  }

  if (targetRolePositioning?.permission === 'must_not_claim_target_role') {
    lines.push(
      'Target role positioning:',
      `- Do not present the candidate directly as: "${targetRolePositioning.targetRole}".`,
      '- The original profile does not provide enough equivalent evidence to claim this target role directly.',
      `- Use this safer positioning instead: "${targetRolePositioning.safeRolePositioning}".`,
      '- You may bridge toward the target context, but must preserve the candidate real professional identity.',
    )
  } else if (targetRolePositioning?.permission === 'can_bridge_to_target_role') {
    lines.push(
      'Target role positioning:',
      `- You may bridge toward "${targetRolePositioning.targetRole}" carefully, but must not open with or state "${targetRolePositioning.targetRole}" as the candidate's established professional identity.`,
      `- Prefer safer positioning such as: "${targetRolePositioning.safeRolePositioning}".`,
      `- Safe summary template: "Profissional com experiência em [evidências reais], com atuação próxima ao contexto de ${targetRolePositioning.targetRole}."`,
    )
  }

  if ((safeTargetingEmphasis?.cautiousBridgeEmphasis.length ?? 0) > 0) {
    lines.push(
      'Use careful bridge wording only in narrative surfaces, never as direct skill or role claims:',
      ...safeTargetingEmphasis!.cautiousBridgeEmphasis.map((bridge) => `- ${bridge.jobSignal}: ${bridge.safeWording}. Do not say: ${bridge.forbiddenWording.join(', ')}.`),
    )
  }

  if (permissions.bridgeClaimsAllowed.length > 0) {
    lines.push(
      'Bridge carefully only when anchored in real evidence:',
      ...permissions.bridgeClaimsAllowed.map((claim) => `- ${claim.safeBridge} Do not say: ${claim.doNotSay.join(', ') || claim.jobSignal}.`),
    )
  }

  if (permissions.relatedButNotClaimable.length > 0) {
    lines.push(`Related but not directly claimable: ${permissions.relatedButNotClaimable.join(', ')}.`)
  }

  if (permissions.forbiddenClaims.length > 0) {
    lines.push(`Forbidden claims: ${permissions.forbiddenClaims.join(', ')}.`)
  }

  lines.push(
    'Surface rules:',
    `- Skills section is strict. Only use direct, normalized, or high-confidence equivalent claims from: ${permissions.skillsSurfaceAllowed.join(', ') || 'none'}.`,
    '- Summary may use careful bridges, but never turn a bridge into a direct mastery claim.',
    '- Experience bullets may use careful bridges only when anchored in real resume evidence.',
    '- Never increase seniority, depth, ownership, certification, tool usage, or years of experience beyond the original resume.',
  )

  return lines
}

function buildClaimPolicyInstructions(assessment?: JobCompatibilityAssessment): string[] {
  if (!assessment) {
    return []
  }

  const allowed = assessment.claimPolicy.allowedClaims.map((claim) => (
    `- ${claim.id}: allowed "${claim.signal}" using ${claim.allowedTerms.join(', ') || 'resume evidence'}.`
  ))
  const cautious = assessment.claimPolicy.cautiousClaims.map((claim) => (
    `- ${claim.id}: cautious "${claim.signal}". Use only related evidence: ${claim.allowedTerms.join(', ') || 'resume evidence'}. Template: ${claim.verbalizationTemplate ?? 'Use cautious bridge wording.'}`
  ))
  const forbidden = assessment.claimPolicy.forbiddenClaims.map((claim) => (
    `- ${claim.id}: forbidden "${claim.signal}". Do not use: ${claim.prohibitedTerms.join(', ') || claim.signal}.`
  ))

  return [
    'Structured claim policy is binding for this rewrite.',
    'Claim-policy-first generation is mandatory: choose claimPolicyIds before writing any new factual text.',
    'For each rewritten bullet, summary line, skill, education item, or certification item, use only allowed or cautious claim policy ids.',
    'For source=new_generated_text, usedClaimPolicyIds, expressedSignals, and evidenceBasis must be non-empty and copied from the selected allowed/cautious policy items.',
    'For source=formatting_only, keep the same facts as the original text and do not add tools, target roles, certifications, seniority, education, domains, platforms, or ownership.',
    'For source=preserved_original, keep the original facts without adding targeting claims.',
    'Expressed signals must come only from allowed or cautious claim signals. Do not invent new expressedSignals outside this policy.',
    'If no allowed or cautious claim applies, preserve original wording or treat the change as formatting only; do not add a new claim.',
    'Never express a forbidden claim. Cautious claims must use cautious bridge wording and real evidence basis.',
    'Allowed claim policy ids:',
    ...(allowed.length > 0 ? allowed : ['- none']),
    'Cautious claim policy ids:',
    ...(cautious.length > 0 ? cautious : ['- none']),
    'Forbidden claim policy ids:',
    ...(forbidden.length > 0 ? forbidden : ['- none']),
  ]
}

function buildClaimPolicyTraceContract(
  assessment?: JobCompatibilityAssessment,
): RewriteSectionInput['claim_policy_trace_contract'] | undefined {
  if (!assessment) {
    return undefined
  }

  return {
    required: true,
    allowedClaims: assessment.claimPolicy.allowedClaims.map((claim) => ({
      id: claim.id,
      signal: claim.signal,
      allowedTerms: claim.allowedTerms,
      evidenceBasis: claim.evidenceBasis.map((basis) => basis.text),
    })),
    cautiousClaims: assessment.claimPolicy.cautiousClaims.map((claim) => ({
      id: claim.id,
      signal: claim.signal,
      allowedTerms: claim.allowedTerms,
      evidenceBasis: claim.evidenceBasis.map((basis) => basis.text),
      ...(claim.verbalizationTemplate === undefined ? {} : { verbalizationTemplate: claim.verbalizationTemplate }),
    })),
    forbiddenClaims: assessment.claimPolicy.forbiddenClaims.map((claim) => ({
      id: claim.id,
      signal: claim.signal,
      prohibitedTerms: claim.prohibitedTerms,
    })),
  }
}

function repairUnclassifiedGeneratedText(params: {
  section: RewriteSectionName
  originalCvState: CVState
  generatedCvState: CVState
  sectionPlan: SectionRewritePlan
  claimPolicy?: JobCompatibilityAssessment['claimPolicy']
  targetRole?: {
    value?: string
    permission?: string
  }
}): CVState {
  const unclassifiedItems = params.sectionPlan.items.filter((item) => shouldRepairGeneratedItem({
    item,
    claimPolicy: params.claimPolicy,
    targetRole: params.targetRole,
  }))

  if (unclassifiedItems.length === 0) {
    return params.generatedCvState
  }

  switch (params.section) {
    case 'summary':
      return {
        ...params.generatedCvState,
        summary: params.originalCvState.summary,
      }

    case 'skills': {
      const blockedSkillIndexes = new Set(unclassifiedItems
        .map((item) => /^skills\.(\d+)$/u.exec(item.targetPath)?.[1])
        .filter((value): value is string => value !== undefined)
        .map(Number))

      return {
        ...params.generatedCvState,
        skills: params.generatedCvState.skills.filter((_, index) => !blockedSkillIndexes.has(index)),
      }
    }

    case 'experience': {
      const experience = params.generatedCvState.experience.map((entry) => ({
        ...entry,
        bullets: [...entry.bullets],
      }))
      const bulletIndexesToRemove = new Map<number, number[]>()

      unclassifiedItems.forEach((item) => {
        const titleMatch = /^experience\.(\d+)\.title$/u.exec(item.targetPath)
        if (titleMatch?.[1] !== undefined) {
          const entryIndex = Number(titleMatch[1])
          const originalEntry = params.originalCvState.experience[entryIndex]
          if (experience[entryIndex] && originalEntry) {
            experience[entryIndex] = {
              ...experience[entryIndex],
              title: originalEntry.title,
              company: originalEntry.company,
              location: originalEntry.location,
            }
          }
          return
        }

        const bulletMatch = /^experience\.(\d+)\.bullets\.(\d+)$/u.exec(item.targetPath)
        if (bulletMatch?.[1] === undefined || bulletMatch[2] === undefined) {
          return
        }

        const entryIndex = Number(bulletMatch[1])
        const bulletIndex = Number(bulletMatch[2])
        const originalBullet = params.originalCvState.experience[entryIndex]?.bullets[bulletIndex]
        if (experience[entryIndex] === undefined) {
          return
        }

        if (originalBullet !== undefined) {
          experience[entryIndex].bullets[bulletIndex] = originalBullet
          return
        }

        bulletIndexesToRemove.set(entryIndex, [
          ...(bulletIndexesToRemove.get(entryIndex) ?? []),
          bulletIndex,
        ])
      })

      bulletIndexesToRemove.forEach((indexes, entryIndex) => {
        const blocked = new Set(indexes)
        const entry = experience[entryIndex]
        if (entry) {
          entry.bullets = entry.bullets.filter((_, index) => !blocked.has(index))
        }
      })

      return {
        ...params.generatedCvState,
        experience,
      }
    }

    case 'education': {
      const blockedIndexes = new Set(unclassifiedItems
        .map((item) => /^education\.(\d+)$/u.exec(item.targetPath)?.[1])
        .filter((value): value is string => value !== undefined)
        .map(Number))

      return {
        ...params.generatedCvState,
        education: params.generatedCvState.education
          .map((entry, index) => params.originalCvState.education[index] ?? entry)
          .filter((_, index) => !blockedIndexes.has(index) || params.originalCvState.education[index] !== undefined),
      }
    }

    case 'certifications': {
      const blockedIndexes = new Set(unclassifiedItems
        .map((item) => /^certifications\.(\d+)$/u.exec(item.targetPath)?.[1])
        .filter((value): value is string => value !== undefined)
        .map(Number))
      const originalCertifications = params.originalCvState.certifications ?? []

      return {
        ...params.generatedCvState,
        certifications: (params.generatedCvState.certifications ?? [])
          .map((entry, index) => originalCertifications[index] ?? entry)
          .filter((_, index) => !blockedIndexes.has(index) || originalCertifications[index] !== undefined),
      }
    }
  }
}

function shouldRepairGeneratedItem(params: {
  item: SectionRewritePlan['items'][number]
  claimPolicy?: JobCompatibilityAssessment['claimPolicy']
  targetRole?: {
    value?: string
    permission?: string
  }
}): boolean {
  if (
    params.item.classificationStatus === 'unclassified_new_text'
    && params.item.claimPolicyIds.length === 0
  ) {
    return true
  }

  if (
    params.item.classificationStatus !== 'original_preserved'
    && params.item.source !== 'preserved_original'
    && params.item.prohibitedTermsAcknowledged.length > 0
  ) {
    return true
  }

  if (
    params.item.source === 'new_generated_text'
    && params.item.permissionLevel === 'cautious'
    && !hasSafeCautiousClaimLanguage(params.item.intendedText, params.item.evidenceBasis)
  ) {
    return true
  }

  if (
    params.item.source === 'new_generated_text'
    && params.claimPolicy
    && mentionsUnsafeCautiousClaim(params.item, params.claimPolicy)
  ) {
    return true
  }

  const targetRole = params.targetRole?.value?.trim()
  if (
    !targetRole
    || params.targetRole?.permission === 'can_claim_target_role'
    || params.item.classificationStatus === 'original_preserved'
    || params.item.source === 'preserved_original'
    || !normalizeForKeywordVisibility(params.item.intendedText).includes(normalizeForKeywordVisibility(targetRole))
  ) {
    return false
  }

  return params.targetRole?.permission !== 'can_bridge_to_target_role'
    || !hasCautiousTargetRoleLanguage(params.item.intendedText)
}

function hasCautiousTargetRoleLanguage(value: string): boolean {
  const normalized = normalizeForKeywordVisibility(value)

  return [
    'aplicavel',
    'contexto',
    'relacionad',
    'proximo',
    'proxima',
    'demandas',
    'perfil',
    'experiencia aplicavel',
  ].some((cue) => normalized.includes(cue))
}

function hasSafeCautiousClaimLanguage(value: string, evidenceBasis: string[]): boolean {
  const normalized = normalizeForKeywordVisibility(value)
  const hasCautiousCue = [
    'aplicavel',
    'aplicaveis',
    'contexto',
    'relacionad',
    'proximo',
    'proxima',
    'demandas',
    'perfil',
    'com base',
    'a partir',
    'por meio',
    'conectad',
  ].some((cue) => normalized.includes(cue))
  const hasEvidenceBasis = evidenceBasis.some((basis) => {
    const normalizedBasis = normalizeForKeywordVisibility(basis)
    return normalizedBasis.length >= 3 && normalized.includes(normalizedBasis)
  })

  return hasCautiousCue && hasEvidenceBasis
}

function mentionsUnsafeCautiousClaim(
  item: SectionRewritePlan['items'][number],
  claimPolicy: JobCompatibilityAssessment['claimPolicy'],
): boolean {
  return claimPolicy.cautiousClaims.some((claim) => {
    const mentioned = [
      claim.signal,
      ...claim.prohibitedTerms,
      ...claim.allowedTerms,
      ...claim.evidenceBasis.map((basis) => basis.text),
    ].some((term) => containsNormalizedTerm(item.intendedText, term))

    if (!mentioned && !item.claimPolicyIds.includes(claim.id)) {
      return false
    }

    return !hasSafeCautiousClaimLanguage(item.intendedText, [
      ...item.evidenceBasis,
      ...claim.allowedTerms,
      ...claim.evidenceBasis.map((basis) => basis.text),
    ])
  })
}

function containsNormalizedTerm(source: string, term: string): boolean {
  const normalizedSource = normalizeForKeywordVisibility(source)
  const normalizedTerm = normalizeForKeywordVisibility(term)

  return normalizedTerm.length >= 3 && normalizedSource.includes(normalizedTerm)
}

function splitTargetRequirements(targetingPlan: TargetingPlan): {
  coreRequirements: CoreRequirement[]
  preferredRequirements: CoreRequirement[]
} {
  const requirements = targetingPlan.coreRequirementCoverage?.requirements ?? []

  return {
    coreRequirements: requirements.filter((requirement) => requirement.importance === 'core'),
    preferredRequirements: requirements.filter((requirement) => (
      requirement.importance === 'differential'
      || requirement.requirementKind === 'preferred'
      || requirement.requirementKind === 'nice_to_have'
    )),
  }
}

function buildSectionTargetPlanInstructions(
  targetingPlan: TargetingPlan,
  section: RewriteSectionName,
): string[] {
  const { coreRequirements, preferredRequirements } = splitTargetRequirements(targetingPlan)
  const targetPlan = buildRewriteTargetPlan({
    targetRole: targetingPlan.targetRole,
    targetRoleConfidence: targetingPlan.targetRoleConfidence,
    coreRequirements,
    preferredRequirements,
    supportedSignals: targetingPlan.safeTargetingEmphasis?.safeDirectEmphasis
      ?? targetingPlan.rewritePermissions?.directClaimsAllowed
      ?? [],
    adjacentSignals: targetingPlan.safeTargetingEmphasis?.cautiousBridgeEmphasis.flatMap((bridge) => [
      bridge.jobSignal,
      ...bridge.supportingTerms,
    ]) ?? [],
    unsupportedSignals: targetingPlan.safeTargetingEmphasis?.forbiddenDirectClaims
      ?? targetingPlan.rewritePermissions?.forbiddenClaims
      ?? targetingPlan.coreRequirementCoverage?.unsupportedSignals
      ?? [],
  })
  const instruction = targetPlan.sectionInstructions.find((item) => item.section === section)

  if (!instruction) {
    return []
  }

  return [
    'Job Targeting 2.0 section rewrite plan:',
    `- Section priority: ${instruction.priority}.`,
    instruction.focusRequirements.length > 0
      ? `- Focus requirements: ${instruction.focusRequirements.join(', ')}.`
      : '- Focus requirements: use the strongest proven overlap with the vacancy.',
    instruction.allowedClaims.length > 0
      ? `- Allowed direct claims: ${instruction.allowedClaims.join(', ')}.`
      : '- Allowed direct claims: none beyond the original resume evidence.',
    instruction.bridgeClaims.length > 0
      ? `- Careful bridge claims: ${instruction.bridgeClaims.join(', ')}.`
      : '- Careful bridge claims: none.',
    instruction.forbiddenClaims.length > 0
      ? `- Forbidden claims: ${instruction.forbiddenClaims.join(', ')}.`
      : '- Forbidden claims: none identified.',
    instruction.instruction,
  ]
}

function buildAtsResumeStyleGuide(): string {
  return [
    buildBaseSystemContext(),
    buildWorkflowContext('ats_enhancement'),
    buildActionContext('rewrite_resume_for_ats'),
    buildOutputContractContext('rewrite_resume_for_ats'),
    buildBaseGuardrails(),
    'Optimize for ATS parsing, semantic keyword matching, and human readability at the same time.',
    'Keep facts from the original resume intact while improving wording, structure, readability, and prioritization.',
    'Apply every resume rewrite guardrail rigorously before making any improvement.',
    'Resume rewrite contract:',
    formatResumeRewriteGuardrails(),
  ].join('\n')
}

function buildJobTargetingStyleGuide(targetJobDescription: string): string {
  const shapedTargetJob = shapeTargetJobDescription(targetJobDescription)

  return [
    buildBaseSystemContext(),
    buildWorkflowContext('job_targeting'),
    buildActionContext('rewrite_resume_for_job_target'),
    buildOutputContractContext('rewrite_resume_for_job_target'),
    buildBaseGuardrails(),
    'Maximize alignment to the target vacancy only with facts already present in the original resume.',
    'Apply every resume rewrite guardrail rigorously before making any improvement.',
    'Resume rewrite contract:',
    formatResumeRewriteGuardrails(),
    shapedTargetJob.compacted
      ? `The target job description was compacted for cost control. Use only this grounded subset as targeting context:\n${shapedTargetJob.content}`
      : `Use this target job description as context:\n${shapedTargetJob.content}`,
  ].join('\n')
}

function buildSectionInstructions(
  section: RewriteSectionName,
  atsAnalysis: AtsAnalysisResult,
  rewritePlan: ReturnType<typeof buildRewritePlan>,
): string {
  const sectionPlan = rewritePlan.sections[section]
  const shared = [
    buildAtsResumeStyleGuide(),
    `Use the ATS analysis findings as guidance: ${atsAnalysis.recommendations.join(' | ') || 'focus on clarity, structure, and ATS readability.'}`,
    `Shared rewrite narrative: ${rewritePlan.sharedNarrative}`,
    `Section goal: ${sectionPlan.goal}`,
    sectionPlan.keywordFocus.length > 0 ? `Prefer these grounded keywords when supported: ${sectionPlan.keywordFocus.join(', ')}.` : '',
    sectionPlan.factualAnchors.length > 0 ? `Stay anchored to these facts: ${sectionPlan.factualAnchors.join(' | ')}.` : '',
    ...sectionPlan.instructions,
  ]

  switch (section) {
    case 'summary':
      return [
        ...shared,
        'Rewrite only the professional summary.',
        'Use 1 strong opening sentence plus 1 optional complementary sentence. Keep the final summary to at most 2 sentences, even if line breaks are used.',
        'The first sentence must lead with professional identity, seniority, and main functional focus instead of generic setup phrasing.',
        'Do not include internal section labels such as "Resumo Profissional:" or "Professional Summary:" inside the summary text.',
        'Keep an executive tone: concise, specific, high-density, and free of keyword stuffing or repeated role/domain phrases.',
        'Do not repeat the same domain, role family, or experience idea across consecutive sentences unless the second sentence adds materially new information.',
        'Preserve grounded technical scope, business context, and supported achievements that strengthen positioning; do not flatten the profile into generic claims.',
        'Use the second sentence only to add useful stack, scope, environment, or impact context that the first sentence does not already cover.',
        'If the original resume contains quantified impact, keep the number, scope, and business result visible whenever they are truthful and relevant.',
        'Avoid empty cliches and preserve factual truth.',
      ].join('\n\n')
    case 'experience':
      return [
        ...shared,
        'Rewrite only the experience section.',
        'Preserve the same companies, titles, dates, and factual scope.',
        'Keep or clarify every grounded tool, system, responsibility, stakeholder scope, and metric already present in the original experience.',
        'Treat quantified bullets as premium evidence. Do not replace percentages, efficiency gains, SLA improvements, savings, volumes, or regional impact with generic wording.',
        'Every bullet must start with a strong action verb in pt-BR and follow action + what was done + result, impact, or purpose when available.',
        'Keep bullets concise and executive; prefer dense factual writing over long explanatory sentences.',
        'Do not merge, trim, or generalize bullets when that would remove relevant technical detail or business context.',
      ].join('\n\n')
    case 'skills':
      return [
        ...shared,
        'Rewrite and reorder only the skills section.',
        'Keep only real skills already evidenced by the resume and remove redundancy.',
        'Preserve technical breadth and specificity; do not replace specific tools, platforms, or methods with vague umbrella labels.',
      ].join('\n\n')
    case 'education':
      return [
        ...shared,
        'Rewrite only the education section.',
        'Preserve institutions, degree names, and years exactly while improving formatting consistency.',
      ].join('\n\n')
    case 'certifications':
      return [
        ...shared,
        'Rewrite only the certifications section.',
        'Preserve certification names, issuers, and years exactly while improving ordering and consistency.',
      ].join('\n\n')
  }
}

function buildTargetJobSectionInstructions(
  section: RewriteSectionName,
  gapAnalysis: GapAnalysisResult,
  targetingPlan: TargetingPlan,
  targetJobDescription: string,
  assessment?: JobCompatibilityAssessment,
): string {
  const safeDirectEmphasis = targetingPlan.safeTargetingEmphasis?.safeDirectEmphasis ?? []
  const cautiousBridges = targetingPlan.safeTargetingEmphasis?.cautiousBridgeEmphasis ?? []
  const shared = [
    buildJobTargetingStyleGuide(targetJobDescription),
    targetingPlan.targetRoleConfidence !== 'low'
      ? `Target role: ${targetingPlan.targetRole}`
      : 'No reliable target role title was extracted. Anchor the rewrite on the vacancy requirements, tools, responsibilities, and seniority signals instead of forcing a literal role claim.',
    targetingPlan.focusKeywords.length > 0
      ? `Vacancy semantic focus: ${targetingPlan.focusKeywords.join(', ')}.`
      : '',
    safeDirectEmphasis.length > 0
      ? `Must emphasize when factually supported: ${safeDirectEmphasis.join(', ')}.`
      : targetingPlan.mustEmphasize.length > 0
      ? `Must emphasize when factually supported: ${targetingPlan.mustEmphasize.join(', ')}.`
      : 'Must emphasize the strongest overlaps already proven in the resume.',
    cautiousBridges.length > 0
      ? `Use cautious bridges only as narrative support: ${cautiousBridges.map((bridge) => `${bridge.jobSignal} -> ${bridge.safeWording}`).join(' | ')}.`
      : '',
    targetingPlan.shouldDeemphasize.length > 0
      ? `De-emphasize when secondary to the target role: ${targetingPlan.shouldDeemphasize.join(', ')}.`
      : '',
    targetingPlan.missingButCannotInvent.length > 0
      ? `These gaps exist and cannot be invented away: ${targetingPlan.missingButCannotInvent.join(', ')}.`
      : '',
    `Gap snapshot: match score ${gapAnalysis.matchScore}/100; missing skills ${gapAnalysis.missingSkills.join(', ') || 'none'}; weak areas ${gapAnalysis.weakAreas.join(', ') || 'none'}.`,
    ...buildTargetedPermissionInstructions(targetingPlan),
    ...buildClaimPolicyInstructions(assessment),
    ...buildSectionTargetPlanInstructions(targetingPlan, section),
  ].filter(Boolean)

  switch (section) {
    case 'summary':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.summary,
        'Rewrite only the professional summary.',
        targetingPlan.targetRolePositioning?.permission === 'must_not_claim_target_role'
          ? 'Use 4 to 6 concise lines aligned to the vacancy context without presenting the candidate as the literal target role.'
          : targetingPlan.targetRolePositioning?.permission === 'can_bridge_to_target_role'
          ? 'Use 4 to 6 concise lines with bridge wording toward the target role context; do not present the candidate as the literal target role title.'
          : targetingPlan.targetRoleConfidence !== 'low'
          ? 'Use 4 to 6 concise lines aligned to the target role without claiming skills or experiences the candidate does not have.'
          : 'Use 4 to 6 concise lines aligned to the vacancy context without claiming a literal role identity, skills, or experiences the candidate does not have.',
        'Preserve grounded technical scope, business context, and supported achievements that help the recruiter understand the real profile.',
      ].join('\n\n')
    case 'experience':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.experience,
        'Rewrite only the experience section.',
        'Preserve companies, titles, dates, and factual scope.',
        'Keep or clarify every grounded tool, system, responsibility, stakeholder scope, and metric already present in the original experience.',
        'Treat quantified bullets as premium evidence. Do not replace percentages, efficiency gains, SLA improvements, savings, volumes, or regional impact with generic wording.',
        'Every bullet must start with a strong action verb in pt-BR and follow action + what was done + result, impact, or purpose when available.',
        'Prioritize bullets that better match the target role and target keywords, but do not fabricate missing fit or compress away important context.',
      ].join('\n\n')
    case 'skills':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.skills,
        'Rewrite and reorder only the skills section.',
        'Keep only grounded skills already evidenced in the resume.',
        'Preserve technical breadth and specificity; do not replace specific tools, platforms, or methods with vague umbrella labels.',
      ].join('\n\n')
    case 'education':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.education,
        'Rewrite only the education section.',
        'Improve consistency only; do not create targeted claims from education.',
      ].join('\n\n')
    case 'certifications':
      return [
        ...shared,
        ...targetingPlan.sectionStrategy.certifications,
        'Rewrite only the certifications section.',
        'Reorder by target-role relevance while preserving factual data exactly.',
      ].join('\n\n')
  }
}

function applySectionData(
  cvState: CVState,
  section: RewriteSectionName,
  sectionData: unknown,
): CVState {
  switch (section) {
    case 'summary':
      return { ...cvState, summary: sectionData as string }
    case 'experience':
      return { ...cvState, experience: sectionData as CVState['experience'] }
    case 'skills':
      return { ...cvState, skills: sectionData as CVState['skills'] }
    case 'education':
      return { ...cvState, education: sectionData as CVState['education'] }
    case 'certifications':
      return { ...cvState, certifications: sectionData as CVState['certifications'] }
  }
}

function formatExperienceSectionContent(experience: CVState['experience']): string {
  return experience
    .map((entry) => [
      [entry.title, entry.company].filter(Boolean).join(' - '),
      ...entry.bullets.map((bullet) => `- ${bullet}`),
    ].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n')
}

function buildPreservedSectionOutput(
  cvState: CVState,
  section: RewriteSectionName,
): Extract<RewriteSectionOutput, { success: true }> {
  switch (section) {
    case 'summary':
      return {
        success: true,
        rewritten_content: cvState.summary,
        section_data: cvState.summary,
        keywords_added: [],
        changes_made: ['Preserved original summary after invalid structured rewrite payload'],
      }
    case 'experience':
      return {
        success: true,
        rewritten_content: formatExperienceSectionContent(cvState.experience),
        section_data: cvState.experience,
        keywords_added: [],
        changes_made: ['Preserved original experience after invalid structured rewrite payload'],
      }
    case 'skills':
      return {
        success: true,
        rewritten_content: cvState.skills.join(', '),
        section_data: cvState.skills,
        keywords_added: [],
        changes_made: ['Preserved original skills after invalid structured rewrite payload'],
      }
    case 'education':
      return {
        success: true,
        rewritten_content: JSON.stringify(cvState.education),
        section_data: cvState.education,
        keywords_added: [],
        changes_made: ['Preserved original education after invalid structured rewrite payload'],
      }
    case 'certifications':
      return {
        success: true,
        rewritten_content: JSON.stringify(cvState.certifications ?? []),
        section_data: cvState.certifications ?? [],
        keywords_added: [],
        changes_made: ['Preserved original certifications after invalid structured rewrite payload'],
      }
  }
}

function normalizeForVisibilityCheck(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateTokenSimilarity(left: string, right: string): number {
  const leftTokens = normalizeForVisibilityCheck(left).split(' ').filter(Boolean)
  const rightTokens = normalizeForVisibilityCheck(right).split(' ').filter(Boolean)

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }

  const rightCounts = new Map<string, number>()
  rightTokens.forEach((token) => {
    rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1)
  })

  let overlap = 0
  leftTokens.forEach((token) => {
    const count = rightCounts.get(token) ?? 0
    if (count > 0) {
      overlap += 1
      rightCounts.set(token, count - 1)
    }
  })

  return (2 * overlap) / (leftTokens.length + rightTokens.length)
}

function hasSummarySectionLabel(summary: string): boolean {
  return /^(?:resumo profissional|professional summary|summary|resumo)\s*[:\-–]/i.test(summary.trim())
}

function countSummaryWords(summary: string): number {
  return summary
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function splitSummarySentences(summary: string): string[] {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function countRepeatedSummaryPhrases(summary: string): number {
  const phrases = summary
    .split(/[.!?;]+|,(?=\s+[A-ZÀ-Ý])/u)
    .map((phrase) => normalizeForVisibilityCheck(phrase))
    .filter((phrase) => phrase.split(' ').length >= 3)

  const counts = new Map<string, number>()
  phrases.forEach((phrase) => {
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
  })

  return Array.from(counts.values()).filter((count) => count > 1).length
}

function countSummaryPatternHits(summary: string, pattern: RegExp): number {
  return Array.from(normalizeForVisibilityCheck(summary).matchAll(pattern)).length
}

function hasWeakSummaryOpening(summary: string): boolean {
  return /^(?:profissional\s+com\b|atuacao\s+em\b|experiencia\s+em\b)/i.test(
    normalizeForVisibilityCheck(summary),
  )
}

function mentionsPrimarySummaryDomain(summary: string): boolean {
  return /\b(business intelligence|engenharia de dados|analytics engineer|analista de dados)\b/.test(
    normalizeForVisibilityCheck(summary),
  )
}

function hasRepeatedSummaryDomainPhrasing(summary: string): boolean {
  const sentences = splitSummarySentences(summary)
  if (sentences.length < 2) {
    return false
  }

  for (let index = 0; index < sentences.length - 1; index += 1) {
    const current = sentences[index] ?? ''
    const next = sentences[index + 1] ?? ''
    const currentNormalized = normalizeForVisibilityCheck(current)
    const nextNormalized = normalizeForVisibilityCheck(next)

    if (!mentionsPrimarySummaryDomain(current) || !mentionsPrimarySummaryDomain(next)) {
      continue
    }

    if (
      currentNormalized === nextNormalized
      || currentNormalized.startsWith(nextNormalized)
      || nextNormalized.startsWith(currentNormalized)
      || calculateTokenSimilarity(currentNormalized, nextNormalized) >= 0.7
    ) {
      return true
    }
  }

  return false
}

function hasNonAdditiveSummarySentences(summary: string): boolean {
  const sentences = splitSummarySentences(summary)
  if (sentences.length < 2) {
    return false
  }

  for (let index = 0; index < sentences.length - 1; index += 1) {
    const current = normalizeForVisibilityCheck(sentences[index] ?? '')
    const next = normalizeForVisibilityCheck(sentences[index + 1] ?? '')

    if (!current || !next) {
      continue
    }

    if (current === next || current.startsWith(next) || next.startsWith(current)) {
      return true
    }

    if (calculateTokenSimilarity(current, next) >= 0.7) {
      return true
    }
  }

  return false
}

function isAtsSummaryStructurallyNoisy(summary: string): boolean {
  const normalized = normalizeForVisibilityCheck(summary)
  const sentences = splitSummarySentences(summary)

  if (!normalized) {
    return true
  }

  if (hasSummarySectionLabel(summary)) {
    return true
  }

  if (countSummaryWords(summary) > 48) {
    return true
  }

  if (sentences.length > 2) {
    return true
  }

  if (countRepeatedSummaryPhrases(summary) > 0) {
    return true
  }

  if (hasWeakSummaryOpening(summary)) {
    return true
  }

  if (hasRepeatedSummaryDomainPhrasing(summary)) {
    return true
  }

  if (hasNonAdditiveSummarySentences(summary)) {
    return true
  }

  return /(business intelligence|engenheiro de dados|analytics engineer|analista de dados)(?:\s+\S+){0,3}\s+\1/i.test(normalized)
}

function isVisibleRewriteTooClose(
  mode: "ats_enhancement" | "job_targeting",
  section: RewriteSectionName,
  currentCvState: CVState,
  nextSectionData: unknown,
): boolean {
  switch (section) {
    case 'summary': {
      const currentSummary = normalizeForVisibilityCheck(currentCvState.summary)
      const nextSummary = normalizeForVisibilityCheck(nextSectionData as string)
      if (currentSummary && !nextSummary) {
        return true
      }

      return Boolean(
        currentSummary
        && nextSummary
        && (
          currentSummary === nextSummary
          || (mode === 'ats_enhancement' && isAtsSummaryStructurallyNoisy(nextSectionData as string))
          || calculateTokenSimilarity(currentSummary, nextSummary) >= 0.88
        ),
      )
    }
    case 'skills': {
      return JSON.stringify(currentCvState.skills) === JSON.stringify(nextSectionData as CVState['skills'])
    }
    case 'experience': {
      const currentBullets = currentCvState.experience.flatMap((entry) => entry.bullets.map(normalizeForVisibilityCheck))
      const nextBullets = (nextSectionData as CVState['experience']).flatMap((entry) => entry.bullets.map(normalizeForVisibilityCheck))
      const unchangedBullets = nextBullets.filter((bullet, index) => currentBullets[index] === bullet).length
      const averageSimilarity = nextBullets.length > 0
        ? nextBullets.reduce((total, bullet, index) => total + calculateTokenSimilarity(currentBullets[index] ?? '', bullet), 0) / nextBullets.length
        : 0

      return nextBullets.length > 0 && (
        unchangedBullets / nextBullets.length >= 0.7
        || averageSimilarity >= 0.9
      )
    }
    default:
      return false
  }
}

function buildAssertiveRewriteInstructions(section: RewriteSectionName): string {
  switch (section) {
    case 'summary':
      return 'The previous rewrite stayed too close to the original wording or still feels noisy. Rewrite the summary again with a stronger opening sentence, at most one additive follow-up sentence, tighter executive language, no internal section labels, and no repetitive role/domain phrasing while preserving the exact facts.'
    case 'experience':
      return 'The previous rewrite stayed too close to the original wording. Rewrite every bullet more assertively with stronger action verbs and clearer business context while preserving the exact facts and dates.'
    case 'skills':
      return 'The previous rewrite kept the original ordering. Reorder and consolidate the skills more intentionally for ATS emphasis, but keep only grounded skills.'
    default:
      return 'The previous rewrite stayed too close to the original. Rewrite again with more visible improvement while preserving the exact facts.'
  }
}

type AtsRewriteParams = {
  mode: 'ats_enhancement'
  cvState: CVState
  atsAnalysis: AtsAnalysisResult
  userId: string
  sessionId: string
}

type JobTargetingRewriteParams = {
  mode: 'job_targeting'
  cvState: CVState
  targetJobDescription: string
  gapAnalysis: GapAnalysisResult
  targetingPlan?: TargetingPlan
  jobCompatibilityAssessment?: JobCompatibilityAssessment
  userId: string
  sessionId: string
}

export async function rewriteResumeFull(params: AtsRewriteParams | JobTargetingRewriteParams): Promise<{
  success: boolean
  optimizedCvState?: CVState
  summary?: {
    changedSections: RewriteSectionName[]
    notes: string[]
    keywordCoverageImprovement?: string[]
  }
  diagnostics?: {
    sectionAttempts: Partial<Record<RewriteSectionName, number>>
    retriedSections: RewriteSectionName[]
    compactedSections: RewriteSectionName[]
  }
  sectionRewritePlans?: SectionRewritePlan[]
  generatedClaimTrace?: GeneratedClaimTrace[]
  error?: string
  errorCode?: ToolErrorCode
  failedSection?: RewriteSectionName
}> {
  try {
    let optimizedCvState: CVState = structuredClone(params.cvState)
    const changedSections: RewriteSectionName[] = []
    const notes: string[] = []
    const sectionAttempts: Partial<Record<RewriteSectionName, number>> = {}
    const retriedSections: RewriteSectionName[] = []
    const compactedSections: RewriteSectionName[] = []
    const sectionRewritePlans: SectionRewritePlan[] = []
    const sections: RewriteSectionName[] = ['summary', 'experience', 'skills', 'education', 'certifications']
    const rewritePlan = params.mode === 'ats_enhancement'
      ? buildRewritePlan(params.cvState, params.atsAnalysis)
      : undefined
    const targetingPlan = params.mode === 'job_targeting'
      ? (params.targetingPlan ?? await buildTargetedRewritePlan({
          cvState: params.cvState,
          targetJobDescription: params.targetJobDescription,
          gapAnalysis: params.gapAnalysis,
          userId: params.userId,
          sessionId: params.sessionId,
          mode: 'job_targeting',
          rewriteIntent: 'targeted_rewrite',
        }))
      : undefined

    for (const section of sections) {
      const shapeResult = params.mode === 'job_targeting'
        ? shapeTargetingRewriteCurrentContent(optimizedCvState, section)
        : shapeRewriteCurrentContent(optimizedCvState, section)
      const { content: currentContent, compacted } = shapeResult

      if (!currentContent.trim() || currentContent.trim() === '[]') {
        continue
      }

      if (compacted) {
        compactedSections.push(section)
      }

      const baseInstructions = params.mode === 'job_targeting'
        ? buildTargetJobSectionInstructions(
            section,
            params.gapAnalysis,
            targetingPlan!,
            params.targetJobDescription,
            params.jobCompatibilityAssessment,
          )
        : buildSectionInstructions(section, params.atsAnalysis, rewritePlan!)
      const targetKeywords = params.mode === 'job_targeting'
        ? (
          targetingPlan!.safeTargetingEmphasis?.safeDirectEmphasis.length
            ? targetingPlan!.safeTargetingEmphasis.safeDirectEmphasis
            : targetingPlan!.mustEmphasize
        )
        : rewritePlan!.keywordFocus

      let result: Awaited<ReturnType<typeof rewriteSection>>
      let attempts = 0

      try {
        const execution = await (params.mode === 'job_targeting' ? executeJobTargetingWithRetry : executeWithStageRetry)(
          async () => {
            const rewriteResult = await rewriteSection({
              section,
              current_content: currentContent,
              instructions: baseInstructions,
              target_keywords: targetKeywords,
              ...(params.mode === 'job_targeting'
                ? { claim_policy_trace_contract: buildClaimPolicyTraceContract(params.jobCompatibilityAssessment) }
                : {}),
            }, params.userId, params.sessionId)

            if (!rewriteResult.output.success) {
              throw new RewriteSectionFailureError(section, rewriteResult.output)
            }

            return rewriteResult
          },
          {
            onRetry: () => {
              if (!retriedSections.includes(section)) {
                retriedSections.push(section)
              }
            },
          },
        )

        result = execution.result
        attempts = execution.attempts
      } catch (error) {
        sectionAttempts[section] = Math.max(1, sectionAttempts[section] ?? 0, retriedSections.includes(section) ? 2 : 1)
        if (
          error instanceof RewriteSectionFailureError
          && error.code === 'LLM_INVALID_OUTPUT'
        ) {
          result = {
            output: buildPreservedSectionOutput(optimizedCvState, section),
          }
          attempts = sectionAttempts[section] ?? 1
        } else {
          return {
            success: false,
            diagnostics: {
              sectionAttempts,
              retriedSections,
              compactedSections,
            },
            error: error instanceof Error ? error.message : 'Failed to rewrite full resume.',
            ...(error instanceof RewriteSectionFailureError
              ? {
                errorCode: error.code,
                failedSection: error.section,
              }
              : {}),
          }
        }
      }

      if (!result.output.success) {
        return {
          success: false,
          diagnostics: {
            sectionAttempts,
            retriedSections,
            compactedSections,
          },
          error: result.output.error,
        }
      }

      let sectionData = params.mode === 'job_targeting' && section === 'skills'
        ? sanitizeJobTargetedSkills(
            params.cvState.skills,
            result.output.section_data as CVState['skills'],
            targetingPlan!,
          )
        : result.output.section_data

      if (
        ['summary', 'experience', 'skills'].includes(section)
        && isVisibleRewriteTooClose(params.mode, section, optimizedCvState, sectionData)
      ) {
        if (!retriedSections.includes(section)) {
          retriedSections.push(section)
        }

        try {
          const assertiveExecution = await (params.mode === 'job_targeting' ? executeJobTargetingWithRetry : executeWithStageRetry)(
            async () => {
              const rewriteResult = await rewriteSection({
                section,
                current_content: currentContent,
                instructions: `${baseInstructions}\n\n${buildAssertiveRewriteInstructions(section)}`,
                target_keywords: targetKeywords,
                ...(params.mode === 'job_targeting'
                  ? { claim_policy_trace_contract: buildClaimPolicyTraceContract(params.jobCompatibilityAssessment) }
                  : {}),
              }, params.userId, params.sessionId)

              if (!rewriteResult.output.success) {
                throw new RewriteSectionFailureError(section, rewriteResult.output)
              }

              return rewriteResult
            },
            {
              onRetry: () => {
                if (!retriedSections.includes(section)) {
                  retriedSections.push(section)
                }
              },
            },
          )

          attempts += assertiveExecution.attempts

          if (assertiveExecution.result.output.success) {
            const assertiveSectionData = params.mode === 'job_targeting' && section === 'skills'
              ? sanitizeJobTargetedSkills(
                  params.cvState.skills,
                  assertiveExecution.result.output.section_data as CVState['skills'],
                  targetingPlan!,
                )
              : assertiveExecution.result.output.section_data

            result = assertiveExecution.result
            sectionData = assertiveSectionData
          }
        } catch {
          attempts += 1
        }
      }

      sectionAttempts[section] = attempts

      optimizedCvState = applySectionData(
        optimizedCvState,
        section,
        sectionData,
      )
      if (params.mode === 'job_targeting' && params.jobCompatibilityAssessment) {
        const modelClaimTraceItems = result.output.success ? result.output.claim_trace_items : undefined
        let sectionRewritePlan = buildSectionRewritePlan({
          section,
          originalCvState: params.cvState,
          generatedCvState: optimizedCvState,
          claimPolicy: params.jobCompatibilityAssessment.claimPolicy,
          modelClaimTraceItems,
        })
        const repairedCvState = repairUnclassifiedGeneratedText({
          section,
          originalCvState: params.cvState,
          generatedCvState: optimizedCvState,
          sectionPlan: sectionRewritePlan,
          claimPolicy: params.jobCompatibilityAssessment.claimPolicy,
          targetRole: {
            value: params.jobCompatibilityAssessment.targetRole,
            permission: targetingPlan?.targetRolePositioning?.permission,
          },
        })

        if (repairedCvState !== optimizedCvState) {
          optimizedCvState = repairedCvState
          sectionRewritePlan = buildSectionRewritePlan({
            section,
            originalCvState: params.cvState,
            generatedCvState: optimizedCvState,
            claimPolicy: params.jobCompatibilityAssessment.claimPolicy,
            modelClaimTraceItems,
          })
        }

        sectionRewritePlans.push(sectionRewritePlan)
      }
      changedSections.push(section)
      if (result.output.success) {
        notes.push(...result.output.changes_made)
      }
    }

    const keywordCoverageImprovement = params.mode === 'job_targeting'
      ? Array.from(new Set(targetingPlan?.mustEmphasize ?? []))
      : collectKeywordVisibilityImprovement(
          params.cvState,
          optimizedCvState,
          rewritePlan?.keywordFocus ?? [],
        )

    return {
      success: true,
      optimizedCvState,
      summary: {
        changedSections,
        notes: Array.from(new Set(notes)),
        keywordCoverageImprovement,
      },
      diagnostics: {
        sectionAttempts,
        retriedSections,
        compactedSections,
      },
      ...(sectionRewritePlans.length === 0
        ? {}
        : {
          sectionRewritePlans,
          generatedClaimTrace: buildGeneratedClaimTraceFromSectionPlans(sectionRewritePlans),
        }),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rewrite full resume.',
    }
  }
}
