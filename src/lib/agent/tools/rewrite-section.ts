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

function validateRewritePayload(
  section: RewriteSectionInput['section'],
  rawText: string,
): ValidatedRewritePayload | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  switch (section) {
    case 'summary': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.string(),
      }).safeParse(parsed)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'skills': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(z.string()),
      }).safeParse(parsed)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'experience': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(ExperienceEntrySchema),
      }).safeParse(parsed)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'education': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(EducationEntrySchema),
      }).safeParse(parsed)

      return result.success
        ? { ...result.data, section }
        : null
    }

    case 'certifications': {
      const result = RewritePayloadBaseSchema.extend({
        section_data: z.array(CertificationEntrySchema),
      }).safeParse(parsed)

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
        model: MODEL_CONFIG.structured,
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
      model: MODEL_CONFIG.structured,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      endpoint: 'rewriter',
    }).catch(() => {})

    const text = getChatCompletionText(response)
    const validatedPayload = validateRewritePayload(input.section, text)

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


