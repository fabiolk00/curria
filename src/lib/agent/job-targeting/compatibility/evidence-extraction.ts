import type {
  JobCompatibilityEvidence,
  JobCompatibilityEvidenceSourceKind,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'

import {
  detectEvidenceQualifier,
  RESUME_EVIDENCE_SOURCE_CONFIDENCE,
} from './evidence-qualifiers'
import { normalizeCompatibilityText } from './requirement-decomposition'

export const EVIDENCE_EXTRACTION_VERSION = 'evidence-extraction-v1'

export function extractResumeEvidence(cvState: CVState): JobCompatibilityEvidence[] {
  const evidence: JobCompatibilityEvidence[] = []

  splitSentences(cvState.summary).forEach((sentence, index) => {
    addEvidence(evidence, {
      text: sentence,
      sourceKind: 'summary_sentence',
      section: 'summary',
      cvPath: index === 0 ? 'summary' : `summary.sentences[${index}]`,
    })
  })

  cvState.skills.forEach((skill, index) => {
    addEvidence(evidence, {
      text: skill,
      sourceKind: 'skill',
      section: 'skills',
      cvPath: `skills[${index}]`,
    })
  })

  cvState.experience.forEach((entry, entryIndex) => {
    addEvidence(evidence, {
      text: entry.title,
      sourceKind: 'experience_title',
      section: 'experience',
      cvPath: `experience[${entryIndex}].title`,
      entryIndex,
    })

    entry.bullets.forEach((bullet, bulletIndex) => {
      addEvidence(evidence, {
        text: bullet,
        sourceKind: 'experience_bullet',
        section: 'experience',
        cvPath: `experience[${entryIndex}].bullets[${bulletIndex}]`,
        entryIndex,
        bulletIndex,
      })
    })
  })

  cvState.education.forEach((entry, entryIndex) => {
    addEvidence(evidence, {
      text: buildEducationEvidenceText(entry),
      sourceKind: 'education_entry',
      section: 'education',
      cvPath: `education[${entryIndex}]`,
      entryIndex,
    })
  })

  cvState.certifications?.forEach((entry, entryIndex) => {
    addEvidence(evidence, {
      text: joinEvidenceParts([entry.name, entry.issuer]),
      sourceKind: 'certification_entry',
      section: 'certifications',
      cvPath: `certifications[${entryIndex}]`,
      entryIndex,
    })
  })

  return evidence
}

function addEvidence(
  evidence: JobCompatibilityEvidence[],
  item: {
    text: string
    sourceKind: JobCompatibilityEvidenceSourceKind
    section: JobCompatibilityEvidence['section']
    cvPath: string
    entryIndex?: number
    bulletIndex?: number
  },
) {
  const text = cleanEvidenceText(item.text)
  const normalizedText = normalizeCompatibilityText(text)

  if (!normalizedText) {
    return
  }

  evidence.push({
    id: buildEvidenceId(evidence.length, item.sourceKind, normalizedText),
    text,
    normalizedText,
    section: item.section,
    sourceKind: item.sourceKind,
    cvPath: item.cvPath,
    sourceConfidence: RESUME_EVIDENCE_SOURCE_CONFIDENCE[item.sourceKind],
    qualifier: detectEvidenceQualifier(text),
    ...(item.entryIndex === undefined ? {} : { entryIndex: item.entryIndex }),
    ...(item.bulletIndex === undefined ? {} : { bulletIndex: item.bulletIndex }),
  })
}

function splitSentences(value: string): string[] {
  return value
    .split(/[.!?]+/)
    .map(cleanEvidenceText)
    .filter(Boolean)
}

function joinEvidenceParts(parts: string[]): string {
  return parts.map(cleanEvidenceText).filter(Boolean).join(', ')
}

function buildEducationEvidenceText(entry: CVState['education'][number]): string {
  const base = joinEvidenceParts([entry.degree, entry.institution, entry.year])
  const status = educationCompletionStatus(entry.year)

  if (!base || status === 'unknown') {
    return base
  }

  return `${base} (${status})`
}

function educationCompletionStatus(year: string): 'completed' | 'in progress' | 'unknown' {
  const date = parseEducationDate(year)
  if (!date) {
    return 'unknown'
  }

  const current = new Date()
  const currentMonth = new Date(current.getFullYear(), current.getMonth(), 1).getTime()

  return date.getTime() > currentMonth ? 'in progress' : 'completed'
}

function parseEducationDate(value: string): Date | null {
  const cleaned = value.trim()
  const monthYear = /^(\d{1,2})[/-](\d{4})$/u.exec(cleaned)
  if (monthYear) {
    const month = Number(monthYear[1])
    const year = Number(monthYear[2])

    if (month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1)
    }
  }

  const yearOnly = /^(\d{4})$/u.exec(cleaned)
  if (yearOnly) {
    return new Date(Number(yearOnly[1]), 11, 1)
  }

  return null
}

function cleanEvidenceText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.]+|[\s:;,.]+$/g, '')
    .trim()
}

function buildEvidenceId(index: number, sourceKind: JobCompatibilityEvidenceSourceKind, normalizedText: string): string {
  const slug = normalizedText.replace(/\s+/g, '-').slice(0, 48)
  return `evidence-${index + 1}-${sourceKind}-${slug}`
}
