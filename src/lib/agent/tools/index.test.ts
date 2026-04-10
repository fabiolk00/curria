import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/types/agent'

import { scoreATS } from '@/lib/ats/score'
import { getResumeTargetForSession, updateResumeTargetGeneratedOutput } from '@/lib/db/resume-targets'
import { applyGeneratedOutputPatch, applyToolPatchWithVersion, mergeToolPatch } from '@/lib/db/sessions'

import { analyzeGap } from './gap-analysis'
import { generateFile } from './generate-file'
import { applyGapAction } from './gap-to-action'
import { parseFile } from './parse-file'
import { ingestResumeText } from './resume-ingestion'
import { dispatchTool, dispatchToolWithContext, executeTool, getToolDefinitionsForPhase } from './index'
import { rewriteSection } from './rewrite-section'
import { createTargetResumeVariant } from '@/lib/resume-targets/create-target-resume'

const { logError, logInfo, logWarn, serializeError } = vi.hoisted(() => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: vi.fn(() => ({})),
}))

vi.mock('./parse-file', () => ({
  parseFile: vi.fn(),
}))

vi.mock('./generate-file', () => ({
  generateFile: vi.fn(),
}))

vi.mock('./resume-ingestion', () => ({
  ingestResumeText: vi.fn(),
}))

vi.mock('./gap-analysis', () => ({
  analyzeGap: vi.fn(),
}))

vi.mock('./gap-to-action', () => ({
  applyGapAction: vi.fn(),
}))

vi.mock('./rewrite-section', () => ({
  rewriteSection: vi.fn(),
}))

vi.mock('@/lib/ats/score', () => ({
  scoreATS: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  applyGeneratedOutputPatch: vi.fn(async (session: Session, patch: Partial<Session['generatedOutput']>) => {
    session.generatedOutput = {
      ...session.generatedOutput,
      ...patch,
    }
  }),
  applyToolPatchWithVersion: vi.fn(),
  mergeToolPatch: vi.fn((session: Session, patch: Parameters<typeof mergeToolPatch>[1]) => ({
    ...session,
    cvState: patch.cvState ? { ...session.cvState, ...patch.cvState } : session.cvState,
    agentState: patch.agentState ? { ...session.agentState, ...patch.agentState } : session.agentState,
    generatedOutput: patch.generatedOutput ? { ...session.generatedOutput, ...patch.generatedOutput } : session.generatedOutput,
    phase: patch.phase ?? session.phase,
    atsScore: patch.atsScore ?? session.atsScore,
    updatedAt: session.updatedAt,
  })),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetForSession: vi.fn(),
  updateResumeTargetGeneratedOutput: vi.fn(),
}))

vi.mock('@/lib/resume-targets/create-target-resume', () => ({
  createTargetResumeVariant: vi.fn(),
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError,
  logInfo,
  logWarn,
  serializeError,
}))

function buildSession(): Session {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'intake',
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer',
      experience: [],
      skills: [],
      education: [],
    },
    agentState: {
      parseStatus: 'attached',
      sourceResumeText: 'existing parsed text',
      rewriteHistory: {},
    },
    generatedOutput: {
      status: 'idle',
    },
    atsScore: undefined,
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date('2026-03-25T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T12:00:00.000Z'),
  }
}

function buildEmptySession(): Session {
  return {
    ...buildSession(),
    cvState: {
      fullName: '',
      email: '',
      phone: '',
      summary: '',
      experience: [],
      skills: [],
      education: [],
    },
  }
}

