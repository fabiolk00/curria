export type SkillAdjacencyRule = {
  requirementPattern: RegExp
  evidencePattern: RegExp
  relatedSuggestions: string[]
  explanationTemplate:
    | 'tooling_detail'
    | 'methodology_detail'
    | 'business_context'
    | 'integration_context'
}

export const SKILL_ADJACENCY_RULES: SkillAdjacencyRule[] = [
  {
    requirementPattern: /\bdax\b/i,
    evidencePattern: /\bpower\s*bi\b|\bdashboards?\b|\bbi\b|\bsql\b/i,
    relatedSuggestions: ['DAX', 'Power Query', 'linguagem M', 'modelagem semantica'],
    explanationTemplate: 'tooling_detail',
  },
  {
    requirementPattern: /\bapi(s)?\b|integr[aã]ç/i,
    evidencePattern: /\betl\b|pipeline|integr[aã]ç|databricks|dados|automatiza/i,
    relatedSuggestions: ['APIs', 'integracao sistemica', 'automacao de dados'],
    explanationTemplate: 'integration_context',
  },
  {
    requirementPattern: /\bstakeholders?\b|[aá]reas?\s+de\s+neg[oó]cio|p[uú]blicos?\s+n[aã]o\s+t[eé]cnicos?|comunica/i,
    evidencePattern: /\bdashboards?\b|indicadores?|apresenta|levantamento|requisitos?|stakeholders?|neg[oó]cio/i,
    relatedSuggestions: ['levantamento de requisitos', 'traducao de demandas', 'apresentacao de analises'],
    explanationTemplate: 'business_context',
  },
  {
    requirementPattern: /\bscrum\b|\bagile\b|kanban|metodolog/i,
    evidencePattern: /\bprojetos?\b|sprints?|rituais?|entregas?|produto|times?\b/i,
    relatedSuggestions: ['Scrum', 'Kanban', 'rituais ageis', 'gestao de entregas'],
    explanationTemplate: 'methodology_detail',
  },
]

export function findSkillAdjacencyRule(requirement: string, evidenceSignals: string[]): {
  rule: SkillAdjacencyRule
  evidence: string[]
} | null {
  const matchingRule = SKILL_ADJACENCY_RULES.find((rule) => rule.requirementPattern.test(requirement))
  if (!matchingRule) {
    return null
  }

  const evidence = evidenceSignals.filter((signal) => matchingRule.evidencePattern.test(signal))
  if (evidence.length === 0) {
    return null
  }

  return {
    rule: matchingRule,
    evidence: Array.from(new Set(evidence)).slice(0, 4),
  }
}
