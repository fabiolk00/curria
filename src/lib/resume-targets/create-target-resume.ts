import { MODEL_CONFIG, AGENT_CONFIG } from '@/lib/agent/config'
import { TOOL_ERROR_CODES, toolFailure, toolFailureFromUnknown } from '@/lib/agent/tool-errors'
import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { CVStateSchema } from '@/lib/cv/schema'
import { createResumeTarget } from '@/lib/db/resume-targets'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import type { ResumeTarget, ToolFailure } from '@/types/agent'
import type { CVState, GapAnalysisResult } from '@/types/cv'

type CreateTargetResumeResult =
  | {
      success: true
      target: ResumeTarget
      gapAnalysis?: GapAnalysisResult
    }
  | ToolFailure

type DerivedTargetResumeResult =
  | {
      success: true
      derivedCvState: CVState
      gapAnalysis: GapAnalysisResult
    }
  | ToolFailure

function parseDerivedCvState(rawText: string): CVState | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  const result = CVStateSchema.safeParse(parsed)
  return result.success ? result.data : null
}

function normalizeAtsText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return trimmed
  }

  return trimmed
    .replace(/\t+/g, ' ')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeDerivedCvStateForAts(cvState: CVState): CVState {
  return {
    ...cvState,
    fullName: normalizeAtsText(cvState.fullName) ?? cvState.fullName,
    email: normalizeAtsText(cvState.email) ?? cvState.email,
    phone: normalizeAtsText(cvState.phone) ?? cvState.phone,
    linkedin: normalizeAtsText(cvState.linkedin),
    location: normalizeAtsText(cvState.location),
    summary: normalizeAtsText(cvState.summary) ?? cvState.summary,
    skills: cvState.skills.map((skill) => normalizeAtsText(skill) ?? skill),
    experience: cvState.experience.map((entry) => ({
      ...entry,
      title: normalizeAtsText(entry.title) ?? entry.title,
      company: normalizeAtsText(entry.company) ?? entry.company,
      location: normalizeAtsText(entry.location),
      bullets: entry.bullets.map((bullet) => normalizeAtsText(bullet) ?? bullet),
    })),
    education: cvState.education.map((entry) => ({
      ...entry,
      degree: normalizeAtsText(entry.degree) ?? entry.degree,
      institution: normalizeAtsText(entry.institution) ?? entry.institution,
      gpa: normalizeAtsText(entry.gpa),
    })),
    certifications: cvState.certifications?.map((entry) => ({
      ...entry,
      name: normalizeAtsText(entry.name) ?? entry.name,
      issuer: normalizeAtsText(entry.issuer) ?? entry.issuer,
    })),
  }
}

function hasObviousAtsArtifacts(cvState: CVState): boolean {
  const values: Array<string | undefined> = [
    cvState.summary,
    ...cvState.skills,
    ...cvState.experience.flatMap((entry) => [
      entry.title,
      entry.company,
      entry.location,
      ...entry.bullets,
    ]),
    ...cvState.education.flatMap((entry) => [
      entry.degree,
      entry.institution,
      entry.gpa,
    ]),
    ...(cvState.certifications?.flatMap((entry) => [entry.name, entry.issuer]) ?? []),
  ]

  return values.some((value) => Boolean(value && /[|\t]/.test(value)))
}

function isMateriallyDifferent(baseCvState: CVState, derivedCvState: CVState): boolean {
  return JSON.stringify(baseCvState) !== JSON.stringify(derivedCvState)
}

function buildTargetResumeSystemPrompt(retryReason?: string): string {
  return `Create a target-specific resume variant from the canonical base resume.
Output valid JSON matching this exact CV state shape:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "linkedin"?: string,
  "location"?: string,
  "summary": string,
  "experience": Array<{
    "title": string,
    "company": string,
    "location"?: string,
    "startDate": string,
    "endDate": string | "present",
    "bullets": string[]
  }>,
  "skills": string[],
  "education": Array<{
    "degree": string,
    "institution": string,
    "year": string,
    "gpa"?: string
  }>,
  "certifications"?: Array<{
    "name": string,
    "issuer": string,
    "year"?: string
  }>
}
Rules:
- preserve factual accuracy from the base resume
- optimize emphasis, ordering, and wording for the target job description
- materially improve ATS readability when the base resume contains layout artifacts, placeholders, or weak wording
- remove table-style separators such as "|" and tabs from summary, skills, and bullet points
- prefer concise plain-text resume language over raw data dumps
- do not invent companies, dates, degrees, certifications, or metrics
- if the output is in Portuguese, use Brazilian Portuguese (pt-BR) with correct accentuation, spelling, grammar, and natural resume wording
- never use European Portuguese variants unless explicitly requested
${retryReason ? `- IMPORTANT: ${retryReason}` : ''}`
}

