import { MODEL_CONFIG } from '@/lib/agent/config'

type AgentReleaseSource =
  | 'vercel_commit'
  | 'vercel_ref'
  | 'vercel_env'
  | 'local_dev'

export type AgentReleaseMetadata = {
  releaseId: string
  releaseSource: AgentReleaseSource
  commitShortSha?: string
  releaseRef?: string
  deploymentEnv: string
  resolvedAgentModel: string
  resolvedDialogModel: string
}

function sanitizeCommitSha(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()

  if (!normalized || !/^[0-9a-f]{7,40}$/.test(normalized)) {
    return undefined
  }

  return normalized
}

function sanitizeRef(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return undefined
  }

  return normalized
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/\/+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || undefined
}

function sanitizeDeploymentEnv(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return 'development'
  }

  return normalized
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'development'
}

export function getAgentReleaseMetadata(): AgentReleaseMetadata {
  const commitSha = sanitizeCommitSha(process.env.VERCEL_GIT_COMMIT_SHA)
  const releaseRef = sanitizeRef(process.env.VERCEL_GIT_COMMIT_REF)
  const deploymentEnv = sanitizeDeploymentEnv(process.env.VERCEL_ENV)
  const commitShortSha = commitSha?.slice(0, 12)

  if (commitShortSha) {
    return {
      releaseId: commitShortSha,
      releaseSource: 'vercel_commit',
      commitShortSha,
      releaseRef,
      deploymentEnv,
      resolvedAgentModel: MODEL_CONFIG.agentModel,
      resolvedDialogModel: MODEL_CONFIG.dialogModel,
    }
  }

  if (releaseRef) {
    return {
      releaseId: `${deploymentEnv}-${releaseRef}`.slice(0, 64),
      releaseSource: 'vercel_ref',
      releaseRef,
      deploymentEnv,
      resolvedAgentModel: MODEL_CONFIG.agentModel,
      resolvedDialogModel: MODEL_CONFIG.dialogModel,
    }
  }

  if (process.env.VERCEL_ENV?.trim()) {
    return {
      releaseId: `vercel-${deploymentEnv}`,
      releaseSource: 'vercel_env',
      deploymentEnv,
      resolvedAgentModel: MODEL_CONFIG.agentModel,
      resolvedDialogModel: MODEL_CONFIG.dialogModel,
    }
  }

  return {
    releaseId: 'local-dev',
    releaseSource: 'local_dev',
    deploymentEnv: 'development',
    resolvedAgentModel: MODEL_CONFIG.agentModel,
    resolvedDialogModel: MODEL_CONFIG.dialogModel,
  }
}
