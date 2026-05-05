export type SkillAdjacencyRule = {
  requirementPattern: RegExp
  evidencePattern: RegExp
  relatedSuggestions: string[]
  explanationTemplate:
    | 'tooling_detail'
    | 'methodology_detail'
    | 'business_context'
    | 'integration_context'
  requirementSignals?: string[]
  evidenceSignals?: string[]
}

export const SKILL_ADJACENCY_RULES: SkillAdjacencyRule[] = []

export function loadSkillAdjacencyCatalog() {
  return {
    metadata: {
      catalogIds: [],
      catalogVersions: {},
    },
    genericTaxonomy: undefined,
    domainPacks: [],
  }
}

export function findSkillAdjacencyRule(
  _requirement?: string,
  _evidenceSignals: string[] = [],
): {
  rule: SkillAdjacencyRule
  evidence: string[]
} | null {
  return null
}
