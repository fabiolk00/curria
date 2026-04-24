import type { RewriteSectionInput } from '@/types/agent'
import type { CVState } from '@/types/cv'

export const MAX_ATS_STAGE_RETRIES = 2
export const MAX_REWRITE_SECTION_CHARS = 5_500
export const MAX_REWRITE_BULLETS_PER_EXPERIENCE = 4

type RewriteSectionName = RewriteSectionInput['section']

function trimText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}

function prioritizeExperienceBullets(bullets: string[]): string[] {
  if (bullets.length <= MAX_REWRITE_BULLETS_PER_EXPERIENCE) {
    return bullets
  }

  const prioritizedIndexes = new Set<number>()
  const highSignalIndexes = bullets
    .map((bullet, index) => ({
      index,
      score: /\d|%/.test(bullet) ? 2 : 0,
    }))
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.index)

  for (const index of highSignalIndexes) {
    prioritizedIndexes.add(index)

    if (prioritizedIndexes.size === MAX_REWRITE_BULLETS_PER_EXPERIENCE) {
      break
    }
  }

  for (const [index] of bullets.entries()) {
    if (prioritizedIndexes.size === MAX_REWRITE_BULLETS_PER_EXPERIENCE) {
      break
    }

    prioritizedIndexes.add(index)
  }

  return bullets.filter((_, index) => prioritizedIndexes.has(index))
}

export function shapeRewriteCurrentContent(
  cvState: CVState,
  section: RewriteSectionName,
): { content: string; compacted: boolean } {
  switch (section) {
    case 'experience': {
      const compactExperience = cvState.experience.map((entry) => ({
        title: entry.title,
        company: entry.company,
        startDate: entry.startDate,
        endDate: entry.endDate,
        bullets: prioritizeExperienceBullets(entry.bullets).map((bullet) =>
          trimText(bullet, 220),
        ),
      }))
      const content = JSON.stringify(compactExperience)
      return {
        content: trimText(content, MAX_REWRITE_SECTION_CHARS),
        compacted: content.length > MAX_REWRITE_SECTION_CHARS
          || cvState.experience.some((entry) => entry.bullets.length > MAX_REWRITE_BULLETS_PER_EXPERIENCE),
      }
    }
    case 'education': {
      const content = JSON.stringify(cvState.education)
      return { content: trimText(content, MAX_REWRITE_SECTION_CHARS), compacted: content.length > MAX_REWRITE_SECTION_CHARS }
    }
    case 'certifications': {
      const content = JSON.stringify(cvState.certifications ?? [])
      return { content: trimText(content, MAX_REWRITE_SECTION_CHARS), compacted: content.length > MAX_REWRITE_SECTION_CHARS }
    }
    case 'skills': {
      const content = cvState.skills.join(', ')
      return { content: trimText(content, MAX_REWRITE_SECTION_CHARS), compacted: content.length > MAX_REWRITE_SECTION_CHARS }
    }
    case 'summary':
    default: {
      const content = cvState.summary
      return { content: trimText(content, MAX_REWRITE_SECTION_CHARS), compacted: content.length > MAX_REWRITE_SECTION_CHARS }
    }
  }
}

export async function executeWithStageRetry<T>(
  task: (attempt: number) => Promise<T>,
  options?: {
    maxAttempts?: number
    shouldRetry?: (error: unknown, attempt: number) => boolean
    onRetry?: (error: unknown, attempt: number) => void | Promise<void>
  },
): Promise<{ result: T; attempts: number }> {
  const maxAttempts = options?.maxAttempts ?? MAX_ATS_STAGE_RETRIES
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await task(attempt)
      return { result, attempts: attempt }
    } catch (error) {
      lastError = error

      const shouldRetry = attempt < maxAttempts
        && (options?.shouldRetry?.(error, attempt) ?? true)

      if (!shouldRetry) {
        throw error
      }

      await options?.onRetry?.(error, attempt)
    }
  }

  throw lastError
}
