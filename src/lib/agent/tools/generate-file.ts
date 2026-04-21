import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'
import fontkit from '@pdf-lib/fontkit'
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { PDFDocument, rgb } from 'pdf-lib'
import { z } from 'zod'

import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { CVStateSchema } from '@/lib/cv/schema'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { logWarn, serializeError } from '@/lib/observability/structured-log'
import { ATS_SECTION_HEADINGS, cvStateToTemplateData, type TemplateData } from '@/lib/templates/cv-state-to-template-data'
import type { AgentState, GenerateFileInput, GenerateFileOutput, GeneratedOutput, ToolPatch } from '@/types/agent'
import type { CVState } from '@/types/cv'

export type GenerateFileExecutionResult = {
  output: GenerateFileOutput
  patch?: ToolPatch
  generatedOutput?: GeneratedOutput
}

type SupabaseStorageClient = ReturnType<SupabaseClient['storage']['from']>
type SignedResumeArtifactUrls = {
  pdfUrl: string | null
  docxUrl?: string | null
}

type SignedUrlFallbackContext = {
  userId: string
  sessionId: string
  targetId?: string
  pdfPath: string
  source: 'fresh_generation' | 'existing_generation' | 'idempotent_generation'
}

type ResumeTemplateSource = CVState | TemplateData
type TemplateTargetSource = Pick<AgentState, 'targetJobDescription'> | string | null | undefined

type ArtifactScope =
  | { type: 'session' }
  | { type: 'target'; targetId: string }

const MARGIN = 78
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN
const MAX_VALIDATION_ERROR_MESSAGE_LENGTH = 500
const DEFAULT_VALIDATION_ERROR_MESSAGE = 'O currículo salvo ainda tem lacunas que precisam ser corrigidas antes da geração.'
const EXPERIENCE_ORDINALS = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava']

const GenerationReadyCVStateSchema = CVStateSchema.superRefine((cvState, ctx) => {
  const requireNonEmptyString = (
    value: string,
    path: Array<string | number>,
    label: string,
  ): void => {
    if (value.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `${label} is required.`,
      })
    }
  }

  requireNonEmptyString(cvState.fullName, ['fullName'], 'fullName')

  if (cvState.experience.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['experience'],
      message: 'At least one work experience entry is required.',
    })
  }

  cvState.experience.forEach((entry, index) => {
    requireNonEmptyString(entry.title, ['experience', index, 'title'], `experience[${index}].title`)
    requireNonEmptyString(entry.company, ['experience', index, 'company'], `experience[${index}].company`)
    requireNonEmptyString(entry.startDate, ['experience', index, 'startDate'], `experience[${index}].startDate`)
    requireNonEmptyString(entry.endDate, ['experience', index, 'endDate'], `experience[${index}].endDate`)

    if (entry.bullets.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['experience', index, 'bullets'],
        message: `experience[${index}].bullets must include at least one bullet.`,
      })
    }

    entry.bullets.forEach((bullet, bulletIndex) => {
      requireNonEmptyString(
        bullet,
        ['experience', index, 'bullets', bulletIndex],
        `experience[${index}].bullets[${bulletIndex}]`,
      )
    })
  })

  cvState.skills.forEach((skill, index) => {
    requireNonEmptyString(skill, ['skills', index], `skills[${index}]`)
  })

  cvState.education.forEach((entry, index) => {
    requireNonEmptyString(entry.degree, ['education', index, 'degree'], `education[${index}].degree`)
    requireNonEmptyString(entry.institution, ['education', index, 'institution'], `education[${index}].institution`)
    requireNonEmptyString(entry.year, ['education', index, 'year'], `education[${index}].year`)
  })

  cvState.certifications?.forEach((entry, index) => {
    requireNonEmptyString(entry.name, ['certifications', index, 'name'], `certifications[${index}].name`)
    requireNonEmptyString(entry.issuer, ['certifications', index, 'issuer'], `certifications[${index}].issuer`)
  })
})

type GenerationValidationResult =
  | {
      success: true
      cvState: CVState
      warnings: string[]
    }
  | {
      success: false
      errorMessage: string
    }

