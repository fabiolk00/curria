import type { AgentContextActionType } from '@/lib/agent/context/types'

export function buildOutputContractContext(actionType: AgentContextActionType): string {
  switch (actionType) {
    case 'rewrite_resume_for_ats':
    case 'rewrite_resume_for_job_target':
      return `Output contract:
- Use a structured resume output with explicit section handling.
- Each major section should be rewritten, preserved, or failed explicitly.
- Do not answer with freeform assistant prose when a rewrite is requested.`
    case 'analyze_resume':
      return `Output contract:
- Return grounded analysis focused on strengths, risks, gaps, and next steps.
- Keep it concise and structured enough to explain the reasoning.`
    case 'validate_rewrite':
      return `Output contract:
- Return a structured validation result with validity status and issue list.`
    default:
      return ''
  }
}
