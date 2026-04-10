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

export async function createTargetResumeVariant(input: {
  sessionId: string
  userId: string
  baseCvState: CVState
  targetJobDescription: string
  externalSignal?: AbortSignal
}): Promise<CreateTargetResumeResult> {
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

    const response = await callOpenAIWithRetry(
      (signal) => openai.chat.completions.create({
        model: MODEL_CONFIG.structuredModel,
        max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Create a target-specific resume variant from the canonical base resume.
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
- do not invent companies, dates, degrees, certifications, or metrics
- if the output is in Portuguese, use Brazilian Portuguese (pt-BR) with correct accentuation, spelling, grammar, and natural resume wording
- never use European Portuguese variants unless explicitly requested`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              baseCvState: input.baseCvState,
              targetJobDescription: input.targetJobDescription,
              gapAnalysis: gapAnalysisExecution.result,
            }),
          },
        ],
      }, { signal }),
      3,
      AGENT_CONFIG.timeout,
      input.externalSignal,
    )

    const usage = getChatCompletionUsage(response)
    trackApiUsage({
      userId: input.userId,
      sessionId: input.sessionId,
      model: MODEL_CONFIG.structuredModel,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      endpoint: 'target_resume',
    }).catch(() => {})

    const responseText = getChatCompletionText(response)
    const derivedCvState = parseDerivedCvState(responseText)

    if (!derivedCvState) {
      return toolFailure(TOOL_ERROR_CODES.LLM_INVALID_OUTPUT, 'Invalid target resume payload.')
    }

    const target = await createResumeTarget({
      sessionId: input.sessionId,
      userId: input.userId,
      targetJobDescription: input.targetJobDescription,
      derivedCvState,
      gapAnalysis: gapAnalysisExecution.result,
    })

    return {
      success: true,
      target,
      gapAnalysis: gapAnalysisExecution.result,
    }
  } catch (error) {
    return toolFailureFromUnknown(error, 'Failed to create target resume.')
  }
}

