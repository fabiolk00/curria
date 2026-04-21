import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CVState } from '@/types/cv'

vi.mock('server-only', () => ({}))

import {
  createSignedResumeArtifactUrls,
  createSignedResumeArtifactUrlsBestEffort,
  generateFile,
  generateFileDeps,
  validateGenerationCvState,
} from './generate-file'

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

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdfDocument = await loadingTask.promise
  const pages: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')

      pages.push(pageText)
    }
  } finally {
    await loadingTask.destroy()
  }

  return pages.join('\n')
}

type ExtractedPdfTextItem = {
  text: string
  x: number
  y: number
}

async function extractPdfTextItems(buffer: Buffer): Promise<ExtractedPdfTextItem[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdfDocument = await loadingTask.promise
  const items: ExtractedPdfTextItem[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const textContent = await page.getTextContent()

      for (const item of textContent.items) {
        if (!('str' in item) || !item.str) {
          continue
        }

        items.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
        })
      }
    }
  } finally {
    await loadingTask.destroy()
  }

  return items
}

function normalizeExtractedPdfText(text: string): string {
  return text
    .replace(/[°•·]/g, '-')
    .replace(/\s+\|\s+/g, ' | ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('generateFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('persists generated output paths but not signed URLs', async () => {
    const supabase = buildSupabase()
    const upload = vi.fn().mockResolvedValue(undefined)

    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      supabase as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )
    vi.spyOn(generateFileDeps, 'upload').mockImplementation(upload)

    const result = await generateFile({
      cv_state: {
        ...buildCvState(),
        linkedin: 'https://linkedin.com/in/ana-silva',
        location: 'Sao Paulo, Brasil',
        summary: 'Backend engineer with ATS-friendly communication.',
        skills: ['TypeScript', 'PostgreSQL', 'English Native'],
        education: [{
          degree: 'Bacharel em Sistemas de Informacao',
          institution: 'USP',
          year: '2018',
        }],
        certifications: [{
          name: 'AWS Cloud Practitioner',
          issuer: 'Amazon',
          year: '2024',
        }],
      },
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

    const uploadedPdfBuffer = upload.mock.calls[0]?.[2] as Buffer | undefined
    expect(uploadedPdfBuffer).toBeInstanceOf(Buffer)

    const pdfText = normalizeExtractedPdfText(await extractPdfText(uploadedPdfBuffer as Buffer))

    expect(pdfText).toContain('Ana Silva')
    expect(pdfText).toContain('Sao Paulo, Brasil')
    expect(pdfText).toContain('ana@example.com | 555-0100')
    expect(pdfText).toContain('https://linkedin.com/in/ana-silva')
    expect(pdfText).toContain('Backend engineer with ATS-friendly communication.')
    expect(pdfText).toContain('RESUMO PROFISSIONAL')
    expect(pdfText).toContain('HABILIDADES')
    expect(pdfText).toContain('EXPERIENCIA PROFISSIONAL')
    expect(pdfText).toContain('EDUCACAO')
    expect(pdfText).toContain('CERTIFICACOES')
    expect(pdfText).toContain('IDIOMAS')
    expect(pdfText).toContain('Analise de Dados: PostgreSQL')
    expect(pdfText).toContain('Programacao: TypeScript')
    expect(pdfText).toContain('Backend Engineer')
    expect(pdfText).toContain('Acme')
    expect(pdfText).toContain('2022 - Atual')
    expect(pdfText).toContain('- Built billing APIs')
    expect(pdfText).toContain('Bacharel em Sistemas de Informacao')
    expect(pdfText).toContain('USP - 2018')
    expect(pdfText).toContain('AWS Cloud Practitioner - Amazon | 2024')
    expect(pdfText).toContain('Ingles: Nativo')
    expect(pdfText).not.toContain('COMPETENCIAS-CHAVE')
    expect(pdfText).not.toContain('FORMACAO ACADEMICA')

    expect(pdfText.indexOf('RESUMO PROFISSIONAL')).toBeLessThan(pdfText.indexOf('HABILIDADES'))
    expect(pdfText.indexOf('HABILIDADES')).toBeLessThan(pdfText.indexOf('EXPERIENCIA PROFISSIONAL'))
    expect(pdfText.indexOf('EXPERIENCIA PROFISSIONAL')).toBeLessThan(pdfText.indexOf('EDUCACAO'))
    expect(pdfText.indexOf('EDUCACAO')).toBeLessThan(pdfText.indexOf('CERTIFICACOES'))
    expect(pdfText.indexOf('CERTIFICACOES')).toBeLessThan(pdfText.indexOf('IDIOMAS'))
  }, 15_000)

  it('renders accented pt-BR and technical strings without broken glyphs in the PDF', async () => {
    const pdfBuffer = await generateFileDeps.generatePDF({
      ...buildCvState(),
      fullName: 'Fábio Kröker',
      summary: 'Estagiário com experiência em ETL e Python - Programming Language.',
      experience: [
        {
          title: 'Estagiário de Dados',
          company: 'Grupo Positivo',
          location: 'Curitiba, Paraná',
          startDate: '01/2024',
          endDate: '04/2026',
          bullets: ['Atuação em ETL e automações com Python - Programming Language.'],
        },
      ],
      education: [
        {
          degree: 'Graduação em Estatística',
          institution: 'UFPR',
          year: '2026',
        },
      ],
      skills: ['ETL', 'Python - Programming Language'],
    })

    const pdfText = await extractPdfText(pdfBuffer)

    expect(pdfText).toContain('Fábio Kröker')
    expect(pdfText).toContain('Estagiário')
    expect(pdfText).toContain('Graduação em Estatística')
    expect(pdfText).toContain('ETL')
    expect(pdfText).toContain('Python - Programming Language')
    expect(pdfText).not.toContain('□')
    expect(pdfText).not.toContain('Est9giário')
    expect(pdfText).not.toContain('Gr9du9ção')
  }, 15_000)

  it('aligns experience dates on the same header line as the title and keeps the company below', async () => {
    const pdfBuffer = await generateFileDeps.generatePDF({
      ...buildCvState(),
      experience: [
        {
          title: 'Senior Business Intelligence',
          company: 'CNH',
          location: 'Curitiba, Paraná',
          startDate: '01/2025',
          endDate: '04/2026',
          bullets: ['Conduziu análises executivas para operações LATAM.'],
        },
      ],
    })

    const pdfItems = await extractPdfTextItems(pdfBuffer)
    const titleItem = pdfItems.find((item) => item.text.includes('Senior Business Intelligence'))
    const periodItem = pdfItems.find((item) => item.text.includes('01/2025 - 04/2026'))
    const companyItem = pdfItems.find((item) => item.text.includes('CNH | Curitiba, Paraná'))

    expect(titleItem).toBeDefined()
    expect(periodItem).toBeDefined()
    expect(companyItem).toBeDefined()

    expect(Math.abs((titleItem?.y ?? 0) - (periodItem?.y ?? 0))).toBeLessThan(2)
    expect((periodItem?.x ?? 0)).toBeGreaterThan((titleItem?.x ?? 0))
    expect((companyItem?.y ?? 0)).toBeLessThan((titleItem?.y ?? 0))
  }, 15_000)

  it('creates transient signed urls from the provided storage seam only', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: {
        signedUrl: 'https://cdn.example.com/usr_123/sess_123/resume.pdf',
      },
      error: null,
    })
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          createSignedUrl,
        })),
      },
    }

    const signedUrls = await createSignedResumeArtifactUrls(
      undefined,
      'usr_123/sess_123/resume.pdf',
      supabase as never,
    )

    expect(supabase.storage.from).toHaveBeenCalledWith('resumes')
    expect(createSignedUrl).toHaveBeenCalledWith('usr_123/sess_123/resume.pdf', 3600)
    expect(signedUrls).toEqual({
      docxUrl: null,
      pdfUrl: 'https://cdn.example.com/usr_123/sess_123/resume.pdf',
    })
  })

  it('fails closed when the storage seam cannot mint a signed url', async () => {
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'policy denied' },
          }),
        })),
      },
    }

    await expect(
      createSignedResumeArtifactUrls(
        undefined,
        'usr_123/sess_123/resume.pdf',
        supabase as never,
      ),
    ).rejects.toThrowError('Failed to create signed download URLs.')
  })

  it('falls back to a completed generation when signed urls are temporarily unavailable', async () => {
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ error: null })),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'policy denied' },
          }),
        })),
      },
    }

    vi.spyOn(generateFileDeps, 'getSupabase').mockReturnValue(
      supabase as unknown as ReturnType<typeof generateFileDeps.getSupabase>,
    )

    const result = await generateFile({
      cv_state: buildCvState(),
    }, 'usr_123', 'sess_123')

    expect(result.output).toEqual({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      warnings: undefined,
    })
    expect(result.patch).toMatchObject({
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
      },
    })
  })

  it('returns null urls from the best-effort signer when signing fails', async () => {
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'policy denied' },
          }),
        })),
      },
    }

    const signedUrls = await createSignedResumeArtifactUrlsBestEffort(
      undefined,
      'usr_123/sess_123/resume.pdf',
      {
        userId: 'usr_123',
        sessionId: 'sess_123',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        source: 'fresh_generation',
      },
      supabase as never,
    )

    expect(signedUrls).toEqual({
      docxUrl: null,
      pdfUrl: null,
    })
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
    expect(result.output.error).toBe('Falta pelo menos uma experiência profissional no currículo salvo.')
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
        error: 'Falta pelo menos uma experiência profissional no currículo salvo.',
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
      error: 'Falta pelo menos uma experiência profissional no currículo salvo.',
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
      email: 'Email não informado no perfil salvo.',
      phone: 'Telefone não informado no perfil salvo.',
      summary: 'Resumo profissional pendente. O perfil salvo não traz uma descrição válida para esta seção.',
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

  it('does not fabricate an end date for the current role during ATS generation', async () => {
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

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Falta a data de término na sua primeira experiência - Senior Analytics Engineer - Pravaler. Se você ainda trabalha nela, marque como atual ou informe uma data aproximada.',
    })
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
      error: 'Falta a data de início na sua primeira experiência - BI Analyst - Grupo Positivo.',
    })
    expect(result.patch).toEqual({
      generatedOutput: {
        status: 'failed',
        docxPath: undefined,
        pdfPath: undefined,
        generatedAt: undefined,
        error: 'Falta a data de início na sua primeira experiência - BI Analyst - Grupo Positivo.',
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
      errorMessage: 'Falta a data de término na sua primeira experiência - Current Role - Acme. Se você ainda trabalha nela, marque como atual ou informe uma data aproximada.',
    })
  })
})
