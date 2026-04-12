import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  GenerateFileOutput,
  ParseFileOutput,
  RewriteSectionOutput,
  Session,
} from '@/types/agent'
import type { CVState, ExperienceEntry } from '@/types/cv'

import { CURRENT_SESSION_STATE_VERSION } from '@/lib/db/sessions'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { generateBillableResume } from '@/lib/resume-generation/generate-billable-resume'

import { dispatchTool } from './index'

const { createCompletion, pdfParse } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  pdfParse: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}))

vi.mock('pdf-parse', () => ({
  default: pdfParse,
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/resume-generation/generate-billable-resume', () => ({
  generateBillableResume: vi.fn(),
}))

const rpc = vi.fn()

function buildSession(): Session {
  return {
    id: 'sess_pipeline',
    userId: 'usr_123',
    stateVersion: CURRENT_SESSION_STATE_VERSION,
    phase: 'dialog',
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      linkedin: 'linkedin.com/in/ana-silva',
      location: 'Sao Paulo, BR',
      summary: 'Backend engineer focused on APIs.',
      experience: [
        {
          title: 'Backend Engineer',
          company: 'Acme',
          startDate: '2022',
          endDate: 'present',
          bullets: ['Built billing APIs'],
        },
      ],
      skills: ['TypeScript', 'PostgreSQL'],
      education: [
        {
          degree: 'BSc Computer Science',
          institution: 'USP',
          year: '2021',
        },
      ],
      certifications: [
        {
          name: 'AWS SAA',
          issuer: 'AWS',
          year: '2024',
        },
      ],
    },
    agentState: {
      parseStatus: 'attached',
      rewriteHistory: {},
    },
    generatedOutput: {
      status: 'idle',
    },
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date('2026-03-25T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T12:00:00.000Z'),
  }
}

function buildOpenAIResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
    },
  }
}

