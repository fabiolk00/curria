import type {
  ClaimPolicyItem,
  JobCompatibilityClaimPolicy,
  StructuredValidationVersion,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { TargetRoleClaimPermission } from '@/types/agent'
import type { CVState } from '@/types/cv'

export const STRUCTURED_VALIDATION_VERSION = 'job-compat-structured-validation-v1'

export type GeneratedClaimTraceSection =
  | 'full_text'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'education'
  | 'certifications'

export type StructuredValidationIssueType =
  | 'forbidden_term'
  | 'unsupported_skill_added'
  | 'unsupported_certification'
  | 'unsupported_education_claim'
  | 'target_role_asserted_without_permission'
  | 'unsafe_direct_claim'

export interface GeneratedClaimTrace {
  id: string
  section: GeneratedClaimTraceSection
  text: string
  cvPath?: string
}

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
  claimPolicy,
  targetRole,
}: ValidateGeneratedClaimsInput): StructuredValidationResult {
  const traces = resolveGeneratedClaimTraces({
    generatedText,
    generatedCvState,
    generatedClaimTraces,
  })
  const issues = [
    ...claimPolicy.forbiddenClaims.flatMap((item) => (
      validateForbiddenTerms({
        traces,
        item,
      })
    )),
    ...claimPolicy.cautiousClaims.flatMap((item) => (
      validateCautiousTerms({
        traces,
        item,
      })
    )),
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
  return [
    trace('summary', 'summary', cvState.summary, 'summary'),
    ...cvState.skills.map((skill, index) => (
      trace(`skills-${index}`, 'skills', skill, `skills.${index}`)
    )),
    ...cvState.experience.flatMap((entry, entryIndex) => [
      trace(
        `experience-${entryIndex}-heading`,
        'experience',
        [entry.title, entry.company].filter(Boolean).join(' '),
        `experience.${entryIndex}`,
      ),
      ...entry.bullets.map((bullet, bulletIndex) => (
        trace(
          `experience-${entryIndex}-bullet-${bulletIndex}`,
          'experience',
          bullet,
          `experience.${entryIndex}.bullets.${bulletIndex}`,
        )
      )),
    ]),
    ...cvState.education.map((entry, index) => (
      trace(
        `education-${index}`,
        'education',
        [entry.degree, entry.institution, entry.year, entry.gpa].filter(Boolean).join(' '),
        `education.${index}`,
      )
    )),
    ...(cvState.certifications ?? []).map((entry, index) => (
      trace(
        `certifications-${index}`,
        'certifications',
        [entry.name, entry.issuer, entry.year].filter(Boolean).join(' '),
        `certifications.${index}`,
      )
    )),
  ].filter((item) => item.text.trim().length > 0)
}

function resolveGeneratedClaimTraces(input: {
  generatedText?: string
  generatedCvState?: CVState
  generatedClaimTraces?: GeneratedClaimTrace[]
}): GeneratedClaimTrace[] {
  if (input.generatedClaimTraces) {
    return input.generatedClaimTraces
  }

  if (input.generatedCvState) {
    return buildGeneratedClaimTracesFromCvState(input.generatedCvState)
  }

  return input.generatedText?.trim()
    ? [trace('full-text', 'full_text', input.generatedText)]
    : []
}

function trace(
  id: string,
  section: GeneratedClaimTraceSection,
  text: string,
  cvPath?: string,
): GeneratedClaimTrace {
  return {
    id,
    section,
    text,
    cvPath,
  }
}

function validateForbiddenTerms({
  traces,
  item,
}: {
  traces: GeneratedClaimTrace[]
  item: ClaimPolicyItem
}): StructuredValidationIssue[] {
  return traces.flatMap((candidateTrace) => (
    item.prohibitedTerms
      .filter((term) => containsTerm(candidateTrace.text, term))
      .map((term, index) => {
        const type = classifyForbiddenIssueType(candidateTrace)

        return {
          id: `${type}-${item.id}-${candidateTrace.id}-${index + 1}`,
          type,
          severity: 'error' as const,
          term,
          claimPolicyItemId: item.id,
          requirementIds: item.requirementIds,
          section: candidateTrace.section,
          traceId: candidateTrace.id,
          generatedText: candidateTrace.text,
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
  return traces.flatMap((candidateTrace) => (
    item.prohibitedTerms
      .filter((term) => containsTerm(candidateTrace.text, term))
      .filter(() => !hasCautiousVerbalization(candidateTrace, item))
      .map((term, index) => ({
        id: `unsafe_direct_claim-${item.id}-${candidateTrace.id}-${index + 1}`,
        type: 'unsafe_direct_claim' as const,
        severity: 'error' as const,
        term,
        claimPolicyItemId: item.id,
        requirementIds: item.requirementIds,
        section: candidateTrace.section,
        traceId: candidateTrace.id,
        generatedText: candidateTrace.text,
      }))
  ))
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
      || candidateTrace.section === 'full_text'
    ))
    .filter((candidateTrace) => containsTerm(candidateTrace.text, role))
    .filter((candidateTrace) => (
      targetRole?.permission !== 'can_bridge_to_target_role'
      || !hasCautiousLanguage(candidateTrace.text)
    ))
    .map((candidateTrace, index) => ({
      id: `target_role_asserted_without_permission-${candidateTrace.id}-${index + 1}`,
      type: 'target_role_asserted_without_permission',
      severity: 'error',
      term: role,
      requirementIds: [],
      section: candidateTrace.section,
      traceId: candidateTrace.id,
      generatedText: candidateTrace.text,
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
  ]

  return hasCautiousLanguage(candidateTrace.text)
    && supportTerms.some((term) => containsTerm(candidateTrace.text, term))
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
  const normalizedSource = normalizeForTermMatch(source)
  const normalizedTerm = normalizeForTermMatch(term)

  return normalizedTerm.length > 0 && normalizedSource.includes(normalizedTerm)
}

function normalizeForTermMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
