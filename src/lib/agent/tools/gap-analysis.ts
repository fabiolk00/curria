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
}

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

function parseGapAnalysis(rawText: string): GapAnalysisResult | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  const result = GapAnalysisResultSchema.safeParse(parsed)
  return result.success ? result.data : null
}

async function requestGapAnalysis(
  cvState: CVState,
  targetJobDescription: string,
  externalSignal?: AbortSignal,
  promptOverride?: string,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return callOpenAIWithRetry(
    (signal) => openai.chat.completions.create({
      model: MODEL_CONFIG.structuredModel,
      max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
      response_format: { type: 'json_object' },
      messages: promptOverride
        ? [
            {
              role: 'system',
              content: promptOverride,
            },
            {
              role: 'user',
              content: JSON.stringify({
                cvState,
                targetJobDescription,
              }),
            },
          ]
        : [
            {
              role: 'system',
              content: GAP_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: JSON.stringify({
                cvState,
                targetJobDescription,
              }),
          },
        ],
    }, { signal }) as Promise<OpenAI.Chat.Completions.ChatCompletion>,
    3,
    AGENT_CONFIG.timeout,
    externalSignal,
  )
}

async function tryRepairGapAnalysis(
  cvState: CVState,
  targetJobDescription: string,
  invalidResponseText: string,
  externalSignal?: AbortSignal,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const repairPrompt = GAP_ANALYSIS_REPAIR_PROMPT
    .replace('{{INPUTS}}', JSON.stringify({ cvState, targetJobDescription }, null, 2))
    .replace('{{INVALID_RESPONSE}}', invalidResponseText)

  return requestGapAnalysis(cvState, targetJobDescription, externalSignal, repairPrompt)
}

export async function analyzeGap(
  cvState: CVState,
  targetJobDescription: string,
  userId: string,
  sessionId: string,
  externalSignal?: AbortSignal,
): Promise<GapAnalysisExecutionResult> {
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
        }
      }

      return {
        output: toolFailure(TOOL_ERROR_CODES.LLM_INVALID_OUTPUT, 'Invalid gap analysis payload.'),
      }
    }

    return {
      output: {
        success: true,
        result,
      },
      result,
    }
  } catch (error) {
    return {
      output: toolFailureFromUnknown(error, 'Failed to analyze resume gap.'),
    }
  }
}
