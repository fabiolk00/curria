import { z } from 'zod'

import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { formatResumeRewriteGuardrails } from '@/lib/agent/tools/resume-rewrite-guidelines'
import { TOOL_ERROR_CODES, toolFailure, toolFailureFromUnknown } from '@/lib/agent/tool-errors'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import type {
  CertificationEntry,
  CVState,
  EducationEntry,
  ExperienceEntry,
} from '@/types/cv'
import type {
  RewriteSectionInput,
  RewriteSectionOutput,
  RewriteClaimTraceItem,
  ToolPatch,
} from '@/types/agent'

type RewriteSectionExecutionResult = {
  output: RewriteSectionOutput
  patch?: ToolPatch
}

type RewritePayloadBase = {
  rewritten_content: string
  keywords_added: string[]
  changes_made: string[]
  claim_trace_items?: RewriteClaimTraceItem[]
}

type ValidatedRewritePayload =
  | (RewritePayloadBase & { section: 'summary'; section_data: string })
  | (RewritePayloadBase & { section: 'skills'; section_data: string[] })
  | (RewritePayloadBase & { section: 'experience'; section_data: ExperienceEntry[] })
  | (RewritePayloadBase & { section: 'education'; section_data: EducationEntry[] })
  | (RewritePayloadBase & { section: 'certifications'; section_data: CertificationEntry[] })

const RewritePayloadBaseSchema = z.object({
  rewritten_content: z.string(),
  keywords_added: z.array(z.string()),
  changes_made: z.array(z.string()),
  claim_trace_items: z.array(z.object({
    targetPath: z.string(),
    source: z.enum(['preserved_original', 'formatting_only', 'new_generated_text']),
    usedClaimPolicyIds: z.array(z.string()),
    expressedSignals: z.array(z.string()),
    evidenceBasis: z.array(z.string()),
    permissionLevel: z.enum(['allowed', 'cautious', 'preserved_original', 'formatting_only']),
    rationale: z.string().optional(),
  })).optional(),
})

const ExperienceEntrySchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.union([z.string(), z.literal('present')]),
  bullets: z.array(z.string()),
})

const EducationEntrySchema = z.object({
  degree: z.string(),
  institution: z.string(),
  year: z.string(),
  gpa: z.string().optional(),
})

const CertificationEntrySchema = z.object({
  name: z.string(),
  issuer: z.string(),
  year: z.string().optional(),
})

function normalizeStringList(value: unknown, maxItems?: number): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = value
    .flatMap((item) => typeof item === 'string' ? item : [])
    .map((item) => item.trim())
    .filter(Boolean)

  return typeof maxItems === 'number'
    ? normalized.slice(0, maxItems)
    : normalized
}

function normalizeStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeSummaryComparisonText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripSummarySectionLabel(value: string): string {
  return value.replace(
    /^(?:[-*•\s]*)(?:resumo profissional|professional summary|summary|resumo)\s*[:\-–]\s*/iu,
    '',
  )
}

function sanitizeSummaryText(value: string): string {
  const stripped = stripSummarySectionLabel(value.trim())

  if (!stripped) {
    return ''
  }

  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    return stripped.replace(/\s+/g, ' ').trim()
  }

  const seen = new Set<string>()
  const deduped = sentences.reduce<Array<{ original: string; normalized: string }>>((acc, sentence) => {
    const normalized = normalizeSummaryComparisonText(sentence)

    if (!normalized || seen.has(normalized)) {
      return acc
    }

    const overlappingIndex = acc.findIndex((entry) =>
      normalized.startsWith(entry.normalized) || entry.normalized.startsWith(normalized),
    )

    if (overlappingIndex >= 0) {
      const existing = acc[overlappingIndex]
      acc[overlappingIndex] = normalized.length >= existing.normalized.length
        ? { original: sentence, normalized }
        : existing
      seen.add(normalized)
      return acc
    }

    seen.add(normalized)
    acc.push({ original: sentence, normalized })
    return acc
  }, [])

  return deduped.map((entry) => entry.original).join(' ').replace(/\s+/g, ' ').trim()
}

function sanitizeSummaryWithFallback(value: string, fallbackValue: string): string {
  const sanitized = sanitizeSummaryText(value)
  if (sanitized) {
    return sanitized
  }

  return sanitizeSummaryText(fallbackValue)
}

