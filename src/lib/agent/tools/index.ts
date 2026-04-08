import type OpenAI from 'openai'

import { scoreATS } from '@/lib/ats/score'
import {
  getResumeTargetForSession,
  updateResumeTargetGeneratedOutput,
} from '@/lib/db/resume-targets'
import {
  applyToolPatchWithVersion,
  mergeToolPatch,
} from '@/lib/db/sessions'
import { isToolFailure, TOOL_ERROR_CODES, toolFailure, toolFailureFromUnknown } from '@/lib/agent/tool-errors'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import { createTargetResumeVariant } from '@/lib/resume-targets/create-target-resume'
import type {
  ApplyGapActionInput,
  AnalyzeGapInput,
  CVVersionSource,
  CreateTargetResumeInput,
  GenerateFileInput,
  ParseFileInput,
  RewriteSectionInput,
  ScoreATSInput,
  Session,
  SetPhaseInput,
  ToolPatch,
  ToolFailure,
} from '@/types/agent'

import { generateFile } from './generate-file'
import { applyGapAction } from './gap-to-action'
import { analyzeGap } from './gap-analysis'
import { parseFile } from './parse-file'
import { ingestResumeText } from './resume-ingestion'
import { rewriteSection } from './rewrite-section'
import { TOOL_INPUT_SCHEMAS } from './schemas'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'

type OpenAITool = OpenAI.Chat.Completions.ChatCompletionTool

