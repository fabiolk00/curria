import type OpenAI from 'openai'

import { MODEL_CONFIG, AGENT_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { GapAnalysisResultSchema } from '@/lib/cv/schema'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import { TOOL_ERROR_CODES, toolFailure, toolFailureFromUnknown } from '@/lib/agent/tool-errors'
import type { AnalyzeGapOutput } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

type GapAnalysisExecutionResult = {
  output: AnalyzeGapOutput
  result?: GapAnalysisResult
  repairAttempted: boolean
}

const GAP_ANALYSIS_MAX_COMPLETION_TOKENS = 600
const GAP_ANALYSIS_REPAIR_MAX_COMPLETION_TOKENS = 400
const GAP_ANALYSIS_MAX_REPAIR_RESPONSE_CHARS = 1_200
const GAP_ANALYSIS_MAX_EXPERIENCE_ENTRIES = 4
const GAP_ANALYSIS_MAX_EXPERIENCE_BULLETS = 3
const GAP_ANALYSIS_MAX_EDUCATION_ENTRIES = 2
const GAP_ANALYSIS_MAX_CERTIFICATION_ENTRIES = 2
const GAP_ANALYSIS_MAX_SKILLS = 18

const GAP_ANALYSIS_SYSTEM_PROMPT = `Compare the provided canonical resume JSON against the target job description.
Output valid JSON matching this exact shape:
{
  "matchScore": number,
  "missingSkills": string[],
  "weakAreas": string[],
  "improvementSuggestions": string[]
}
Rules:
- matchScore must be between 0 and 100
- missingSkills must contain concrete missing or underrepresented skills
- weakAreas must describe resume sections or competency gaps, not raw prose
- improvementSuggestions must be concise, actionable resume improvements`

type GapAnalysisInput = {
  resume: {
    fullName: string
    email?: string
    phone?: string
    linkedin?: string
    location?: string
    summary: string
    skills: string[]
    experience: Array<{
      title: string
      company: string
      location?: string
      startDate: string
      endDate: string | 'present'
      bullets: string[]
    }>
    education: Array<{
      degree: string
      institution: string
      year: string
      gpa?: string
    }>
    certifications?: Array<{
      name: string
      issuer: string
      year?: string
    }>
  }
  targetJobDescription: string
}

const GAP_ANALYSIS_REPAIR_PROMPT = `The previous gap analysis response was invalid.
Return only valid JSON matching the exact shape below, with no markdown, no code fences, and no extra keys:
{
  "matchScore": number,
  "missingSkills": string[],
  "weakAreas": string[],
  "improvementSuggestions": string[]
}

Original inputs:
{{INPUTS}}

Invalid response:
{{INVALID_RESPONSE}}`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function normalizeScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampScore(value)
  }

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/%$/, '')
    const parsed = Number.parseFloat(cleaned)
    if (Number.isFinite(parsed)) {
      return clampScore(parsed)
    }
  }

  return null
}

function normalizeStringList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)

    return items.length > 0 ? items : []
  }

  if (typeof value === 'string') {
    const items = value
      .replace(/\r\n/g, '\n')
      .split(/[\n,;•|]/u)
      .map((item) => item.replace(/^[\s*-]+/u, '').trim())
      .filter((item) => item.length > 0)

    return items.length > 0 ? items : []
  }

  return null
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

  for (let index = 0; index < stripped.length; index++) {
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
      depth++
      continue
    }

    if (char === '}' && startIndex !== -1) {
      depth--
      if (depth === 0) {
        return stripped.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function coerceGapAnalysisResult(parsed: unknown): unknown {
  const candidate = isRecord(parsed) && isRecord(parsed.result)
    ? parsed.result
    : parsed

  if (!isRecord(candidate)) {
    return parsed
  }

  const normalized: Record<string, unknown> = { ...candidate }
  const matchScore = normalizeScore(candidate.matchScore ?? candidate.score ?? candidate.match_score)
  const missingSkills = normalizeStringList(candidate.missingSkills ?? candidate.missing_skills ?? candidate.missingSkillsList)
  const weakAreas = normalizeStringList(candidate.weakAreas ?? candidate.weak_areas ?? candidate.weaknesses)
  const improvementSuggestions = normalizeStringList(
    candidate.improvementSuggestions
    ?? candidate.improvement_suggestions
    ?? candidate.suggestions,
  )

  if (matchScore !== null) {
    normalized.matchScore = matchScore
  }

  if (missingSkills !== null) {
    normalized.missingSkills = missingSkills
  }

  if (weakAreas !== null) {
    normalized.weakAreas = weakAreas
  }

  if (improvementSuggestions !== null) {
    normalized.improvementSuggestions = improvementSuggestions
  }

  return normalized
}

function parseGapAnalysis(rawText: string): GapAnalysisResult | null {
  const candidateText = extractJsonCandidate(rawText) ?? rawText.trim()
  if (!candidateText) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(candidateText)
  } catch {
    return null
  }

  const result = GapAnalysisResultSchema.safeParse(coerceGapAnalysisResult(parsed))
  return result.success ? result.data : null
}

function truncateForPrompt(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }

  return `${text.slice(0, maxChars - 15)}\n[truncated]`
}