async function requestDerivedTargetResume(input: {
  sessionId: string
  userId: string
  baseCvState: CVState
  targetJobDescription: string
  gapAnalysis: GapAnalysisResult
  externalSignal?: AbortSignal
  retryReason?: string
}): Promise<{
  derivedCvState: CVState | null
  inputTokens: number
  outputTokens: number
}> {
  const response = await callOpenAIWithRetry(
    (signal) => openai.chat.completions.create({
      model: MODEL_CONFIG.structuredModel,
      max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildTargetResumeSystemPrompt(input.retryReason),
        },
        {
          role: 'user',
          content: JSON.stringify({
            baseCvState: input.baseCvState,
            targetJobDescription: input.targetJobDescription,
            gapAnalysis: input.gapAnalysis,
          }),
        },
      ],
    }, { signal }),
    3,
    AGENT_CONFIG.timeout,
    input.externalSignal,
  )

  const usage = getChatCompletionUsage(response)
  const responseText = getChatCompletionText(response)

  return {
    derivedCvState: parseDerivedCvState(responseText),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  }
}

export async function deriveTargetResumeCvState(input: {
  sessionId: string
  userId: string
  baseCvState: CVState
  targetJobDescription: string
  externalSignal?: AbortSignal
}): Promise<DerivedTargetResumeResult> {
  try {
    const gapAnalysisExecution = await analyzeGap(
      input.baseCvState,
      input.targetJobDescription,
      input.userId,
      input.sessionId,
      input.externalSignal,
    )

    if (!gapAnalysisExecution.result) {
      return gapAnalysisExecution.output.success
        ? toolFailure(TOOL_ERROR_CODES.INTERNAL_ERROR, 'Gap analysis did not return a validated result.')
        : gapAnalysisExecution.output
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0

    const initialAttempt = await requestDerivedTargetResume({
      ...input,
      gapAnalysis: gapAnalysisExecution.result,
    })
    totalInputTokens += initialAttempt.inputTokens
    totalOutputTokens += initialAttempt.outputTokens

    let derivedCvState = initialAttempt.derivedCvState
      ? normalizeDerivedCvStateForAts(initialAttempt.derivedCvState)
      : null

    const needsRetry = !derivedCvState
      || !isMateriallyDifferent(input.baseCvState, derivedCvState)
      || hasObviousAtsArtifacts(derivedCvState)

    if (needsRetry) {
      const retryAttempt = await requestDerivedTargetResume({
        ...input,
        gapAnalysis: gapAnalysisExecution.result,
        retryReason: 'Your previous output stayed too close to the base resume. Return a materially improved ATS-ready variant that reflects the target vacancy and removes layout artifacts.',
      })
      totalInputTokens += retryAttempt.inputTokens
      totalOutputTokens += retryAttempt.outputTokens

      const retriedCvState = retryAttempt.derivedCvState
        ? normalizeDerivedCvStateForAts(retryAttempt.derivedCvState)
        : null

      if (retriedCvState) {
        derivedCvState = retriedCvState
      }
    }

    trackApiUsage({
      userId: input.userId,
      sessionId: input.sessionId,
      model: MODEL_CONFIG.structuredModel,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      endpoint: 'target_resume',
    }).catch(() => {})

    if (!derivedCvState) {
      return toolFailure(TOOL_ERROR_CODES.LLM_INVALID_OUTPUT, 'Invalid target resume payload.')
    }

    return {
      success: true,
      derivedCvState,
      gapAnalysis: gapAnalysisExecution.result,
    }
  } catch (error) {
    return toolFailureFromUnknown(error, 'Failed to create target resume.')
  }
}

export async function createTargetResumeVariant(input: {
  sessionId: string
  userId: string
  baseCvState: CVState
  targetJobDescription: string
  externalSignal?: AbortSignal
}): Promise<CreateTargetResumeResult> {
  try {
    const derivation = await deriveTargetResumeCvState(input)
    if (!derivation.success) {
      return derivation
    }

    const target = await createResumeTarget({
      sessionId: input.sessionId,
      userId: input.userId,
      targetJobDescription: input.targetJobDescription,
      derivedCvState: derivation.derivedCvState,
      gapAnalysis: derivation.gapAnalysis,
    })

    return {
      success: true,
      target,
      gapAnalysis: derivation.gapAnalysis,
    }
  } catch (error) {
    return toolFailureFromUnknown(error, 'Failed to create target resume.')
  }
}
