import type {
  ClaimPolicyItem,
  JobCompatibilityClaimPolicy,
  StructuredValidationVersion,
} from '@/lib/agent/job-targeting/compatibility/types'

export const STRUCTURED_VALIDATION_VERSION = 'job-compat-structured-validation-v1'

export type StructuredValidationIssueType = 'forbidden_term' | 'unsafe_direct_claim'

export interface StructuredValidationIssue {
  id: string
  type: StructuredValidationIssueType
  severity: 'error'
  term: string
  claimPolicyItemId: string
  requirementIds: string[]
}

export interface ValidateGeneratedClaimsInput {
  generatedText: string
  claimPolicy: JobCompatibilityClaimPolicy
}

export interface StructuredValidationResult {
  valid: boolean
  blocked: boolean
  issues: StructuredValidationIssue[]
  validationVersion: StructuredValidationVersion
}

export function validateGeneratedClaims({
  generatedText,
  claimPolicy,
}: ValidateGeneratedClaimsInput): StructuredValidationResult {
  const issues = [
    ...claimPolicy.forbiddenClaims.flatMap((item) => (
      validateTerms({
        generatedText,
        item,
        type: 'forbidden_term',
      })
    )),
    ...claimPolicy.cautiousClaims.flatMap((item) => (
      validateTerms({
        generatedText,
        item,
        type: 'unsafe_direct_claim',
      })
    )),
  ]

  return {
    valid: issues.length === 0,
    blocked: issues.length > 0,
    issues,
    validationVersion: STRUCTURED_VALIDATION_VERSION,
  }
}

function validateTerms({
  generatedText,
  item,
  type,
}: {
  generatedText: string
  item: ClaimPolicyItem
  type: StructuredValidationIssueType
}): StructuredValidationIssue[] {
  return item.prohibitedTerms
    .filter((term) => containsTerm(generatedText, term))
    .map((term, index) => ({
      id: `${type}-${item.id}-${index + 1}`,
      type,
      severity: 'error',
      term,
      claimPolicyItemId: item.id,
      requirementIds: item.requirementIds,
    }))
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
