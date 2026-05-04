import type {
  ClaimPolicyItem,
  GeneratedClaimTrace,
  GeneratedClaimTraceSection,
  JobCompatibilityClaimPolicy,
  StructuredValidationVersion,
} from '@/lib/agent/job-targeting/compatibility/types'
import {
  canonicalizeClaimSignal,
  containsCanonicalClaimSignal,
} from '@/lib/agent/job-targeting/compatibility/claim-signal'
import type { TargetRoleClaimPermission } from '@/types/agent'
import type { CVState } from '@/types/cv'

export const STRUCTURED_VALIDATION_VERSION = 'job-compat-structured-validation-v1'

export type StructuredValidationIssueType =
  | 'forbidden_term'
  | 'unsupported_skill_added'
  | 'unsupported_certification'
  | 'unsupported_education_claim'
  | 'target_role_asserted_without_permission'
  | 'unsafe_direct_claim'
  | 'missing_claim_trace'
  | 'unclassified_generated_text'
  | 'unsupported_expressed_signal'

export interface StructuredValidationIssue {
  id: string
  type: StructuredValidationIssueType
  severity: 'error'
  term: string
  claimPolicyItemId?: string
  requirementIds: string[]
  section?: GeneratedClaimTraceSection
  traceId?: string
  generatedText?: string
}

export interface ValidateGeneratedClaimsInput {
  generatedText?: string
  generatedCvState?: CVState
  generatedClaimTraces?: GeneratedClaimTrace[]
  requireClaimTrace?: boolean
  claimPolicy: JobCompatibilityClaimPolicy
  targetRole?: {
    value?: string
    permission?: TargetRoleClaimPermission
  }
}

export interface StructuredValidationResult {
  valid: boolean
  blocked: boolean
  issues: StructuredValidationIssue[]
  validationVersion: StructuredValidationVersion
}

export function validateGeneratedClaims({
  generatedText,
  generatedCvState,
  generatedClaimTraces,
  requireClaimTrace = false,
  claimPolicy,
  targetRole,
}: ValidateGeneratedClaimsInput): StructuredValidationResult {
  const traces = generatedClaimTraces ?? resolveGeneratedClaimTraces({
    generatedText,
    generatedCvState,
  })
  const issues = [
    ...(requireClaimTrace && generatedCvState
      ? validateTraceCoverage({
        generatedCvState,
        traces: generatedClaimTraces ?? [],
      })
      : []),
    ...validateTraceExpressedSignals({
      traces,
      claimPolicy,
    }),
    ...validateUnclassifiedGeneratedText({ traces }),
    ...claimPolicy.forbiddenClaims.flatMap((item) => validateForbiddenTerms({ traces, item })),
    ...claimPolicy.cautiousClaims.flatMap((item) => validateCautiousTerms({ traces, item })),
    ...validateTargetRole({
      traces,
      targetRole,
    }),
  ]

  return {
    valid: issues.length === 0,
    blocked: issues.length > 0,
    issues,
    validationVersion: STRUCTURED_VALIDATION_VERSION,
  }
}

export function buildGeneratedClaimTracesFromCvState(cvState: CVState): GeneratedClaimTrace[] {
  return flattenCvState(cvState).map((item) => ({
    section: item.section,
    itemPath: item.itemPath,
    generatedText: item.generatedText,
    expressedSignals: [],
    usedClaimPolicyIds: [],
    evidenceBasis: [],
    prohibitedTermsFound: [],
    validationStatus: 'valid',
    rationale: 'legacy_trace_from_cv_state',
  }))
}

function resolveGeneratedClaimTraces(input: {
  generatedText?: string
  generatedCvState?: CVState
}): GeneratedClaimTrace[] {
  if (input.generatedCvState) {
    return buildGeneratedClaimTracesFromCvState(input.generatedCvState)
  }

  return input.generatedText?.trim()
    ? [{
      section: 'summary',
      itemPath: 'full_text',
      generatedText: input.generatedText,
      expressedSignals: [],
      usedClaimPolicyIds: [],
      evidenceBasis: [],
      prohibitedTermsFound: [],
      validationStatus: 'valid',
      rationale: 'legacy_trace_from_text',
    }]
    : []
}

function flattenCvState(cvState: CVState): GeneratedClaimTrace[] {
  return [
    trace('summary', 'summary', cvState.summary),
    ...cvState.skills.map((skill, index) => trace('skills', `skills.${index}`, skill)),
    ...cvState.experience.flatMap((entry, entryIndex) => [
      trace('experience', `experience.${entryIndex}.title`, [entry.title, entry.company].filter(Boolean).join(' ')),
      ...entry.bullets.map((bullet, bulletIndex) => (
        trace('experience', `experience.${entryIndex}.bullets.${bulletIndex}`, bullet)
      )),
    ]),
    ...cvState.education.map((entry, index) => (
      trace('education', `education.${index}`, [entry.degree, entry.institution, entry.year, entry.gpa].filter(Boolean).join(' '))
    )),
    ...(cvState.certifications ?? []).map((entry, index) => (
      trace('certifications', `certifications.${index}`, [entry.name, entry.issuer, entry.year].filter(Boolean).join(' '))
    )),
  ].filter((item) => item.generatedText.trim().length > 0)
}

