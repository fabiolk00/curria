import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CVState } from '@/types/cv'

import { generateFile, generateFileDeps, validateGenerationCvState } from './generate-file'

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
        upload: vi.fn(() => Promise.resolve({ error: null })),
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
    const generatePDF = vi.fn().mockResolvedValue(Buffer.from('pdf'))

    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      supabase as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'upload').mockImplementation(upload)
    vi.spyOn(generateFileDeps, 'generatePDF').mockImplementation(generatePDF)

    const result = await generateFile({
      cv_state: buildCvState(),
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/resume.pdf',
      docxUrl: null,
      warnings: undefined,
    })
    expect(result.patch).toMatchObject({
      generatedOutput: {
        status: 'ready',
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
    vi.spyOn(generateFileDeps, 'generatePDF').mockRejectedValue(new Error('template render failed'))

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
        generatedAt: undefined,
        error: 'template render failed',
      },
    })
  })

  it('returns a client-compatible tool output shape', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    const result = await generateFile({
      cv_state: buildCvState(),
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(true)
    if (!result.output.success) {
      throw new Error('Expected successful output.')
    }

    expect(result.output.pdfUrl).toContain('resume.pdf')
    expect(result.output.docxUrl).toBeNull()
  })

  it('builds target-specific artifact metadata without touching session-level patching', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    const result = await generateFile({
      cv_state: buildCvState(),
      target_id: 'target_123',
    }, 'usr_123', 'sess_123', { type: 'target', targetId: 'target_123' })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/targets/target_123/resume.pdf',
      docxUrl: null,
      warnings: undefined,
    })
    expect(result.patch).toBeUndefined()
    expect(result.generatedOutput).toEqual({
      status: 'ready',
      pdfPath: 'usr_123/sess_123/targets/target_123/resume.pdf',
      generatedAt: expect.any(String),
      error: undefined,
    })
  })

  it('passes targeting context into the ATS template mapping step', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    const generatePDF = vi.fn().mockResolvedValue(Buffer.from('pdf'))
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
    expect(result.output.error).toBe('Falta pelo menos uma experiencia profissional no curriculo salvo.')
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
      error: 'Falta o nome completo no perfil salvo.',
    })
    expect(result.patch).toEqual({
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'Falta o nome completo no perfil salvo.',
      },
    })
  })

  it('returns VALIDATION_ERROR when target cvState is invalid', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        email: '',
      },
      target_id: 'target_123',
    }, 'usr_123', 'sess_123', { type: 'target', targetId: 'target_123' })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/targets/target_123/resume.pdf',
      docxUrl: null,
      warnings: ['email'],
    })
    expect(result.patch).toBeUndefined()
    expect(result.generatedOutput).toEqual({
      status: 'ready',
      pdfPath: 'usr_123/sess_123/targets/target_123/resume.pdf',
      generatedAt: expect.any(String),
      error: undefined,
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
        error: 'Falta pelo menos uma experiencia profissional no curriculo salvo.',
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
        experience: [],
      },
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Falta pelo menos uma experiencia profissional no curriculo salvo.',
    })
    expect(getSupabase).not.toHaveBeenCalled()
    expect(generateDOCX).not.toHaveBeenCalled()
    expect(generatePDF).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('fills missing contact and summary fields with explicit placeholders and warnings', async () => {
    const supabase = buildSupabase()
    const upload = vi.fn().mockResolvedValue(undefined)
    const generatePDF = vi.fn().mockResolvedValue(Buffer.from('pdf'))

    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      supabase as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'upload').mockImplementation(upload)
    vi.spyOn(generateFileDeps, 'generatePDF').mockImplementation(generatePDF)

    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        email: '',
        phone: '',
        summary: '',
      },
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/resume.pdf',
      docxUrl: null,
      warnings: ['email', 'telefone', 'resumo profissional'],
    })
    expect(generatePDF).toHaveBeenCalledWith(expect.objectContaining({
      email: 'Email nao informado no perfil salvo.',
      phone: 'Telefone nao informado no perfil salvo.',
      summary: 'Resumo profissional pendente. O perfil salvo nao traz uma descricao valida para esta secao.',
    }))
  })

  it('coerces non-string optional contact fields into placeholders instead of failing generation', async () => {
    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      buildSupabase() as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'generatePDF').mockResolvedValue(Buffer.from('pdf'))
    vi.spyOn(generateFileDeps, 'upload').mockResolvedValue(undefined)

    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        phone: 999,
      } as unknown as CVState,
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/resume.pdf',
      docxUrl: null,
      warnings: ['telefone'],
    })
  })

  it('autofills the missing end date for the most recent experience during generation', async () => {
    const supabase = buildSupabase()
    const upload = vi.fn().mockResolvedValue(undefined)
    const generatePDF = vi.fn().mockResolvedValue(Buffer.from('pdf'))

    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      supabase as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'upload').mockImplementation(upload)
    vi.spyOn(generateFileDeps, 'generatePDF').mockImplementation(generatePDF)

    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        experience: [
          {
            title: 'Senior Analytics Engineer',
            company: 'Pravaler',
            startDate: '01/2024',
            endDate: null as never,
            bullets: ['Liderou modelagem analitica com dbt'],
          },
          {
            title: 'BI Engineer',
            company: 'Acme',
            startDate: '2022',
            endDate: '2023',
            bullets: ['Criou dashboards executivos'],
          },
        ],
      },
    }, 'usr_123', 'sess_123')

    expect(result.output.success).toBe(true)
    expect(generatePDF).toHaveBeenCalledWith(expect.objectContaining({
      experiences: expect.arrayContaining([
        expect.objectContaining({
          company: 'Pravaler',
          period: expect.stringMatching(/01\/2024 .* \d{2}\/\d{4}/),
        }),
      ]),
    }))
  })

  it('returns a precise human-readable validation message for missing experience details', async () => {
    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        experience: [
          {
            title: 'BI Analyst',
            company: 'Grupo Positivo',
            startDate: '',
            endDate: '2024',
            bullets: ['Criou indicadores de desempenho'],
          },
          {
            title: 'Analytics Engineer',
            company: 'Case New Holland',
            startDate: '2022',
            endDate: '2023',
            bullets: [],
          },
        ],
      },
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Falta a data de inicio na sua primeira experiencia - BI Analyst - Grupo Positivo.',
    })
    expect(result.patch).toEqual({
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'Falta a data de inicio na sua primeira experiencia - BI Analyst - Grupo Positivo.',
      },
    })
  })

  it('does not auto-fill a missing endDate for older experience entries', () => {
    const validation = validateGenerationCvState({
      ...buildCvState(),
      experience: [
        {
          title: 'Current Role',
          company: 'Acme',
          startDate: '2022',
          endDate: '',
          bullets: ['Built billing APIs'],
        },
        {
          title: 'Older Role',
          company: 'Legacy Co',
          startDate: '2019',
          endDate: '',
          bullets: ['Maintained legacy systems'],
        },
      ],
    })

    expect(validation).toEqual({
      success: false,
      errorMessage: 'Falta a data de termino na sua segunda experiencia - Older Role - Legacy Co. Se voce ainda trabalha nela, marque como atual ou informe uma data aproximada.',
    })
  })
})