function normalizeBullets(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.replace(/^[\-\u2022]\s*/, '').trim())
      .filter(Boolean)
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .flatMap((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const candidate = [
          record.text,
          record.description,
          record.content,
          record.bullet,
        ].find((entry) => typeof entry === 'string')

        return typeof candidate === 'string' ? candidate : []
      }

      return []
    })
    .map((bullet) => bullet.trim())
    .filter(Boolean)
}

function extractStructuredTextContent(value: string): string | null {
  const parsed = extractJsonLikeObject(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const record = parsed as Record<string, unknown>
  const itemTexts = Array.isArray(record.items)
    ? record.items
        .flatMap((item) => {
          if (typeof item === 'string') {
            return item
          }

          if (!item || typeof item !== 'object') {
            return []
          }

          const itemRecord = item as Record<string, unknown>
          const content = [itemRecord.content, itemRecord.text, itemRecord.profile]
            .find((candidate) => typeof candidate === 'string')

          return typeof content === 'string' ? content : []
        })
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    : []

  if (itemTexts.length > 0) {
    return itemTexts.join(' ')
  }

  if (typeof record.content === 'string' && record.content.trim()) {
    return record.content.replace(/\s+/g, ' ').trim()
  }

  if (typeof record.profile === 'string' && record.profile.trim()) {
    return record.profile.replace(/\s+/g, ' ').trim()
  }

  if (typeof record.rewritten_content === 'string' && record.rewritten_content.trim() !== value.trim()) {
    return record.rewritten_content.replace(/\s+/g, ' ').trim()
  }

  return null
}

function parseCurrentExperienceEntries(rawContent: string): ExperienceEntry[] {
  const parsed = extractJsonLikeObject(rawContent)
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is ExperienceEntry => Boolean(entry && typeof entry === 'object'))
    : []
}

function normalizeExperienceEntry(
  entry: unknown,
  fallback?: Partial<ExperienceEntry>,
): ExperienceEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const record = entry as Record<string, unknown>
  const currentValue = Boolean(record.current) || record.endDate === 'Atual'

  return {
    title: normalizeStringValue(record.title ?? record.role ?? record.position ?? record.jobTitle ?? fallback?.title),
    company: normalizeStringValue(record.company ?? record.employer ?? record.companyName ?? record.organization ?? fallback?.company),
    location: normalizeStringValue(record.location ?? record.city ?? fallback?.location) || undefined,
    startDate: normalizeStringValue(record.startDate ?? record.start ?? record.start_date ?? fallback?.startDate),
    endDate: normalizeStringValue(
      record.endDate
      ?? record.end
      ?? record.end_date
      ?? (currentValue ? 'present' : fallback?.endDate),
    ) || (currentValue ? 'present' : ''),
    bullets: normalizeBullets(
      record.bullets
      ?? record.achievements
      ?? record.highlights
      ?? record.responsibilities
      ?? record.description
      ?? fallback?.bullets,
    ),
  }
}

function normalizeExperienceSectionData(
  value: unknown,
  currentContent: string,
): ExperienceEntry[] | unknown {
  const fallbackEntries = parseCurrentExperienceEntries(currentContent)

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => normalizeExperienceEntry(entry, fallbackEntries[index]))
      .filter((entry): entry is ExperienceEntry => entry !== null)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const nestedEntries = record.experience ?? record.experiences ?? record.items ?? record.entries

    if (Array.isArray(nestedEntries)) {
      return nestedEntries
        .map((entry, index) => normalizeExperienceEntry(entry, fallbackEntries[index]))
        .filter((entry): entry is ExperienceEntry => entry !== null)
    }
  }

  return value
}

function getSectionDataDescription(section: RewriteSectionInput['section']): string {
  switch (section) {
    case 'summary':
      return '"section_data": string'
    case 'skills':
      return '"section_data": string[]'
    case 'experience':
      return `"section_data": Array<{
  "title": string,
  "company": string,
  "location"?: string,
  "startDate": string,
  "endDate": string | "present",
  "bullets": string[]
}>`
    case 'education':
      return `"section_data": Array<{
  "degree": string,
  "institution": string,
  "year": string,
  "gpa"?: string
}>`
    case 'certifications':
      return `"section_data": Array<{
  "name": string,
  "issuer": string,
  "year"?: string
}>`
  }
}

