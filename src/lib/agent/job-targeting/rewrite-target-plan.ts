import type {
  CoreRequirement,
  RewriteChangeSection,
  RewritePermission,
} from '@/types/agent'

export type RewriteTargetPlanInput = {
  targetRole?: string
  targetRoleConfidence?: 'low' | 'medium' | 'high'
  coreRequirements: CoreRequirement[]
  preferredRequirements: CoreRequirement[]
  supportedSignals: string[]
  adjacentSignals: string[]
  unsupportedSignals: string[]
}

export type SectionRewriteInstruction = {
  section: RewriteChangeSection
  priority: 'high' | 'medium' | 'low'
  focusRequirements: string[]
  allowedClaims: string[]
  bridgeClaims: string[]
  forbiddenClaims: string[]
  instruction: string
}

export type RewriteTargetPlan = {
  targetRole?: string
  sectionInstructions: SectionRewriteInstruction[]
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase('pt-BR')
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
}

function isDirectPermission(permission: RewritePermission): boolean {
  return permission === 'can_claim_directly' || permission === 'can_claim_normalized'
}

function isBridgePermission(permission: RewritePermission): boolean {
  return permission === 'can_bridge_carefully' || permission === 'can_mention_as_related_context'
}

function collectAllowedClaims(input: RewriteTargetPlanInput): string[] {
  return dedupe([
    ...input.supportedSignals,
    ...input.coreRequirements
      .filter((requirement) => isDirectPermission(requirement.rewritePermission))
      .map((requirement) => requirement.signal),
    ...input.preferredRequirements
      .filter((requirement) => isDirectPermission(requirement.rewritePermission))
      .map((requirement) => requirement.signal),
  ]).slice(0, 16)
}

function collectBridgeClaims(input: RewriteTargetPlanInput): string[] {
  return dedupe([
    ...input.adjacentSignals,
    ...input.coreRequirements
      .filter((requirement) => isBridgePermission(requirement.rewritePermission))
      .map((requirement) => requirement.signal),
    ...input.preferredRequirements
      .filter((requirement) => isBridgePermission(requirement.rewritePermission))
      .map((requirement) => requirement.signal),
  ]).slice(0, 12)
}

function collectForbiddenClaims(input: RewriteTargetPlanInput): string[] {
  return dedupe([
    ...input.unsupportedSignals,
    ...input.coreRequirements
      .filter((requirement) => requirement.rewritePermission === 'must_not_claim')
      .map((requirement) => requirement.signal),
    ...input.preferredRequirements
      .filter((requirement) => requirement.rewritePermission === 'must_not_claim')
      .map((requirement) => requirement.signal),
  ]).slice(0, 16)
}

function collectFocusRequirements(input: RewriteTargetPlanInput): string[] {
  return dedupe([
    ...input.coreRequirements.map((requirement) => requirement.signal),
    ...input.preferredRequirements.map((requirement) => requirement.signal),
  ]).slice(0, 12)
}

function buildSectionInstruction(params: {
  section: RewriteChangeSection
  priority: SectionRewriteInstruction['priority']
  focusRequirements: string[]
  allowedClaims: string[]
  bridgeClaims: string[]
  forbiddenClaims: string[]
  targetRole?: string
  targetRoleConfidence?: 'low' | 'medium' | 'high'
}): SectionRewriteInstruction {
  const allowed = params.allowedClaims.join(', ') || 'nenhum claim novo alem do curriculo original'
  const bridge = params.bridgeClaims.join(', ') || 'nenhuma ponte semantica relevante'
  const forbidden = params.forbiddenClaims.join(', ') || 'nenhum requisito bloqueado identificado'
  const targetRoleInstruction = params.targetRole && params.targetRoleConfidence !== 'low'
    ? `Posicione a secao para ${params.targetRole} usando somente evidencias reais.`
    : 'Ancora a secao nos requisitos da vaga sem forcar um cargo alvo literal.'

  const sectionSpecific: Record<RewriteChangeSection, string> = {
    summary: [
      targetRoleInstruction,
      `Destaque diretamente apenas: ${allowed}.`,
      `Quando houver evidencia adjacente, aproxime com linguagem cuidadosa para: ${bridge}.`,
      `Nao declare dominio, cargo, ferramenta ou metodologia sem evidencia para: ${forbidden}.`,
      'Evite resumo generico; abra com identidade profissional real, foco da vaga e sinais comprovados.',
    ].join(' '),
    experience: [
      'Reordene e reescreva bullets para aproximar responsabilidades da vaga mantendo fatos originais.',
      `Claims diretos permitidos: ${allowed}.`,
      `Pontes cuidadosas permitidas quando ancoradas em evidencias reais: ${bridge}.`,
      `Nao invente ferramentas, dominios, senioridade, stakeholders ou escopo para: ${forbidden}.`,
      'Torne explicito impacto, indicador, tomada de decisao ou stakeholder apenas quando isso ja estiver sustentado.',
    ].join(' '),
    skills: [
      'Reordene skills por prioridade da vaga e mantenha apenas competencias comprovadas.',
      `Skills/claims permitidos: ${allowed}.`,
      `Nao adicione como skill direta: ${forbidden}.`,
      `Itens adjacentes devem ficar fora de Skills, salvo se ja existirem no curriculo: ${bridge}.`,
    ].join(' '),
    education: [
      'Mantenha formacao factual e apenas melhore consistencia.',
      `Nao transforme requisitos sem evidencia em formacao ou certificacao: ${forbidden}.`,
    ].join(' '),
    certifications: [
      'Reordene certificacoes por relevancia para a vaga preservando nomes, emissores e datas.',
      `Nao criar certificacoes nem equivalencias para: ${forbidden}.`,
    ].join(' '),
  }

  return {
    section: params.section,
    priority: params.priority,
    focusRequirements: params.focusRequirements,
    allowedClaims: params.allowedClaims,
    bridgeClaims: params.bridgeClaims,
    forbiddenClaims: params.forbiddenClaims,
    instruction: sectionSpecific[params.section],
  }
}

export function buildRewriteTargetPlan(input: RewriteTargetPlanInput): RewriteTargetPlan {
  const allowedClaims = collectAllowedClaims(input)
  const bridgeClaims = collectBridgeClaims(input)
  const forbiddenClaims = collectForbiddenClaims(input)
  const focusRequirements = collectFocusRequirements(input)
  const targetSections: Array<{
    section: RewriteChangeSection
    priority: SectionRewriteInstruction['priority']
  }> = [
    { section: 'summary', priority: 'high' },
    { section: 'experience', priority: 'high' },
    { section: 'skills', priority: 'high' },
    { section: 'education', priority: 'low' },
    { section: 'certifications', priority: 'low' },
  ]

  return {
    targetRole: input.targetRole,
    sectionInstructions: targetSections.map((section) => buildSectionInstruction({
      ...section,
      focusRequirements,
      allowedClaims,
      bridgeClaims,
      forbiddenClaims,
      targetRole: input.targetRole,
      targetRoleConfidence: input.targetRoleConfidence,
    })),
  }
}
