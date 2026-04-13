import { z } from 'zod'

import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import type { ToolPatch } from '@/types/agent'
import type {
  CVState,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
} from '@/types/cv'

const ExperienceEntrySchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.union([z.string(), z.literal('present')]),
  bullets: z.array(z.string()),
})

const EducationEntrySchema = z.object({
  degree: z.string(),
  institution: z.string(),
  year: z.string(),
  gpa: z.string().optional(),
})

const CertificationEntrySchema = z.object({
  name: z.string(),
  issuer: z.string(),
  year: z.string().optional(),
})

const ResumeIngestionSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  linkedin: z.string().optional(),
  location: z.string().optional(),
  summary: z.string(),
  experience: z.array(ExperienceEntrySchema),
  skills: z.array(z.string()),
  education: z.array(EducationEntrySchema),
  certifications: z.array(CertificationEntrySchema).optional(),
  confidenceScore: z.number().min(0).max(1),
})

type ResumeIngestionPayload = z.infer<typeof ResumeIngestionSchema>

type ResumeIngestionResult = {
  patch?: ToolPatch
  confidenceScore?: number
  strategy: 'populate_empty' | 'merge_preserving_existing' | 'unstructured_only'
  changedFields: Array<keyof CVState>
  preservedFields: Array<keyof CVState>
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value)
}

function dedupeObjectArray<T>(items: T[]): T[] {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = stableSerialize(item)
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>()

  return items.filter((item) => {
    const normalized = item.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) {
      return false
    }

    seen.add(normalized)
    return true
  })
}

function isCvStateEmpty(cvState: CVState): boolean {
  return (
    isBlank(cvState.fullName) &&
    isBlank(cvState.email) &&
    isBlank(cvState.phone) &&
    isBlank(cvState.linkedin) &&
    isBlank(cvState.location) &&
    isBlank(cvState.summary) &&
    cvState.experience.length === 0 &&
    cvState.skills.length === 0 &&
    cvState.education.length === 0 &&
    (!cvState.certifications || cvState.certifications.length === 0)
  )
}

function hasMeaningfulResumeData(payload: ResumeIngestionPayload): boolean {
  return (
    !isBlank(payload.fullName) ||
    !isBlank(payload.email) ||
    !isBlank(payload.phone) ||
    !isBlank(payload.summary) ||
    payload.experience.length > 0 ||
    payload.skills.length > 0 ||
    payload.education.length > 0 ||
    (payload.certifications?.length ?? 0) > 0
  )
}

function toCanonicalCvState(payload: ResumeIngestionPayload): CVState {
  return {
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    linkedin: payload.linkedin?.trim() || undefined,
    location: payload.location?.trim() || undefined,
    summary: payload.summary.trim(),
    experience: payload.experience.map((entry) => ({
      ...entry,
      title: entry.title.trim(),
      company: entry.company.trim(),
      location: entry.location?.trim() || undefined,
      startDate: entry.startDate.trim(),
      endDate: typeof entry.endDate === 'string' ? entry.endDate.trim() : entry.endDate,
      bullets: dedupeStrings(entry.bullets.map((bullet) => bullet.trim())),
    })),
    skills: dedupeStrings(payload.skills.map((skill) => skill.trim())),
    education: payload.education.map((entry) => ({
      ...entry,
      degree: entry.degree.trim(),
      institution: entry.institution.trim(),
      year: entry.year.trim(),
      gpa: entry.gpa?.trim() || undefined,
    })),
    certifications: payload.certifications?.map((entry) => ({
      ...entry,
      name: entry.name.trim(),
      issuer: entry.issuer.trim(),
      year: entry.year?.trim() || undefined,
    })),
  }
}