function buildSectionPromptInstructions(section: RewriteSectionInput['section']): string[] {
  switch (section) {
    case 'summary':
      return [
        'Resumo Profissional: 4 a 6 linhas, destacando perfil real, senioridade e diferencial sem buzzwords genéricos.',
        'Resumo Profissional: não inclua rótulos internos como "Resumo Profissional:" ou "Professional Summary:" dentro do conteúdo.',
        'Resumo Profissional: use tom executivo, conciso e não repetitivo, sem repetir papel, domínio ou stack de forma inflada.',
      ]
    case 'skills':
      return [
        'Habilidades Técnicas: preserve todas as ferramentas concretas e nunca substitua tecnologias específicas por rótulos vagos.',
      ]
    case 'experience':
      return [
        'Experiência: mantenha ferramentas, métricas, senioridade, escopo e contexto de negócio em cada bullet.',
        'Experiência: preserve percentuais, reduções de tempo, economia, throughput, SLA, volumes e impacto regional/global sempre que forem reais.',
        'Experiência: escreva bullets concisos com estrutura de ação + contexto + impacto quando houver suporte factual no original.',
      ]
    case 'education':
      return [
        'Educação: preserve instituições, grau e datas com consistência de formatação.',
      ]
    case 'certifications':
      return [
        'Certificações: preserve nome, emissor e ano sem simplificar ou generalizar.',
      ]
  }
}

function buildRewriteSystemPrompt(section: RewriteSectionInput['section']): string {
  return `Você é um especialista sênior em currículos otimizados para ATS, com foco em posições técnicas (Engenharia de Dados, BI, Desenvolvimento etc.).

Sempre aplique todas as guardrails antes de qualquer alteração. Se tiver dúvida entre preservar ou melhorar, priorize preservar.

Siga rigorosamente estas regras na ordem de prioridade:

REGRA DE OURO (nunca viole):
- Melhore clareza, impacto e compatibilidade com ATS SEM NUNCA piorar o currículo ou perder informação relevante. Preservar especificidade técnica, métricas, ferramentas, escopo e senioridade tem prioridade absoluta.

Regras obrigatórias:
- Preserve todos os detalhes técnicos, ferramentas específicas, responsabilidades, contexto de negócio, senioridade e conquistas.
- Mantenha TODAS as métricas reais. Nunca omita, suavize ou generalize números.
- Trate bullets com percentuais, ganhos, reduções, volumes, SLA, throughput, escopo regional/global e resultados mensuráveis como evidência premium.
- Nunca troque um bullet quantificado por um bullet genérico. Se reescrever, preserve ou melhore o mesmo valor factual.
- Não encurte, funda ou remova bullets/seções se isso causar perda de especificidade técnica, métrica, sinal de senioridade ou contexto relevante.
- Se sua versão ficar menos detalhada, menos técnica ou menos impactante que o original, revise até ficar pelo menos tão forte quanto o original.
- Use verbos de ação fortes no início de cada bullet (Desenvolvi, Otimizei, Liderei, Implementei, Gerenciei, etc.).
- Prefira estrutura: Verbo forte + o que foi feito (com ferramentas e escopo) + resultado/impacto/propósito.
- Mantenha senso crítico: melhore redação sem exagerar, inflar ou esconder gaps. Nunca invente nada.

Estrutura de saída (JSON exato):
{
  "rewritten_content": "texto legível para exibição humana",
  ${getSectionDataDescription(section)},
  "keywords_added": ["lista", "de", "keywords", "adicionadas"],
  "changes_made": ["lista curta e factual de melhorias reais"]
}

Regras de saída:
- "rewritten_content" deve ser legível, natural e próprio para exibição humana
- "section_data" deve ser totalmente estruturado e válido para a seção solicitada
- "keywords_added" deve listar apenas keywords realmente adicionadas ou enfatizadas
- "changes_made" deve listar no máximo 7 melhorias curtas, factuais e reais

Instruções adicionais por seção:
${buildSectionPromptInstructions(section).map((item) => `- ${item}`).join('\n')}

Contrato compartilhado de reescrita a aplicar rigorosamente:
${formatResumeRewriteGuardrails()}

Claim-policy trace contract when requested:
- Include "claim_trace_items" only when input.claim_policy_trace_contract.required=true.
- For new factual text, choose usedClaimPolicyIds before writing the line.
- expressedSignals must be copied from selected claimPolicy.signal values.
- If no claimPolicyId applies, preserve the original text or mark the item as formatting_only without adding any new tool, role, certification, seniority, education, or domain claim.

Idioma:
- Use português brasileiro (pt-BR) profissional, objetivo e confiante.
- Mantenha nomes próprios de ferramentas e termos técnicos em inglês quando esse for o uso correto (Azure Databricks, PySpark, Qlik Sense, Medallion, etc.).
- Evite linguagem de marketing inflada, buzzwords vazios e traduções artificiais de termos técnicos.`
}

