export type ProductEvidenceGroup = 'supported' | 'adjacent' | 'unsupported'

export type InternalEvidenceLevel =
  | 'exact'
  | 'catalog_alias'
  | 'catalog_anti_equivalence'
  | 'catalog_category'
  | 'adjacent_category'
  | 'llm_ambiguity_resolved'
  | 'unsupported'

export type ClaimPermission = 'allowed' | 'cautious' | 'forbidden'

export type RequirementKind =
  | 'skill'
  | 'experience'
  | 'education'
  | 'responsibility'
  | 'preferred'
  | 'unknown'

export type RequirementImportance = 'core' | 'secondary' | 'differential'

export type JobCompatibilityScoreDimensionId = 'skills' | 'experience' | 'education'

export type JobCompatibilityAssessmentVersion = 'job-compat-assessment-v1'
export type JobCompatibilityScoreVersion = 'job-compat-score-v1'

export interface RequirementEvidenceSource {
  id: string
  text: string
  section?: string
  sourceKind?: string
  cvPath?: string
}

export interface RequirementEvidenceAudit {
  matcherVersion: string
  matchSource: InternalEvidenceLevel
  precedence: readonly InternalEvidenceLevel[]
  catalogIds: string[]
  catalogVersions: Record<string, string>
  catalogTermIds: string[]
  catalogCategoryIds: string[]
  antiEquivalenceTermIds?: string[]
  ambiguityResolved?: boolean
}

export interface RequirementEvidence {
  requirementId: string
  requirementText: string
  requirementKind: RequirementKind
  requirementImportance: RequirementImportance
  productEvidenceGroup: ProductEvidenceGroup
  internalEvidenceLevel: InternalEvidenceLevel
  claimPermission: ClaimPermission
  evidenceIds: string[]
  matchedEvidence: RequirementEvidenceSource[]
  catalogTermIds: string[]
  catalogCategoryIds: string[]
  prohibitedTerms: string[]
  confidence: number
  rationaleCode: string
  audit: RequirementEvidenceAudit
}

export interface ClaimPolicyItem {
  requirementId: string
  permission: ClaimPermission
  productEvidenceGroup: ProductEvidenceGroup
  evidenceIds: string[]
  allowedTerms: string[]
  prohibitedTerms: string[]
  cautiousTemplate?: string
  reasonCode: string
}

export interface JobCompatibilityScoreDimensionBreakdown {
  id: JobCompatibilityScoreDimensionId
  weight: number
  requirementCount: number
  supportedCount: number
  adjacentCount: number
  unsupportedCount: number
  rawScore: number
  weightedScore: number
}

export interface JobCompatibilityScoreBreakdown {
  version: JobCompatibilityScoreVersion
  total: number
  maxTotal: 100
  adjacentDiscount: number
  dimensions: Record<JobCompatibilityScoreDimensionId, JobCompatibilityScoreDimensionBreakdown>
  formula: {
    supportedValue: 1
    adjacentValue: 0.5
    unsupportedValue: 0
  }
}

export interface JobCompatibilityGap {
  requirementId: string
  text: string
  kind: RequirementKind
  importance: RequirementImportance
  severity: 'critical' | 'review'
  reasonCode: string
  prohibitedTerms?: string[]
}

export interface JobCompatibilityLowFitState {
  triggered: boolean
  riskLevel: 'low' | 'medium' | 'high'
  reasons: string[]
  thresholdAudit: {
    score: number
    minimumScore?: number
    unsupportedCoreCount?: number
    unsupportedCoreRatio?: number
  }
}

export interface JobCompatibilityAssessment {
  version: JobCompatibilityAssessmentVersion
  targetRole?: string
  targetRoleConfidence?: 'low' | 'medium' | 'high'
  requirements: RequirementEvidence[]
  supportedRequirements: RequirementEvidence[]
  adjacentRequirements: RequirementEvidence[]
  unsupportedRequirements: RequirementEvidence[]
  claimPolicy: ClaimPolicyItem[]
  score: JobCompatibilityScoreBreakdown
  criticalGaps: JobCompatibilityGap[]
  reviewNeededGaps: JobCompatibilityGap[]
  lowFit: JobCompatibilityLowFitState
  catalog: {
    catalogIds: string[]
    catalogVersions: Record<string, string>
  }
  audit: {
    generatedAt: string
    assessmentVersion: JobCompatibilityAssessmentVersion
    matcherVersion: string
    scoreVersion: JobCompatibilityScoreVersion
    counts: {
      requirements: number
      supported: number
      adjacent: number
      unsupported: number
      criticalGaps: number
      reviewNeededGaps: number
    }
  }
}
