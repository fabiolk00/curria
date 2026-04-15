import { MAX_TARGETING_PLAN_ITEMS, shapeTargetJobDescription } from '@/lib/agent/job-targeting-retry'
import type { GapAnalysisResult, CVState } from '@/types/cv'
import type { TargetingPlan } from '@/types/agent'

const FALLBACK_TARGET_ROLE = 'Vaga Alvo'

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

  return /^(bi|vaga\s+alvo|target\s+role)$/.test(normalized)
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
  const lowerText = shapedTargetJob.toLowerCase()
  const phrasePatterns = [
    /\bpower\s+bi\b/gi,
    /\bqlik(?:\s+sense|\s+cloud)?\b/gi,
    /\bbigquery\b/gi,
    /\bdatabricks\b/gi,
    /\bdata\s+factory\b/gi,
    /\bdata\s+warehouse\b/gi,
    /\bdata\s+analytics\b/gi,
    /\bmodelagem\s+de\s+dados\b/gi,
    /\bvisualiza(?:c|ç)(?:a|ã)o\s+de\s+dados\b/gi,
    /\bpipelines?\s+de\s+dados\b/gi,
    /\borquestra(?:c|ç)(?:a|ã)o\b/gi,
    /\bpower\s+automate\b/gi,
    /\bpython\b/gi,
    /\bpyspark\b/gi,
    /\bspark\b/gi,
    /\bsql\b/gi,
    /\betl\b/gi,
    /\bazure\b/gi,
    /\bcloud\b/gi,
  ]

  const phraseMatches = phrasePatterns.flatMap((pattern) =>
    Array.from(lowerText.matchAll(pattern), (match) => match[0]),
  )

  const tokenMatches = lowerText.match(/[a-z0-9+#.]{3,}/gi) ?? []
  const stopWords = new Set([
    'para', 'com', 'uma', 'das', 'dos', 'que', 'and', 'the', 'this', 'role',
    'vaga', 'sera', 'will', 'you', 'your', 'como', 'mais', 'sobre',
    'responsabilidades', 'responsibilities', 'requisitos', 'requirements',
    'qualificacoes', 'qualifications', 'experience', 'experiencia', 'job',
    'about', 'looking', 'buscamos', 'procuramos', 'profissionais',
  ])

  return Array.from(new Set([
    ...phraseMatches,
    ...tokenMatches.filter((token) => !stopWords.has(token)),
  ]))
}

function extractTargetRole(targetJobDescription: string): { targetRole: string; confidence: 'high' | 'low' } {
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

export function buildTargetingPlan(params: {
  cvState: CVState
  targetJobDescription: string
  gapAnalysis: GapAnalysisResult
}): TargetingPlan {
  const { cvState, targetJobDescription, gapAnalysis } = params
  const extractedTargetRole = extractTargetRole(targetJobDescription)
  const targetRole = toTitleCase(extractedTargetRole.targetRole)
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
  const roleAwareSummaryInstruction = extractedTargetRole.confidence === 'high'
    ? `Posicione o candidato para ${targetRole} sem alegar experiência não comprovada.`
    : 'Use os requisitos, responsabilidades e stack da vaga como âncora sem forçar um cargo-alvo literal não confiável.'

  return {
    targetRole,
    targetRoleConfidence: extractedTargetRole.confidence,
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
