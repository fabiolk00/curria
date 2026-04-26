import { shapeTargetJobDescription } from '@/lib/agent/job-targeting-retry'
import type { ResumeGenerationType, WorkflowMode } from '@/types/agent'

const DEFAULT_PREFIX = 'Curriculo'
const DEFAULT_NAME_SEGMENT = 'Usuario'
const MAX_NAME_SEGMENT_LENGTH = 60
const MAX_TITLE_SEGMENT_LENGTH = 48

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function collapseUnderscores(value: string): string {
  return value.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}

function toTitleCase(value: string): string {
  const lowerCaseJoiners = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'of', 'and'])

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index > 0 && lowerCaseJoiners.has(lower)) {
        return lower
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function cleanExtractedRole(value: string): string {
  return value
    .replace(/\s+(para\s+atuar|para\s+liderar|para\s+trabalhar|com\s+foco|atuando\s+em|working\s+on|to\s+work).*/i, '')
    .replace(/\s+(responsavel\s+por|responsible\s+for|requisitos?|requirements?|qualifications?|responsabilidades?|about\s+the\s+job|about\s+the\s+role).*/i, '')
    .replace(/[|:;.,-]+$/g, '')
    .trim()
}

function isSectionHeading(line: string): boolean {
  const normalized = normalizeWhitespace(line).toLowerCase().replace(/[:\-]+$/g, '').trim()

  return /^(requisitos(?:\s+obrigatorios)?|responsabilidades?(?:\s+e\s+atribuicoes)?|atribuicoes|qualificacoes|desejavel|diferenciais|beneficios|sobre\s+a?\s*vaga|sobre\s+o\s+time|descricao|resumo|atividades|about\s+the\s+job|about\s+the\s+role|job\s+description|responsibilities|requirements|qualifications|what\s+you(?:'ll|\s+will)?\s+do|what\s+you(?:'ll|\s+will)?\s+bring)$/i.test(normalized)
}

function isWeakTargetRole(value: string): boolean {
  const normalized = normalizeWhitespace(cleanExtractedRole(value)).toLowerCase()

  if (!normalized || isSectionHeading(normalized) || normalized.length > 70) {
    return true
  }

  return /^(bi|vaga\s+alvo|target\s+role)$/.test(normalized)
}

function extractReliableTargetJobTitleFromDescription(targetJobDescription?: string | null): string | null {
  const normalizedDescription = normalizeWhitespace(targetJobDescription)
  if (!normalizedDescription) {
    return null
  }

  const shapedTargetJob = shapeTargetJobDescription(normalizedDescription).content
  const lines = shapedTargetJob
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const explicitRoleLine = lines.find((line) =>
    /^(cargo|position|role|vaga|titulo|title)\s*:/i.test(line),
  )

  if (explicitRoleLine) {
    const explicitRole = cleanExtractedRole(explicitRoleLine.replace(/^[^:]+:\s*/i, '').trim())
    if (!isWeakTargetRole(explicitRole)) {
      return toTitleCase(explicitRole)
    }
  }

  const rolePattern = /\b(analytics engineer|data engineer|data analyst|business intelligence analyst|business intelligence engineer|business intelligence|product manager|analista(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|engenheir[oa](?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|desenvolvedor(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|cientista(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|gerente(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|coordenador(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|consultor(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|designer(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|arquiteto(?:a)?(?:\s+(?:de|da|do)\s+[a-z0-9+/&.-]+){0,3}|devops|sre|qa|especialista(?:\s+(?:em|de)\s+[a-z0-9+/&.-]+){0,3})\b[^,\n|]*/i

  for (const line of lines) {
    if (isSectionHeading(line)) {
      continue
    }

    const matchedRole = line.match(rolePattern)?.[0]
    const cleaned = matchedRole ? cleanExtractedRole(matchedRole) : ''
    if (cleaned && !isWeakTargetRole(cleaned)) {
      return toTitleCase(cleaned)
    }
  }

  return null
}

export function normalizeFilenameSegment(
  value: string | null | undefined,
  options?: { fallback?: string; maxLength?: number },
): string {
  const fallback = options?.fallback ?? ''
  const maxLength = options?.maxLength ?? MAX_NAME_SEGMENT_LENGTH
  const stripped = stripAccents(normalizeWhitespace(value))
  const sanitized = collapseUnderscores(
    stripped
      .replace(/[^A-Za-z0-9]+/g, '_')
      .trim(),
  )

  if (!sanitized) {
    return fallback
  }

  return sanitized.slice(0, maxLength).replace(/^_+|_+$/g, '')
}

function resolveShouldIncludeTargetTitle(input: {
  workflowMode?: WorkflowMode | null
  generationType?: ResumeGenerationType | null
}): boolean {
  return input.generationType === 'JOB_TARGETING' || input.workflowMode === 'job_targeting'
}

function resolveReliableTargetJobTitle(input: {
  targetJobTitle?: string | null
  targetRole?: string | null
  targetRoleConfidence?: 'high' | 'medium' | 'low' | null
  targetJobDescription?: string | null
}): string | null {
  const explicitTargetTitle = normalizeWhitespace(input.targetJobTitle)
  if (explicitTargetTitle) {
    return explicitTargetTitle
  }

  if (input.targetRoleConfidence !== 'low' && input.targetRole && !isWeakTargetRole(input.targetRole)) {
    return input.targetRole
  }

  return extractReliableTargetJobTitleFromDescription(input.targetJobDescription)
}

export function buildResumeExportFilename(input: {
  fullName?: string | null
  workflowMode?: WorkflowMode | null
  generationType?: ResumeGenerationType | null
  targetJobTitle?: string | null
  targetRole?: string | null
  targetRoleConfidence?: 'high' | 'medium' | 'low' | null
  targetJobDescription?: string | null
  extension: string
}): string {
  const normalizedExtension = input.extension.replace(/^\./, '').toLowerCase() || 'pdf'
  const nameSegment = normalizeFilenameSegment(input.fullName, {
    fallback: DEFAULT_NAME_SEGMENT,
    maxLength: MAX_NAME_SEGMENT_LENGTH,
  })

  const includeTargetTitle = resolveShouldIncludeTargetTitle(input)
  const reliableTargetTitle = includeTargetTitle
    ? resolveReliableTargetJobTitle(input)
    : null
  const titleSegment = reliableTargetTitle
    ? normalizeFilenameSegment(reliableTargetTitle, { maxLength: MAX_TITLE_SEGMENT_LENGTH })
    : ''

  const parts = [DEFAULT_PREFIX, nameSegment, titleSegment].filter(Boolean)
  return `${collapseUnderscores(parts.join('_'))}.${normalizedExtension}`
}
