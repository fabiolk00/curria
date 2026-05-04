import { describe, expect, it } from 'vitest'

import { extractResumeEvidence } from '@/lib/agent/job-targeting/compatibility/evidence-extraction'
import type { CVState } from '@/types/cv'

describe('resume evidence extraction', () => {
  it('extracts evidence from canonical cvState fields only', () => {
    const cvState: CVState = {
      fullName: 'Candidate Name',
      email: 'candidate@example.com',
      phone: '+55 11 99999-0000',
      summary: 'Clear communicator with recurring planning experience.',
      skills: ['Written communication', 'Process documentation'],
      experience: [
        {
          title: 'Delivery Coordinator',
          company: 'Example Organization',
          startDate: '2021',
          endDate: 'present',
          bullets: [
            'Coordinated recurring delivery routines',
            'Documented measurable process outcomes',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor degree',
          institution: 'Example Institution',
          year: '2020',
        },
      ],
      certifications: [
        {
          name: 'Professional facilitation certificate',
          issuer: 'Example Issuer',
          year: '2022',
        },
      ],
    }

    const evidence = extractResumeEvidence(cvState)

    expect(evidence).toEqual([
      expect.objectContaining({
        text: 'Clear communicator with recurring planning experience',
        normalizedText: 'clear communicator with recurring planning experience',
        section: 'summary',
        sourceKind: 'summary_sentence',
        cvPath: 'summary',
      }),
      expect.objectContaining({
        text: 'Written communication',
        section: 'skills',
        sourceKind: 'skill',
        cvPath: 'skills[0]',
      }),
      expect.objectContaining({
        text: 'Process documentation',
        section: 'skills',
        sourceKind: 'skill',
        cvPath: 'skills[1]',
      }),
      expect.objectContaining({
        text: 'Delivery Coordinator',
        section: 'experience',
        sourceKind: 'experience_title',
        cvPath: 'experience[0].title',
        entryIndex: 0,
      }),
      expect.objectContaining({
        text: 'Coordinated recurring delivery routines',
        section: 'experience',
        sourceKind: 'experience_bullet',
        cvPath: 'experience[0].bullets[0]',
        entryIndex: 0,
        bulletIndex: 0,
      }),
      expect.objectContaining({
        text: 'Documented measurable process outcomes',
        section: 'experience',
        sourceKind: 'experience_bullet',
        cvPath: 'experience[0].bullets[1]',
        entryIndex: 0,
        bulletIndex: 1,
      }),
      expect.objectContaining({
        text: 'Bachelor degree, Example Institution',
        section: 'education',
        sourceKind: 'education_entry',
        cvPath: 'education[0]',
        entryIndex: 0,
      }),
      expect.objectContaining({
        text: 'Professional facilitation certificate, Example Issuer',
        section: 'certifications',
        sourceKind: 'certification_entry',
        cvPath: 'certifications[0]',
        entryIndex: 0,
      }),
    ])
  })

  it('omits blank resume fields without consulting agentState', () => {
    const cvState: CVState = {
      fullName: 'Candidate Name',
      email: 'candidate@example.com',
      phone: '+55 11 99999-0000',
      summary: '  ',
      skills: [' ', 'Reliable documentation'],
      experience: [
        {
          title: '',
          company: 'Example Organization',
          startDate: '2021',
          endDate: 'present',
          bullets: [' ', 'Maintained recurring review notes'],
        },
      ],
      education: [],
      certifications: [],
    }

    const evidence = extractResumeEvidence(cvState)

    expect(evidence.map((item) => item.cvPath)).toEqual([
      'skills[1]',
      'experience[0].bullets[1]',
    ])
  })

  it('annotates source confidence and generic evidence qualifiers', () => {
    const cvState: CVState = {
      fullName: 'Candidate Name',
      email: 'candidate@example.com',
      phone: '+55 11 99999-0000',
      summary: 'Conhecimento basico em planejamento operacional.',
      skills: ['Aprendendo rotinas de automacao'],
      experience: [
        {
          title: 'Analyst',
          company: 'Example Organization',
          startDate: '2021',
          endDate: 'present',
          bullets: [
            'Sem experiência com sistemas dedicados de atendimento',
            'Não registra experiência direta com SAP FI',
            'Experiencia avancada em melhoria de processos',
          ],
        },
      ],
      education: [],
      certifications: [],
    }

    const evidence = extractResumeEvidence(cvState)

    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKind: 'summary_sentence',
        sourceConfidence: 0.55,
        qualifier: 'basic',
      }),
      expect.objectContaining({
        sourceKind: 'skill',
        sourceConfidence: 0.65,
        qualifier: 'learning',
      }),
      expect.objectContaining({
        text: 'Sem experiência com sistemas dedicados de atendimento',
        sourceConfidence: 1,
        qualifier: 'negative',
      }),
      expect.objectContaining({
        text: 'Não registra experiência direta com SAP FI',
        sourceConfidence: 1,
        qualifier: 'negative',
      }),
      expect.objectContaining({
        text: 'Experiencia avancada em melhoria de processos',
        sourceConfidence: 1,
        qualifier: 'strong',
      }),
    ]))
  })
})
