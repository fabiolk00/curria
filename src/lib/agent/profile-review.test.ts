import { describe, expect, it } from 'vitest'

import {
  assessProfileAuditFindings,
  buildCareerFitWarningText,
  requiresCareerFitWarning,
  requiresCareerFitOverrideConfirmation,
} from './profile-review'

describe('profile review', () => {
  it('flags the main ATS and recruiter weaknesses in incomplete profiles', () => {
    const findings = assessProfileAuditFindings({
      fullName: 'Ana Silva',
      email: '',
      phone: '',
      summary: 'Analista de dados',
      experience: [],
      skills: ['SQL'],
      education: [],
    })

    expect(findings.map((finding) => finding.key)).toEqual(
      expect.arrayContaining(['contact', 'summary', 'experience', 'skills']),
    )
  })

  it('requires a realism warning for a clear role-family mismatch even before generation', () => {
    const session = {
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Frontend developer focused on React, TypeScript and UI systems.',
        experience: [{
          title: 'Frontend Developer',
          company: 'Acme',
          startDate: '2023',
          endDate: 'present' as const,
          bullets: ['Built React interfaces and design system components.'],
        }],
        skills: ['React', 'TypeScript', 'CSS'],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
        sourceResumeText: 'Frontend developer focused on React and UI.',
        targetJobDescription: 'Senior DevOps Engineer with Kubernetes, Terraform and AWS.',
        phaseMeta: {
          careerFitWarningIssuedAt: '2026-04-12T12:00:00.000Z',
          careerFitWarningTargetJobDescription: 'Senior DevOps Engineer with Kubernetes, Terraform and AWS.',
        },
      },
    }

    expect(requiresCareerFitWarning(session as never)).toBe(true)
    expect(requiresCareerFitOverrideConfirmation(session as never)).toBe(true)
    expect(buildCareerFitWarningText(session as never)).toContain('mais alinhado a frontend')
  })
})
