import { describe, expect, it } from 'vitest'

import { buildResumeExportFilename, normalizeFilenameSegment } from './export-filename'

describe('resume export filename', () => {
  it('removes accents and replaces spaces with underscores in the user name', () => {
    expect(
      buildResumeExportFilename({
        fullName: 'Fábio Kröker',
        workflowMode: 'ats_enhancement',
        extension: 'pdf',
      }),
    ).toBe('Curriculo_Fabio_Kroker.pdf')
  })

  it('uses only the user name for ATS enhancement exports', () => {
    expect(
      buildResumeExportFilename({
        fullName: 'Fabio Kroker',
        workflowMode: 'ats_enhancement',
        targetJobDescription: 'Cargo: Analista de Dados',
        extension: 'pdf',
      }),
    ).toBe('Curriculo_Fabio_Kroker.pdf')
  })

  it('adds a reliable target title for job targeting exports', () => {
    expect(
      buildResumeExportFilename({
        fullName: 'Fábio Kröker',
        workflowMode: 'job_targeting',
        targetJobDescription: 'Cargo: Analista de Dados',
        extension: 'pdf',
      }),
    ).toBe('Curriculo_Fabio_Kroker_Analista_de_Dados.pdf')
  })

  it('falls back to the base filename when no reliable target title exists', () => {
    expect(
      buildResumeExportFilename({
        fullName: 'Fábio Kröker',
        workflowMode: 'job_targeting',
        targetJobDescription: 'Buscamos alguém com mindset analítico e colaboração com o time.',
        extension: 'pdf',
      }),
    ).toBe('Curriculo_Fabio_Kroker.pdf')
  })

  it('removes invalid characters while keeping the filename legible', () => {
    expect(normalizeFilenameSegment('Senior Data / BI @ LATAM!!!')).toBe('Senior_Data_BI_LATAM')
  })

})
