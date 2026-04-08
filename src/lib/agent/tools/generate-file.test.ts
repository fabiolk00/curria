import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CVState } from '@/types/cv'

import { generateFile, generateFileDeps } from './generate-file'

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Backend engineer',
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
    education: [],
  }
}

function buildSupabase() {
  return {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn((filePath: string) => Promise.resolve({
          data: {
            signedUrl: `https://cdn.example.com/${filePath}`,
          },
        })),
      })),
    },
  }
}

describe('generateFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('persists generated output paths but not signed URLs', async () => {
    const supabase = buildSupabase()
    const upload = vi.fn().mockResolvedValue(undefined)
    const generateDOCX = vi.fn().mockResolvedValue(Buffer.from('docx'))
    const generatePDF = vi.fn().mockResolvedValue(Buffer.from('pdf'))

    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      supabase as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'upload').mockImplementation(upload)
    vi.spyOn(generateFileDeps, 'generateDOCX').mockImplementation(generateDOCX)
    vi.spyOn(generateFileDeps, 'generatePDF').mockImplementation(generatePDF)

    const result = await generateFile({
      cv_state: buildCvState(),
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      docxUrl: 'https://cdn.example.com/usr_123/sess_123/resume.docx',
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/resume.pdf',
    })
    expect(result.patch).toMatchObject({
      generatedOutput: {
        status: 'ready',
        docxPath: 'usr_123/sess_123/resume.docx',
        pdfPath: 'usr_123/sess_123/resume.pdf',
      },
    })
    expect(result.patch?.generatedOutput).not.toHaveProperty('docxUrl')
    expect(result.patch?.generatedOutput).not.toHaveProperty('pdfUrl')
  })

  it('persists failed status and explicit error on failure', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generateDOCX').mockRejectedValue(new Error('template render failed'))
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))

    const result = await generateFile({
      cv_state: buildCvState(),
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'File generation failed.',
    })
    expect(result.patch).toEqual({
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        error: 'template render failed',
      },
    })
  })

  it('returns a client-compatible tool output shape', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generateDOCX').mockResolvedValue(Buffer.from('docx'))
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    const result = await generateFile({
      cv_state: buildCvState(),
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(true)
    if (!result.output.success) {
      throw new Error('Expected successful output.')
    }

    expect(result.output.docxUrl).toContain('resume.docx')
    expect(result.output.pdfUrl).toContain('resume.pdf')
  })

  it('builds target-specific artifact metadata without touching session-level patching', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generateDOCX').mockResolvedValue(Buffer.from('docx'))
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    const result = await generateFile({
      cv_state: buildCvState(),
      target_id: 'target_123',
    }, 'usr_123', 'sess_123', { type: 'target', targetId: 'target_123' })

    expect(result.output).toEqual({
      success: true,
      docxUrl: 'https://cdn.example.com/usr_123/sess_123/targets/target_123/resume.docx',
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/targets/target_123/resume.pdf',
    })
    expect(result.patch).toBeUndefined()
    expect(result.generatedOutput).toEqual({
      status: 'ready',
      docxPath: 'usr_123/sess_123/targets/target_123/resume.docx',
      pdfPath: 'usr_123/sess_123/targets/target_123/resume.pdf',
      generatedAt: expect.any(String),
      error: undefined,
    })
  })

  it('passes targeting context into the ATS template mapping step', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    const generateDOCX = vi.fn().mockResolvedValue(Buffer.from('docx'))
    const generatePDF = vi.fn().mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'generateDOCX').mockImplementation(generateDOCX)
    vi.spyOn(generateFileDeps, 'generatePDF').mockImplementation(generatePDF)
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    await generateFile({
      cv_state: {
        ...buildCvState(),
        skills: ['TypeScript', 'React', 'PostgreSQL'],
      },
    }, 'usr_123', 'sess_123', { type: 'session' }, {
      targetJobDescription: 'React engineer with PostgreSQL experience',
    })

    expect(generateDOCX).toHaveBeenCalledWith(expect.objectContaining({
      skills: 'React, PostgreSQL, TypeScript',
    }))
    expect(generatePDF).toHaveBeenCalledWith(expect.objectContaining({
      skills: 'React, PostgreSQL, TypeScript',
    }))
  })

  it('returns a validation error for malformed generation input', async () => {
    const result = await generateFile({
      cv_state: {
        fullName: 'Ana Silva',
      } as never,
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(false)
    if (result.output.success) {
      throw new Error('Expected validation failure.')
    }

    expect(result.output.code).toBe('VALIDATION_ERROR')
    expect(result.output.error).toContain('email')
  })

  it('returns VALIDATION_ERROR when base cvState is invalid', async () => {
    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        fullName: '',
      },
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: expect.stringContaining('fullName'),
    })
    expect(result.patch).toEqual({
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: expect.stringContaining('fullName'),
      },
    })
  })

  it('returns VALIDATION_ERROR when target cvState is invalid', async () => {
    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        email: '',
      },
      target_id: 'target_123',
    }, 'usr_123', 'sess_123', { type: 'target', targetId: 'target_123' })

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: expect.stringContaining('email'),
    })
    expect(result.patch).toBeUndefined()
    expect(result.generatedOutput).toEqual({
      status: 'failed',
      docxPath: undefined,
      pdfPath: undefined,
      generatedAt: undefined,
      error: expect.stringContaining('email'),
    })
  })

  it('persists generatedOutput.status=failed with error message on validation failure', async () => {
    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        experience: [],
      },
    }, 'usr_123', 'sess_123')

    expect(result.patch).toEqual({
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: expect.stringContaining('experience'),
      },
    })
  })

  it('does not call generation or storage dependencies on validation failure', async () => {
    const getSupabase = vi.spyOn(generateFileDeps, 'getSupabase')
    const generateDOCX = vi.spyOn(generateFileDeps, 'generateDOCX')
    const generatePDF = vi.spyOn(generateFileDeps, 'generatePDF')
    const upload = vi.spyOn(generateFileDeps, 'upload')

    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        summary: '',
      },
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: expect.stringContaining('summary'),
    })
    expect(getSupabase).not.toHaveBeenCalled()
    expect(generateDOCX).not.toHaveBeenCalled()
    expect(generatePDF).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('returns VALIDATION_ERROR instead of GENERATION_ERROR on schema failure', async () => {
    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        phone: 999,
      } as unknown as CVState,
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(false)
    if (result.output.success) {
      throw new Error('Expected validation failure.')
    }

    expect(result.output.code).toBe('VALIDATION_ERROR')
    expect(result.output.error).toContain('phone')
  })
})
