import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { z } from 'zod'

import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { CVStateSchema } from '@/lib/cv/schema'
import { cvStateToTemplateData, type TemplateData } from '@/lib/templates/cv-state-to-template-data'
import type { AgentState, GenerateFileInput, GenerateFileOutput, GeneratedOutput, ToolPatch } from '@/types/agent'
import type { CVState } from '@/types/cv'

type GenerateFileExecutionResult = {
  output: GenerateFileOutput
  patch?: ToolPatch
  generatedOutput?: GeneratedOutput
}

type SupabaseStorageClient = ReturnType<SupabaseClient['storage']['from']>
type SignedResumeArtifactUrls = {
  pdfUrl: string
  docxUrl?: string | null
}

type ResumeTemplateSource = CVState | TemplateData
type TemplateTargetSource = Pick<AgentState, 'targetJobDescription'> | string | null | undefined

type ArtifactScope =
  | { type: 'session' }
  | { type: 'target'; targetId: string }

const MARGIN = 50
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN
const MAX_VALIDATION_ERROR_MESSAGE_LENGTH = 500
const DEFAULT_VALIDATION_ERROR_MESSAGE = 'O curriculo salvo ainda tem lacunas que precisam ser corrigidas antes da geracao.'
const EXPERIENCE_ORDINALS = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'setima', 'oitava']

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
    placeholder: 'Email nao informado no perfil salvo.',
  },
  {
    field: 'phone',
    label: 'telefone',
    placeholder: 'Telefone nao informado no perfil salvo.',
  },
  {
    field: 'summary',
    label: 'resumo profissional',
    placeholder: 'Resumo profissional pendente. O perfil salvo nao traz uma descricao valida para esta secao.',
  },
]

function normalizeNullableString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function getCurrentMonthYear(): string {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

function isMostRecentExperienceIndex(index: number, totalEntries: number): boolean {
  return index === 0 || index === totalEntries - 1
}

function normalizeGenerationCvState(input: GenerateFileInput['cv_state']): CVState {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<CVState>
  const rawExperience = Array.isArray(source.experience) ? source.experience : []
  const currentMonthYear = getCurrentMonthYear()

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
        endDate: normalizedEndDate.length > 0
          ? normalizedEndDate
          : (isMostRecentExperienceIndex(index, entries.length) ? currentMonthYear : ''),
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
    return `${index + 1}a experiencia`
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

  return `${index + 1}a experiencia`
}

function humanizeValidationIssue(issue: z.ZodIssue, cvState: CVState): string {
  const [root, index, field] = issue.path

  if (root === 'experience' && typeof index === 'number') {
    const ordinal = getOrdinalLabel(index)
    const reference = buildExperienceReference(cvState, index)

    if (field === 'title') {
      return `Falta o cargo na sua ${ordinal} experiencia - ${reference}.`
    }

    if (field === 'company') {
      return `Falta a empresa na sua ${ordinal} experiencia - ${reference}.`
    }

    if (field === 'startDate') {
      return `Falta a data de inicio na sua ${ordinal} experiencia - ${reference}.`
    }

    if (field === 'endDate') {
      return `Falta a data de termino na sua ${ordinal} experiencia - ${reference}. Se voce ainda trabalha nela, marque como atual ou informe uma data aproximada.`
    }

    if (field === 'bullets') {
      return `Falta a descricao da sua ${ordinal} experiencia - ${reference}. Adicione pelo menos um resultado, responsabilidade ou entrega dessa funcao.`
    }
  }

  if (root === 'fullName') {
    return 'Falta o nome completo no perfil salvo.'
  }

  if (root === 'experience') {
    return 'Falta pelo menos uma experiencia profissional no curriculo salvo.'
  }

  if (root === 'education' && typeof index === 'number') {
    if (field === 'degree') {
      return `Falta o curso na sua formacao ${index + 1}.`
    }

    if (field === 'institution') {
      return `Falta a instituicao na sua formacao ${index + 1}.`
    }

    if (field === 'year') {
      return `Falta o ano ou data principal na sua formacao ${index + 1}.`
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

function validateGenerationCvState(cvState: GenerateFileInput['cv_state']): GenerationValidationResult {
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are not configured.')
  }

  return createClient(url, serviceRoleKey)
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

    const signedUrls = await createSignedResumeArtifactUrls(docxPath, pdfPath, supabase)

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

function createDocxHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: 'Helvetica',
        size: 22,
        bold: true,
        color: '000000',
      }),
    ],
    spacing: { before: 240, after: 120 },
    border: {
      bottom: {
        color: 'BBBBBB',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
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
        size: 18,
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
        size: 18,
        color: '1A1A1A',
      }),
    ],
    bullet: { level: 0 },
    indent: { left: 360, hanging: 120 },
    spacing: { after: 80 },
  })
}