type GenerationPlaceholderRule = {
  field: 'email' | 'phone' | 'summary'
  label: string
  placeholder: string
}

const NON_BLOCKING_PLACEHOLDER_RULES: GenerationPlaceholderRule[] = [
  {
    field: 'email',
    label: 'email',
    placeholder: 'Email não informado no perfil salvo.',
  },
  {
    field: 'phone',
    label: 'telefone',
    placeholder: 'Telefone não informado no perfil salvo.',
  },
  {
    field: 'summary',
    label: 'resumo profissional',
    placeholder: 'Resumo profissional pendente. O perfil salvo não traz uma descrição válida para esta seção.',
  },
]

const PREVIEW_FONT_REGULAR_PATH = path.join(
  process.cwd(),
  'public',
  'fonts',
  'inter-all-400-normal.woff',
)
const PREVIEW_FONT_SEMIBOLD_PATH = path.join(
  process.cwd(),
  'public',
  'fonts',
  'inter-all-600-normal.woff',
)

let previewPdfFontBytesPromise: Promise<{ regular: Uint8Array; semibold: Uint8Array }> | null = null

function normalizeNullableString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

async function loadPreviewPdfFontBytes(): Promise<{ regular: Uint8Array; semibold: Uint8Array }> {
  if (!previewPdfFontBytesPromise) {
    previewPdfFontBytesPromise = Promise.all([
      readFile(PREVIEW_FONT_REGULAR_PATH),
      readFile(PREVIEW_FONT_SEMIBOLD_PATH),
    ]).then(([regular, semibold]) => ({
      regular: regular,
      semibold: semibold,
    }))
  }

  return previewPdfFontBytesPromise
}

function normalizeGenerationCvState(input: GenerateFileInput['cv_state']): CVState {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<CVState>
  const rawExperience = Array.isArray(source.experience) ? source.experience : []

  return {
    fullName: normalizeNullableString(source.fullName),
    email: normalizeNullableString(source.email),
    phone: normalizeNullableString(source.phone),
    linkedin: normalizeNullableString(source.linkedin) || undefined,
    location: normalizeNullableString(source.location) || undefined,
    summary: normalizeNullableString(source.summary),
    experience: rawExperience.map((rawEntry, index, entries) => {
      const entry = (rawEntry && typeof rawEntry === 'object' ? rawEntry : {}) as Record<string, unknown>
      const normalizedEndDate = normalizeNullableString(entry.endDate).trim()

      return {
        title: normalizeNullableString(entry.title),
        company: normalizeNullableString(entry.company),
        location: normalizeNullableString(entry.location) || undefined,
        startDate: normalizeNullableString(entry.startDate),
        endDate: normalizedEndDate,
        bullets: Array.isArray(entry.bullets)
          ? entry.bullets.map((bullet) => normalizeNullableString(bullet))
          : [],
      }
    }),
    skills: Array.isArray(source.skills)
      ? source.skills.map((skill) => normalizeNullableString(skill))
      : [],
    education: Array.isArray(source.education)
      ? source.education.map((rawEntry) => {
        const entry = (rawEntry && typeof rawEntry === 'object' ? rawEntry : {}) as Record<string, unknown>
        return {
          degree: normalizeNullableString(entry.degree),
          institution: normalizeNullableString(entry.institution),
          year: normalizeNullableString(entry.year),
          gpa: normalizeNullableString(entry.gpa) || undefined,
        }
      })
      : [],
    certifications: Array.isArray(source.certifications)
      ? source.certifications.map((rawEntry) => {
        const entry = (rawEntry && typeof rawEntry === 'object' ? rawEntry : {}) as Record<string, unknown>
        return {
          name: normalizeNullableString(entry.name),
          issuer: normalizeNullableString(entry.issuer),
          year: normalizeNullableString(entry.year) || undefined,
        }
      })
      : undefined,
  }
}

