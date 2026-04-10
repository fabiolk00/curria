import type { Page, Route } from '@playwright/test'

import type { SessionWorkspace } from '../../../src/types/dashboard'
import type { CVState } from '../../../src/types/cv'
import type { AgentStreamChunk } from '../../../src/types/agent'
import { buildSsePayload } from '../helpers/sse'

type SessionMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

type FileResponse = {
  available?: boolean
  pdfUrl: string | null
  docxUrl?: string | null
}

type ProfileResponse = {
  profile: {
    id: string
    source: string
    cvState: CVState
    profilePhotoUrl: string | null
    createdAt: string
    updatedAt: string
    extractedAt: string
    linkedinUrl: string | null
  } | null
}

type ApiMockOptions = {
  file?: FileResponse
  onGenerate?: (payload: { scope: 'base' } | { scope: 'target'; targetId: string }) => void | Promise<void>
  messages?: SessionMessage[]
  onProfileSave?: (payload: CVState) => void | Promise<void>
  profile?: ProfileResponse
  sessionId?: string
  streamChunks?: AgentStreamChunk[]
  workspace?: SessionWorkspace
}

const DEFAULT_ASSET_BASE_URL = 'http://127.0.0.1:3000/__e2e-assets'
const EMPTY_ASSISTANT_RESPONSE_FALLBACK =
  'Analisei sua mensagem, mas nao consegui concluir a resposta desta vez. Tente enviar novamente.'

function buildDefaultArtifactResponse(isReady: boolean): FileResponse {
  if (!isReady) {
    return {
      available: false,
      pdfUrl: null,
      docxUrl: null,
    }
  }

  return {
    available: true,
    pdfUrl: `${DEFAULT_ASSET_BASE_URL}/resume.pdf`,
    docxUrl: null,
  }
}

function jsonResponse(route: Route, payload: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

export function buildMockWorkspace(sessionId = 'sess_e2e_browser'): SessionWorkspace {
  return {
    session: {
      id: sessionId,
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Teste',
        email: 'ana@example.com',
        phone: '+55 11 99999-0000',
        linkedin: 'https://linkedin.com/in/ana-teste',
        location: 'Sao Paulo, BR',
        summary: 'Backend engineer focused on platform reliability.',
        experience: [],
        skills: ['TypeScript', 'Node.js', 'AWS'],
        education: [],
        certifications: [],
      },
      agentState: {
        parseStatus: 'parsed',
        parseConfidenceScore: 0.96,
        targetJobDescription: 'Platform engineer role',
        gapAnalysis: {
          result: {
            matchScore: 78,
            missingSkills: ['Kubernetes'],
            weakAreas: ['summary'],
            improvementSuggestions: ['Highlight Kubernetes exposure.'],
          },
          analyzedAt: '2026-04-10T12:00:00.000Z',
        },
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: `${sessionId}/resume.pdf`,
        generatedAt: '2026-04-10T12:05:00.000Z',
      },
      atsScore: {
        total: 82,
        breakdown: {
          format: 16,
          structure: 17,
          keywords: 19,
          contact: 10,
          impact: 20,
        },
        issues: [],
        suggestions: [],
      },
      messageCount: 2,
      creditConsumed: true,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:05:00.000Z',
    },
    targets: [],
  }
}

function resolveFileResponse(
  workspace: SessionWorkspace,
  targetId: string | null,
  override?: FileResponse,
): FileResponse {
  if (override) {
    return override
  }

  const generatedOutput = targetId
    ? workspace.targets.find((entry) => entry.id === targetId)?.generatedOutput
    : workspace.session.generatedOutput

  const isReady =
    generatedOutput?.status === 'ready'
    && Boolean(generatedOutput.pdfPath)

  return buildDefaultArtifactResponse(isReady)
}

function markGeneratedOutputReady(workspace: SessionWorkspace, sessionId: string): void {
  workspace.session.generatedOutput = {
    status: 'ready',
    pdfPath: `${sessionId}/resume.pdf`,
    generatedAt: '2026-04-10T12:31:00.000Z',
  }
}