function trace(
  section: GeneratedClaimTraceSection,
  itemPath: string,
  generatedText: string,
): GeneratedClaimTrace {
  return {
    section,
    itemPath,
    generatedText,
    expressedSignals: [],
    usedClaimPolicyIds: [],
    evidenceBasis: [],
    prohibitedTermsFound: [],
    validationStatus: 'valid',
    rationale: 'generated_from_cv_state',
  }
}

function validateTraceCoverage({
  generatedCvState,
  traces,
}: {
  generatedCvState: CVState
  traces: GeneratedClaimTrace[]
}): StructuredValidationIssue[] {
  const tracePaths = new Set(traces.map((item) => item.itemPath))

  return flattenCvState(generatedCvState)
    .filter((item) => !tracePaths.has(item.itemPath))
    .map((item) => ({
      id: `missing_claim_trace-${item.itemPath}`,
      type: 'missing_claim_trace' as const,
      severity: 'error' as const,
      term: item.itemPath,
      requirementIds: [],
      section: item.section,
      traceId: item.itemPath,
      generatedText: item.generatedText,
    }))
}

function validateTraceExpressedSignals({
  traces,
  claimPolicy,
}: {
  traces: GeneratedClaimTrace[]
  claimPolicy: JobCompatibilityClaimPolicy
}): StructuredValidationIssue[] {
  const allowedClaimIds = new Set([
    ...claimPolicy.allowedClaims,
    ...claimPolicy.cautiousClaims,
  ].map((item) => item.id))
  const allowedSignals = new Set([
    ...claimPolicy.allowedClaims,
    ...claimPolicy.cautiousClaims,
  ].flatMap((item) => [item.signal, ...item.allowedTerms]).map(normalizeForTermMatch))

  return traces.flatMap((item) => {
    const missingPolicyForExpressedSignal = item.expressedSignals
      .filter((signal) => normalizeForTermMatch(signal).length > 0)
      .filter((signal) => !allowedSignals.has(normalizeForTermMatch(signal)))
    const invalidClaimIds = item.usedClaimPolicyIds.filter((id) => !allowedClaimIds.has(id))

    return [
      ...missingPolicyForExpressedSignal.map((signal, index) => ({
        id: `unsupported_expressed_signal-${item.itemPath}-${index + 1}`,
        type: 'unsupported_expressed_signal' as const,
        severity: 'error' as const,
        term: signal,
        requirementIds: [],
        section: item.section,
        traceId: item.itemPath,
        generatedText: item.generatedText,
      })),
      ...invalidClaimIds.map((id, index) => ({
        id: `unsupported_expressed_signal-${item.itemPath}-policy-${index + 1}`,
        type: 'unsupported_expressed_signal' as const,
        severity: 'error' as const,
        term: id,
        requirementIds: [],
        section: item.section,
        traceId: item.itemPath,
        generatedText: item.generatedText,
      })),
    ]
  })
}

function validateUnclassifiedGeneratedText({
  traces,
}: {
  traces: GeneratedClaimTrace[]
}): StructuredValidationIssue[] {
  return traces
    .filter((item) => (
      item.classificationStatus === 'unclassified_new_text'
      || item.rationale === 'new_text_without_claim_policy'
    ))
    .filter((item) => item.usedClaimPolicyIds.length === 0)
    .filter((item) => item.expressedSignals.length === 0)
    .map((item, index) => ({
      id: `unclassified_generated_text-${item.itemPath}-${index + 1}`,
      type: 'unclassified_generated_text' as const,
      severity: 'error' as const,
      term: item.unclassifiedText ?? item.generatedText,
      requirementIds: [],
      section: item.section,
      traceId: item.itemPath,
      generatedText: item.generatedText,
    }))
}

function validateForbiddenTerms({
  traces,
  item,
}: {
  traces: GeneratedClaimTrace[]
  item: ClaimPolicyItem
}): StructuredValidationIssue[] {
  return traces
    .filter((candidateTrace) => (
      candidateTrace.source !== 'preserved_original'
      && candidateTrace.classificationStatus !== 'original_preserved'
    ))
    .flatMap((candidateTrace) => (
      item.prohibitedTerms
        .filter((term) => (
          containsTerm(candidateTrace.generatedText, term)
          || candidateTrace.prohibitedTermsFound.some((found) => containsTerm(found, term))
        ))
        .map((term, index) => {
          const type = classifyForbiddenIssueType(candidateTrace)

          return {
            id: `${type}-${item.id}-${candidateTrace.itemPath}-${index + 1}`,
            type,
            severity: 'error' as const,
            term,
            claimPolicyItemId: item.id,
            requirementIds: item.requirementIds,
            section: candidateTrace.section,
            traceId: candidateTrace.itemPath,
            generatedText: candidateTrace.generatedText,
          }
        })
    ))
}