function capValidationErrorMessage(message: string): string {
  return message.length > MAX_VALIDATION_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_VALIDATION_ERROR_MESSAGE_LENGTH - 3)}...`
    : message
}

function formatValidationPath(path: ReadonlyArray<string | number>): string {
  return path.reduce<string>((formattedPath, segment) => {
    if (typeof segment === 'number') {
      return `${formattedPath}[${segment}]`
    }

    return formattedPath.length === 0
      ? segment
      : `${formattedPath}.${segment}`
  }, '')
}

function getOrdinalLabel(index: number): string {
  return EXPERIENCE_ORDINALS[index] ?? `${index + 1}a`
}

function buildExperienceReference(cvState: CVState, index: number): string {
  const experience = cvState.experience[index]
  if (!experience) {
    return `${index + 1}a experiência`
  }

  const company = experience.company.trim()
  const title = experience.title.trim()

  if (company && title) {
    return `${title} - ${company}`
  }

  if (company) {
    return company
  }

  if (title) {
    return title
  }

  return `${index + 1}a experiência`
}

function humanizeValidationIssue(issue: z.ZodIssue, cvState: CVState): string {
  const [root, index, field] = issue.path

  if (root === 'experience' && typeof index === 'number') {
    const ordinal = getOrdinalLabel(index)
    const reference = buildExperienceReference(cvState, index)

    if (field === 'title') {
      return `Falta o cargo na sua ${ordinal} experiência - ${reference}.`
    }

    if (field === 'company') {
      return `Falta a empresa na sua ${ordinal} experiência - ${reference}.`
    }

    if (field === 'startDate') {
      return `Falta a data de início na sua ${ordinal} experiência - ${reference}.`
    }

    if (field === 'endDate') {
      return `Falta a data de término na sua ${ordinal} experiência - ${reference}. Se você ainda trabalha nela, marque como atual ou informe uma data aproximada.`
    }

    if (field === 'bullets') {
      return `Falta a descrição da sua ${ordinal} experiência - ${reference}. Adicione pelo menos um resultado, responsabilidade ou entrega dessa função.`
    }
  }

  if (root === 'fullName') {
    return 'Falta o nome completo no perfil salvo.'
  }

  if (root === 'experience') {
    return 'Falta pelo menos uma experiência profissional no currículo salvo.'
  }

  if (root === 'education' && typeof index === 'number') {
    if (field === 'degree') {
      return `Falta o curso na sua formação ${index + 1}.`
    }

    if (field === 'institution') {
      return `Falta a instituição na sua formação ${index + 1}.`
    }

    if (field === 'year') {
      return `Falta o ano ou data principal na sua formação ${index + 1}.`
    }
  }

  const path = formatValidationPath(issue.path)
  const baseMessage = issue.code === z.ZodIssueCode.custom || path.length === 0
    ? issue.message
    : `${path}: ${issue.message}`

  return baseMessage || DEFAULT_VALIDATION_ERROR_MESSAGE
}

function getValidationErrorMessage(error: z.ZodError<CVState>, cvState: CVState): string {
  const [firstIssue] = error.issues

  if (!firstIssue) {
    return DEFAULT_VALIDATION_ERROR_MESSAGE
  }

  return capValidationErrorMessage(humanizeValidationIssue(firstIssue, cvState))
}

export function validateGenerationCvState(cvState: GenerateFileInput['cv_state']): GenerationValidationResult {
  const normalizedCvState = normalizeGenerationCvState(cvState)
  const parsedCvState = GenerationReadyCVStateSchema.safeParse(normalizedCvState)

  if (!parsedCvState.success) {
    return {
      success: false,
      errorMessage: getValidationErrorMessage(parsedCvState.error, normalizedCvState),
    }
  }

  const generationReadyCvState = structuredClone(parsedCvState.data)
  const warnings: string[] = []

  for (const rule of NON_BLOCKING_PLACEHOLDER_RULES) {
    if (generationReadyCvState[rule.field].trim().length > 0) {
      continue
    }

    generationReadyCvState[rule.field] = rule.placeholder
    warnings.push(rule.label)
  }

  return {
    success: true,
    cvState: generationReadyCvState,
    warnings,
  }
}

function getSupabase(): SupabaseClient {
  return getSupabaseAdminClient()
}

function createSuccessPatch(pdfPath: string): ToolPatch {
  return {
    generatedOutput: createGeneratedOutput('ready', undefined, undefined, pdfPath),
  }
}

function createGeneratedOutput(status: GeneratedOutput['status'], error?: string, docxPath?: string, pdfPath?: string): GeneratedOutput {
  return {
    status,
    docxPath,
    pdfPath,
    generatedAt: status === 'ready' ? new Date().toISOString() : undefined,
    error,
  }
}

function createFailurePatch(error: string, docxPath?: string, pdfPath?: string): ToolPatch {
  return {
    generatedOutput: createGeneratedOutput('failed', error, docxPath, pdfPath),
  }
}

function buildArtifactPaths(
  userId: string,
  sessionId: string,
  scope: ArtifactScope,
): { pdfPath: string } {
  if (scope.type === 'target') {
    return {
      pdfPath: `${userId}/${sessionId}/targets/${scope.targetId}/resume.pdf`,
    }
  }

  return {
    pdfPath: `${userId}/${sessionId}/resume.pdf`,
  }
}

export async function createSignedResumeArtifactUrls(
  docxPath: string | undefined,
  pdfPath: string,
  supabase: SupabaseClient = generateFileDeps.getSupabase(),
): Promise<SignedResumeArtifactUrls> {
  const { data: pdfSigned, error: pdfError } = await supabase.storage
    .from('resumes')
    .createSignedUrl(pdfPath, 3600)

  if (pdfError || !pdfSigned?.signedUrl) {
    throw new Error('Failed to create signed download URLs.')
  }

  return {
    docxUrl: docxPath ? null : null,
    pdfUrl: pdfSigned.signedUrl,
  }
}

export async function createSignedResumeArtifactUrlsBestEffort(
  docxPath: string | undefined,
  pdfPath: string,
  fallbackContext: SignedUrlFallbackContext,
  supabase: SupabaseClient = generateFileDeps.getSupabase(),
): Promise<SignedResumeArtifactUrls> {
  try {
    return await createSignedResumeArtifactUrls(docxPath, pdfPath, supabase)
  } catch (error) {
    logWarn('resume.generation.signed_url_unavailable', {
      userId: fallbackContext.userId,
      sessionId: fallbackContext.sessionId,
      targetId: fallbackContext.targetId,
      pdfPath: fallbackContext.pdfPath,
      source: fallbackContext.source,
      ...serializeError(error),
    })

    return {
      docxUrl: null,
      pdfUrl: null,
    }
  }
}

export async function generateFile(
  input: GenerateFileInput,
  userId: string,
  sessionId: string,
  scope: ArtifactScope = { type: 'session' },
  templateTargetSource?: TemplateTargetSource,
): Promise<GenerateFileExecutionResult> {
  let docxPath: string | undefined
  let pdfPath: string | undefined

  const validation = validateGenerationCvState(input.cv_state)
  if (!validation.success) {
    return {
      output: toolFailure(TOOL_ERROR_CODES.VALIDATION_ERROR, validation.errorMessage),
      patch: scope.type === 'session'
        ? createFailurePatch(validation.errorMessage, docxPath, pdfPath)
        : undefined,
      generatedOutput: createGeneratedOutput('failed', validation.errorMessage, docxPath, pdfPath),
    }
  }

  try {
    const supabase = generateFileDeps.getSupabase()
    const templateData = cvStateToTemplateData(validation.cvState, templateTargetSource)

    const pdfBuffer = await generateFileDeps.generatePDF(templateData)

    const artifactPaths = buildArtifactPaths(userId, sessionId, scope)
    pdfPath = artifactPaths.pdfPath

    await generateFileDeps.upload(
      supabase,
      pdfPath,
      pdfBuffer,
      'application/pdf',
    )

    const signedUrls = await createSignedResumeArtifactUrlsBestEffort(
      docxPath,
      pdfPath,
      {
        userId,
        sessionId,
        targetId: scope.type === 'target' ? scope.targetId : undefined,
        pdfPath,
        source: 'fresh_generation',
      },
      supabase,
    )

    return {
      output: {
        success: true,
        pdfUrl: signedUrls.pdfUrl,
        docxUrl: null,
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      },
      patch: scope.type === 'session' ? createSuccessPatch(pdfPath) : undefined,
      generatedOutput: createGeneratedOutput('ready', undefined, undefined, pdfPath),
    }
  } catch (err) {
    console.error('[generateFile]', err)

    const error = err instanceof Error && err.message
      ? err.message
      : 'File generation failed.'

    return {
      output: toolFailure(TOOL_ERROR_CODES.GENERATION_ERROR, 'File generation failed.'),
      patch: scope.type === 'session' ? createFailurePatch(error, docxPath, pdfPath) : undefined,
      generatedOutput: createGeneratedOutput('failed', error, docxPath, pdfPath),
    }
  }
}

function toTemplateData(source: ResumeTemplateSource): TemplateData {
  return isTemplateData(source)
    ? source
    : cvStateToTemplateData(source)
}

function isTemplateData(source: ResumeTemplateSource): source is TemplateData {
  return typeof source === 'object' && source !== null && 'experiences' in source
}

function buildContactLines(templateData: TemplateData): string[] {
  const lines: string[] = []

  if (templateData.location.trim().length > 0) {
    lines.push(templateData.location.trim())
  }

  const contactLine = [
    templateData.email.trim(),
    templateData.phone.trim(),
  ].filter(Boolean)

  if (contactLine.length > 0) {
    lines.push(contactLine.join(' | '))
  }

  if (templateData.linkedin.trim().length > 0) {
    lines.push(templateData.linkedin.trim())
  }

  return lines
}

function sanitizePdfText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u00A0\u2007\u202F]/gu, ' ')
    .replace(/[‐‑‒–—−]/gu, '-')
    .replace(/[•▪◦●○]/gu, '-')
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
}

function buildSkillGroupLines(templateData: TemplateData): string[] {
  if (templateData.skillGroups.length > 0) {
    return templateData.skillGroups.map((group) => `${group.label}: ${group.items.join(', ')}`)
  }

  if (templateData.skills.trim().length > 0) {
    return [templateData.skills.trim()]
  }

  return []
}

function formatExperienceMetadata(experience: TemplateData['experiences'][number]): string {
  const parts = [experience.period.trim()]

  if (experience.location.trim().length > 0) {
    parts.push(experience.location.trim())
  }

  return parts.join(' | ')
}

function formatExperienceSecondaryLine(experience: TemplateData['experiences'][number]): string {
  const parts = [experience.company.trim()]

  if (experience.location.trim().length > 0) {
    parts.push(experience.location.trim())
  }

  return parts.filter(Boolean).join(' | ')
}

function formatCertificationLine(certification: TemplateData['certifications'][number]): string {
  const trailingParts = [certification.issuer.trim(), certification.period.trim()].filter(Boolean)

  return trailingParts.length > 0
    ? `${certification.name.trim()} - ${trailingParts.join(' | ')}`
    : certification.name.trim()
}

function formatLanguageLine(language: TemplateData['languages'][number]): string {
  return language.level.trim().length > 0
    ? `${language.language}: ${language.level.trim()}`
    : language.language
}

function createDocxSeparator(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: 'BBBBBB',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { after: 180 },
  })
}

function createDocxHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: 'Helvetica',
        size: 28,
        bold: true,
        color: '000000',
      }),
    ],
    spacing: { before: 0, after: 120 },
    heading: HeadingLevel.HEADING_2,
  })
}

function createDocxBody(
  text: string,
  options: { bold?: boolean; italics?: boolean; color?: string } = {},
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: 'Helvetica',
        size: 20,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
        color: options.color ?? '1A1A1A',
      }),
    ],
    spacing: { after: 120 },
  })
}

function createDocxBullet(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: 'Helvetica',
        size: 20,
        color: '1A1A1A',
      }),
    ],
    bullet: { level: 0 },
    indent: { left: 360, hanging: 120 },
    spacing: { after: 80 },
  })
}

function buildDocxDocument(templateData: TemplateData): Document {
  const contactLines = buildContactLines(templateData)
  const skillLines = buildSkillGroupLines(templateData)

  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: templateData.fullName,
          font: 'Helvetica',
          size: 28,
          bold: true,
          color: '000000',
        }),
      ],
      spacing: { after: 60 },
    }),
  ]

  for (const line of contactLines) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: 'Helvetica',
            size: 20,
            color: '555555',
          }),
        ],
        spacing: { after: 60 },
      }),
    )
  }

  children.push(
    createDocxSeparator(),
    createDocxHeading(ATS_SECTION_HEADINGS.summary),
    createDocxBody(templateData.summary),
  )

  if (skillLines.length > 0) {
    children.push(
      createDocxSeparator(),
      createDocxHeading(ATS_SECTION_HEADINGS.skills),
    )

    for (const line of skillLines) {
      children.push(createDocxBody(line))
    }
  }

  if (templateData.experiences.length > 0) {
    children.push(createDocxSeparator(), createDocxHeading(ATS_SECTION_HEADINGS.experience))

    templateData.experiences.forEach((experience, index) => {
      children.push(
        createDocxBody(experience.title, {
          bold: true,
        }),
        createDocxBody(experience.company, {
          color: '1A1A1A',
        }),
        createDocxBody(formatExperienceMetadata(experience), {
          color: '555555',
        }),
      )

      for (const bullet of experience.bullets) {
        children.push(createDocxBullet(bullet.text))
      }

      if (index < templateData.experiences.length - 1) {
        children.push(createDocxSeparator())
      }
    })
  }

  if (templateData.education.length > 0) {
    children.push(createDocxSeparator(), createDocxHeading(ATS_SECTION_HEADINGS.education))

    for (const education of templateData.education) {
      children.push(
        createDocxBody(education.degree, {
          bold: true,
        }),
        createDocxBody(
          [education.institution, education.period].filter(Boolean).join(' - '),
          { color: '555555' },
        ),
      )
    }
  }

  if (templateData.hasCertifications) {
    children.push(createDocxSeparator(), createDocxHeading(ATS_SECTION_HEADINGS.certifications))

    for (const certification of templateData.certifications) {
      children.push(createDocxBody(formatCertificationLine(certification)))
    }
  }

  if (templateData.hasLanguages) {
    children.push(createDocxSeparator(), createDocxHeading(ATS_SECTION_HEADINGS.languages))

    for (const language of templateData.languages) {
      children.push(createDocxBody(formatLanguageLine(language)))
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Helvetica',
            size: 20,
            color: '1A1A1A',
          },
          paragraph: {
            spacing: {
              line: 240,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              right: 1134,
              bottom: 1134,
              left: 1134,
            },
          },
        },
        children,
      },
    ],
  })
}

export async function generateDOCX(source: ResumeTemplateSource): Promise<Buffer> {
  const templateData = toTemplateData(source)
  const doc = buildDocxDocument(templateData)
  return Packer.toBuffer(doc)
}

async function generatePDF(source: ResumeTemplateSource): Promise<Buffer> {
  const templateData = toTemplateData(source)
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const previewFontBytes = await loadPreviewPdfFontBytes()
  const font = await pdfDoc.embedFont(previewFontBytes.regular)
  const fontBold = await pdfDoc.embedFont(previewFontBytes.semibold)

  const palette = {
    text: rgb(0.09, 0.09, 0.11),
    muted: rgb(0.34, 0.36, 0.4),
    separator: rgb(0.85, 0.87, 0.9),
    heading: rgb(0.18, 0.2, 0.24),
  }

  const typography = {
    nameSize: 22,
    sectionSize: 11,
    bodySize: 10,
    metaSize: 9.25,
    experienceTitleSize: 11,
    companySize: 10.1,
  }

  let currentY = PAGE_HEIGHT - MARGIN

  function drawText(
    activePage: typeof page,
    text: string,
    x: number,
    y: number,
    size: number,
    activeFont: typeof font,
    color = palette.text,
    lineGap = 4,
  ): number {
    activePage.drawText(sanitizePdfText(text), { x, y, size, font: activeFont, color })
    return y - size - lineGap
  }

  function drawSeparator(activePage: typeof page, y: number): void {
    activePage.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.8,
      color: palette.separator,
    })
  }

  function wrapText(text: string, activeFont: typeof font, size: number, maxWidth: number): string[] {
    const words = sanitizePdfText(text).split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = activeFont.widthOfTextAtSize(testLine, size)

      if (width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  function drawSectionHeading(activePage: typeof page, title: string, y: number): number {
    const headingText = title.toUpperCase()
    const nextY = y - 16
    const headingWidth = fontBold.widthOfTextAtSize(headingText, typography.sectionSize)

    activePage.drawText(headingText, {
      x: MARGIN,
      y: nextY,
      size: typography.sectionSize,
      font: fontBold,
      color: palette.heading,
    })

    activePage.drawLine({
      start: { x: MARGIN + headingWidth + 12, y: nextY + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: nextY + 4 },
      thickness: 0.8,
      color: palette.separator,
    })

    return nextY - 16
  }

  function checkPageOverflow(y: number, minimumRemainingHeight = 80): typeof page {
    if (y < MARGIN + minimumRemainingHeight) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      currentY = PAGE_HEIGHT - MARGIN
    }

    return page
  }

  function drawWrappedLines(lines: string[], indent = 0, color = palette.text, size = typography.bodySize, lineGap = 5): void {
    for (const line of lines) {
      page = checkPageOverflow(currentY, 40)
      currentY = drawText(page, line, MARGIN + indent, currentY, size, font, color, lineGap)
    }
  }

  function drawBulletParagraphs(lines: string[]): void {
    for (const bullet of lines) {
      const bulletLines = wrapText(bullet, font, typography.bodySize, USABLE_WIDTH - 22)

      for (let lineIndex = 0; lineIndex < bulletLines.length; lineIndex++) {
        page = checkPageOverflow(currentY, 40)
        const prefix = lineIndex === 0 ? '- ' : '  '
        currentY = drawText(
          page,
          `${prefix}${bulletLines[lineIndex]}`,
          MARGIN + 16,
          currentY,
          typography.bodySize,
          font,
          palette.text,
          5,
        )
      }

      currentY -= 1
    }
  }

  function drawExperienceHeader(experience: TemplateData['experiences'][number]): void {
    const period = sanitizePdfText(experience.period)
    const periodWidth = period.length > 0
      ? font.widthOfTextAtSize(period, typography.metaSize)
      : 0
    const titleMaxWidth = period.length > 0
      ? Math.max(160, USABLE_WIDTH - periodWidth - 16)
      : USABLE_WIDTH
    const titleLines = wrapText(experience.title, fontBold, typography.experienceTitleSize, titleMaxWidth)
    const headerTopY = currentY

    for (let index = 0; index < titleLines.length; index += 1) {
      page = checkPageOverflow(currentY, 40)
      const line = titleLines[index]
      const lineY = currentY

      currentY = drawText(
        page,
        line,
        MARGIN,
        lineY,
        typography.experienceTitleSize,
        fontBold,
        palette.text,
        4,
      )

      if (index === 0 && period.length > 0) {
        page.drawText(period, {
          x: PAGE_WIDTH - MARGIN - periodWidth,
          y: lineY + 0.5,
          size: typography.metaSize,
          font,
          color: palette.muted,
        })
      }
    }

    if (titleLines.length === 0 && period.length > 0) {
      page.drawText(period, {
        x: PAGE_WIDTH - MARGIN - periodWidth,
        y: headerTopY + 0.5,
        size: typography.metaSize,
        font,
        color: palette.muted,
      })
      currentY = headerTopY - typography.metaSize - 4
    }

    const secondaryLine = formatExperienceSecondaryLine(experience)
    if (secondaryLine.length > 0) {
      currentY = drawText(
        page,
        secondaryLine,
        MARGIN,
        currentY,
        typography.companySize,
        font,
        palette.heading,
        5,
      )
    }
  }

  const contactLines = buildContactLines(templateData)
  const skillLines = buildSkillGroupLines(templateData)

  currentY = drawText(page, templateData.fullName, MARGIN, currentY, typography.nameSize, fontBold, palette.text, 7)

  for (const line of contactLines) {
    currentY = drawText(page, line, MARGIN, currentY, typography.metaSize, font, palette.muted, 4)
  }

  currentY -= 6

  if (templateData.summary) {
    page = checkPageOverflow(currentY, 120)
    drawSeparator(page, currentY)
    currentY -= 12
    currentY = drawSectionHeading(page, ATS_SECTION_HEADINGS.summary, currentY)

    const summaryLines = wrapText(templateData.summary, font, typography.bodySize, USABLE_WIDTH)
    drawWrappedLines(summaryLines, 0, palette.text, typography.bodySize, 5)
    currentY -= 10
  }

  if (skillLines.length > 0) {
    page = checkPageOverflow(currentY, 120)
    drawSeparator(page, currentY)
    currentY -= 12
    currentY = drawSectionHeading(page, ATS_SECTION_HEADINGS.skills, currentY)

    for (const line of skillLines) {
      const wrappedSkillLine = wrapText(line, font, typography.bodySize, USABLE_WIDTH)
      drawWrappedLines(wrappedSkillLine, 0, palette.text, typography.bodySize, 5)
      currentY -= 3
    }
    currentY -= 8
  }

  if (templateData.experiences.length > 0) {
    page = checkPageOverflow(currentY, 120)
    drawSeparator(page, currentY)
    currentY -= 12
    currentY = drawSectionHeading(page, ATS_SECTION_HEADINGS.experience, currentY)

    for (let index = 0; index < templateData.experiences.length; index += 1) {
      const experience = templateData.experiences[index]
      page = checkPageOverflow(currentY, 120)
      drawExperienceHeader(experience)
      currentY -= 3

      drawBulletParagraphs(experience.bullets.map((bullet) => bullet.text))
      currentY -= 8

      if (index < templateData.experiences.length - 1) {
        page = checkPageOverflow(currentY, 60)
        drawSeparator(page, currentY + 2)
        currentY -= 18
      }
    }
  }

  if (templateData.education.length > 0) {
    page = checkPageOverflow(currentY, 120)
    drawSeparator(page, currentY)
    currentY -= 12
    currentY = drawSectionHeading(page, ATS_SECTION_HEADINGS.education, currentY)

    for (const education of templateData.education) {
      page = checkPageOverflow(currentY, 80)
      currentY = drawText(page, education.degree, MARGIN, currentY, typography.bodySize, fontBold, palette.text, 4)
      currentY = drawText(
        page,
        [education.institution, education.period].filter(Boolean).join(' - '),
        MARGIN,
        currentY,
        typography.metaSize,
        font,
        palette.muted,
        6,
      )
    }
    currentY -= 10
  }

  if (templateData.hasCertifications) {
    page = checkPageOverflow(currentY, 120)
    drawSeparator(page, currentY)
    currentY -= 12
    currentY = drawSectionHeading(page, ATS_SECTION_HEADINGS.certifications, currentY)

    for (const certification of templateData.certifications) {
      page = checkPageOverflow(currentY, 60)
      currentY = drawText(page, formatCertificationLine(certification), MARGIN, currentY, typography.bodySize, font, palette.text, 6)
    }
    currentY -= 10
  }

  if (templateData.hasLanguages) {
    page = checkPageOverflow(currentY, 120)
    drawSeparator(page, currentY)
    currentY -= 12
    currentY = drawSectionHeading(page, ATS_SECTION_HEADINGS.languages, currentY)

    for (const language of templateData.languages) {
      page = checkPageOverflow(currentY, 60)
      currentY = drawText(page, formatLanguageLine(language), MARGIN, currentY, typography.bodySize, font, palette.text, 6)
    }
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

async function upload(
  supabase: SupabaseClient,
  filePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from('resumes')
    .upload(filePath, buffer, { contentType, upsert: true })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }
}

export const generateFileDeps = {
  getSupabase,
  generateDOCX,
  generatePDF,
  upload,
}