export async function installCoreFunnelApiMocks(
  page: Page,
  options: ApiMockOptions = {},
): Promise<void> {
  const sessionId = options.sessionId ?? options.workspace?.session.id ?? 'sess_e2e_browser'
  const workspace = options.workspace ?? buildMockWorkspace(sessionId)
  let messages = [...(options.messages ?? [
    {
      role: 'assistant',
      content: 'Ola! Vamos revisar a vaga.',
      createdAt: '2026-04-10T12:00:00.000Z',
    },
  ])]
  let profile = options.profile ?? {
    profile: {
      id: 'profile_e2e_browser',
      source: 'manual',
      cvState: workspace.session.cvState,
      profilePhotoUrl: null,
      createdAt: '2026-04-10T11:00:00.000Z',
      updatedAt: '2026-04-10T11:00:00.000Z',
      extractedAt: '2026-04-10T11:00:00.000Z',
      linkedinUrl: workspace.session.cvState.linkedin ?? null,
    },
  }
  const streamChunks = options.streamChunks ?? [
    { type: 'sessionCreated', sessionId },
    { type: 'text', content: 'Analise iniciada. ' },
    {
      type: 'done',
      sessionId,
      phase: workspace.session.phase,
      atsScore: workspace.session.atsScore,
      messageCount: workspace.session.messageCount,
      isNewSession: true,
    },
  ]

  await page.route('**/api/profile', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as CVState
      await options.onProfileSave?.(body)
      profile = {
        profile: {
          id: profile.profile?.id ?? 'profile_e2e_browser',
          source: 'manual',
          cvState: body,
          profilePhotoUrl: profile.profile?.profilePhotoUrl ?? null,
          createdAt: profile.profile?.createdAt ?? '2026-04-10T11:00:00.000Z',
          updatedAt: '2026-04-10T12:30:00.000Z',
          extractedAt: profile.profile?.extractedAt ?? '2026-04-10T11:00:00.000Z',
          linkedinUrl: body.linkedin ?? null,
        },
      }
      await jsonResponse(route, {
        profile: profile.profile,
      })
      return
    }

    await jsonResponse(route, profile)
  })

  await page.route('**/api/session/*/messages', async (route) => {
    await jsonResponse(route, { messages })
  })

  await page.route('**/api/session/*', async (route) => {
    workspace.session.messageCount = messages.length
    await jsonResponse(route, workspace)
  })

  await page.route('**/api/session/*/generate', async (route) => {
    const payload = route.request().postDataJSON() as
      | { scope: 'base' }
      | { scope: 'target'; targetId: string }

    await options.onGenerate?.(payload)

    if (payload.scope === 'base') {
      markGeneratedOutputReady(workspace, sessionId)
    }

    await jsonResponse(route, {
      success: true,
      scope: payload.scope,
      targetId: payload.scope === 'target' ? payload.targetId : undefined,
    })
  })

  await page.route('**/api/agent', async (route) => {
    const body = route.request().postDataJSON() as { message?: string } | null
    const userMessage = body?.message?.trim()

    if (userMessage) {
      messages = [
        ...messages,
        {
          role: 'user',
          content: userMessage,
          createdAt: '2026-04-10T12:30:00.000Z',
        },
      ]
    }

    const assistantContent = streamChunks
      .filter((chunk): chunk is Extract<AgentStreamChunk, { type: 'text' }> => chunk.type === 'text')
      .map((chunk) => chunk.content)
      .join('')
      .trim()

    const doneChunk = streamChunks.find(
      (chunk): chunk is Extract<AgentStreamChunk, { type: 'done' }> => chunk.type === 'done',
    )

    if (assistantContent || doneChunk) {
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: assistantContent || EMPTY_ASSISTANT_RESPONSE_FALLBACK,
          createdAt: '2026-04-10T12:30:01.000Z',
        },
      ]
    }

    if (doneChunk) {
      workspace.session.phase = doneChunk.phase
      workspace.session.messageCount = doneChunk.messageCount ?? messages.length

      if (doneChunk.atsScore) {
        workspace.session.atsScore = doneChunk.atsScore
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'cache-control': 'no-cache',
      },
      body: buildSsePayload(streamChunks),
    })
  })

  await page.route('**/api/file/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    const targetId = requestUrl.searchParams.get('targetId')
    await jsonResponse(route, resolveFileResponse(workspace, targetId, options.file))
  })
  await page.route('**/__e2e-assets/*.pdf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.1\n%CurrIA E2E Preview\n%%EOF'),
    })
  })
}