function validateCautiousTerms({
  traces,
  item,
}: {
  traces: GeneratedClaimTrace[]
  item: ClaimPolicyItem
}): StructuredValidationIssue[] {
  return traces
    .filter((candidateTrace) => (
      candidateTrace.source !== 'preserved_original'
      && candidateTrace.classificationStatus !== 'original_preserved'
      && candidateTrace.source !== 'formatting_only'
      && candidateTrace.classificationStatus !== 'formatting_only'
    ))
    .filter((candidateTrace) => (
      candidateTrace.usedClaimPolicyIds.includes(item.id)
      || candidateTrace.expressedSignals.some((signal) => containsTerm(signal, item.signal))
      || containsTerm(candidateTrace.generatedText, item.signal)
      || item.prohibitedTerms.some((term) => containsTerm(candidateTrace.generatedText, term))
    ))
    .filter((candidateTrace) => !hasCautiousVerbalization(candidateTrace, item))
    .map((candidateTrace, index) => ({
      id: `unsafe_direct_claim-${item.id}-${candidateTrace.itemPath}-${index + 1}`,
      type: 'unsafe_direct_claim' as const,
      severity: 'error' as const,
      term: item.signal,
      claimPolicyItemId: item.id,
      requirementIds: item.requirementIds,
      section: candidateTrace.section,
      traceId: candidateTrace.itemPath,
      generatedText: candidateTrace.generatedText,
    }))
}

function validateTargetRole({
  traces,
  targetRole,
}: {
  traces: GeneratedClaimTrace[]
  targetRole?: ValidateGeneratedClaimsInput['targetRole']
}): StructuredValidationIssue[] {
  const role = targetRole?.value?.trim()
  if (!role || targetRole?.permission === 'can_claim_target_role') {
    return []
  }

  return traces
    .filter((candidateTrace) => (
      candidateTrace.section === 'summary'
      || candidateTrace.section === 'experience'
    ))
    .filter((candidateTrace) => (
      candidateTrace.source !== 'preserved_original'
      && candidateTrace.classificationStatus !== 'original_preserved'
    ))
    .filter((candidateTrace) => containsTerm(candidateTrace.generatedText, role))
    .filter((candidateTrace) => (
      targetRole?.permission !== 'can_bridge_to_target_role'
      || !hasCautiousLanguage(candidateTrace.generatedText)
    ))
    .map((candidateTrace, index) => ({
      id: `target_role_asserted_without_permission-${candidateTrace.itemPath}-${index + 1}`,
      type: 'target_role_asserted_without_permission',
      severity: 'error',
      term: role,
      requirementIds: [],
      section: candidateTrace.section,
      traceId: candidateTrace.itemPath,
      generatedText: candidateTrace.generatedText,
    }))
}

function classifyForbiddenIssueType(
  candidateTrace: GeneratedClaimTrace,
): StructuredValidationIssueType {
  if (candidateTrace.section === 'skills') {
    return 'unsupported_skill_added'
  }

  if (candidateTrace.section === 'certifications') {
    return 'unsupported_certification'
  }

  if (candidateTrace.section === 'education') {
    return 'unsupported_education_claim'
  }

  return 'forbidden_term'
}

function hasCautiousVerbalization(candidateTrace: GeneratedClaimTrace, item: ClaimPolicyItem): boolean {
  if (
    candidateTrace.section === 'skills'
    || candidateTrace.section === 'education'
    || candidateTrace.section === 'certifications'
  ) {
    return false
  }

  const supportTerms = [
    ...item.allowedTerms,
    ...item.evidenceBasis.map((basis) => basis.text),
    ...candidateTrace.evidenceBasis,
  ]

  return hasCautiousLanguage(candidateTrace.generatedText)
    && supportTerms.some((term) => containsTerm(candidateTrace.generatedText, term))
}

function hasCautiousLanguage(value: string): boolean {
  const normalized = normalizeForTermMatch(value)

  return [
    'related',
    'adjacent',
    'context',
    'based on',
    'connected to',
    'relacionad',
    'contexto',
    'com base',
    'a partir',
    'por meio',
    'proximo',
    'proxima',
  ].some((cue) => normalized.includes(cue))
}

function containsTerm(source: string, term: string): boolean {
  return containsCanonicalClaimSignal(source, term)
}

function normalizeForTermMatch(value: string): string {
  return canonicalizeClaimSignal(value)
}
