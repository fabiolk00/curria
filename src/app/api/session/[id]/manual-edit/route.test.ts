import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResumeTarget, Session } from '@/types/agent'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { manualEditSection } from '@/lib/agent/tools/manual-edit'
import {
  getResumeTargetForSession,
  updateResumeTargetGeneratedOutput,
  updateResumeTargetCvStateWithVersion,
} from '@/lib/db/resume-targets'
import { applyToolPatchWithVersion, getSession } from '@/lib/db/sessions'

import { POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/agent/tools/manual-edit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agent/tools/manual-edit')>('@/lib/agent/tools/manual-edit')

  return {
    ...actual,
    manualEditSection: vi.fn(actual.manualEditSection),
  }
})

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetForSession: vi.fn(),
  updateResumeTargetGeneratedOutput: vi.fn(),
  updateResumeTargetCvStateWithVersion: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  applyToolPatchWithVersion: vi.fn(),
  mergeToolPatch: vi.fn((session: Session, patch: { cvState?: Partial<Session['cvState']> }) => ({
    ...session,
    cvState: patch.cvState ? { ...session.cvState, ...patch.cvState } : session.cvState,
  })),
}))

function buildAppUser(id: string) {
  return {
    id,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    authIdentity: {
      id: `identity_${id}`,
      userId: id,
      provider: 'clerk' as const,
      providerSubject: `clerk_${id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    creditAccount: {
      id: `cred_${id}`,
      userId: id,
      creditsRemaining: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

function buildTarget(): ResumeTarget {
  return {
    id: 'target_123',
    sessionId: 'sess_123',
    targetJobDescription: 'AWS role',
    derivedCvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Target summary',
      experience: [],
      skills: ['TypeScript', 'AWS'],
      education: [],
    },
    createdAt: new Date('2026-03-27T12:00:00.000Z'),
    updatedAt: new Date('2026-03-27T12:00:00.000Z'),
  }
}

function buildOptimizedCvState() {
  return {
    ...buildSession().cvState,
    summary: 'ATS optimized summary',
    skills: ['TypeScript', 'PostgreSQL'],
  }
}

function buildSession(targets?: ResumeTarget[]): Session & { resumeTargets?: ResumeTarget[] } {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog',
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      linkedin: 'linkedin.com/in/anasilva',
      location: 'Sao Paulo',
      summary: 'Backend engineer',
      experience: [],
      skills: ['TypeScript'],
      education: [],
      certifications: [{
        name: 'AWS SAA',
        issuer: 'AWS',
        year: '2024',
      }],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      optimizedCvState: undefined,
    },
    generatedOutput: {
      status: 'idle',
    },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date('2026-03-27T12:00:00.000Z'),
    updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    resumeTargets: targets,
  }
}

function buildTrustedHeaders() {
  return {
    'content-type': 'application/json',
    origin: 'https://example.com',
  }
}

describe('manual edit route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getResumeTargetForSession).mockResolvedValue(null)
  })

  it('creates a manual version for a successful canonical edit', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          section: 'summary',
          value: 'Backend engineer focused on platform reliability.',
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      section: 'summary',
      section_data: 'Backend engineer focused on platform reliability.',
      changed: true,
    })
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_123' }),
      {
        cvState: {
          summary: 'Backend engineer focused on platform reliability.',
        },
        generatedOutput: {
          status: 'idle',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: undefined,
          previewAccess: undefined,
        },
      },
      'manual',
    )
  })

  it('does not create a version when the content is unchanged', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          section: 'summary',
          value: 'Backend engineer',
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      section: 'summary',
      section_data: 'Backend engineer',
      changed: false,
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('rejects invalid edits and does not persist them', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          section: 'experience',
          value: [{ company: 'Acme' }],
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(400)
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('propagates structured manual edit failures', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(manualEditSection).mockResolvedValueOnce({
      output: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'Invalid manual edit payload.',
      },
    })

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          section: 'summary',
          value: 'Backend engineer focused on platform reliability.',
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Invalid manual edit payload.',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('keeps target resumes isolated from base manual edits', async () => {
    const target = buildTarget()
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession([target]))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          section: 'skills',
          value: ['TypeScript', 'PostgreSQL'],
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(target.derivedCvState.skills).toEqual(['TypeScript', 'AWS'])
  })

  it('saves the full base cvState without generating billable artifacts', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'base',
          cvState: {
            ...buildSession().cvState,
            summary: 'Updated base summary.',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'base',
      changed: true,
    })
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_123' }),
      {
        cvState: expect.objectContaining({
          summary: 'Updated base summary.',
        }),
        generatedOutput: {
          status: 'idle',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: undefined,
          previewAccess: undefined,
        },
      },
      'manual',
    )
  })

  it('skips persistence when the full base cvState is unchanged', async () => {
    const session = buildSession()
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'base',
          cvState: session.cvState,
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'base',
      changed: false,
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('updates the current target resume without generating target artifacts', async () => {
    const target = buildTarget()
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession([target]))
    vi.mocked(getResumeTargetForSession).mockResolvedValue(target)
    vi.mocked(updateResumeTargetCvStateWithVersion).mockResolvedValue({
      ...target,
      derivedCvState: {
        ...target.derivedCvState,
        summary: 'Updated target summary.',
      },
    })

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'target',
          targetId: 'target_123',
          cvState: {
            ...target.derivedCvState,
            summary: 'Updated target summary.',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'target',
      targetId: 'target_123',
      changed: true,
    })
    expect(updateResumeTargetCvStateWithVersion).toHaveBeenCalledWith({
      sessionId: 'sess_123',
      targetId: 'target_123',
      userId: 'usr_123',
      derivedCvState: expect.objectContaining({
        summary: 'Updated target summary.',
      }),
    })
    expect(updateResumeTargetGeneratedOutput).toHaveBeenCalledWith(
      'sess_123',
      'target_123',
      expect.objectContaining({
        status: 'idle',
      }),
    )
  })

  it('saves the optimized cvState without overwriting the canonical base cvState', async () => {
    const session = buildSession()
    session.agentState.optimizedCvState = buildOptimizedCvState()
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'optimized',
          cvState: {
            ...buildOptimizedCvState(),
            summary: 'Updated optimized summary.',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'optimized',
      changed: true,
    })
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_123' }),
      {
        agentState: expect.objectContaining({
          optimizedCvState: expect.objectContaining({
            summary: 'Updated optimized summary.',
          }),
          rewriteStatus: 'completed',
        }),
        generatedOutput: {
          status: 'idle',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: undefined,
          previewAccess: undefined,
        },
      },
    )
  })

  it('keeps the current generated artifact metadata intact when only the base cvState changes behind an optimized resume', async () => {
    const session = buildSession()
    session.agentState.optimizedCvState = buildOptimizedCvState()
    session.generatedOutput = {
      status: 'ready',
      pdfPath: 'usr_123/sess_123/resume.pdf',
      generatedAt: '2026-04-21T00:00:00.000Z',
    }

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'base',
          cvState: {
            ...session.cvState,
            summary: 'Base summary updated behind optimized state.',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_123' }),
      {
        cvState: expect.objectContaining({
          summary: 'Base summary updated behind optimized state.',
        }),
      },
      'manual',
    )
  })

  it('returns 409 when optimized editing is requested without an optimized cvState', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'optimized',
          cvState: buildSession().cvState,
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'No optimized resume found for this session.',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('blocks optimized edits when the generated free-trial preview is locked', async () => {
    const session = buildSession()
    session.agentState.optimizedCvState = buildOptimizedCvState()
    session.generatedOutput = {
      status: 'ready',
      previewAccess: {
        locked: true,
        blurred: true,
        canViewRealContent: false,
        requiresUpgrade: true,
        requiresRegenerationAfterUnlock: true,
        reason: 'free_trial_locked',
        lockedAt: '2026-04-20T12:00:00.000Z',
        message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
      },
    }

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'optimized',
          cvState: {
            ...buildOptimizedCvState(),
            summary: 'Não deveria salvar.',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Este preview gratuito está bloqueado. Faça upgrade e gere novamente para editar a versão real.',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('blocks target edits when the target generated preview is locked', async () => {
    const target: ResumeTarget = {
      ...buildTarget(),
      generatedOutput: {
        status: 'ready',
        previewAccess: {
          locked: true,
          blurred: true,
          canViewRealContent: false,
          requiresUpgrade: true,
          requiresRegenerationAfterUnlock: true,
          reason: 'free_trial_locked',
          lockedAt: '2026-04-20T12:00:00.000Z',
          message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
        },
      },
    }

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession([target]))
    vi.mocked(getResumeTargetForSession).mockResolvedValue(target)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'target',
          targetId: 'target_123',
          cvState: {
            ...target.derivedCvState,
            summary: 'Não deveria salvar.',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Este preview gratuito está bloqueado. Faça upgrade e gere novamente para editar a versão real.',
    })
    expect(updateResumeTargetCvStateWithVersion).not.toHaveBeenCalled()
  })

  it('returns 404 when the requested target resume does not exist', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(getResumeTargetForSession).mockResolvedValue(null)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'target',
          targetId: 'target_missing',
          cvState: buildSession().cvState,
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(updateResumeTargetCvStateWithVersion).not.toHaveBeenCalled()
  })

  it('rejects invalid full-state payloads', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({
          scope: 'base',
          cvState: {
            summary: 'Incomplete payload',
          },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(400)
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('rejects cross-origin manual edits before touching session state', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/manual-edit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({
          section: 'summary',
          value: 'Blocked cross-origin edit.',
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
    expect(updateResumeTargetCvStateWithVersion).not.toHaveBeenCalled()
  })
})
