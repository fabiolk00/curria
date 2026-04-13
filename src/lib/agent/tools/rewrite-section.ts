import { z } from 'zod'

import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
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

function normalizeStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
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

  if (!Array.isArray(record.keywords_added)) {
    record.keywords_added = []
  }

  if (!Array.isArray(record.changes_made)) {
    record.changes_made = []
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
            content: `You are an expert ATS resume writer. Rewrite the provided resume section following the instructions.
Output valid JSON matching this shape exactly:
{
  "rewritten_content": string,
  ${getSectionDataDescription(input.section)},
  "keywords_added": string[],
  "changes_made": string[]
}
Rules:
- "rewritten_content" must stay human-readable plain text for conversational display
- "section_data" must be fully structured and valid for the requested section
- preserve factual truth exactly; never invent employers, tools, certifications, metrics, projects, or achievements
- optimize for ATS parsing, recruiter clarity, strong action verbs, and natural keyword usage
- avoid keyword stuffing, empty cliches, decorative language, and exaggerated claims
- if the content is in Portuguese, use Brazilian Portuguese (pt-BR) with correct accentuation, spelling, grammar, and professional resume tone
- never use European Portuguese variants unless the user explicitly provided them`,
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
      },
      patch: buildRewritePatch(validatedPayload),
    }
  } catch (error) {
    return {
      output: toolFailureFromUnknown(error, 'Failed to rewrite resume section.'),
    }
  }
}
