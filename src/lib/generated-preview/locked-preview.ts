import type { GenerateFileOutput, GeneratedOutput, PreviewAccess, ToolPatch } from '@/types/agent'
import type { CVState } from '@/types/cv'
import type { PreviewLockSummary } from '@/types/dashboard'

const LOCKED_PREVIEW_MESSAGE =
  'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.'

export function buildLockedPreviewAccess(
  lockedAt = new Date().toISOString(),
): PreviewAccess {
  return {
    locked: true,
    blurred: true,
    canViewRealContent: false,
    requiresUpgrade: true,
    requiresRegenerationAfterUnlock: true,
    reason: 'free_trial_locked',
    lockedAt,
    message: LOCKED_PREVIEW_MESSAGE,
  }
}

export function canViewRealPreview(
  output?: Pick<GeneratedOutput, 'previewAccess'> | null,
): boolean {
  if (!output?.previewAccess) {
    return true
  }

  return output.previewAccess.locked !== true && output.previewAccess.canViewRealContent === true
}

export function isLockedPreview(output?: Pick<GeneratedOutput, 'previewAccess'> | null): boolean {
  return !canViewRealPreview(output)
}

export function applyPreviewAccessToGeneratedOutput<T extends GeneratedOutput | undefined>(
  generatedOutput: T,
  previewAccess?: PreviewAccess,
): T {
  if (!generatedOutput || !previewAccess) {
    return generatedOutput
  }

  return {
    ...generatedOutput,
    previewAccess,
  } as T
}

export function applyPreviewAccessToPatch<T extends ToolPatch | undefined>(
  patch: T,
  previewAccess?: PreviewAccess,
): T {
  if (!patch?.generatedOutput || !previewAccess) {
    return patch
  }

  return {
    ...patch,
    generatedOutput: {
      ...patch.generatedOutput,
      previewAccess,
    },
  } as T
}

export function getPreviewLockSummary(
  output?: Pick<GeneratedOutput, 'previewAccess'> | null,
): PreviewLockSummary | undefined {
  if (!isLockedPreview(output)) {
    return undefined
  }

  return {
    locked: true,
    blurred: true,
    reason: output!.previewAccess!.reason as PreviewLockSummary['reason'],
    requiresUpgrade: output!.previewAccess!.requiresUpgrade,
    requiresPaidRegeneration: output!.previewAccess!.requiresRegenerationAfterUnlock,
    message: output!.previewAccess!.message ?? LOCKED_PREVIEW_MESSAGE,
  }
}

export function sanitizeGeneratedOutputForClient<T extends GeneratedOutput | undefined>(
  generatedOutput: T,
): T {
  if (!generatedOutput || !isLockedPreview(generatedOutput)) {
    return generatedOutput
  }

  return {
    ...generatedOutput,
    docxPath: undefined,
    pdfPath: undefined,
  } as T
}

export function buildLockedPreviewCvState(
  scope: 'optimized' | 'target',
): CVState {
  const headline = scope === 'target'
    ? 'Currículo demonstrativo para vaga'
    : 'Currículo demonstrativo ATS'

  return {
    fullName: 'Preview bloqueado',
    email: 'upgrade@curria.preview',
    phone: '(00) 00000-0000',
    linkedin: 'linkedin.com/company/curria-preview',
    location: 'Sao Paulo, SP',
    summary: 'Esta é uma visualização ilustrativa. O currículo real gerado no free trial não fica disponível para leitura ou download.',
    experience: [
      {
        title: headline,
        company: 'CurrIA Preview',
        location: 'Remoto',
        startDate: '2026',
        endDate: 'present',
        bullets: [
          'Mostra apenas um documento demonstrativo no plano gratuito.',
          'Exige novo processamento após o upgrade para liberar o currículo verdadeiro.',
        ],
      },
    ],
    skills: ['Preview bloqueado', 'Upgrade necessario', 'Regeneracao obrigatoria'],
    education: [
      {
        degree: 'Versão de demonstração',
        institution: 'CurrIA',
        year: '2026',
      },
    ],
    certifications: [
      {
        name: 'Acesso ao currículo real disponível apenas após upgrade',
        issuer: 'CurrIA',
        year: '2026',
      },
    ],
  }
}

export function sanitizeGeneratedCvStateForClient(
  cvState: CVState | undefined,
  output: Pick<GeneratedOutput, 'previewAccess'> | null | undefined,
  scope: 'optimized' | 'target',
): CVState | undefined {
  if (!cvState) {
    return undefined
  }

  return isLockedPreview(output)
    ? buildLockedPreviewCvState(scope)
    : structuredClone(cvState)
}

export function buildLockedPreviewPdfUrl(sessionId: string, targetId?: string | null): string {
  const searchParams = new URLSearchParams()
  if (targetId) {
    searchParams.set('targetId', targetId)
  }

  const suffix = searchParams.toString()
  return `/api/file/${encodeURIComponent(sessionId)}/locked-preview${suffix ? `?${suffix}` : ''}`
}

export function assertNoRealArtifactForLockedPreview(input: {
  output: Pick<Extract<GenerateFileOutput, { success: true }>, 'pdfUrl' | 'docxUrl'>
  generatedOutput?: Pick<GeneratedOutput, 'previewAccess'> | null
  patch?: Pick<ToolPatch, 'generatedOutput'> | null
  sessionId: string
  targetId?: string | null
}): void {
  if (!isLockedPreview(input.generatedOutput)) {
    return
  }

  const lockedPreviewPdfUrl = buildLockedPreviewPdfUrl(input.sessionId, input.targetId)

  if (input.output.pdfUrl !== null && input.output.pdfUrl !== lockedPreviewPdfUrl) {
    throw new Error('Locked preview cannot expose a real pdf url.')
  }

  if (input.output.docxUrl) {
    throw new Error('Locked preview cannot expose a real docx url.')
  }

  if (!input.patch?.generatedOutput?.previewAccess) {
    throw new Error('Locked preview responses must persist previewAccess in the generated output patch.')
  }
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function buildLockedPreviewPdfBytes(scope: 'optimized' | 'target'): Uint8Array {
  const lines = [
    scope === 'target' ? 'PREVIEW BLOQUEADO - TARGET JOB' : 'PREVIEW BLOQUEADO - ATS',
    '',
    'Este PDF e apenas ilustrativo.',
    'O currículo real gerado no free trial não fica disponível para leitura.',
    'Faça upgrade e gere novamente para receber a versão real.',
  ]

  const content = [
    'BT',
    '/F1 20 Tf',
    '72 720 Td',
    `(${escapePdfText(lines[0])}) Tj`,
    '/F1 12 Tf',
    '0 -32 Td',
    `(${escapePdfText(lines[2])}) Tj`,
    '0 -20 Td',
    `(${escapePdfText(lines[3])}) Tj`,
    '0 -20 Td',
    `(${escapePdfText(lines[4])}) Tj`,
    'ET',
  ].join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += object
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new TextEncoder().encode(pdf)
}
