import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function loadReleaseMetadataModule() {
  vi.resetModules()
  return import('./release-metadata')
}

describe('getAgentReleaseMetadata', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('prefers the Vercel commit SHA and exposes the resolved model contract', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12'
    process.env.VERCEL_GIT_COMMIT_REF = 'feature/dialog-fix'
    process.env.VERCEL_ENV = 'preview'
    process.env.OPENAI_AGENT_MODEL = 'gpt-5-mini'
    process.env.OPENAI_DIALOG_MODEL = 'gpt-5.4-mini'

    const { getAgentReleaseMetadata } = await loadReleaseMetadataModule()
    const metadata = getAgentReleaseMetadata()

    expect(metadata).toMatchObject({
      releaseId: 'abcdef123456',
      releaseSource: 'vercel_commit',
      commitShortSha: 'abcdef123456',
      releaseRef: 'feature-dialog-fix',
      deploymentEnv: 'preview',
      resolvedAgentModel: 'gpt-5-mini',
      resolvedDialogModel: 'gpt-5.4-mini',
    })
  })

  it('falls back to local-dev when no Vercel metadata exists', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.VERCEL_GIT_COMMIT_REF
    delete process.env.VERCEL_ENV
    delete process.env.OPENAI_AGENT_MODEL
    delete process.env.OPENAI_DIALOG_MODEL

    const { getAgentReleaseMetadata } = await loadReleaseMetadataModule()
    const metadata = getAgentReleaseMetadata()

    expect(metadata).toMatchObject({
      releaseId: 'local-dev',
      releaseSource: 'local_dev',
      deploymentEnv: 'development',
      resolvedAgentModel: 'gpt-5-mini',
      resolvedDialogModel: 'gpt-5-mini',
    })
    expect(metadata.commitShortSha).toBeUndefined()
    expect(metadata.releaseRef).toBeUndefined()
  })
})
