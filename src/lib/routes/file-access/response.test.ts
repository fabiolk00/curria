import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSignedResumeArtifactUrls } from '@/lib/agent/tools/generate-file'

import { toFileAccessResponse } from './response'
import type { FileAccessContext, FileAccessDecision } from './types'

vi.mock('@/lib/agent/tools/generate-file', () => ({
  createSignedResumeArtifactUrls: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

function buildContext(): FileAccessContext {
  return {
    request: new NextRequest('https://example.com/api/file/sess_1') as never,
    requestStartedAt: Date.now(),
    requestPath: '/api/file/sess_1',
    params: { sessionId: 'sess_1' },
    targetId: null,
    appUser: { id: 'usr_1' } as never,
    session: {
      id: 'sess_1',
      cvState: {
        fullName: 'Ana Silva',
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'ready', pdfPath: 'file.pdf' },
    } as never,
    target: null,
    artifactMetadata: { status: 'ready', pdfPath: 'file.pdf' },
    latestArtifactJob: null,
  }
}

describe('file-access response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not emit a real signed url for locked previews', async () => {
    const response = await toFileAccessResponse(buildContext(), {
      kind: 'locked_preview',
      body: {
        docxUrl: null,
        pdfUrl: '/api/file/sess_1/locked-preview',
        available: true,
        generationStatus: 'ready',
      },
      log: {
        generationStatus: 'ready',
        lifecycleStatus: 'completed',
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: '/api/file/sess_1/locked-preview',
      pdfFileName: 'Curriculo_Ana_Silva.pdf',
      available: true,
      generationStatus: 'ready',
    })
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('only signs urls for artifact_available decisions', async () => {
    vi.mocked(createSignedResumeArtifactUrls).mockResolvedValue({
      docxUrl: 'https://example.com/docx',
      pdfUrl: 'https://example.com/pdf',
    })

    const decision: FileAccessDecision = {
      kind: 'artifact_available',
      pdfPath: 'file.pdf',
      body: {
        docxUrl: null,
        available: true,
        generationStatus: 'ready',
      },
      log: {
        generationStatus: 'ready',
        lifecycleStatus: 'completed',
      },
    }

    const response = await toFileAccessResponse(buildContext(), decision)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      available: true,
      generationStatus: 'ready',
      pdfFileName: 'Curriculo_Ana_Silva.pdf',
      pdfUrl: 'https://example.com/pdf',
    })
    expect(createSignedResumeArtifactUrls).toHaveBeenCalledWith(undefined, 'file.pdf')
  })
})
