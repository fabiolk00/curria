import { AGENT_CONFIG } from '@/lib/agent/config'
import { isDialogRewriteRequest, isGenerationApproval, isGenerationRequest } from '@/lib/agent/agent-intents'
import { resolveWorkflowMode } from '@/lib/agent/pre-loop-setup'
import { logWarn } from '@/lib/observability/structured-log'
import { buildActionContext } from '@/lib/agent/context/actions/build-action-context'
import { buildBaseGuardrails } from '@/lib/agent/context/base/build-base-guardrails'
import { buildBaseSystemContext } from '@/lib/agent/context/base/build-base-system-context'
import { buildOutputContractContext } from '@/lib/agent/context/schemas/build-output-contract-context'
import { buildSourceContextBlocks, buildPreloadedResumeContext } from '@/lib/agent/context/sources/build-source-context'
import { describeContextComposition } from '@/lib/agent/context/debug/describe-context-composition'
import { buildWorkflowContext } from '@/lib/agent/context/workflows/build-workflow-context'
import type {
  AgentContextActionType,
  AgentContextBlock,
  AgentContextDebug,
  AgentContextResult,
  AgentContextWorkflowMode,
  BuildAgentContextInput,
} from '@/lib/agent/context/types'

function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0) return ''
  if (text.length <= maxLen) return text
  if (maxLen <= 12) return text.slice(0, maxLen)
  return `${text.slice(0, maxLen - 12)}\n[truncated]`
}

function renderSections(sections: AgentContextBlock[]): string {
  return sections
    .filter((section) => section.body.trim().length > 0)
    .map((section) => `${section.heading}\n${section.body}`)
    .join('\n\n')
}

function fitSectionsToBudget(
  input: BuildAgentContextInput,
  sections: AgentContextBlock[],
  staticLength: number,
): AgentContextBlock[] {
  const maxChars = AGENT_CONFIG.maxSystemPromptCharsByPhase[input.session.phase]
  const orderedKeys = [
    'resume_text',
    'rewrite_history',
    'analysis_snapshot',
    'career_fit_guardrail',
    'target_job',
    'optimized_resume',
    'canonical_resume',
    'generated_output',
    'profile_audit',
  ] as const

  const fittedSections = sections.map((section) => ({ ...section }))
  const truncatedSections = new Set<string>()

  const currentLength = () => staticLength + renderSections(fittedSections).length

  for (const key of orderedKeys) {
    if (currentLength() <= maxChars) {
      break
    }

    const section = fittedSections.find((candidate) => candidate.key === key)
    if (!section) continue

    const overflow = currentLength() - maxChars
    const targetLength = Math.max(section.minChars ?? 0, section.body.length - overflow)
    if (targetLength < section.body.length) {
      section.body = truncate(section.body, targetLength)
      truncatedSections.add(section.key)
    }
  }

  if (currentLength() > maxChars) {
    const lastSection = fittedSections[fittedSections.length - 1]
    if (lastSection) {
      const overflow = currentLength() - maxChars
      lastSection.body = truncate(lastSection.body, Math.max(0, lastSection.body.length - overflow))
      truncatedSections.add(lastSection.key)
    }
  }

  if (truncatedSections.size > 0) {
    logWarn('agent.context.truncated', {
      sessionId: input.session.id,
      phase: input.session.phase,
      truncatedSections: Array.from(truncatedSections).join(','),
      maxSystemPromptChars: maxChars,
    })
  }

  return fittedSections
}

function resolveContextWorkflowMode(input: BuildAgentContextInput): AgentContextWorkflowMode {
  if (input.workflowMode) {
    return input.workflowMode
  }

  const resolved = input.session.agentState.workflowMode ?? resolveWorkflowMode(input.session)
  return resolved === 'resume_review' ? 'chat_lightweight' : resolved
}

function resolveContextActionType(input: BuildAgentContextInput, workflowMode: AgentContextWorkflowMode): AgentContextActionType {
  if (input.actionType) {
    return input.actionType
  }

  const userMessage = input.userMessage ?? ''

  if (workflowMode === 'artifact_support' || input.session.phase === 'generation' || isGenerationApproval(userMessage) || isGenerationRequest(userMessage)) {
    return 'prepare_generation_support'
  }

  if (workflowMode === 'job_targeting' && isDialogRewriteRequest(userMessage)) {
    return 'rewrite_resume_for_job_target'
  }

  if (workflowMode === 'ats_enhancement' && isDialogRewriteRequest(userMessage)) {
    return 'rewrite_resume_for_ats'
  }

  if (input.session.phase === 'analysis') {
    return 'analyze_resume'
  }

  if (input.session.agentState.optimizedCvState && (input.session.phase === 'dialog' || input.session.phase === 'confirm')) {
    return 'explain_changes'
  }

  return 'chat'
}

export function buildAgentContext(input: BuildAgentContextInput): AgentContextResult {
  const workflowMode = resolveContextWorkflowMode(input)
  const actionType = resolveContextActionType(input, workflowMode)
  const workflowContext = buildWorkflowContext(workflowMode)
  const actionContext = buildActionContext(actionType)
  const outputContract = buildOutputContractContext(actionType)
  const sourceContext = buildSourceContextBlocks({
    session: input.session,
    actionType,
    workflowMode,
    resumeTarget: input.resumeTarget,
    generatedOutputOverride: input.generatedOutputOverride,
  })

  const dynamicSections: AgentContextBlock[] = [
    { key: 'workflow_rules', heading: '## Workflow Rules', body: workflowContext, minChars: 120 },
    { key: 'action_contract', heading: '## Action Contract', body: actionContext, minChars: 100 },
    ...sourceContext.blocks,
  ]

  if (outputContract) {
    dynamicSections.push({
      key: 'output_contract',
      heading: '## Output Contract',
      body: outputContract,
      minChars: 100,
    })
  }

  const staticParts = [buildBaseSystemContext(), buildBaseGuardrails()].join('\n\n')
  const fittedSections = fitSectionsToBudget(input, dynamicSections, staticParts.length + 4)

  const debug: AgentContextDebug = {
    workflowMode,
    actionType,
    sessionPhase: input.session.phase,
    selectedSnapshotSource: sourceContext.selectedSnapshotSource,
    includedBlocks: fittedSections.map((section) => section.key),
    includesTargetJob: fittedSections.some((section) => section.key === 'target_job'),
    includesOptimizedCvState: fittedSections.some((section) => section.key === 'optimized_resume'),
    includesGeneratedOutput: fittedSections.some((section) => section.key === 'generated_output'),
    includesValidation: fittedSections.some((section) => section.key === 'validation_snapshot'),
    includesOutputSchema: Boolean(outputContract),
  }

  return {
    systemPrompt: [
      buildBaseSystemContext(),
      renderSections(fittedSections),
      buildBaseGuardrails(),
    ].filter(Boolean).join('\n\n'),
    debug,
  }
}

export {
  buildPreloadedResumeContext,
  describeContextComposition,
}

export type {
  AgentContextActionType,
  AgentContextDebug,
  AgentContextResult,
  AgentContextWorkflowMode,
  BuildAgentContextInput,
}
