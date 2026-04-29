import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { POST as postSmartGeneration } from '../smart-generation/route'

const smartGenerationPostMock = vi.hoisted(() => vi.fn())

vi.mock('../smart-generation/route', () => ({
  POST: smartGenerationPostMock,
}))

function buildCvState() {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'https://linkedin.com/in/ana',
    location: 'Sao Paulo',
    summary: 'Analista de dados com foco em BI e melhoria continua.',
    experience: [{
      title: 'Analista de Dados',
      company: 'Acme',
      location: 'Sao Paulo',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Criei dashboards executivos.', 'Automatizei relatorios.'],
    }],
    skills: ['SQL', 'Power BI', 'ETL', 'Excel'],
    education: [{
      degree: 'Bacharel em Sistemas de Informacao',
      institution: 'USP',
      year: '2020',
    }],
    certifications: [{
      name: 'AWS Cloud Practitioner',
      issuer: 'Amazon',
      year: '2024',
    }],
  }
}

function buildTrustedHeaders() {
  return {
    'content-type': 'application/json',
    origin: 'https://example.com',
  }
}

describe('POST /api/profile/ats-enhancement compatibility wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates the legacy ATS request to Smart Generation without running local orchestration', async () => {
    let delegatedPayload: unknown
    smartGenerationPostMock.mockImplementation(async (request: NextRequest) => {
      delegatedPayload = await request.json()

      return NextResponse.json({
        success: true,
        sessionId: 'sess_smart_ats_123',
        creditsUsed: 1,
        resumeGenerationId: 'gen_smart_ats_123',
        generationType: 'ATS_ENHANCEMENT',
      })
    })

    const request = new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    })
    const response = await POST(request)

    expect(postSmartGeneration).toHaveBeenCalledTimes(1)
    expect(postSmartGeneration).toHaveBeenCalledWith(request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_smart_ats_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_smart_ats_123',
      generationType: 'ATS_ENHANCEMENT',
    })
    expect(delegatedPayload).toEqual(buildCvState())
  })

  it('preserves Smart Generation trust handling by forwarding untrusted requests unchanged', async () => {
    smartGenerationPostMock.mockImplementation(async (request: NextRequest) => {
      expect(request.headers.get('origin')).toBe('https://evil.example')

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    })

    const request = new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify(buildCvState()),
    })
    const response = await POST(request)

    expect(postSmartGeneration).toHaveBeenCalledTimes(1)
    expect(postSmartGeneration).toHaveBeenCalledWith(request)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })
})