function buildDocxDocument(templateData: TemplateData): Document {
  const contactLine = [
    templateData.email,
    templateData.phone,
    templateData.linkedin,
    templateData.location,
  ].filter(Boolean).join('  |  ')

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

  if (templateData.jobTitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: templateData.jobTitle,
            font: 'Helvetica',
            size: 18,
            italics: true,
            color: '555555',
          }),
        ],
        spacing: { after: 60 },
      }),
    )
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contactLine,
          font: 'Helvetica',
          size: 18,
          color: '555555',
        }),
      ],
      spacing: { after: 180 },
      border: {
        bottom: {
          color: 'BBBBBB',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
    }),
    createDocxHeading('Resumo Profissional'),
    createDocxBody(templateData.summary),
    createDocxHeading('Habilidades'),
    createDocxBody(templateData.skills),
  )

  if (templateData.experiences.length > 0) {
    children.push(createDocxHeading('ExperiÃªncia Profissional'))

    for (const experience of templateData.experiences) {
      children.push(
        createDocxBody(`${experience.title}${experience.company ? ` - ${experience.company}` : ''}`, {
          bold: true,
        }),
        createDocxBody(experience.period, {
          color: '555555',
        }),
      )

      if (experience.techStack) {
        children.push(
          createDocxBody(`Tech stack: ${experience.techStack}`, {
            color: '555555',
          }),
        )
      }

      for (const bullet of experience.bullets) {
        children.push(createDocxBullet(bullet.text))
      }
    }
  }

  if (templateData.education.length > 0) {
    children.push(createDocxHeading('EducaÃ§Ã£o'))

    for (const education of templateData.education) {
      children.push(
        createDocxBody(
          `${education.degree}${education.institution ? ` - ${education.institution}` : ''}${education.period ? ` - ${education.period}` : ''}`,
        ),
      )
    }
  }

  if (templateData.hasCertifications) {
    children.push(createDocxHeading('CertificaÃ§Ãµes'))

    for (const certification of templateData.certifications) {
      children.push(createDocxBody(certification.name))
    }
  }

  if (templateData.hasLanguages) {
    children.push(createDocxHeading('Idiomas'))

    for (const language of templateData.languages) {
      children.push(
        createDocxBody(language.level ? `${language.language} - ${language.level}` : language.language),
      )
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Helvetica',
            size: 18,
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
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let currentY = PAGE_HEIGHT - MARGIN

  function drawText(
    activePage: typeof page,
    text: string,
    x: number,
    y: number,
    size: number,
    activeFont: typeof font,
    color = rgb(0, 0, 0),
  ): number {
    activePage.drawText(text, { x, y, size, font: activeFont, color })
    return y - size - 4
  }

  function drawLine(activePage: typeof page, y: number): void {
    activePage.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })
  }

  function wrapText(text: string, activeFont: typeof font, size: number, maxWidth: number): string[] {
    const words = text.split(' ')
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
    let nextY = y - 12
    activePage.drawText(title.toUpperCase(), {
      x: MARGIN,
      y: nextY,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    nextY -= 16
    drawLine(activePage, nextY)
    return nextY - 6
  }

  function checkPageOverflow(y: number): typeof page {
    if (y < MARGIN + 60) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      currentY = PAGE_HEIGHT - MARGIN
    }

    return page
  }

  currentY = drawText(page, templateData.fullName, MARGIN, currentY, 18, fontBold)

  if (templateData.jobTitle) {
    currentY = drawText(page, templateData.jobTitle, MARGIN, currentY, 10, font, rgb(0.35, 0.35, 0.35))
  }

  const contactParts = [
    templateData.email,
    templateData.phone,
    templateData.linkedin,
    templateData.location,
  ].filter(Boolean)
  const contactLine = contactParts.join('  |  ')
  currentY = drawText(page, contactLine, MARGIN, currentY, 10, font, rgb(0.35, 0.35, 0.35))
  currentY -= 6
  drawLine(page, currentY)
  currentY -= 12

  if (templateData.summary) {
    page = checkPageOverflow(currentY)
    currentY = drawSectionHeading(page, 'Resumo Profissional', currentY)

    const summaryLines = wrapText(templateData.summary, font, 10, USABLE_WIDTH)
    for (const line of summaryLines) {
      page = checkPageOverflow(currentY)
      currentY = drawText(page, line, MARGIN, currentY, 10, font)
    }
    currentY -= 6
  }

  if (templateData.skills.trim().length > 0) {
    page = checkPageOverflow(currentY)
    currentY = drawSectionHeading(page, 'Habilidades', currentY)

    const skillsLines = wrapText(templateData.skills, font, 10, USABLE_WIDTH)
    for (const line of skillsLines) {
      page = checkPageOverflow(currentY)
      currentY = drawText(page, line, MARGIN, currentY, 10, font)
    }
    currentY -= 6
  }

  if (templateData.experiences.length > 0) {
    page = checkPageOverflow(currentY)
    currentY = drawSectionHeading(page, 'Experiência Profissional', currentY)

    for (const experience of templateData.experiences) {
      page = checkPageOverflow(currentY)
      const titleLine = `${experience.title}${experience.company ? ` - ${experience.company}` : ''}`
      currentY = drawText(page, titleLine, MARGIN, currentY, 12, fontBold)

      currentY = drawText(page, experience.period, MARGIN, currentY, 10, font, rgb(0.3, 0.3, 0.3))
      if (experience.techStack) {
        currentY = drawText(page, `Tech stack: ${experience.techStack}`, MARGIN, currentY, 10, font, rgb(0.35, 0.35, 0.35))
      }
      currentY -= 2

      for (const bullet of experience.bullets) {
        page = checkPageOverflow(currentY)
        const bulletLines = wrapText(bullet.text, font, 10, USABLE_WIDTH - 15)

        for (let lineIndex = 0; lineIndex < bulletLines.length; lineIndex++) {
          page = checkPageOverflow(currentY)
          const prefix = lineIndex === 0 ? '- ' : '  '
          currentY = drawText(page, prefix + bulletLines[lineIndex], MARGIN + 15, currentY, 10, font)
        }
      }
      currentY -= 6
    }
  }

  if (templateData.education.length > 0) {
    page = checkPageOverflow(currentY)
    currentY = drawSectionHeading(page, 'Formação Acadêmica', currentY)

    for (const education of templateData.education) {
      page = checkPageOverflow(currentY)
      const educationLine = `${education.degree}${education.institution ? ` - ${education.institution}` : ''}${education.period ? ` - ${education.period}` : ''}`
      currentY = drawText(page, educationLine, MARGIN, currentY, 10, font)
    }
    currentY -= 6
  }

  if (templateData.hasCertifications) {
    page = checkPageOverflow(currentY)
    currentY = drawSectionHeading(page, 'Certificações', currentY)

    for (const certification of templateData.certifications) {
      page = checkPageOverflow(currentY)
      currentY = drawText(page, certification.name, MARGIN, currentY, 10, font)
    }
    currentY -= 6
  }

  if (templateData.hasLanguages) {
    page = checkPageOverflow(currentY)
    currentY = drawSectionHeading(page, 'Idiomas', currentY)

    for (const language of templateData.languages) {
      page = checkPageOverflow(currentY)
      const languageLine = language.level ? `${language.language} - ${language.level}` : language.language
      currentY = drawText(page, languageLine, MARGIN, currentY, 10, font)
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