function compactGapAnalysisInput(cvState: CVState, targetJobDescription: string): GapAnalysisInput {
  return {
    resume: {
      fullName: cvState.fullName,
      email: cvState.email,
      phone: cvState.phone,
      linkedin: cvState.linkedin,
      location: cvState.location,
      summary: cvState.summary,
      skills: cvState.skills.slice(0, GAP_ANALYSIS_MAX_SKILLS),
      experience: cvState.experience.slice(0, GAP_ANALYSIS_MAX_EXPERIENCE_ENTRIES).map((experience) => ({
        title: experience.title,
        company: experience.company,
        location: experience.location,
        startDate: experience.startDate,
        endDate: experience.endDate,
        bullets: experience.bullets.slice(0, GAP_ANALYSIS_MAX_EXPERIENCE_BULLETS),
      })),
      education: cvState.education.slice(0, GAP_ANALYSIS_MAX_EDUCATION_ENTRIES).map((education) => ({
        degree: education.degree,
        institution: education.institution,
        year: education.year,
        gpa: education.gpa,
      })),
      certifications: cvState.certifications?.slice(0, GAP_ANALYSIS_MAX_CERTIFICATION_ENTRIES).map((certification) => ({
        name: certification.name,
        issuer: certification.issuer,
        year: certification.year,
      })),
    },
    targetJobDescription,
  }
}

async function requestGapAnalysis(
  cvState: CVState,
  targetJobDescription: string,
  externalSignal?: AbortSignal,
  promptOverride?: string,
  maxCompletionTokens = GAP_ANALYSIS_MAX_COMPLETION_TOKENS,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const inputPayload = JSON.stringify(compactGapAnalysisInput(cvState, targetJobDescription))

  return callOpenAIWithRetry(
    (signal) => openai.chat.completions.create({
      model: MODEL_CONFIG.structuredModel,
      max_completion_tokens: maxCompletionTokens,
      response_format: { type: 'json_object' },
      messages: promptOverride
        ? [
            {
              role: 'system',
              content: promptOverride,
            },
            {
              role: 'user',
              content: inputPayload,
            },
          ]
        : [
            {
              role: 'system',
              content: GAP_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: inputPayload,
            },
        ],
    }, { signal }) as Promise<OpenAI.Chat.Completions.ChatCompletion>,
    3,
    AGENT_CONFIG.timeout,
    externalSignal,
    {
      operation: 'gap_analysis',
      stage: promptOverride ? 'repair' : 'initial',
      model: MODEL_CONFIG.structuredModel,
    },
  )
}

async function tryRepairGapAnalysis(
  cvState: CVState,
  targetJobDescription: string,
  invalidResponseText: string,
  externalSignal?: AbortSignal,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const compactInput = compactGapAnalysisInput(cvState, targetJobDescription)
  const repairPrompt = GAP_ANALYSIS_REPAIR_PROMPT
    .replace('{{INPUTS}}', JSON.stringify(compactInput, null, 2))
    .replace('{{INVALID_RESPONSE}}', truncateForPrompt(invalidResponseText, GAP_ANALYSIS_MAX_REPAIR_RESPONSE_CHARS))

  return requestGapAnalysis(
    cvState,
    targetJobDescription,
    externalSignal,
    repairPrompt,
    GAP_ANALYSIS_REPAIR_MAX_COMPLETION_TOKENS,
  )
}

export async function analyzeGap(
  cvState: CVState,
  targetJobDescription: string,
  userId: string,
  sessionId: string,
  externalSignal?: AbortSignal,
): Promise<GapAnalysisExecutionResult> {
  let repairAttempted = false

  try {
    const response = await requestGapAnalysis(cvState, targetJobDescription, externalSignal)

    const usage = getChatCompletionUsage(response)
    trackApiUsage({
      userId,
      sessionId,
      model: MODEL_CONFIG.structuredModel,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      endpoint: 'gap_analysis',
    }).catch(() => {})

    const responseText = getChatCompletionText(response)
    const result = parseGapAnalysis(responseText)

    if (!result) {
      repairAttempted = true
      const repairResponse = await tryRepairGapAnalysis(
        cvState,
        targetJobDescription,
        responseText,
        externalSignal,
      )

      const repairUsage = getChatCompletionUsage(repairResponse)
      trackApiUsage({
        userId,
        sessionId,
        model: MODEL_CONFIG.structuredModel,
        inputTokens: repairUsage.inputTokens,
        outputTokens: repairUsage.outputTokens,
        endpoint: 'gap_analysis',
      }).catch(() => {})

      const repairResult = parseGapAnalysis(getChatCompletionText(repairResponse))
      if (repairResult) {
        return {
          output: {
            success: true,
            result: repairResult,
          },
          result: repairResult,
          repairAttempted,
        }
      }

      return {
        output: toolFailure(TOOL_ERROR_CODES.LLM_INVALID_OUTPUT, 'Invalid gap analysis payload.'),
        repairAttempted,
      }
    }

    return {
      output: {
        success: true,
        result,
      },
      result,
      repairAttempted,
    }
  } catch (error) {
    return {
      output: toolFailureFromUnknown(error, 'Failed to analyze resume gap.'),
      repairAttempted,
    }
  }
}
