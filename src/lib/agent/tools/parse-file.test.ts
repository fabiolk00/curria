import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseFile } from './parse-file'
import type { ParseFileInput } from '@/types/agent'

const { pdfParse } = vi.hoisted(() => ({
  pdfParse: vi.fn(),
}))

vi.mock('pdf-parse', () => ({
  default: pdfParse,
}))

describe('parseFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts text from a valid PDF upload', async () => {
    const resumeText = [
      'Ana Silva',
      'Backend engineer with TypeScript and PostgreSQL delivery experience.',
      'Built billing APIs, improved observability, and supported production operations.',
    ].join(' ')

    pdfParse.mockResolvedValue({
      text: resumeText,
      numpages: 2,
    })

    const result = await parseFile({
      file_base64: Buffer.from('fake pdf').toString('base64'),
      mime_type: 'application/pdf',
    })

    expect(result).toEqual({
      success: true,
      text: resumeText,
      pageCount: 2,
    })
  })

  it('rejects DOCX uploads with a PDF-only validation failure', async () => {
    const result = await parseFile({
      file_base64: Buffer.from('fake docx').toString('base64'),
      mime_type: (
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as unknown as ParseFileInput['mime_type']
      ),
    })

    expect(result).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'O produto aceita apenas currículos em PDF.',
    })
    expect(pdfParse).not.toHaveBeenCalled()
  })

  it('rejects image uploads with the same PDF-only validation failure', async () => {
    const result = await parseFile({
      file_base64: Buffer.from('fake image').toString('base64'),
      mime_type: 'image/png' as unknown as ParseFileInput['mime_type'],
    })

    expect(result).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'O produto aceita apenas currículos em PDF.',
    })
  })

  it('returns PARSE_ERROR when extracted PDF text is insufficient', async () => {
    pdfParse.mockResolvedValue({
      text: 'too short',
      numpages: 1,
    })

    const result = await parseFile({
      file_base64: Buffer.from('fake pdf').toString('base64'),
      mime_type: 'application/pdf',
    })

    expect(result).toEqual({
      success: false,
      code: 'PARSE_ERROR',
      error: 'PDF_SCANNED - very little text extracted. The file may be image-based. Upload a text-based PDF.',
    })
  })
})
