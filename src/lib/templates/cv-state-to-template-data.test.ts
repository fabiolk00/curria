import { describe, expect, it } from 'vitest'

import type { CVState } from '@/types/cv'

import { ATS_SECTION_HEADINGS, cvStateToTemplateData } from './cv-state-to-template-data'

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'linkedin.com/in/ana-silva',
    location: 'Sao Paulo, SP',
    summary: 'Backend engineer with platform experience.',
    experience: [
      {
        title: 'Senior Backend Engineer',
        company: 'Acme',
        location: 'Sao Paulo, SP',
        startDate: 'Jan 2022',
        endDate: 'present',
        bullets: [
          'Built APIs for billing and reporting',
          'Improved PostgreSQL performance for finance dashboards',
        ],
      },
    ],
    skills: [
      'TypeScript',
      'React',
      'PostgreSQL',
      'English C1',
      'Portuguese Native',
      'Power BI',
      'Stakeholder Management',
    ],
    education: [
      {
        degree: 'B.Sc. Computer Science',
        institution: 'USP',
        year: '2018',
      },
    ],
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon',
        year: '2024',
      },
    ],
  }
}

describe('cvStateToTemplateData', () => {
  it('maps the base CV state into PT-BR ATS template data', () => {
    const result = cvStateToTemplateData(buildCvState())

    expect(result).toMatchObject({
      fullName: 'Ana Silva',
      jobTitle: 'Senior Backend Engineer',
      email: 'ana@example.com',
      phone: '555-0100',
      location: 'Sao Paulo, SP',
      linkedin: 'linkedin.com/in/ana-silva',
      summary: 'Backend engineer with platform experience.',
      skills: 'TypeScript, React, PostgreSQL, Power BI, Stakeholder Management',
      hasCertifications: true,
      hasLanguages: true,
    })

    expect(result.skillGroups).toEqual([
      { label: 'Analise de Dados', items: ['PostgreSQL'] },
      { label: 'Business Intelligence', items: ['Power BI'] },
      { label: 'Programacao', items: ['TypeScript', 'React'] },
      { label: 'Metodologias e Colaboracao', items: ['Stakeholder Management'] },
    ])

    expect(result.experiences).toHaveLength(1)
    expect(result.experiences[0]).toMatchObject({
      title: 'Senior Backend Engineer',
      company: 'Acme',
      location: 'Sao Paulo, SP',
      period: 'Jan 2022 - Atual',
      techStack: '',
    })
    expect(result.experiences[0].bullets).toEqual([
      { text: 'Built APIs for billing and reporting' },
      { text: 'Improved PostgreSQL performance for finance dashboards' },
    ])

    expect(result.education).toEqual([
      {
        degree: 'B.Sc. Computer Science',
        institution: 'USP',
        period: '2018',
      },
    ])
    expect(result.certifications).toEqual([
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon',
        period: '2024',
      },
    ])
  })

  it('moves target-matched skills to the front while preserving grouping', () => {
    const result = cvStateToTemplateData(buildCvState(), {
      targetJobDescription: 'We need a React engineer with PostgreSQL experience.',
    })

    expect(result.skills).toBe('React, PostgreSQL, TypeScript, Power BI, Stakeholder Management')
    expect(result.skillGroups).toEqual([
      { label: 'Analise de Dados', items: ['PostgreSQL'] },
      { label: 'Business Intelligence', items: ['Power BI'] },
      { label: 'Programacao', items: ['React', 'TypeScript'] },
      { label: 'Metodologias e Colaboracao', items: ['Stakeholder Management'] },
    ])
  })

  it('extracts language entries from skills and removes them from competencias', () => {
    const result = cvStateToTemplateData({
      ...buildCvState(),
      skills: ['English C1', 'Portuguese Native', 'Python'],
    })

    expect(result.languages).toEqual([
      { language: 'Ingles', level: 'C1' },
      { language: 'Portugues', level: 'Nativo' },
    ])
    expect(result.skills).toBe('Python')
    expect(result.skillGroups).toEqual([
      { label: 'Programacao', items: ['Python'] },
    ])
    expect(result.hasLanguages).toBe(true)
  })

  it('keeps canonical ATS section headings exported for renderers', () => {
    expect(ATS_SECTION_HEADINGS).toEqual({
      summary: 'Resumo Profissional',
      skills: 'Habilidades',
      experience: 'Experiencia Profissional',
      education: 'Educacao',
      certifications: 'Certificacoes',
      languages: 'Idiomas',
    })
  })

  it('does not fabricate an end date when experience has no ongoing sentinel', () => {
    const result = cvStateToTemplateData({
      ...buildCvState(),
      experience: [
        {
          title: 'Senior Backend Engineer',
          company: 'Acme',
          location: 'Sao Paulo, SP',
          startDate: 'Jan 2022',
          endDate: '',
          bullets: ['Built APIs for billing and reporting'],
        },
      ],
    })

    expect(result.experiences[0]?.period).toBe('Jan 2022')
  })
})
