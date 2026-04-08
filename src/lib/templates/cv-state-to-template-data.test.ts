import { describe, expect, it } from 'vitest'

import type { CVState } from '@/types/cv'

import { cvStateToTemplateData } from './cv-state-to-template-data'

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'linkedin.com/in/ana-silva',
    location: 'São Paulo, SP',
    summary: 'Backend engineer with platform experience.',
    experience: [
      {
        title: 'Senior Backend Engineer',
        company: 'Acme',
        location: 'São Paulo, SP',
        startDate: 'Jan 2022',
        endDate: 'present',
        bullets: [
          'Node.js, React, PostgreSQL',
          'Built APIs for billing and reporting',
        ],
      },
    ],
    skills: ['TypeScript', 'React', 'PostgreSQL', 'English C1', 'Portuguese Native'],
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
  it('maps the base CV state into canonical template data', () => {
    const result = cvStateToTemplateData(buildCvState())

    expect(result).toMatchObject({
      fullName: 'Ana Silva',
      jobTitle: 'Senior Backend Engineer',
      email: 'ana@example.com',
      phone: '555-0100',
      location: 'São Paulo, SP',
      linkedin: 'linkedin.com/in/ana-silva',
      summary: 'Backend engineer with platform experience.',
      skills: 'TypeScript, React, PostgreSQL, English C1, Portuguese Native',
      hasCertifications: true,
      hasLanguages: true,
    })

    expect(result.experiences).toHaveLength(1)
    expect(result.experiences[0]).toMatchObject({
      title: 'Senior Backend Engineer',
      company: 'Acme',
      location: 'São Paulo, SP',
      period: 'Jan 2022 – Presente',
      techStack: 'Node.js, React, PostgreSQL',
    })
    expect(result.experiences[0].bullets).toEqual([
      { text: 'Built APIs for billing and reporting' },
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
      },
    ])
  })

  it('moves target-matched skills to the front while preserving the rest order', () => {
    const result = cvStateToTemplateData(buildCvState(), {
      targetJobDescription: 'We need a React engineer with PostgreSQL experience.',
    })

    expect(result.skills).toBe('React, PostgreSQL, TypeScript, English C1, Portuguese Native')
  })

  it('extracts the tech stack line from the first experience bullet', () => {
    const result = cvStateToTemplateData({
      ...buildCvState(),
      experience: [
        {
          ...buildCvState().experience[0],
          bullets: [
            'Node.js, React, PostgreSQL',
            'Built APIs for billing and reporting',
          ],
        },
      ],
    })

    expect(result.experiences[0].techStack).toBe('Node.js, React, PostgreSQL')
    expect(result.experiences[0].bullets).toEqual([
      { text: 'Built APIs for billing and reporting' },
    ])
  })

  it('extracts language entries from skills', () => {
    const result = cvStateToTemplateData({
      ...buildCvState(),
      skills: ['English C1', 'Portuguese Native', 'Python'],
    })

    expect(result.languages).toEqual([
      { language: 'English', level: 'C1' },
      { language: 'Portuguese', level: 'Native' },
    ])
    expect(result.hasLanguages).toBe(true)
  })
})