describe('agent tool dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(applyGeneratedOutputPatch).mockImplementation(async (session, patch) => {
      session.generatedOutput = {
        ...session.generatedOutput,
        ...patch,
      }
    })
    vi.mocked(getResumeTargetForSession).mockResolvedValue(null)
    vi.mocked(updateResumeTargetGeneratedOutput).mockResolvedValue(undefined)
    vi.mocked(applyToolPatchWithVersion).mockImplementation(async (session, patch) => {
      if (!patch) {
        return
      }

      const mergedSession = vi.mocked(mergeToolPatch)(session, patch)
      session.phase = mergedSession.phase
      session.cvState = mergedSession.cvState
      session.agentState = mergedSession.agentState
      session.generatedOutput = mergedSession.generatedOutput
      session.atsScore = mergedSession.atsScore
    })
  })

  it('returns a patch from the tool executor without mutating the session directly', async () => {
    const session = buildSession()

    vi.mocked(parseFile).mockResolvedValue({
      success: true,
      text: 'parsed resume text',
      pageCount: 2,
    })
    vi.mocked(ingestResumeText).mockResolvedValue({
      patch: {
        cvState: {
          summary: 'Ingested summary',
        },
      },
      confidenceScore: 0.92,
      strategy: 'populate_empty',
      changedFields: ['summary'],
      preservedFields: [],
    })

    const execution = await executeTool('parse_file', {
      file_base64: 'abc',
      mime_type: 'application/pdf',
    }, session)

    expect(execution.output).toEqual({
      success: true,
      text: 'parsed resume text',
      pageCount: 2,
    })
    expect(execution.patch).toEqual({
      cvState: {
        summary: 'Ingested summary',
      },
      agentState: {
        parseStatus: 'parsed',
        parseError: undefined,
        parseConfidenceScore: 0.92,
        sourceResumeText: 'parsed resume text',
      },
    })
    expect(session.agentState.sourceResumeText).toBe('existing parsed text')
    expect(session.agentState.parseStatus).toBe('attached')
  })

  it('limits tool exposure by phase', () => {
    const analysisTools = getToolDefinitionsForPhase('analysis').map((tool) => (
      tool.type === 'function' ? tool.function.name : 'unknown'
    ))
    const confirmTools = getToolDefinitionsForPhase('confirm').map((tool) => (
      tool.type === 'function' ? tool.function.name : 'unknown'
    ))

    expect(analysisTools).toEqual(['score_ats', 'analyze_gap', 'set_phase'])
    expect(confirmTools).toEqual(['create_target_resume', 'set_phase', 'generate_file'])
    expect(confirmTools).not.toContain('rewrite_section')
  })

  it('persists the produced patch exactly once through the dispatcher', async () => {
    const session = buildSession()
    const atsResult = {
      total: 88,
      breakdown: {
        format: 18,
        structure: 18,
        keywords: 24,
        contact: 10,
        impact: 18,
      },
      issues: [],
      suggestions: [],
    }

    vi.mocked(scoreATS).mockReturnValue(atsResult)

    const rawResult = await dispatchTool('score_ats', {
      resume_text: 'resume text',
      job_description: 'job description',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: true,
      result: atsResult,
    })
    expect(applyToolPatchWithVersion).toHaveBeenCalledTimes(1)
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(session, {
      atsScore: atsResult,
      agentState: {
        targetJobDescription: 'job description',
      },
    }, undefined)
  })

  it('creates a version when ingestion first populates canonical cvState', async () => {
    const session = buildEmptySession()

    vi.mocked(parseFile).mockResolvedValue({
      success: true,
      text: 'parsed resume text',
      pageCount: 2,
    })
    vi.mocked(ingestResumeText).mockResolvedValue({
      patch: {
        cvState: {
          summary: 'Ingested summary',
          skills: ['TypeScript'],
        },
      },
      confidenceScore: 0.92,
      strategy: 'populate_empty',
      changedFields: ['summary', 'skills'],
      preservedFields: [],
    })

    await dispatchTool('parse_file', {
      file_base64: 'abc',
      mime_type: 'application/pdf',
    }, session)

    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      session,
      {
        cvState: {
          summary: 'Ingested summary',
          skills: ['TypeScript'],
        },
        agentState: {
          parseStatus: 'parsed',
          parseError: undefined,
          parseConfidenceScore: 0.92,
          sourceResumeText: 'parsed resume text',
        },
      },
      'ingestion',
    )
  })

  it('returns a compatible rewrite_section tool output through the dispatcher', async () => {
    const session = buildSession()

    vi.mocked(rewriteSection).mockResolvedValue({
      output: {
        success: true,
        rewritten_content: 'Led backend modernization across billing services.',
        section_data: 'Led backend modernization across billing services.',
        keywords_added: ['billing'],
        changes_made: ['Added stronger action verb'],
      },
      patch: {
        cvState: {
          summary: 'Led backend modernization across billing services.',
        },
      },
    })

    const rawResult = await dispatchTool('rewrite_section', {
      section: 'summary',
      current_content: 'Backend engineer',
      instructions: 'Make it stronger',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: true,
      rewritten_content: 'Led backend modernization across billing services.',
      section_data: 'Led backend modernization across billing services.',
      keywords_added: ['billing'],
      changes_made: ['Added stronger action verb'],
    })
    expect(applyToolPatchWithVersion).toHaveBeenCalledTimes(1)
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      session,
      {
        cvState: {
          summary: 'Led backend modernization across billing services.',
        },
      },
      'rewrite',
    )
  })

  it('maps a selected gap item into a targeted rewrite that updates only the intended section', async () => {
    const session = buildSession()
    const previousExperience = structuredClone(session.cvState.experience)
    const previousEducation = structuredClone(session.cvState.education)

    vi.mocked(applyGapAction).mockResolvedValue({
      output: {
        success: true,
        section: 'summary',
        item_type: 'missing_skill',
        item_value: 'AWS',
        rewritten_content: 'Backend engineer with AWS platform delivery experience.',
        section_data: 'Backend engineer with AWS platform delivery experience.',
        keywords_added: ['AWS'],
        changes_made: ['Added AWS keyword to summary'],
      },
      patch: {
        cvState: {
          summary: 'Backend engineer with AWS platform delivery experience.',
        },
        agentState: {
          rewriteHistory: {
            summary: {
              rewrittenContent: 'Backend engineer with AWS platform delivery experience.',
              keywordsAdded: ['AWS'],
              changesMade: ['Added AWS keyword to summary'],
              updatedAt: '2026-03-27T12:05:00.000Z',
            },
          },
        },
      },
    })

    const rawResult = await dispatchTool('apply_gap_action', {
      item_type: 'missing_skill',
      item_value: 'AWS',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: true,
      section: 'summary',
      item_type: 'missing_skill',
      item_value: 'AWS',
      rewritten_content: 'Backend engineer with AWS platform delivery experience.',
      section_data: 'Backend engineer with AWS platform delivery experience.',
      keywords_added: ['AWS'],
      changes_made: ['Added AWS keyword to summary'],
    })
    expect(applyGapAction).toHaveBeenCalledWith({
      item_type: 'missing_skill',
      item_value: 'AWS',
    }, session)
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      session,
      {
        cvState: {
          summary: 'Backend engineer with AWS platform delivery experience.',
        },
        agentState: {
          rewriteHistory: {
            summary: {
              rewrittenContent: 'Backend engineer with AWS platform delivery experience.',
              keywordsAdded: ['AWS'],
              changesMade: ['Added AWS keyword to summary'],
              updatedAt: '2026-03-27T12:05:00.000Z',
            },
          },
        },
      },
      'rewrite',
    )
    expect(session.cvState.summary).toBe('Backend engineer with AWS platform delivery experience.')
    expect(session.cvState.experience).toEqual(previousExperience)
    expect(session.cvState.education).toEqual(previousEducation)
  })

  it('keeps canonical state unchanged when transactional version persistence fails', async () => {
    const session = buildEmptySession()
    const originalSessionSnapshot = structuredClone(session)

    vi.mocked(parseFile).mockResolvedValue({
      success: true,
      text: 'parsed resume text',
      pageCount: 2,
    })
    vi.mocked(ingestResumeText).mockResolvedValue({
      patch: {
        cvState: {
          summary: 'Ingested summary',
        },
      },
      confidenceScore: 0.92,
      strategy: 'populate_empty',
      changedFields: ['summary'],
      preservedFields: [],
    })
    vi.mocked(applyToolPatchWithVersion).mockRejectedValue(
      new Error('Failed to create transactional CV version.'),
    )

    const rawResult = await dispatchTool('parse_file', {
      file_base64: 'abc',
      mime_type: 'application/pdf',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Tool execution failed.',
    })
    expect(session).toEqual(originalSessionSnapshot)
  })

  it('does not persist invalid rewrite output', async () => {
    const session = buildSession()

    vi.mocked(rewriteSection).mockResolvedValue({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid rewrite payload for section "skills".',
      },
    })

    const rawResult = await dispatchTool('rewrite_section', {
      section: 'skills',
      current_content: 'TypeScript, SQL',
      instructions: 'Improve it',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: false,
      code: 'LLM_INVALID_OUTPUT',
      error: 'Invalid rewrite payload for section "skills".',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('does not persist generatedOutput when generate_file validation fails', async () => {
    const session = buildSession()
    const originalGeneratedOutput = structuredClone(session.generatedOutput)

    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'summary is required.',
      },
      patch: {
        generatedOutput: {
          status: 'failed',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: 'summary is required.',
        },
      },
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'summary is required.',
      },
    })

    const rawResult = await dispatchTool('generate_file', {
      cv_state: session.cvState,
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'summary is required.',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
    expect(applyGeneratedOutputPatch).not.toHaveBeenCalled()
    expect(session.generatedOutput).toEqual(originalGeneratedOutput)
  })

  it('returns no persistedPatch when generate_file fails', async () => {
    const session = buildSession()

    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'summary is required.',
      },
      patch: {
        generatedOutput: {
          status: 'failed',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: 'summary is required.',
        },
      },
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'summary is required.',
      },
    })

    const result = await dispatchToolWithContext('generate_file', {
      cv_state: session.cvState,
    }, session)

    expect(result.outputFailure).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'summary is required.',
    })
    expect(result.persistedPatch).toBeUndefined()
    expect(applyGeneratedOutputPatch).not.toHaveBeenCalled()
  })

  it('does not mutate cvState or agentState when generate_file fails', async () => {
    const session = buildSession()
    const originalCvState = structuredClone(session.cvState)
    const originalGeneratedOutput = structuredClone(session.generatedOutput)
    session.agentState = {
      parseStatus: 'parsed',
      rewriteHistory: {
        summary: {
          rewrittenContent: 'Existing summary',
          keywordsAdded: ['TypeScript'],
          changesMade: ['Strengthened summary'],
          updatedAt: '2026-03-27T12:05:00.000Z',
        },
      },
    }
    const originalAgentState = structuredClone(session.agentState)

    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'phone is required.',
      },
      patch: {
        generatedOutput: {
          status: 'failed',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: 'phone is required.',
        },
      },
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'phone is required.',
      },
    })

    await dispatchTool('generate_file', {
      cv_state: session.cvState,
    }, session)

    expect(session.cvState).toEqual(originalCvState)
    expect(session.agentState).toEqual(originalAgentState)
    expect(session.generatedOutput).toEqual(originalGeneratedOutput)
  })

  it('rejects malformed gap-driven rewrite output without persisting changes', async () => {
    const session = buildSession()

    vi.mocked(applyGapAction).mockResolvedValue({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid rewrite payload for section "summary".',
      },
    })

    const rawResult = await dispatchTool('apply_gap_action', {
      item_type: 'suggestion',
      item_value: 'Add AWS emphasis to the summary',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: false,
      code: 'LLM_INVALID_OUTPUT',
      error: 'Invalid rewrite payload for section "summary".',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
  })

  it('logs structured tool failure codes when a tool returns a failure payload', async () => {
    const session = buildSession()

    vi.mocked(rewriteSection).mockResolvedValue({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid rewrite payload for section "summary".',
      },
    })

    await dispatchTool('rewrite_section', {
      section: 'summary',
      current_content: 'Backend engineer',
      instructions: 'Improve it',
    }, session)

    expect(logWarn).toHaveBeenCalledWith(
      'agent.tool.completed',
      expect.objectContaining({
        success: false,
        errorCode: 'LLM_INVALID_OUTPUT',
        errorMessage: 'Invalid rewrite payload for section "summary".',
      }),
    )
  })

  it('does not log generatedOutput persistence when generate_file fails', async () => {
    const session = buildSession()

    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'summary is required.',
      },
      patch: {
        generatedOutput: {
          status: 'failed',
          docxPath: undefined,
          pdfPath: undefined,
          generatedAt: undefined,
          error: 'summary is required.',
        },
      },
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'summary is required.',
      },
    })

    await dispatchTool('generate_file', {
      cv_state: session.cvState,
    }, session)

    expect(logInfo).not.toHaveBeenCalledWith(
      'agent.tool.generated_output.persisted',
      expect.objectContaining({
        toolName: 'generate_file',
      }),
    )
  })

  it('reads generate_file input from canonical session cvState', async () => {
    const session = buildSession()

    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: true,
        docxUrl: 'https://example.com/resume.docx',
        pdfUrl: 'https://example.com/resume.pdf',
      },
      patch: {
        generatedOutput: {
          status: 'ready',
          docxPath: 'usr_123/sess_123/resume.docx',
          pdfPath: 'usr_123/sess_123/resume.pdf',
          generatedAt: '2026-03-27T12:00:00.000Z',
        },
      },
    })

    const execution = await executeTool('generate_file', {
      cv_state: {
        fullName: 'Wrong Name',
        email: 'wrong@example.com',
        phone: '000',
        summary: 'wrong summary',
        experience: [],
        skills: [],
        education: [],
      },
    }, session)

    expect(generateFile).toHaveBeenCalledWith(
      {
        cv_state: session.cvState,
        target_id: undefined,
      },
      session.userId,
      session.id,
      { type: 'session' },
      session.agentState,
    )
    expect(execution.patch).toEqual({
      generatedOutput: {
        status: 'ready',
        docxPath: 'usr_123/sess_123/resume.docx',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        generatedAt: '2026-03-27T12:00:00.000Z',
      },
    })
    expect(updateResumeTargetGeneratedOutput).not.toHaveBeenCalled()
  })

  it('generates files from the selected target derived cvState without overwriting the base resume', async () => {
    const session = buildSession()
    const originalCvState = structuredClone(session.cvState)

    vi.mocked(getResumeTargetForSession).mockResolvedValue({
      id: 'target_123',
      sessionId: session.id,
      targetJobDescription: 'AWS backend role',
      derivedCvState: {
        ...session.cvState,
        summary: 'Target-specific AWS summary.',
        skills: ['TypeScript', 'AWS'],
      },
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    })
    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: true,
        docxUrl: 'https://example.com/target-resume.docx',
        pdfUrl: 'https://example.com/target-resume.pdf',
      },
      generatedOutput: {
        status: 'ready',
        docxPath: 'usr_123/sess_123/targets/target_123/resume.docx',
        pdfPath: 'usr_123/sess_123/targets/target_123/resume.pdf',
        generatedAt: '2026-03-27T12:30:00.000Z',
      },
    })

    const execution = await executeTool('generate_file', {
      cv_state: session.cvState,
      target_id: 'target_123',
    }, session)

    expect(getResumeTargetForSession).toHaveBeenCalledWith(session.id, 'target_123')
    expect(generateFile).toHaveBeenCalledWith(
      {
        cv_state: {
          ...session.cvState,
          summary: 'Target-specific AWS summary.',
          skills: ['TypeScript', 'AWS'],
        },
        target_id: 'target_123',
      },
      session.userId,
      session.id,
      { type: 'target', targetId: 'target_123' },
      'AWS backend role',
    )
    expect(updateResumeTargetGeneratedOutput).toHaveBeenCalledWith(
      session.id,
      'target_123',
      {
        status: 'ready',
        docxPath: 'usr_123/sess_123/targets/target_123/resume.docx',
        pdfPath: 'usr_123/sess_123/targets/target_123/resume.pdf',
        generatedAt: '2026-03-27T12:30:00.000Z',
      },
    )
    expect(execution.output).toEqual({
      success: true,
      docxUrl: 'https://example.com/target-resume.docx',
      pdfUrl: 'https://example.com/target-resume.pdf',
    })
    expect(execution.patch).toBeUndefined()
    expect(session.cvState).toEqual(originalCvState)
  })

  it('persists target generatedOutput on failure without updating the session generatedOutput', async () => {
    const session = buildSession()
    const originalGeneratedOutput = structuredClone(session.generatedOutput)

    vi.mocked(getResumeTargetForSession).mockResolvedValue({
      id: 'target_123',
      sessionId: session.id,
      targetJobDescription: 'AWS backend role',
      derivedCvState: {
        ...session.cvState,
        email: '',
      },
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    })
    vi.mocked(generateFile).mockResolvedValue({
      output: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'email is required.',
      },
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'email is required.',
      },
    })

    const rawResult = await dispatchTool('generate_file', {
      cv_state: session.cvState,
      target_id: 'target_123',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'email is required.',
    })
    expect(updateResumeTargetGeneratedOutput).toHaveBeenCalledWith(
      session.id,
      'target_123',
      {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'email is required.',
      },
    )
    expect(applyGeneratedOutputPatch).not.toHaveBeenCalled()
    expect(session.generatedOutput).toEqual(originalGeneratedOutput)
  })

  it('does not persist patch for non-generate_file tool failures', async () => {
    const session = buildSession()
    const originalAgentState = structuredClone(session.agentState)

    vi.mocked(rewriteSection).mockResolvedValue({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid rewrite payload.',
      },
      patch: {
        agentState: {
          rewriteHistory: {
            summary: {
              rewrittenContent: 'Unexpected rewrite',
              keywordsAdded: ['AWS'],
              changesMade: ['Added unsupported claim'],
              updatedAt: '2026-03-27T12:05:00.000Z',
            },
          },
        },
      },
    })

    const rawResult = await dispatchTool('rewrite_section', {
      section: 'summary',
      current_content: 'Backend engineer',
      instructions: 'Improve it',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: false,
      code: 'LLM_INVALID_OUTPUT',
      error: 'Invalid rewrite payload.',
    })
    expect(applyToolPatchWithVersion).not.toHaveBeenCalled()
    expect(applyGeneratedOutputPatch).not.toHaveBeenCalled()
    expect(session.agentState).toEqual(originalAgentState)
  })

  it('builds an agentState patch from validated gap analysis output', async () => {
    const session = buildSession()

    vi.mocked(analyzeGap).mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 72,
          missingSkills: ['AWS'],
          weakAreas: ['summary'],
          improvementSuggestions: ['Highlight AWS experience'],
        },
      },
      result: {
        matchScore: 72,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight AWS experience'],
      },
    })

    const execution = await executeTool('analyze_gap', {
      target_job_description: 'AWS backend role',
    }, session)

    expect(execution.patch).toEqual({
      agentState: {
        targetJobDescription: 'AWS backend role',
        targetFitAssessment: {
          level: 'partial',
          summary: expect.stringContaining('partially aligned'),
          reasons: expect.arrayContaining(['Missing or underrepresented skill: AWS']),
          assessedAt: expect.any(String),
        },
        gapAnalysis: {
          result: {
            matchScore: 72,
            missingSkills: ['AWS'],
            weakAreas: ['summary'],
            improvementSuggestions: ['Highlight AWS experience'],
          },
          analyzedAt: expect.any(String),
        },
      },
    })
  })

  it('creates target-specific resumes without overwriting the canonical base cvState', async () => {
    const session = buildSession()
    const originalCvState = structuredClone(session.cvState)
    const originalGapAnalysis = {
      result: {
        matchScore: 64,
        missingSkills: ['Kafka'],
        weakAreas: ['experience'],
        improvementSuggestions: ['Add platform scale details'],
      },
      analyzedAt: '2026-03-26T12:00:00.000Z',
    }
    session.agentState.gapAnalysis = originalGapAnalysis

    vi.mocked(createTargetResumeVariant).mockResolvedValue({
      success: true,
      target: {
        id: 'target_123',
        sessionId: session.id,
        targetJobDescription: 'AWS backend role',
        derivedCvState: {
          ...session.cvState,
          summary: 'Backend engineer optimized for AWS backend roles.',
          skills: ['TypeScript', 'AWS'],
          experience: [],
          education: [],
        },
        gapAnalysis: {
          matchScore: 72,
          missingSkills: ['AWS'],
          weakAreas: ['summary'],
          improvementSuggestions: ['Highlight AWS experience'],
        },
        createdAt: new Date('2026-03-27T12:00:00.000Z'),
        updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      },
      gapAnalysis: {
        matchScore: 72,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight AWS experience'],
      },
    })

    const rawResult = await dispatchTool('create_target_resume', {
      target_job_description: 'AWS backend role',
    }, session)

    expect(JSON.parse(rawResult)).toEqual({
      success: true,
      targetId: 'target_123',
      targetJobDescription: 'AWS backend role',
      derivedCvState: {
        ...session.cvState,
        summary: 'Backend engineer optimized for AWS backend roles.',
        skills: ['TypeScript', 'AWS'],
        experience: [],
        education: [],
      },
      gapAnalysis: {
        matchScore: 72,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight AWS experience'],
      },
    })
    expect(session.cvState).toEqual(originalCvState)
    expect(session.agentState.gapAnalysis).toEqual(originalGapAnalysis)
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      session,
      {
        agentState: {
          targetJobDescription: 'AWS backend role',
          targetFitAssessment: {
            level: 'partial',
            summary: expect.stringContaining('partially aligned'),
            reasons: expect.arrayContaining(['Missing or underrepresented skill: AWS']),
            assessedAt: expect.any(String),
          },
        },
      },
      undefined,
    )
  })
})
