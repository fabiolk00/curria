import type {
  EvidencePolarity,
  EvidenceQualifier,
} from '@/lib/agent/job-targeting/compatibility/types'

export const RESUME_EVIDENCE_SOURCE_CONFIDENCE = {
  experience_bullet: 1,
  experience_title: 0.8,
  certification_entry: 0.9,
  education_entry: 0.9,
  skill: 0.65,
  summary_sentence: 0.55,
} as const

const NON_ACCENTED_EXPERIENCIA = 'experi' + 'encia'
const NON_ACCENTED_NAO = 'na' + 'o'

const QUALIFIER_PATTERNS: Array<{
  qualifier: EvidenceQualifier
  pattern: RegExp
}> = [
  {
    qualifier: 'negative',
    pattern: new RegExp(
      `\\b(?:${NON_ACCENTED_NAO}\\s+possui|${NON_ACCENTED_NAO}\\s+registra|sem\\s+${NON_ACCENTED_EXPERIENCIA}|sem\\s+vivencia|ainda\\s+${NON_ACCENTED_NAO}|${NON_ACCENTED_NAO}\\s+tem\\s+${NON_ACCENTED_EXPERIENCIA}|no\\s+experience|without\\s+experience|not\\s+experienced|does\\s+not\\s+have\\s+experience)\\b`,
      'iu',
    ),
  },
  {
    qualifier: 'introductory',
    pattern: /\b(?:curso\s+introdutorio|introductory\s+course|introductory)\b/iu,
  },
  {
    qualifier: 'learning',
    pattern: /\b(?:aprendendo|learning|studying|estudando)\b/iu,
  },
  {
    qualifier: 'basic',
    pattern: /\b(?:basico|basica|basic|beginner|iniciante)\b/iu,
  },
  {
    qualifier: 'familiarity',
    pattern: /\b(?:nocoes|familiarity|familiarizado|familiarizada)\b/iu,
  },
  {
    qualifier: 'expired',
    pattern: /\b(?:expirados?|expiradas?|expired)\b/iu,
  },
  {
    qualifier: 'strong',
    pattern: new RegExp(
      `\\b(?:avancados?|avancadas?|advanced|proficiencia|proficiency|${NON_ACCENTED_EXPERIENCIA}\\s+(?:solida|comprovada|pratica)|hands-on)\\b`,
      'iu',
    ),
  },
]

const negativeCueTokenSequences = [
  [NON_ACCENTED_NAO, 'possui'],
  [NON_ACCENTED_NAO, 'registra'],
  ['sem', NON_ACCENTED_EXPERIENCIA],
  ['sem', 'vivencia'],
  ['sem', 'foco', 'em'],
  ['ainda', NON_ACCENTED_NAO],
  [NON_ACCENTED_NAO, 'tem', NON_ACCENTED_EXPERIENCIA],
  ['no', 'experience'],
  ['without', 'experience'],
  ['not', 'experienced'],
  ['does', 'not', 'have', 'experience'],
] as const

const weakCueTokenSequences = [
  ['basico'],
  ['basica'],
  ['basic'],
  ['beginner'],
  ['iniciante'],
  ['aprendendo'],
  ['learning'],
  ['estudando'],
  ['familiarity'],
  ['familiarizado'],
  ['familiarizada'],
] as const

export function detectEvidenceQualifier(value: string): EvidenceQualifier {
  const normalizedValue = normalizeEvidenceText(value)
  const match = QUALIFIER_PATTERNS.find(({ pattern }) => pattern.test(normalizedValue))
  return match?.qualifier ?? 'unknown'
}

export function detectEvidencePolarity(text: string, term: string): EvidencePolarity {
  const textTokens = polarityTokens(text)
  const termTokens = polarityTokens(term)

  if (textTokens.length === 0 || termTokens.length === 0) {
    return 'unknown'
  }

  const termPositions = findTokenSequencePositions(textTokens, termTokens)
  if (termPositions.length === 0) {
    return 'unknown'
  }

  if (termPositions.some((position) => hasCueBefore(textTokens, position, negativeCueTokenSequences))) {
    return 'negative'
  }

  if (termPositions.some((position) => hasCueBefore(textTokens, position, weakCueTokenSequences))) {
    return 'weak'
  }

  return 'positive'
}

export function isWeakEvidenceQualifier(qualifier: EvidenceQualifier): boolean {
  return qualifier === 'basic'
    || qualifier === 'introductory'
    || qualifier === 'learning'
    || qualifier === 'familiarity'
    || qualifier === 'expired'
}

function hasCueBefore(
  tokens: string[],
  termPosition: number,
  cueSequences: readonly (readonly string[])[],
): boolean {
  const windowStart = Math.max(0, termPosition - 16)
  const contextTokens = tokens.slice(windowStart, termPosition)

  return cueSequences.some((cueSequence) => (
    findTokenSequencePositions(contextTokens, cueSequence).length > 0
  ))
}

function findTokenSequencePositions(tokens: string[], sequence: readonly string[]): number[] {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return []
  }

  const positions: number[] = []
  tokens.forEach((_, index) => {
    if (sequence.every((token, offset) => tokens[index + offset] === token)) {
      positions.push(index)
    }
  })

  return positions
}

function polarityTokens(value: string): string[] {
  return normalizeEvidenceText(value)
    .replace(/[^\w\s-]/gu, ' ')
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean)
}

function normalizeEvidenceText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim()
}
