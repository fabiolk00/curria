export type CatalogRequirementKind =
  | 'skill'
  | 'experience'
  | 'education'
  | 'responsibility'
  | 'preferred'

export type CatalogScoreDimensionId = 'skills' | 'experience' | 'education'

export interface CatalogAuditMetadata {
  source?: string
  owner?: string
  updatedAt?: string
  notes?: string
}

export interface CatalogAlias {
  value: string
  goldenCaseIds: string[]
  audit?: CatalogAuditMetadata
}

export interface CatalogCategoryRelationship {
  categoryId: string
  goldenCaseIds: string[]
  rationale?: string
  audit?: CatalogAuditMetadata
}

export interface CatalogTerm {
  id: string
  label: string
  goldenCaseIds: string[]
  aliases: CatalogAlias[]
  categoryIds: string[]
  audit?: CatalogAuditMetadata
}

export interface CatalogCategory {
  id: string
  label: string
  goldenCaseIds: string[]
  parentCategoryIds: string[]
  equivalentCategoryIds: CatalogCategoryRelationship[]
  adjacentCategoryIds: CatalogCategoryRelationship[]
  audit?: CatalogAuditMetadata
}

export interface CatalogAntiEquivalence {
  leftTermId: string
  rightTermId: string
  goldenCaseIds: string[]
  rationale?: string
  audit?: CatalogAuditMetadata
}

export interface CatalogScoreDimension {
  id: CatalogScoreDimensionId
  weight: number
}

export interface CatalogSectionWeights {
  skills: number
  experience: number
  education: number
}

export interface JobTargetingCatalogPack {
  id: string
  version: string
  domain: string
  goldenCaseIds: string[]
  requirementKinds: CatalogRequirementKind[]
  scoreDimensions: CatalogScoreDimension[]
  sectionWeights: CatalogSectionWeights
  adjacentDiscount: number
  terms: CatalogTerm[]
  categories: CatalogCategory[]
  antiEquivalences: CatalogAntiEquivalence[]
  audit?: CatalogAuditMetadata
}

export interface LoadedJobTargetingCatalog {
  genericTaxonomy: JobTargetingCatalogPack
  domainPacks: JobTargetingCatalogPack[]
  metadata: {
    catalogIds: string[]
    catalogVersions: Record<string, string>
  }
}