function extractJsonLikeObject(rawText: string): unknown {
  const trimmed = rawText.trim()

  const candidates = [
    trimmed,
    trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, ''),
  ]

  const firstBraceIndex = trimmed.indexOf('{')
  const lastBraceIndex = trimmed.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    candidates.push(trimmed.slice(firstBraceIndex, lastBraceIndex + 1))
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      continue
    }
  }

  return null
}

function normalizeRewritePayload(
  section: RewriteSectionInput['section'],
  parsed: unknown,
  currentContent: string,
): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed
  }

  const record = { ...(parsed as Record<string, unknown>) }

  record.keywords_added = normalizeStringList(record.keywords_added)
  record.changes_made = normalizeStringList(record.changes_made, 7)
  if (Array.isArray(record.claim_trace_items)) {
    const validTraceSources = new Set(['preserved_original', 'formatting_only', 'new_generated_text'])
    const validPermissionLevels = new Set(['allowed', 'cautious', 'preserved_original', 'formatting_only'])
    record.claim_trace_items = record.claim_trace_items
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const traceItem = item as Record<string, unknown>
        const source = normalizeStringValue(traceItem.source)
        const permissionLevel = normalizeStringValue(traceItem.permissionLevel)

        return {
          targetPath: normalizeStringValue(traceItem.targetPath),
          source,
          usedClaimPolicyIds: normalizeStringList(traceItem.usedClaimPolicyIds),
          expressedSignals: normalizeStringList(traceItem.expressedSignals),
          evidenceBasis: normalizeStringList(traceItem.evidenceBasis),
          permissionLevel,
          rationale: normalizeStringValue(traceItem.rationale) || undefined,
        }
      })
      .filter((item) => (
        item.targetPath
        && validTraceSources.has(item.source)
        && validPermissionLevels.has(item.permissionLevel)
      ))

    if ((record.claim_trace_items as unknown[]).length === 0) {
      delete record.claim_trace_items
    }
  }

  if (section === 'summary') {
    if (typeof record.section_data !== 'string') {
      if (typeof record.rewritten_content === 'string') {
        record.section_data = record.rewritten_content
      } else if (typeof record.summary === 'string') {
        record.section_data = record.summary
      }
    }

    if (typeof record.rewritten_content !== 'string' && typeof record.section_data === 'string') {
      record.rewritten_content = record.section_data
    }

    if (typeof record.section_data === 'string') {
      const normalizedSummary = extractStructuredTextContent(record.section_data)
      if (normalizedSummary) {
        record.section_data = normalizedSummary
      }

      record.section_data = sanitizeSummaryWithFallback(record.section_data as string, currentContent)
    }

    if (typeof record.rewritten_content === 'string') {
      const normalizedRewrittenContent = extractStructuredTextContent(record.rewritten_content)
      if (normalizedRewrittenContent) {
        record.rewritten_content = normalizedRewrittenContent
      }

      record.rewritten_content = sanitizeSummaryWithFallback(record.rewritten_content as string, currentContent)
    }
  }

  if (section === 'experience') {
    if (record.section_data === undefined) {
      record.section_data = record.experience ?? record.experiences ?? record.items ?? record.entries
    }

    record.section_data = normalizeExperienceSectionData(record.section_data, currentContent)

    if (typeof record.rewritten_content !== 'string' && Array.isArray(record.section_data)) {
      record.rewritten_content = record.section_data
        .map((entry) => {
          const title = entry?.title?.trim()
          const company = entry?.company?.trim()
          const bullets: string[] = Array.isArray(entry?.bullets) ? entry.bullets.filter(Boolean) : []
          return [
            [title, company].filter(Boolean).join(' - '),
            ...bullets.map((bullet) => `- ${bullet}`),
          ].filter(Boolean).join('\n')
        })
        .filter(Boolean)
        .join('\n\n')
    }
  }

  return record
}

