import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import {
  buildCoreRequirementCoverage,
  extractCoreRequirementSignalsFromDescription,
} from '@/lib/agent/job-targeting/core-requirement-coverage'
import { classifyTargetEvidence } from '@/lib/agent/job-targeting/evidence-classifier'
import { buildLowFitWarningGate } from '@/lib/agent/job-targeting/low-fit-warning-gate'
import { buildTargetRolePositioning } from '@/lib/agent/job-targeting/recoverable-validation'
import { buildTargetedRewritePermissions } from '@/lib/agent/job-targeting/rewrite-permissions'
import { buildSafeTargetingEmphasis } from '@/lib/agent/job-targeting/safe-targeting-emphasis'
import { buildTargetingPlanFromAssessment } from '@/lib/agent/job-targeting/compatibility/legacy-adapters'
import { MAX_TARGETING_PLAN_ITEMS, shapeTargetJobDescription } from '@/lib/agent/job-targeting-retry'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
import type { TargetingPlan } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

const FALLBACK_TARGET_ROLE = 'Vaga Alvo'
const UNKNOWN_TARGET_ROLE = 'Unknown Role'
const TARGET_ROLE_EXTRACTION_MAX_COMPLETION_TOKENS = 120

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function normalizeWhitespace(value: string | undefined): string {
  return normalize(value).replace(/\s+/g, ' ').trim()
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function cleanExtractedRole(value: string): string {
  return value
    .replace(/\s+(para\s+atuar|para\s+liderar|para\s+trabalhar|com\s+foco|atuando\s+em|working\s+on|to\s+work).*/i, '')
    .replace(/\s+(responsavel\s+por|responsible\s+for|requisitos?|requirements?|qualifications?|responsabilidades?|about\s+the\s+job|about\s+the\s+role).*/i, '')
    .replace(/[|:;.,-]+$/g, '')
    .trim()
}

function isSectionHeading(line: string): boolean {
  const normalized = normalizeWhitespace(line).replace(/[:\-]+$/g, '').trim()

  return /^(requisitos(?:\s+obrigatorios)?|responsabilidades?(?:\s+e\s+atribuicoes)?|atribuicoes|qualificacoes|desejavel|diferenciais|beneficios|sobre\s+a?\s*vaga|sobre\s+o\s+time|descricao|resumo|atividades|about\s+the\s+job|about\s+the\s+role|job\s+description|responsibilities|requirements|qualifications|what\s+you(?:'ll|\s+will)?\s+do|what\s+you(?:'ll|\s+will)?\s+bring)$/i.test(normalized)
}

function isAnnouncementLine(line: string): boolean {
  const normalized = normalizeWhitespace(line)

  return /^(buscamos|procuramos|estamos\s+contratando|contratamos|looking\s+for|we\s+are\s+hiring|we're\s+hiring|join\s+our\s+team)\b/i.test(normalized)
}

function lineHasRoleSignal(line: string): boolean {
  const normalized = normalizeWhitespace(line)

  return /\b(analista|engenheir[oa]|developer|desenvolvedor(?:a)?|cientista|gerente|coordenador(?:a)?|consultor(?:a)?|product\s+manager|designer|arquiteto(?:a)?|devops|sre|qa|analytics\s+engineer|data\s+engineer|data\s+analyst|business\s+intelligence|especialista)\b/i.test(normalized)
}

function isWeakTargetRole(value: string): boolean {
  const normalized = normalizeWhitespace(cleanExtractedRole(value))

  if (!normalized || isSectionHeading(normalized) || isAnnouncementLine(normalized) || normalized.length > 70) {
    return true
  }

  return /^(bi|vaga\s+alvo|target\s+role|unknown\s+role)$/.test(normalized)
}

function matchesSemanticSignal(value: string, semanticSignals: string[]): boolean {
  const normalizedValue = normalizeWhitespace(value)

  return semanticSignals.some((signal) => {
    const normalizedSignal = normalizeWhitespace(signal)
    return normalizedSignal.length >= 3
      && (normalizedValue.includes(normalizedSignal) || normalizedSignal.includes(normalizedValue))
  })
}

function extractSemanticSignals(targetJobDescription: string): string[] {
  const shapedTargetJob = shapeTargetJobDescription(targetJobDescription).content
  const segments = shapedTargetJob
    .split(/[\n,;|]/u)
    .map((segment) => segment.replace(/^[^:]{0,32}:\s*/u, '').trim())
    .filter(Boolean)
  const stopWords = new Set([
    'para', 'com', 'uma', 'das', 'dos', 'que', 'and', 'the', 'this', 'role',
    'vaga', 'sera', 'will', 'you', 'your', 'como', 'mais', 'sobre',
    'responsabilidades', 'responsibilities', 'requisitos', 'requirements',
    'qualificacoes', 'qualifications', 'experience', 'experiencia', 'job',
    'about', 'looking', 'buscamos', 'procuramos', 'profissionais',
    'build', 'create', 'manage', 'using', 'used', 'atuar', 'atuacao', 'atuando',
    'realizar', 'realize', 'strong',
  ])

  const phraseCandidates = segments.flatMap((segment) => {
    const tokens = (segment.toLowerCase().match(/[\p{L}\p{N}+#./-]{2,}/gu) ?? [])
      .filter((token) => !stopWords.has(token))

    const phrases: string[] = []
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        phrases.push(tokens.slice(index, index + size).join(' '))
      }
    }

    return phrases
  })

  const phraseMatches = segments
    .map((segment) => segment.toLowerCase())
    .filter((segment) => segment.split(/\s+/u).length <= 4)
    .filter((segment) => {
      const tokens = segment.match(/[\p{L}\p{N}+#./-]{3,}/gu) ?? []
      return tokens.length > 0 && tokens.some((token) => !stopWords.has(token))
    })

  const tokenMatches = shapedTargetJob
    .toLowerCase()
    .match(/[\p{L}\p{N}+#./-]{3,}/gu) ?? []

  return Array.from(new Set([
    ...phraseMatches,
    ...phraseCandidates,
    ...tokenMatches.filter((token) => !stopWords.has(token)),
  ]))
}

/**
 * Legacy targeting plan builder.
 *
 * IMPORTANT:
 * This function intentionally does NOT run semantic evidence classification.
 * It must remain safe for highlight-only, ATS, generic rewrite, job analysis,
 * and other non-targeted-rewrite flows.
 *
 * Use buildTargetedRewritePlan() exclusively for job_targeting targeted rewrite,
 * where TargetEvidence and TargetedRewritePermissions are required.
 */
export async function buildTargetingPlan(params: BuildTargetingPlanParams): Promise<TargetingPlan> {
  return buildBaseTargetingPlan(params)
}

/**
 * Enriched targeting plan builder for job_targeting targeted rewrite only.
 *
 * This is the only allowed entry point for TargetEvidence and
 * TargetedRewritePermissions generation.
 */
export async function buildTargetedRewritePlan(params: BuildTargetedRewritePlanInput): Promise<TargetingPlan> {
  if (params.mode !== 'job_targeting' || params.rewriteIntent !== 'targeted_rewrite') {
    throw new Error('buildTargetedRewritePlan only supports job_targeting targeted_rewrite flows.')
  }

  if (!params.targetJobDescription.trim()) {
    throw new Error('buildTargetedRewritePlan requires a target job description for targeted rewrite.')
  }

  const basePlan = await buildBaseTargetingPlan(params)
  if (params.jobCompatibilityAssessment) {
    return buildTargetingPlanFromAssessment(params.jobCompatibilityAssessment, {
      basePlan,
    })
  }

  const coreRequirementSignals = extractCoreRequirementSignalsFromDescription(params.targetJobDescription)

  const targetEvidence = await classifyTargetEvidence({
    cvState: params.cvState,
    targetingPlan: basePlan,
    gapAnalysis: params.gapAnalysis,
    coreRequirementSignals,
    userId: params.userId,
    sessionId: params.sessionId,
  })
  const rewritePermissions = buildTargetedRewritePermissions(targetEvidence)
  const initialTargetRolePositioning = buildTargetRolePositioning({
    targetRole: basePlan.targetRole,
    targetEvidence,
    mustEmphasize: basePlan.mustEmphasize,
    directClaimsAllowed: rewritePermissions.directClaimsAllowed,
    careerFitEvaluation: params.careerFitEvaluation,
    matchScore: params.gapAnalysis.matchScore,
    targetRoleConfidence: basePlan.targetRoleConfidence,
  })
  const safeTargetingEmphasis = buildSafeTargetingEmphasis({
    targetEvidence,
    rewritePermissions,
    mustEmphasize: basePlan.mustEmphasize,
  })
  const coreRequirementCoverage = buildCoreRequirementCoverage({
    targetJobDescription: params.targetJobDescription,
    targetRole: basePlan.targetRole,
    targetEvidence,
    missingButCannotInvent: basePlan.missingButCannotInvent,
    targetRolePositioning: initialTargetRolePositioning,
  })
  const targetRolePositioning = buildTargetRolePositioning({
    targetRole: basePlan.targetRole,
    targetEvidence,
    mustEmphasize: basePlan.mustEmphasize,
    directClaimsAllowed: rewritePermissions.directClaimsAllowed,
    careerFitEvaluation: params.careerFitEvaluation,
    matchScore: params.gapAnalysis.matchScore,
    targetRoleConfidence: basePlan.targetRoleConfidence,
    coreRequirementCoverage,
  })
  const lowFitWarningGate = buildLowFitWarningGate({
    matchScore: params.gapAnalysis.matchScore,
    careerFitEvaluation: params.careerFitEvaluation,
    targetEvidence,
    targetRolePositioning,
    coreRequirementCoverage,
    targetRoleConfidence: basePlan.targetRoleConfidence,
  })

  return {
    ...basePlan,
    targetEvidence,
    rewritePermissions,
    safeTargetingEmphasis,
    coreRequirementCoverage,
    lowFitWarningGate,
    targetRolePositioning,
  }
}

function extractTargetRole(targetJobDescription: string): { targetRole: string; confidence: 'high' | 'medium' | 'low' } {
  const shapedTargetJob = shapeTargetJobDescription(targetJobDescription).content
  const lines = shapedTargetJob
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const explicitRoleLine = lines.find((line) =>
    /^(cargo|position|role|vaga|titulo|title)\s*:/i.test(line),
  )
  if (explicitRoleLine) {
    const explicitRole = cleanExtractedRole(explicitRoleLine.replace(/^[^:]+:\s*/i, '').trim())
    if (!isWeakTargetRole(explicitRole)) {
      return { targetRole: explicitRole, confidence: 'high' }
    }
  }

  const rolePattern = /\b(analytics engineer|data engineer|data analyst|business intelligence analyst|business intelligence engineer|business intelligence|product manager|analista(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|engenheir[oa](?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|desenvolvedor(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|cientista(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|gerente(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|coordenador(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|consultor(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|designer(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|arquiteto(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|devops|sre|qa|especialista(?:\s+(?:em|de)\s+[a-z0-9+/&.-]+){0,3})\b[^,\n|]*/i
  const candidateLines = lines.filter((line) => !isSectionHeading(line))

  for (const line of candidateLines) {
    const roleMatch = line.match(rolePattern)
    const matchedRole = roleMatch?.[0] ? cleanExtractedRole(roleMatch[0]) : ''
    if (matchedRole && !isWeakTargetRole(matchedRole)) {
      return { targetRole: matchedRole, confidence: 'high' }
    }
  }

  const shortRoleLikeLine = candidateLines
    .map((line) => cleanExtractedRole(line))
    .find((line) =>
      !isWeakTargetRole(line)
      && !isAnnouncementLine(line)
      && lineHasRoleSignal(line)
      && line.split(/\s+/).length <= 6,
    )

  if (shortRoleLikeLine) {
    return { targetRole: shortRoleLikeLine, confidence: 'high' }
  }

  return {
    targetRole: FALLBACK_TARGET_ROLE,
    confidence: 'low',
  }
}

function stripMarkdownFences(rawText: string): string {
  const trimmed = rawText.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenceMatch?.[1]?.trim() ?? trimmed
}

function extractJsonCandidate(rawText: string): string | null {
  const stripped = stripMarkdownFences(rawText)

  let startIndex = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < stripped.length; index += 1) {
    const char = stripped[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (startIndex === -1) {
        startIndex = index
      }
      depth += 1
      continue
    }

    if (char === '}' && startIndex !== -1) {
      depth -= 1
      if (depth === 0) {
        return stripped.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

async function extractTargetRoleWithLLM(
  targetJobDescription: string,
  context?: {
    userId?: string
    sessionId?: string
  },
): Promise<{ targetRole: string; confidence: 'high' | 'medium' | 'low' }> {
  const shapedTargetJobDescription = shapeTargetJobDescription(targetJobDescription)

  try {
    const response = await callOpenAIWithRetry(
      (signal) => openai.chat.completions.create({
        model: MODEL_CONFIG.structuredModel,
        max_completion_tokens: TARGET_ROLE_EXTRACTION_MAX_COMPLETION_TOKENS,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a job posting analyst.
Given a job description, identify the target job title.

Rules:
- Return ONLY a valid JSON object with the shape { "targetRole": string, "confidence": "high" | "medium" | "low" }
- "high": the title is stated explicitly in the posting
- "medium": the title is strongly implied by responsibilities, tools, and seniority signals
- "low": you cannot determine the role confidently
- Do not invent a role
- If confidence is "low", set targetRole to "Unknown Role"
- Return the role name in the same language as the job description
- Be concise: "Engenheiro de Dados", "Product Manager", "UX Designer"`,
          },
          {
            role: 'user',
            content: shapedTargetJobDescription.content,
          },
        ],
      }, { signal }),
      3,
      AGENT_CONFIG.timeout,
      undefined,
      {
        operation: 'target_role_extraction',
        workflowMode: 'job_targeting',
        stage: 'target_role_extraction',
        model: MODEL_CONFIG.structuredModel,
        sessionId: context?.sessionId,
        userId: context?.userId,
      },
    )

    const usage = getChatCompletionUsage(response)
    if (context?.userId && context?.sessionId) {
      trackApiUsage({
        userId: context.userId,
        sessionId: context.sessionId,
        model: MODEL_CONFIG.structuredModel,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        endpoint: 'rewriter',
      }).catch(() => {})
    }

    const rawText = getChatCompletionText(response)
    const jsonCandidate = extractJsonCandidate(rawText) ?? stripMarkdownFences(rawText)
    const parsed = JSON.parse(jsonCandidate) as {
      targetRole?: unknown
      confidence?: unknown
    }
    const targetRole = typeof parsed.targetRole === 'string'
      ? cleanExtractedRole(parsed.targetRole).trim()
      : ''

    if (
      targetRole
      && ['high', 'medium', 'low'].includes(parsed.confidence as string)
      && !isWeakTargetRole(targetRole)
    ) {
      return {
        targetRole,
        confidence: parsed.confidence as 'high' | 'medium' | 'low',
      }
    }
  } catch {
    // Fall through to low-confidence fallback.
  }

  return { targetRole: UNKNOWN_TARGET_ROLE, confidence: 'low' }
}

function takeRelevant(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const normalized = normalizeWhitespace(value)
      if (seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
    .slice(0, MAX_TARGETING_PLAN_ITEMS)
}

type BuildTargetingPlanParams = {
  cvState: CVState
  targetJobDescription: string
  gapAnalysis: GapAnalysisResult
  jobCompatibilityAssessment?: JobCompatibilityAssessment
  userId?: string
  sessionId?: string
}

export type BuildTargetedRewritePlanInput = BuildTargetingPlanParams & {
  mode: 'job_targeting'
  rewriteIntent: 'targeted_rewrite'
  careerFitEvaluation?: import('@/types/agent').CareerFitEvaluation
}

async function buildBaseTargetingPlan(params: BuildTargetingPlanParams): Promise<TargetingPlan> {
  const { cvState, targetJobDescription, gapAnalysis } = params
  const heuristic = extractTargetRole(targetJobDescription)

  let extractedRole: { targetRole: string; confidence: 'high' | 'medium' | 'low' }
  let targetRoleSource: TargetingPlan['targetRoleSource']

  if (params.jobCompatibilityAssessment) {
    extractedRole = {
      targetRole: params.jobCompatibilityAssessment.targetRole,
      confidence: params.jobCompatibilityAssessment.targetRoleConfidence,
    }
    targetRoleSource = params.jobCompatibilityAssessment.targetRoleSource
  } else if (heuristic.confidence === 'high') {
    extractedRole = heuristic
    targetRoleSource = 'heuristic'
  } else {
    const llmExtraction = await extractTargetRoleWithLLM(targetJobDescription, {
      userId: params.userId,
      sessionId: params.sessionId,
    })

    if (llmExtraction.confidence !== 'low') {
      extractedRole = llmExtraction
      targetRoleSource = 'llm'
    } else {
      extractedRole = { targetRole: FALLBACK_TARGET_ROLE, confidence: 'low' }
      targetRoleSource = 'fallback'
    }
  }

  const targetRole = toTitleCase(extractedRole.targetRole)
  const focusKeywords = takeRelevant(extractSemanticSignals(targetJobDescription))
  const normalizedJobText = normalizeWhitespace(shapeTargetJobDescription(targetJobDescription).content)

  const mustEmphasize = takeRelevant([
    ...cvState.skills.filter((skill) =>
      normalizedJobText.includes(normalizeWhitespace(skill)) || matchesSemanticSignal(skill, focusKeywords),
    ),
    ...cvState.experience
      .flatMap((entry) => [entry.title, ...entry.bullets])
      .filter((value) =>
        normalizedJobText.includes(normalizeWhitespace(value)) || matchesSemanticSignal(value, focusKeywords),
      ),
  ])

  const shouldDeemphasize = takeRelevant(
    cvState.skills.filter((skill) =>
      !normalizedJobText.includes(normalizeWhitespace(skill)) && !matchesSemanticSignal(skill, focusKeywords),
    ),
  )

  const missingButCannotInvent = takeRelevant(gapAnalysis.missingSkills)
  const roleAwareSummaryInstruction = extractedRole.confidence !== 'low'
    ? `Posicione o candidato para ${targetRole} sem alegar experiência não comprovada.`
    : 'Use os requisitos, responsabilidades e stack da vaga como âncora sem forçar um cargo-alvo literal não confiável.'

  return {
    targetRole,
    targetRoleConfidence: extractedRole.confidence,
    targetRoleSource,
    focusKeywords,
    mustEmphasize,
    shouldDeemphasize,
    missingButCannotInvent,
    sectionStrategy: {
      summary: [
        roleAwareSummaryInstruction,
        mustEmphasize.length > 0
          ? `Priorize ${mustEmphasize.join(', ')} quando houver suporte factual.`
          : focusKeywords.length > 0
            ? `Priorize os sinais semânticos da vaga já presentes no currículo, como ${focusKeywords.join(', ')}.`
            : 'Priorize termos e contextos da vaga que já aparecem no currículo.',
        missingButCannotInvent.length > 0
          ? `Não esconda gaps como ${missingButCannotInvent.join(', ')}.`
          : 'Evite parecer um encaixe perfeito quando houver lacunas reais.',
      ],
      experience: [
        'Reordene a narrativa dos bullets para destacar contexto, stack e impacto mais próximos da vaga.',
        'Mantenha empresas, cargos, datas e escopo factual intactos.',
        shouldDeemphasize.length > 0
          ? `Reduza ênfase em ${shouldDeemphasize.join(', ')} quando não forem centrais para a vaga.`
          : 'Remova redundancias e preserve apenas o que ajuda na leitura ATS.',
      ],
      skills: [
        mustEmphasize.length > 0
          ? `Suba para o topo skills aderentes como ${mustEmphasize.join(', ')}.`
          : focusKeywords.length > 0
            ? `Ordene skills pela relevância semântica da vaga, como ${focusKeywords.join(', ')}.`
            : 'Ordene skills pela relevância para a vaga.',
        'Não adicione skills ausentes do currículo original.',
      ],
      education: [
        'Mantenha formação totalmente factual.',
        'Apenas padronize formato e leitura ATS.',
      ],
      certifications: [
        'Destaque certificações mais próximas da vaga, mantendo nomes, emissores e anos.',
        'Não crie alinhamento artificial com certificações inexistentes.',
      ],
    },
  }
}

















