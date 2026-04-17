import type { AgentContextWorkflowMode } from '@/lib/agent/context/types'

export function buildWorkflowContext(workflowMode: AgentContextWorkflowMode): string {
  switch (workflowMode) {
    case 'ats_enhancement':
      return `Workflow: ATS enhancement.
- No target job is available.
- Improve the whole resume for general ATS performance.
- Preserve facts while improving clarity, structure, keyword visibility, and consistency.
- If rewriting, every section must be rewritten or explicitly preserved.`
    case 'job_targeting':
      return `Workflow: job targeting.
- A target role or vacancy is available.
- Adapt emphasis, wording, and prioritization toward the role without inventing experience.
- The target role influences optimization, but factual truth remains primary.
- If rewriting, every section must be rewritten or explicitly preserved.`
    case 'artifact_support':
      return `Workflow: artifact support.
- Explain or prepare generation using the correct source snapshot.
- Be explicit about which resume snapshot is authoritative.
- Avoid ambiguity between original, optimized, and target-derived content.`
    case 'resume_review':
    case 'chat_lightweight':
      return `Workflow: lightweight chat.
- Stay fast, cheap, and helpful.
- Avoid heavy rewrite behavior unless the current action explicitly requires it.
- Use only the minimum context needed to answer well.`
  }
}