function validateRewritePayload(
  section: RewriteSectionInput['section'],
  rawText: string,
  currentContent: string,
): ValidatedRewritePayload | null {
  const parsed = extractJsonLikeObject(rawText)
  if (parsed === null) {
    return null
  }

  const normalizedPayload = normalizeRewritePayload(section, parsed, currentContent)

  switch (section) {
    case 'summary': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.string(),
      }).safeParse(normalizedPayload)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'skills': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(z.string()),
      }).safeParse(normalizedPayload)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'experience': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(ExperienceEntrySchema),
      }).safeParse(normalizedPayload)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'education': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(EducationEntrySchema),
      }).safeParse(normalizedPayload)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'certifications': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(CertificationEntrySchema),
      }).safeParse(normalizedPayload)

      return result.success
        ? { ...result.data, section }
        : null
    }
  }
}

function buildCvStatePatch(payload: ValidatedRewritePayload): Partial<CVState> {
  switch (payload.section) {
    case 'summary':
      return { summary: payload.section_data }
    case 'skills':
      return { skills: payload.section_data }
    case 'experience':
      return { experience: payload.section_data }
    case 'education':
      return { education: payload.section_data }
    case 'certifications':
      return { certifications: payload.section_data }
  }
}

function buildRewritePatch(payload: ValidatedRewritePayload): ToolPatch {
  const updatedAt = new Date().toISOString()

  return {
    cvState: buildCvStatePatch(payload),
    agentState: {
      rewriteHistory: {
        [payload.section]: {
          rewrittenContent: payload.rewritten_content,
          keywordsAdded: payload.keywords_added,
          changesMade: payload.changes_made,
          updatedAt,
        },
      },
    },
  }
}

export async function rewriteSection(
  input: RewriteSectionInput,
  userId: string,
  sessionId: string,
  externalSignal?: AbortSignal,
): Promise<RewriteSectionExecutionResult> {
  try {
    const response = await callOpenAIWithRetry(
      (signal) => openai.chat.completions.create({
        model: MODEL_CONFIG.structuredModel,
        max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildRewriteSystemPrompt(input.section),
          },
          {
            role: 'user',
            content: JSON.stringify(input),
          },
        ],
      }, { signal }),
      3,
      AGENT_CONFIG.timeout,
      externalSignal,
      {
        operation: 'rewrite_section',
        stage: input.section,
        model: MODEL_CONFIG.structuredModel,
        sessionId,
        userId,
      },
    )

    const usage = getChatCompletionUsage(response)
    trackApiUsage({
      userId,
      sessionId,
      model: MODEL_CONFIG.structuredModel,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      endpoint: 'rewriter',
    }).catch(() => {})

    const text = getChatCompletionText(response)
    const validatedPayload = validateRewritePayload(input.section, text, input.current_content)

    if (!validatedPayload) {
      return {
        output: toolFailure(
          TOOL_ERROR_CODES.LLM_INVALID_OUTPUT,
          `Invalid rewrite payload for section "${input.section}".`,
        ),
      }
    }

    return {
      output: {
        success: true,
        rewritten_content: validatedPayload.rewritten_content,
        section_data: validatedPayload.section_data,
        keywords_added: validatedPayload.keywords_added,
        changes_made: validatedPayload.changes_made,
        ...(validatedPayload.claim_trace_items === undefined
          ? {}
          : { claim_trace_items: validatedPayload.claim_trace_items }),
      },
      patch: buildRewritePatch(validatedPayload),
    }
  } catch (error) {
    return {
      output: toolFailureFromUnknown(error, 'Failed to rewrite resume section.'),
    }
  }
}