export const TOOL_DEFINITIONS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'parse_file',
      description: 'Extract text from an uploaded resume file (PDF, DOCX, or image).',
      parameters: {
        type: 'object',
        properties: {
          file_base64: { type: 'string', description: 'Base64-encoded file content' },
          mime_type: {
            type: 'string',
            enum: [
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'image/png',
              'image/jpeg',
            ],
          },
        },
        required: ['file_base64', 'mime_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_ats',
      description: 'Score a resume for ATS compatibility and return section-level feedback.',
      parameters: {
        type: 'object',
        properties: {
          resume_text: { type: 'string' },
          job_description: { type: 'string', description: 'Optional - improves keyword analysis' },
        },
        required: ['resume_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_gap',
      description: 'Analyze the gap between the canonical resume and a target job description.',
      parameters: {
        type: 'object',
        properties: {
          target_job_description: { type: 'string' },
        },
        required: ['target_job_description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_gap_action',
      description: 'Turn one structured gap-analysis item into a targeted canonical rewrite action.',
      parameters: {
        type: 'object',
        properties: {
          item_type: { type: 'string', enum: ['missing_skill', 'weak_area', 'suggestion'] },
          item_value: { type: 'string' },
        },
        required: ['item_type', 'item_value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rewrite_section',
      description: 'Rewrite a specific resume section to improve ATS score and impact.',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', enum: ['summary', 'experience', 'skills', 'education', 'certifications'] },
          current_content: { type: 'string' },
          instructions: { type: 'string' },
          target_keywords: { type: 'array', items: { type: 'string' } },
        },
        required: ['section', 'current_content', 'instructions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_target_resume',
      description: 'Create a target-specific resume variant without overwriting the canonical base resume.',
      parameters: {
        type: 'object',
        properties: {
          target_job_description: { type: 'string' },
        },
        required: ['target_job_description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_phase',
      description: 'Advance the conversation to the next phase of the agent.',
      parameters: {
        type: 'object',
        properties: {
          phase: { type: 'string', enum: ['intake', 'analysis', 'dialog', 'confirm', 'generation'] },
          reason: { type: 'string' },
        },
        required: ['phase'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_file',
      description: 'Generate the final ATS-optimized DOCX and PDF files for download.',
      parameters: {
        type: 'object',
        properties: {
          cv_state: { type: 'object', description: 'Final structured resume data' },
          target_id: { type: 'string', description: 'Optional target resume id to generate from a derived variant' },
        },
        required: ['cv_state'],
      },
    },
  },
]

export type ToolExecutionResult = {
  output: unknown
  patch?: ToolPatch
}

export type DispatchedToolResult = {
  output: unknown
  outputJson: string
  persistedPatch?: ToolPatch
  outputFailure?: ToolFailure
}

function isCvStateEmpty(cvState: Session['cvState']): boolean {
  return (
    cvState.fullName.trim().length === 0 &&
    cvState.email.trim().length === 0 &&
    cvState.phone.trim().length === 0 &&
    (cvState.linkedin?.trim().length ?? 0) === 0 &&
    (cvState.location?.trim().length ?? 0) === 0 &&
    cvState.summary.trim().length === 0 &&
    cvState.experience.length === 0 &&
    cvState.skills.length === 0 &&
    cvState.education.length === 0 &&
    (cvState.certifications?.length ?? 0) === 0
  )
}

function didCvStateChange(previousCvState: Session['cvState'], nextCvState: Session['cvState']): boolean {
  return JSON.stringify(previousCvState) !== JSON.stringify(nextCvState)
}

function resolveCvVersionSource(
  toolName: string,
  previousCvState: Session['cvState'],
  nextCvState: Session['cvState'],
  execution: ToolExecutionResult,
): CVVersionSource | undefined {
  if (!execution.patch?.cvState || !didCvStateChange(previousCvState, nextCvState)) {
    return undefined
  }

  if (toolName === 'parse_file' && isCvStateEmpty(previousCvState)) {
    return 'ingestion'
  }

  if (toolName === 'rewrite_section' || toolName === 'apply_gap_action') {
    return 'rewrite'
  }

  return undefined
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  session: Session,
  externalSignal?: AbortSignal,
): Promise<ToolExecutionResult> {
  // Validate tool input against its Zod schema before dispatching
  const schema = TOOL_INPUT_SCHEMAS[toolName]
  if (schema) {
    const parsed = schema.safeParse(toolInput)
    if (!parsed.success) {
      return {
        output: toolFailure(
          TOOL_ERROR_CODES.VALIDATION_ERROR,
          `Invalid input for ${toolName}: ${parsed.error.issues.map(i => i.message).join(', ')}`,
        ),
      }
    }
  }

  switch (toolName) {
    case 'parse_file': {
      const result = await parseFile(
        toolInput as ParseFileInput,
        session.userId,
        session.id,
        externalSignal,
      )

      if (!result.success) {
        return {
          output: result,
          patch: {
            agentState: {
              parseStatus: 'failed',
              parseError: result.error,
            },
          },
        }
      }

      const ingestionResult = await ingestResumeText(
        result.text,
        session.cvState,
        session.userId,
        session.id,
        externalSignal,
      )

      const agentStatePatch = {
        parseStatus: 'parsed' as const,
        parseError: undefined,
        sourceResumeText: result.text,
        parseConfidenceScore: ingestionResult.confidenceScore,
      }

      return {
        output: result,
        patch: ingestionResult.patch
          ? {
              ...ingestionResult.patch,
              agentState: agentStatePatch,
            }
          : {
              agentState: agentStatePatch,
            },
      }
    }

    case 'score_ats': {
      const { resume_text, job_description } = toolInput as ScoreATSInput
      const result = scoreATS(resume_text, job_description)

      return {
        output: { success: true, result },
        patch: {
          atsScore: result,
          agentState: job_description
            ? {
                targetJobDescription: job_description,
                ...(session.agentState.gapAnalysis ? { gapAnalysis: undefined } : {}),
                ...(session.agentState.targetFitAssessment ? { targetFitAssessment: undefined } : {}),
              }
            : undefined,
        },
      }
    }

    case 'analyze_gap': {
      const { target_job_description } = toolInput as AnalyzeGapInput
      const result = await analyzeGap(
        session.cvState,
        target_job_description,
        session.userId,
        session.id,
        externalSignal,
      )
      const analyzedAt = new Date().toISOString()

      return {
        output: result.output,
        patch: result.result
          ? {
              agentState: {
                targetJobDescription: target_job_description,
                targetFitAssessment: deriveTargetFitAssessment(
                  result.result,
                  analyzedAt,
                ),
                gapAnalysis: {
                  result: result.result,
                  analyzedAt,
                },
              },
            }
          : undefined,
      }
    }

    case 'rewrite_section':
      return rewriteSection(
        toolInput as RewriteSectionInput,
        session.userId,
        session.id,
        externalSignal,
      )

    case 'apply_gap_action':
      return applyGapAction(
        toolInput as ApplyGapActionInput,
        session,
      )

    case 'create_target_resume': {
      const { target_job_description } = toolInput as CreateTargetResumeInput
      const result = await createTargetResumeVariant({
        sessionId: session.id,
        userId: session.userId,
        baseCvState: session.cvState,
        targetJobDescription: target_job_description,
        externalSignal,
      })

      return result.success
        ? {
            output: {
              success: true,
              targetId: result.target.id,
              targetJobDescription: result.target.targetJobDescription,
              derivedCvState: result.target.derivedCvState,
              gapAnalysis: result.gapAnalysis,
            },
            patch: {
              agentState: {
                targetJobDescription: target_job_description,
                targetFitAssessment: result.gapAnalysis
                  ? deriveTargetFitAssessment(result.gapAnalysis)
                  : undefined,
              },
            },
          }
        : {
            output: result,
          }
    }

    case 'set_phase': {
      const { phase } = toolInput as SetPhaseInput

      return {
        output: { success: true, phase },
        patch: { phase },
      }
    }

    case 'generate_file': {
      const targetId = typeof toolInput.target_id === 'string' ? toolInput.target_id : undefined
      const target = targetId
        ? await getResumeTargetForSession(session.id, targetId)
        : null

      if (targetId && !target) {
        return {
          output: toolFailure(TOOL_ERROR_CODES.NOT_FOUND, 'Target resume not found.'),
        }
      }

      const result = await generateFile(
        {
          cv_state: target?.derivedCvState ?? session.cvState,
          target_id: targetId,
        } satisfies GenerateFileInput,
        session.userId,
        session.id,
        target
          ? { type: 'target', targetId: target.id }
          : { type: 'session' },
        target?.targetJobDescription ?? session.agentState,
      )

      if (target && result.generatedOutput) {
        await updateResumeTargetGeneratedOutput(session.id, target.id, result.generatedOutput)

        return {
          output: result.output,
        }
      }

      return result
    }

    default:
      return {
        output: toolFailure(TOOL_ERROR_CODES.VALIDATION_ERROR, `Unknown tool: ${toolName}`),
      }
  }
}

async function dispatchToolInternal(
  toolName: string,
  toolInput: Record<string, unknown>,
  session: Session,
  externalSignal?: AbortSignal,
): Promise<DispatchedToolResult> {
  const startedAt = Date.now()
  const previousCvState = structuredClone(session.cvState)

  try {
    logInfo('agent.tool.started', {
      sessionId: session.id,
      appUserId: session.userId,
      toolName,
      phase: session.phase,
      stateVersion: session.stateVersion,
    })

    const execution = await executeTool(toolName, toolInput, session, externalSignal)
    const outputFailure = isToolFailure(execution.output) ? execution.output : undefined
    let persistedGeneratedOutput = false
    let persistedPatch: ToolPatch | undefined

    if (execution.patch && !outputFailure) {
      const nextSession = mergeToolPatch(session, execution.patch)
      const versionSource = resolveCvVersionSource(toolName, previousCvState, nextSession.cvState, execution)
      await applyToolPatchWithVersion(session, execution.patch, versionSource)
      persistedGeneratedOutput = execution.patch.generatedOutput !== undefined
      persistedPatch = execution.patch
    }

    if (persistedGeneratedOutput) {
      logInfo('agent.tool.generated_output.persisted', {
        sessionId: session.id,
        appUserId: session.userId,
        toolName,
        phase: session.phase,
        stateVersion: session.stateVersion,
        status: session.generatedOutput.status,
        errorCode: outputFailure?.code,
        errorMessage: session.generatedOutput.error,
      })
    }

    const logFields = {
      sessionId: session.id,
      appUserId: session.userId,
      toolName,
      phase: session.phase,
      stateVersion: session.stateVersion,
      latencyMs: Date.now() - startedAt,
      success: outputFailure === undefined,
      updatedPhase: execution.patch?.phase ?? session.phase,
      touchedCvState: execution.patch?.cvState !== undefined,
      touchedAgentState: execution.patch?.agentState !== undefined,
      touchedGeneratedOutput: persistedGeneratedOutput,
      touchedAtsScore: execution.patch?.atsScore !== undefined,
      parseConfidenceScore: execution.patch?.agentState?.parseConfidenceScore,
      errorCode: outputFailure?.code,
      errorMessage: outputFailure?.error,
    }

    if (outputFailure) {
      logWarn('agent.tool.completed', logFields)
    } else {
      logInfo('agent.tool.completed', logFields)
    }

    return {
      output: execution.output,
      outputJson: JSON.stringify(execution.output),
      persistedPatch,
      outputFailure,
    }
  } catch (err) {
    const failure = toolFailureFromUnknown(err, 'Tool execution failed.')

    logError('agent.tool.failed', {
      sessionId: session.id,
      appUserId: session.userId,
      toolName,
      phase: session.phase,
      stateVersion: session.stateVersion,
      latencyMs: Date.now() - startedAt,
      success: false,
      ...serializeError(err),
      errorCode: failure.code,
      errorMessage: failure.error,
    })
    return {
      output: failure,
      outputJson: JSON.stringify(failure),
      outputFailure: failure,
    }
  }
}

export async function dispatchToolWithContext(
  toolName: string,
  toolInput: Record<string, unknown>,
  session: Session,
  externalSignal?: AbortSignal,
): Promise<DispatchedToolResult> {
  return dispatchToolInternal(toolName, toolInput, session, externalSignal)
}

export async function dispatchTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  session: Session,
  externalSignal?: AbortSignal,
): Promise<string> {
  const result = await dispatchToolInternal(toolName, toolInput, session, externalSignal)
  return result.outputJson
}
