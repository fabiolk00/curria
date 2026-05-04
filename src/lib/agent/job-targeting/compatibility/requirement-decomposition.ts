import type {
  JobCompatibilityRequirement,
  JobCompatibilityRequirementImportance,
  JobCompatibilityRequirementKind,
  JobCompatibilityRequirementSourceKind,
  JobCompatibilityScoreDimensionId,
} from '@/lib/agent/job-targeting/compatibility/types'

export const REQUIREMENT_DECOMPOSITION_VERSION = 'requirement-decomposition-v1'

export type RequirementDecompositionInput =
  | string
  | {
      targetJobDescription: string
    }

type SectionState = {
  section: string
  heading?: string
  sentenceIndex: number
  listIndex: number
}

type SignalResult<T extends string> = {
  value: T
  signalIds: string[]
}

const DEFAULT_SECTION = 'general'

const listItemPattern = /^\s*(?:[-*]|\d+[.)])\s+/
const headingOnlyPattern = /^\s*(?:#{1,6}\s*)?([^:\n]{2,80}):\s*$/
const inlineHeadingPattern = /^\s*(?:#{1,6}\s*)?([^:\n]{2,80}):\s*(.+)$/
const standaloneHeadingPattern = /^\s*(?:#{1,6}\s*)?([^:\n.?!]{2,80})\s*$/

const coreImportancePatterns = [
  { id: 'must', pattern: /\bmust\b/i },
  { id: 'required', pattern: /\brequired\b/i },
  { id: 'mandatory', pattern: /\bmandatory\b/i },
  { id: 'minimum', pattern: /\bminimum\b/i },
  { id: 'essential', pattern: /\bessential\b/i },
  { id: 'necessario', pattern: /\bnecessario\b/i },
  { id: 'obrigatorio', pattern: /\bobrigatorio\b/i },
]

const differentialImportancePatterns = [
  { id: 'preferred', pattern: /\bpreferred\b/i },
  { id: 'nice_to_have', pattern: /\bnice\s+to\s+have\b/i },
  { id: 'desirable', pattern: /\bdesirable\b/i },
  { id: 'differential', pattern: /\bdifferential\b/i },
  { id: 'desejavel', pattern: /\bdesejavel\b/i },
  { id: 'diferencial', pattern: /\bdiferencial\b/i },
]

const responsibilitySectionPattern = /\b(responsibilities|responsibility|activities|tasks|duties|atribuicoes|atividades|responsabilidades)\b/i
const educationRequirementPattern = /\b(education|degree|academic|formacao|graduacao|bacharelado|licenciatura)\b/i

const kindPatterns: Array<{
  kind: JobCompatibilityRequirementKind
  id: string
  pattern: RegExp
}> = [
  { kind: 'education', id: 'education', pattern: educationRequirementPattern },
  { kind: 'responsibility', id: 'experience', pattern: /\b(experience|background|track\s+record|vivencia|experi(?:e|ê)ncia)\b/i },
  { kind: 'responsibility', id: 'responsibility', pattern: responsibilitySectionPattern },
  { kind: 'responsibility', id: 'action_coordinate', pattern: /\b(coordinate|deliver|maintain|support|prepare|manage|analyze|conduzir|coordenar|entregar)\b/i },
  { kind: 'skill', id: 'skill', pattern: /\b(skill|ability|communication|knowledge|proficiency|competencia|habilidade|conhecimento|comunicacao)\b/i },
]

const requirementLeadPattern = /^(?:the\s+role\s+)?(?:must\s+have|must\s+include|must|requires?|required|needs?|should\s+have|preferred|nice\s+to\s+have|desirable|mandatory|essential)\s*:?\s+/i
const jobTitleLeadPattern = /^(?:vaga|cargo|role|position|job)\s+(?:para|de|as|for)?\s*.{2,80}?\s+(?:com|with|para)\s+/i
const standaloneSectionHeadings = [
  /^(?:about the job|about the role|job description)$/i,
  /^(?:qual sera o seu papel|como sera seu dia a dia|o que esperamos de voce)$/i,
  /^(?:responsabilidades?|responsabilidades da posicao|atividades|atribuicoes)$/i,
  /^(?:requisitos?|requisitos do perfil|requisitos e qualificacoes|qualificacoes)$/i,
]
const noiseLinePatterns = [
  /^(?:junte-se|sobre nos|quem somos|todos os dias)\b/i,
  /^(?:com mais de|esta posicao|com reporte para)\b/i,
  /^(?:na relacao com|na gestao|na rotina)\b/i,
  /^(?:sera o principal ponto de contato|voce sera responsavel por conectar)\b/i,
]
const metadataOnlyHeadingPattern = /^(?:cargo|vaga|role|position|job title|target role|empresa|company|contexto|context|observacao|observation|source|testonly|anonymized|metadata)$/i
const seedMetadataLinePatterns = [
  /^empresa ficticia shadow$/i,
  /\bseed de teste anonimo\b/i,
  /\bnao usar dados reais\b/i,
  /\bcaso marcado como shadow_seed\b/i,
  /\bsource\s*:?\s*shadow_seed\b/i,
  /\btestonly\b/i,
  /\banonymized\b/i,
]

export function decomposeJobRequirements(input: RequirementDecompositionInput): JobCompatibilityRequirement[] {
  const targetJobDescription = typeof input === 'string' ? input : input.targetJobDescription
  const sectionState: SectionState = {
    section: DEFAULT_SECTION,
    sentenceIndex: 0,
    listIndex: 0,
  }
  const requirements: JobCompatibilityRequirement[] = []

  splitLines(targetJobDescription).forEach((line) => {
    const headingOnly = line.match(headingOnlyPattern)

    if (headingOnly?.[1]) {
      updateSection(sectionState, headingOnly[1])
      return
    }

    const standaloneHeading = line.match(standaloneHeadingPattern)
    if (standaloneHeading?.[1] && isStandaloneSectionHeading(standaloneHeading[1])) {
      updateSection(sectionState, standaloneHeading[1])
      return
    }

    const inlineHeading = line.match(inlineHeadingPattern)
    const contentLine = inlineHeading?.[2] ?? line

    if (inlineHeading?.[1]) {
      updateSection(sectionState, inlineHeading[1])

      if (isMetadataOnlyHeading(inlineHeading[1])) {
        return
      }
    }

    const isListItem = listItemPattern.test(contentLine)
    const text = contentLine.replace(listItemPattern, '').trim()

    if (!text) {
      return
    }

    if (isNoiseRequirementText(text)) {
      return
    }

    if (isListItem) {
      appendRequirements({
        requirements,
        rawText: text,
        sectionState,
        sourceKind: 'list_item',
        sourceIndex: sectionState.listIndex,
      })
      sectionState.listIndex += 1
      return
    }

    splitSentences(text).forEach((sentence) => {
      appendRequirements({
        requirements,
        rawText: sentence,
        sectionState,
        sourceKind: 'sentence',
        sourceIndex: sectionState.sentenceIndex,
      })
      sectionState.sentenceIndex += 1
    })
  })

  return requirements
}

export function normalizeCompatibilityText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function updateSection(sectionState: SectionState, heading: string) {
  const cleanHeading = cleanRequirementText(heading)

  sectionState.heading = cleanHeading
  sectionState.section = normalizeCompatibilityText(cleanHeading) || DEFAULT_SECTION
  sectionState.sentenceIndex = 0
  sectionState.listIndex = 0
}

function appendRequirements({
  requirements,
  rawText,
  sectionState,
  sourceKind,
  sourceIndex,
}: {
  requirements: JobCompatibilityRequirement[]
  rawText: string
  sectionState: SectionState
  sourceKind: JobCompatibilityRequirementSourceKind
  sourceIndex: number
}) {
  const context = `${sectionState.section} ${rawText}`
  const importance = detectImportance(context)
  const items = splitCompositeRequirement(rawText)

  items.forEach((itemText) => {
    const kind = detectRequirementKind(itemText, sectionState.section)
    const normalizedText = normalizeCompatibilityText(itemText)

    if (!normalizedText) {
      return
    }

    requirements.push({
      id: buildRequirementId(requirements.length, normalizedText),
      text: itemText,
      normalizedText,
      kind: kind.value,
      importance: importance.value,
      scoreDimension: getScoreDimension(kind.value),
      source: {
        section: sectionState.section,
        heading: sectionState.heading,
        sourceKind,
        ...(sourceKind === 'list_item' ? { listIndex: sourceIndex } : { sentenceIndex: sourceIndex }),
      },
      audit: {
        extractorVersion: REQUIREMENT_DECOMPOSITION_VERSION,
        signalIds: [...importance.signalIds, ...kind.signalIds],
      },
    })
  })
}

function splitSentences(value: string): string[] {
  const protectedDotTerms: string[] = []
  const protectedValue = value.replace(
    /\b[\p{L}\p{N}][\p{L}\p{N}+#-]*\.[\p{L}\p{N}][\p{L}\p{N}+#-]*(?:\.[\p{L}\p{N}][\p{L}\p{N}+#-]*)*\b/gu,
    (match) => {
      const placeholder = `__DOT_TERM_${protectedDotTerms.length}__`
      protectedDotTerms.push(match)
      return placeholder
    },
  )

  return protectedValue
    .split(/[.!?]+/)
    .map((sentence) => restoreProtectedDotTerms(sentence, protectedDotTerms))
    .map(cleanRequirementText)
    .filter(Boolean)
}

function restoreProtectedDotTerms(value: string, protectedDotTerms: string[]): string {
  return protectedDotTerms.reduce(
    (restoredValue, term, index) => restoredValue.replaceAll(`__DOT_TERM_${index}__`, term),
    value,
  )
}

function splitCompositeRequirement(value: string): string[] {
  const withoutLead = cleanRequirementText(value)
    .replace(requirementLeadPattern, '')
    .replace(jobTitleLeadPattern, '')

  if (educationRequirementPattern.test(withoutLead)) {
    return [capitalizeFirstLetter(withoutLead)]
  }

  const shouldSplitConjunction = /\b(?:must|requires?|required|needs?|preferred|nice\s+to\s+have)\b/i.test(value)
  const commaReady = shouldSplitConjunction
    ? withoutLead.replace(/\s+(?:and|or)\s+/gi, ', ')
    : withoutLead.replace(/,\s+(?:and|or)\s+/gi, ', ')

  return commaReady
    .split(/\s*[;,]\s*/)
    .map(cleanRequirementText)
    .filter(Boolean)
    .map(capitalizeFirstLetter)
}

function isStandaloneSectionHeading(value: string): boolean {
  const normalizedValue = normalizeCompatibilityText(value)

  return standaloneSectionHeadings.some((pattern) => pattern.test(normalizedValue))
}

function isNoiseRequirementText(value: string): boolean {
  const normalizedValue = normalizeCompatibilityText(cleanRequirementText(value))

  if (!normalizedValue) {
    return true
  }

  return standaloneSectionHeadings.some((pattern) => pattern.test(normalizedValue))
    || noiseLinePatterns.some((pattern) => pattern.test(normalizedValue))
    || seedMetadataLinePatterns.some((pattern) => pattern.test(normalizedValue))
}

function isMetadataOnlyHeading(value: string): boolean {
  return metadataOnlyHeadingPattern.test(normalizeCompatibilityText(value))
}

function detectImportance(value: string): SignalResult<JobCompatibilityRequirementImportance> {
  const normalizedValue = normalizeCompatibilityText(value)
  const differentialSignals = differentialImportancePatterns
    .filter(({ pattern }) => pattern.test(normalizedValue))
    .map(({ id }) => `importance.${id}`)

  if (differentialSignals.length > 0) {
    return { value: 'differential', signalIds: differentialSignals }
  }

  const coreSignals = coreImportancePatterns
    .filter(({ pattern }) => pattern.test(normalizedValue))
    .map(({ id }) => `importance.${id}`)

  if (coreSignals.length > 0) {
    return { value: 'core', signalIds: coreSignals }
  }

  if (responsibilitySectionPattern.test(normalizedValue)) {
    return { value: 'secondary', signalIds: ['importance.responsibility_section'] }
  }

  return { value: 'secondary', signalIds: ['importance.default'] }
}

function detectRequirementKind(
  text: string,
  section: string,
): SignalResult<JobCompatibilityRequirementKind> {
  const normalizedValue = normalizeCompatibilityText(`${section} ${text}`)
  const matched = kindPatterns.find(({ pattern }) => pattern.test(normalizedValue))

  if (!matched) {
    return { value: 'unknown', signalIds: ['kind.default'] }
  }

  return { value: matched.kind, signalIds: [`kind.${matched.id}`] }
}

function getScoreDimension(kind: JobCompatibilityRequirementKind): JobCompatibilityScoreDimensionId {
  if (kind === 'education') {
    return 'education'
  }

  if (kind === 'responsibility' || kind === 'industry' || kind === 'business_domain' || kind === 'seniority') {
    return 'experience'
  }

  return 'skills'
}

function cleanRequirementText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.]+|[\s:;,.]+$/g, '')
    .trim()
}

function capitalizeFirstLetter(value: string): string {
  if (!value) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildRequirementId(index: number, normalizedText: string): string {
  const slug = normalizedText.replace(/\s+/g, '-').slice(0, 48)
  return `requirement-${index + 1}-${slug}`
}
