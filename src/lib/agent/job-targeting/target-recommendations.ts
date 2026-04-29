import {
  findSkillAdjacencyRule,
  type SkillAdjacencyRule,
} from '@/lib/agent/job-targeting/skill-adjacency'
import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import type {
  CoreRequirement,
  TargetRecommendation,
  TargetRecommendationKind,
  TargetRecommendationPriority,
} from '@/types/agent'

export type BuildTargetRecommendationsInput = {
  targetRole?: string
  coreRequirements: CoreRequirement[]
  preferredRequirements: CoreRequirement[]
  supportedSignals: string[]
  adjacentSignals: string[]
  resumeSkillSignals: string[]
  maxRecommendations?: number
}

const DEFAULT_MAX_RECOMMENDATIONS = 6
const DIRECTLY_SUPPORTED_LEVELS = new Set<CoreRequirement['evidenceLevel']>([
  'explicit',
  'normalized_alias',
  'technical_equivalent',
])

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const canonical = buildCanonicalSignal(value) || value.toLocaleLowerCase('pt-BR')
      if (seen.has(canonical)) {
        return false
      }

      seen.add(canonical)
      return true
    })
}

function sentenceList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? ''
  }

  if (values.length === 2) {
    return `${values[0]} e ${values[1]}`
  }

  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`
}

function isDirectlySupported(requirement: CoreRequirement): boolean {
  return DIRECTLY_SUPPORTED_LEVELS.has(requirement.evidenceLevel)
    && requirement.rewritePermission !== 'must_not_claim'
}

function priorityFor(requirement: CoreRequirement): TargetRecommendationPriority {
  if (requirement.importance === 'core') {
    return 'high'
  }

  if (requirement.importance === 'differential') {
    return 'medium'
  }

  return 'low'
}

function inferKind(requirement: CoreRequirement, rule?: SkillAdjacencyRule): TargetRecommendationKind {
  if (rule?.explanationTemplate === 'tooling_detail') {
    return 'adjacent_skill'
  }

  if (rule?.explanationTemplate === 'integration_context') {
    return 'missing_tooling_detail'
  }

  if (rule?.explanationTemplate === 'methodology_detail') {
    return 'missing_methodology'
  }

  if (rule?.explanationTemplate === 'business_context') {
    return 'missing_stakeholder_context'
  }

  const signal = requirement.signal
  if (/\b(?:metricas?|indicadores?|kpis?|resultado|impacto|quantifica)/iu.test(signal)) {
    return 'needs_quantification'
  }

  if (/\b(?:negocio|business|dominio|industria|mercado|cliente)\b/iu.test(signal)) {
    return 'missing_business_domain'
  }

  if (/\b(?:ferramenta|tooling|stack|plataforma|sistema|sql|python|excel|power\s*bi)\b/iu.test(signal)) {
    return 'missing_tooling_detail'
  }

  return requirement.evidenceLevel === 'unsupported_gap'
    ? 'missing_explicit_skill'
    : 'missing_context'
}

function relatedSectionFor(kind: TargetRecommendationKind): TargetRecommendation['relatedResumeSection'] {
  switch (kind) {
    case 'adjacent_skill':
    case 'missing_explicit_skill':
    case 'missing_tooling_detail':
    case 'missing_methodology':
      return 'skills'
    case 'needs_quantification':
    case 'missing_business_domain':
    case 'missing_context':
    case 'missing_stakeholder_context':
      return 'experience'
  }
}

function relatedEvidenceLevel(requirement: CoreRequirement, hasEvidence: boolean): TargetRecommendation['relatedEvidenceLevel'] {
  if (isDirectlySupported(requirement)) {
    return 'explicit'
  }

  return hasEvidence ? 'adjacent' : 'unsupported_gap'
}

function buildEvidenceCandidates(input: BuildTargetRecommendationsInput): string[] {
  return dedupe([
    ...input.resumeSkillSignals,
    ...input.supportedSignals,
    ...input.adjacentSignals,
  ])
}

function hasWeakOrMissingEvidence(requirement: CoreRequirement): boolean {
  return requirement.rewritePermission === 'must_not_claim'
    || requirement.evidenceLevel === 'unsupported_gap'
    || requirement.evidenceLevel === 'semantic_bridge_only'
    || requirement.evidenceLevel === 'strong_contextual_inference'
    || requirement.rewritePermission === 'can_bridge_carefully'
    || requirement.rewritePermission === 'can_mention_as_related_context'
}

function buildCurrentEvidence(params: {
  requirement: CoreRequirement
  evidenceCandidates: string[]
  adjacentMatch?: ReturnType<typeof findSkillAdjacencyRule>
}): string[] {
  if (params.adjacentMatch) {
    return params.adjacentMatch.evidence
  }

  const requirementTokens = new Set(
    buildCanonicalSignal(params.requirement.signal)
      .split(' ')
      .filter((token) => token.length >= 4),
  )

  return params.evidenceCandidates
    .filter((evidence) => {
      const evidenceTokens = buildCanonicalSignal(evidence).split(' ')
      return evidenceTokens.some((token) => requirementTokens.has(token))
    })
    .slice(0, 3)
}

function buildActionCopy(params: {
  requirement: CoreRequirement
  currentEvidence: string[]
  kind: TargetRecommendationKind
  relatedSuggestions: string[]
}): { suggestedUserAction: string; safeExample?: string } {
  const requirement = params.requirement.signal
  const evidenceCopy = params.currentEvidence.length > 0
    ? `Seu currículo mostra ${sentenceList(params.currentEvidence)}`
    : 'Seu currículo ainda não traz evidência suficiente desse ponto'
  const suggestions = params.relatedSuggestions.length > 0
    ? sentenceList(params.relatedSuggestions)
    : requirement

  if (params.kind === 'adjacent_skill' || params.kind === 'missing_tooling_detail') {
    return {
      suggestedUserAction: `A vaga pede ${requirement}. ${evidenceCopy}, mas não deixa claro se você usa ${suggestions}. Se você realmente tem experiência com ${suggestions}, adicione isso explicitamente em Skills e em uma experiência prática.`,
      safeExample: `Se for verdadeiro: Construí entregas usando ${suggestions}, conectando essa prática a um resultado ou contexto real do projeto.`,
    }
  }

  if (params.kind === 'missing_stakeholder_context') {
    return {
      suggestedUserAction: `A vaga valoriza ${requirement}. ${evidenceCopy}, mas poderia explicar melhor como você levantou requisitos, traduziu demandas ou apresentou análises. Caso isso faça parte da sua trajetória, descreva essa atuação em uma experiência.`,
      safeExample: 'Se for verdadeiro: Atuei junto a áreas de negócio para levantar requisitos, traduzir demandas em indicadores e apresentar análises para tomada de decisão.',
    }
  }

  if (params.kind === 'needs_quantification') {
    return {
      suggestedUserAction: `A vaga valoriza ${requirement}. ${evidenceCopy}. Se você tiver números reais, adicione métricas, volume, prazo, qualidade ou impacto, apenas se forem verdadeiros.`,
      safeExample: 'Se for verdadeiro: Acompanhei indicadores com melhoria mensurável de prazo, qualidade ou eficiência, informando o número real.',
    }
  }

  if (params.kind === 'missing_methodology') {
    return {
      suggestedUserAction: `A vaga cita ${requirement}. ${evidenceCopy}. Se você realmente usou ${suggestions}, mencione a metodologia no contexto do projeto em que ela foi aplicada.`,
      safeExample: `Se for verdadeiro: Conduzi entregas usando ${suggestions}, mantendo rituais, priorização e acompanhamento de evolução do trabalho.`,
    }
  }

  if (params.kind === 'missing_business_domain') {
    return {
      suggestedUserAction: `A vaga pede contexto de ${requirement}. ${evidenceCopy}. Caso isso faça parte da sua experiência real, detalhe o domínio de negócio, público atendido ou área parceira.`,
      safeExample: 'Se for verdadeiro: Apoiei áreas de negócio com análises e indicadores conectados ao domínio real da operação.',
    }
  }

  return {
    suggestedUserAction: `A vaga pede ${requirement}. ${evidenceCopy}. Se você realmente tem essa experiência, adicione apenas o que for verdadeiro; se não tiver, não afirme esse requisito no currículo.`,
    safeExample: `Se for verdadeiro: Descreva ${requirement} dentro de uma experiência real, citando a atividade, ferramenta ou contexto em que ocorreu.`,
  }
}

function buildRecommendationId(requirement: CoreRequirement, index: number): string {
  const slug = (buildCanonicalSignal(requirement.signal) || `requisito-${index}`)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40)

  return `target-rec-${slug || index}`
}

function scoreRecommendation(recommendation: TargetRecommendation, sourceIndex: number): number {
  const priorityScore = recommendation.priority === 'high'
    ? 100
    : recommendation.priority === 'medium'
      ? 60
      : 30
  const evidenceScore = recommendation.currentEvidence.length > 0 ? 12 : 0
  const kindScore = recommendation.kind === 'adjacent_skill' ? 10 : 0

  return priorityScore + evidenceScore + kindScore - sourceIndex
}

export function buildTargetRecommendations(
  input: BuildTargetRecommendationsInput,
): TargetRecommendation[] {
  const maxRecommendations = input.maxRecommendations ?? DEFAULT_MAX_RECOMMENDATIONS
  const evidenceCandidates = buildEvidenceCandidates(input)
  const requirements = dedupe([
    ...input.coreRequirements.map((requirement) => requirement.signal),
    ...input.preferredRequirements.map((requirement) => requirement.signal),
  ]).map((signal) => (
    [...input.coreRequirements, ...input.preferredRequirements]
      .find((requirement) => buildCanonicalSignal(requirement.signal) === buildCanonicalSignal(signal))
  )).filter((requirement): requirement is CoreRequirement => Boolean(requirement))

  const recommendations = requirements
    .filter((requirement) => !isDirectlySupported(requirement))
    .filter(hasWeakOrMissingEvidence)
    .map((requirement, index) => {
      const adjacentMatch = findSkillAdjacencyRule(requirement.signal, evidenceCandidates)
      const currentEvidence = buildCurrentEvidence({
        requirement,
        evidenceCandidates,
        adjacentMatch,
      })
      const kind = inferKind(requirement, adjacentMatch?.rule)
      const relatedSuggestions = adjacentMatch?.rule.relatedSuggestions ?? [requirement.signal]
      const { suggestedUserAction, safeExample } = buildActionCopy({
        requirement,
        currentEvidence,
        kind,
        relatedSuggestions,
      })

      return {
        recommendation: {
          id: buildRecommendationId(requirement, index),
          kind,
          priority: priorityFor(requirement),
          jobRequirement: requirement.signal,
          currentEvidence,
          suggestedUserAction,
          safeExample,
          mustNotInvent: true,
          relatedResumeSection: relatedSectionFor(kind),
          relatedEvidenceLevel: relatedEvidenceLevel(requirement, currentEvidence.length > 0),
        } satisfies TargetRecommendation,
        sourceIndex: index,
      }
    })
    .filter(({ recommendation }) => (
      recommendation.priority === 'high'
      || recommendation.currentEvidence.length > 0
      || recommendation.kind === 'missing_explicit_skill'
    ))
    .filter(({ recommendation }) => !/benef[ií]cios?|cultura|sobre\s+n[oó]s|plano\s+de\s+carreira/iu.test(recommendation.jobRequirement))
    .sort((left, right) => scoreRecommendation(right.recommendation, right.sourceIndex) - scoreRecommendation(left.recommendation, left.sourceIndex))
    .map(({ recommendation }) => recommendation)

  return recommendations.slice(0, maxRecommendations)
}