describe('agent pipeline session state evolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)
    rpc.mockImplementation((fn: string) => {
      if (fn === 'apply_session_patch_with_version') {
        return Promise.resolve({
          data: true,
          error: null,
        })
      }

      throw new Error(`Unexpected RPC: ${fn}`)
    })
    vi.mocked(generateBillableResume).mockResolvedValue({
      output: {
        success: true,
        docxUrl: 'https://cdn.example.com/usr_123/sess_pipeline/resume.docx',
        pdfUrl: 'https://cdn.example.com/usr_123/sess_pipeline/resume.pdf',
      },
      patch: {
        generatedOutput: {
          status: 'ready',
          docxPath: 'usr_123/sess_pipeline/resume.docx',
          pdfPath: 'usr_123/sess_pipeline/resume.pdf',
          generatedAt: '2026-03-25T12:00:00.000Z',
        },
      },
    })
  })

  it('evolves session state correctly across parse, rewrite, and generate', async () => {
    const session = buildSession()
    const originalExperience: ExperienceEntry[] = structuredClone(session.cvState.experience)
    const originalEducation = structuredClone(session.cvState.education)
    const originalCertifications = structuredClone(session.cvState.certifications ?? [])
    const parsedResumeText = 'Ana Silva backend resume text with metrics and APIs. '.repeat(4)
    const rewrittenSummary = 'Led backend billing modernization, improving reliability and delivery speed.'
    const canonicalCvStateBeforeGeneration: CVState = structuredClone({
      ...session.cvState,
      summary: rewrittenSummary,
    })
    pdfParse.mockResolvedValue({
      text: parsedResumeText,
      numpages: 2,
    })

    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        linkedin: 'linkedin.com/in/ana-silva',
        location: 'Sao Paulo, BR',
        summary: 'Backend engineer focused on APIs, billing systems, and measurable delivery.',
        experience: [
          {
            title: 'Backend Engineer',
            company: 'Acme',
            startDate: '2022',
            endDate: 'present',
            bullets: ['Built billing APIs'],
          },
        ],
        skills: ['TypeScript', 'PostgreSQL'],
        education: [
          {
            degree: 'BSc Computer Science',
            institution: 'USP',
            year: '2021',
          },
        ],
        certifications: [
          {
            name: 'AWS SAA',
            issuer: 'AWS',
            year: '2024',
          },
        ],
        confidenceScore: 0.9,
      })))
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        rewritten_content: rewrittenSummary,
        section_data: rewrittenSummary,
        keywords_added: ['billing modernization'],
        changes_made: ['Added clearer business impact'],
      })))

    const parseResult = JSON.parse(await dispatchTool('parse_file', {
      file_base64: Buffer.from('fake pdf bytes').toString('base64'),
      mime_type: 'application/pdf',
    }, session)) as ParseFileOutput

    expect(parseResult).toEqual({
      success: true,
      text: parsedResumeText.trim(),
      pageCount: 2,
    })
    expect(session.agentState.parseStatus).toBe('parsed')
    expect(session.agentState.parseConfidenceScore).toBe(0.9)
    expect(session.agentState.sourceResumeText).toBe(parsedResumeText.trim())
    expect(session.cvState.summary).toBe('Backend engineer focused on APIs.')
    expect('rawText' in session.cvState).toBe(false)
    expect('targetJobDescription' in session.cvState).toBe(false)

    const rewriteResult = JSON.parse(await dispatchTool('rewrite_section', {
      section: 'summary',
      current_content: session.cvState.summary,
      instructions: 'Make it stronger and more ATS-friendly.',
      target_keywords: ['billing modernization'],
    }, session)) as RewriteSectionOutput

    expect(rewriteResult).toEqual({
      success: true,
      rewritten_content: rewrittenSummary,
      section_data: rewrittenSummary,
      keywords_added: ['billing modernization'],
      changes_made: ['Added clearer business impact'],
    })
    expect(session.cvState.summary).toBe(rewrittenSummary)
    expect(session.cvState.experience).toEqual(originalExperience)
    expect(session.cvState.education).toEqual(originalEducation)
    expect(session.cvState.certifications).toEqual(originalCertifications)
    expect(session.agentState.rewriteHistory.summary).toMatchObject({
      rewrittenContent: rewrittenSummary,
      keywordsAdded: ['billing modernization'],
      changesMade: ['Added clearer business impact'],
    })
    expect(session.agentState.rewriteHistory.summary?.updatedAt).toEqual(expect.any(String))
    expect(session.agentState.sourceResumeText).toBe(parsedResumeText.trim())

    const generateResult = JSON.parse(await dispatchTool('generate_file', {
      cv_state: {
        ...session.cvState,
        summary: 'wrong summary from transient input',
      },
    }, session)) as GenerateFileOutput

    expect(generateBillableResume).toHaveBeenCalledWith({
      userId: session.userId,
      sessionId: session.id,
      sourceCvState: canonicalCvStateBeforeGeneration,
      targetId: undefined,
      idempotencyKey: undefined,
      templateTargetSource: session.agentState,
    })
    expect(generateResult).toEqual({
      success: true,
      docxUrl: 'https://cdn.example.com/usr_123/sess_pipeline/resume.docx',
      pdfUrl: 'https://cdn.example.com/usr_123/sess_pipeline/resume.pdf',
    })
    expect(session.generatedOutput).toMatchObject({
      status: 'ready',
      docxPath: 'usr_123/sess_pipeline/resume.docx',
      pdfPath: 'usr_123/sess_pipeline/resume.pdf',
    })
    expect(session.generatedOutput.generatedAt).toEqual(expect.any(String))
    expect(session.generatedOutput).not.toHaveProperty('docxUrl')
    expect(session.generatedOutput).not.toHaveProperty('pdfUrl')

    expect(rpc).toHaveBeenCalledTimes(3)

    const rpcCalls = rpc.mock.calls as unknown as Array<[string, Record<string, unknown>]>
    const firstPersistedUpdate = rpcCalls[0]?.[1]
    const secondPersistedUpdate = rpcCalls[1]?.[1]
    const thirdPersistedUpdate = rpcCalls[2]?.[1]

    expect(firstPersistedUpdate).toEqual({
      p_session_id: 'sess_pipeline',
      p_user_id: 'usr_123',
      p_phase: 'dialog',
      p_cv_state: expect.any(Object),
      p_agent_state: expect.objectContaining({
        parseStatus: 'parsed',
        parseConfidenceScore: 0.9,
        sourceResumeText: parsedResumeText.trim(),
      }),
      p_generated_output: expect.any(Object),
      p_ats_score: null,
      p_version_source: null,
    })
    expect(secondPersistedUpdate).toEqual({
      p_session_id: 'sess_pipeline',
      p_user_id: 'usr_123',
      p_phase: 'dialog',
      p_cv_state: expect.objectContaining({
        summary: rewrittenSummary,
      }),
      p_agent_state: expect.objectContaining({
        rewriteHistory: expect.objectContaining({
          summary: expect.objectContaining({
            rewrittenContent: rewrittenSummary,
          }),
        }),
      }),
      p_generated_output: expect.any(Object),
      p_ats_score: null,
      p_version_source: 'rewrite',
    })
    expect(thirdPersistedUpdate).toEqual({
      p_session_id: 'sess_pipeline',
      p_user_id: 'usr_123',
      p_phase: 'dialog',
      p_cv_state: expect.any(Object),
      p_agent_state: expect.any(Object),
      p_generated_output: expect.objectContaining({
        status: 'ready',
        docxPath: 'usr_123/sess_pipeline/resume.docx',
        pdfPath: 'usr_123/sess_pipeline/resume.pdf',
      }),
      p_ats_score: null,
      p_version_source: null,
    })
  })
})
