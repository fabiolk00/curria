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

export async function analyzeGap(
  cvState: CVState,
  targetJobDescription: string,
  userId: string,
  sessionId: string,
  externalSignal?: AbortSignal,
): Promise<GapAnalysisExecutionResult> {
  try {
    const response = await callOpenAIWithRetry(
      (signal) => openai.chat.completions.create({
        model: MODEL_CONFIG.structured,
        max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Compare the provided canonical resume JSON against the target job description.
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
- improvementSuggestions must be concise, actionable resume improvements`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              cvState,
              targetJobDescription,
            }),
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
      endpoint: 'gap_analysis',
    }).catch(() => {})

    const responseText = getChatCompletionText(response)
    const result = parseGapAnalysis(responseText)

    if (!result) {
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


