import type { AgentContextActionType } from '@/lib/agent/context/types'

export function buildActionContext(actionType: AgentContextActionType): string {
  switch (actionType) {
    case 'analyze_resume':
      return `Action contract: analyze_resume.
- Evaluate the resume and identify the most important issues.
- Do not rewrite unless the action explicitly asks for rewriting.
- Prefer concise, grounded analysis over generic commentary.`
    case 'rewrite_resume_for_ats':
      return `Action contract: rewrite_resume_for_ats.
- Produce a structured ATS-focused rewrite.
- Preserve facts and improve wording, readability, and keyword visibility.
- Return structured content, not conversational filler.`
    case 'rewrite_resume_for_job_target':
      return `Action contract: rewrite_resume_for_job_target.
- Produce a structured target-role rewrite.
- Preserve facts and optimize wording, emphasis, and prioritization toward the target role.
- Return structured content, not conversational filler.`
    case 'validate_rewrite':
      return `Action contract: validate_rewrite.
- Compare rewritten content against source facts.
- Mark safe, degraded, or failed areas clearly.`
    case 'explain_changes':
      return `Action contract: explain_changes.
- Explain what changed and why.
- Reference analysis findings, rewrite intent, and selected source-of-truth explicitly.`
    case 'prepare_generation_support':
      return `Action contract: prepare_generation_support.
- Identify the authoritative snapshot for generation or artifact explanation.
- Explain source-of-truth and generated-output consistency clearly.`
    case 'chat':
      return `Action contract: chat.
- Answer conversationally and precisely.
- Do not force rewrite behavior or structured output unless the workflow and user intent require it.`
  }
}