function buildCvStatePatch(
  currentCvState: CVState,
  ingestedCvState: CVState,
): ResumeIngestionResult {
  if (isCvStateEmpty(currentCvState)) {
    return {
      patch: {
        cvState: ingestedCvState,
      },
      strategy: 'populate_empty',
      changedFields: [
        'fullName',
        'email',
        'phone',
        'linkedin',
        'location',
        'summary',
        'experience',
        'skills',
        'education',
        'certifications',
      ].filter((field) => field in ingestedCvState) as Array<keyof CVState>,
      preservedFields: [],
    }
  }

  const patch: Partial<CVState> = {}
  const changedFields: Array<keyof CVState> = []
  const preservedFields: Array<keyof CVState> = []

  const fillMissingScalar = <K extends keyof Pick<CVState, 'fullName' | 'email' | 'phone' | 'linkedin' | 'location' | 'summary'>>(
    key: K,
  ): void => {
    const currentValue = currentCvState[key]
    const nextValue = ingestedCvState[key]

    if (typeof nextValue !== 'string' && nextValue !== undefined) {
      return
    }

    if (isBlank(typeof currentValue === 'string' ? currentValue : undefined) && !isBlank(nextValue)) {
      patch[key] = nextValue as CVState[K]
      changedFields.push(key)
      return
    }

    if (!isBlank(nextValue) && !isBlank(typeof currentValue === 'string' ? currentValue : undefined)) {
      preservedFields.push(key)
    }
  }

  fillMissingScalar('fullName')
  fillMissingScalar('email')
  fillMissingScalar('phone')
  fillMissingScalar('linkedin')
  fillMissingScalar('location')
  fillMissingScalar('summary')

  const mergedSkills = dedupeStrings([...currentCvState.skills, ...ingestedCvState.skills])
  if (stableSerialize(mergedSkills) !== stableSerialize(currentCvState.skills)) {
    patch.skills = mergedSkills
    changedFields.push('skills')
  } else if (ingestedCvState.skills.length > 0) {
    preservedFields.push('skills')
  }

  const mergedExperience = dedupeObjectArray<ExperienceEntry>([
    ...currentCvState.experience,
    ...ingestedCvState.experience,
  ])
  if (stableSerialize(mergedExperience) !== stableSerialize(currentCvState.experience)) {
    patch.experience = mergedExperience
    changedFields.push('experience')
  } else if (ingestedCvState.experience.length > 0) {
    preservedFields.push('experience')
  }

  const mergedEducation = dedupeObjectArray<EducationEntry>([
    ...currentCvState.education,
    ...ingestedCvState.education,
  ])
  if (stableSerialize(mergedEducation) !== stableSerialize(currentCvState.education)) {
    patch.education = mergedEducation
    changedFields.push('education')
  } else if (ingestedCvState.education.length > 0) {
    preservedFields.push('education')
  }

  const currentCertifications = currentCvState.certifications ?? []
  const ingestedCertifications = ingestedCvState.certifications ?? []
  const mergedCertifications = dedupeObjectArray<CertificationEntry>([
    ...currentCertifications,
    ...ingestedCertifications,
  ])
  if (stableSerialize(mergedCertifications) !== stableSerialize(currentCertifications)) {
    patch.certifications = mergedCertifications
    changedFields.push('certifications')
  } else if (ingestedCertifications.length > 0) {
    preservedFields.push('certifications')
  }

  return {
    patch: Object.keys(patch).length > 0 ? { cvState: patch } : undefined,
    strategy: 'merge_preserving_existing',
    changedFields,
    preservedFields,
  }
}

function parseResumeIngestionPayload(rawText: string): ResumeIngestionPayload | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  const result = ResumeIngestionSchema.safeParse(parsed)
  return result.success ? result.data : null
}

export async function ingestResumeText(
  resumeText: string,
  currentCvState: CVState,
  userId: string,
  sessionId?: string,
  externalSignal?: AbortSignal,
): Promise<ResumeIngestionResult> {
  const response = await callOpenAIWithRetry(
    (signal) => openai.chat.completions.create({
      model: MODEL_CONFIG.structuredModel,
      max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extract structured resume data from the provided raw resume text.
Output valid JSON matching this exact shape:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "linkedin"?: string,
  "location"?: string,
  "summary": string,
  "experience": Array<{
    "title": string,
    "company": string,
    "location"?: string,
    "startDate": string,
    "endDate": string | "present",
    "bullets": string[]
  }>,
  "skills": string[],
  "education": Array<{
    "degree": string,
    "institution": string,
    "year": string,
    "gpa"?: string
  }>,
  "certifications"?: Array<{
    "name": string,
    "issuer": string,
    "year"?: string
  }>,
  "confidenceScore": number
}
Rules:
- confidenceScore must be between 0 and 1
- do not invent missing facts
- use empty strings or empty arrays when information is unavailable
- preserve the original language where relevant`,
        },
        {
          role: 'user',
          content: resumeText,
        },
      ],
    }, { signal }),
    3,
    AGENT_CONFIG.timeout,
    externalSignal,
  )

  const usage = getChatCompletionUsage(response)
  trackApiUsage({
    userId,
    sessionId,
    model: MODEL_CONFIG.structuredModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    endpoint: 'rewriter',
  }).catch(() => {})

  const responseText = getChatCompletionText(response)
  const payload = parseResumeIngestionPayload(responseText)

  if (!payload || !hasMeaningfulResumeData(payload)) {
    return {
      patch: undefined,
      confidenceScore: undefined,
      strategy: 'unstructured_only',
      changedFields: [],
      preservedFields: [],
    }
  }

  const ingestedCvState = toCanonicalCvState(payload)
  const mergeResult = buildCvStatePatch(currentCvState, ingestedCvState)

  return {
    ...mergeResult,
    confidenceScore: payload.confidenceScore,
  }
}
