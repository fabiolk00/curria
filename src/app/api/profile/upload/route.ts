import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { parseFile } from '@/lib/agent/tools/parse-file'
import { ingestResumeText } from '@/lib/agent/tools/resume-ingestion'
import { logError, logInfo, serializeError } from '@/lib/observability/structured-log'
import {
  getExistingUserProfile,
  saveImportedUserProfile,
  type UserProfileRow,
} from '@/lib/profile/user-profiles'
import type { CVState } from '@/types/cv'

export const runtime = 'nodejs'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

const FileMetadataSchema = z.object({
  type: z.literal('application/pdf'),
  size: z.number().positive().max(MAX_FILE_SIZE_BYTES),
})

const AUTH_REQUIRED_MESSAGE = 'Voce precisa estar autenticado para importar um curriculo.'
const MISSING_FILE_MESSAGE = 'Selecione um arquivo PDF para importar.'
const INVALID_FILE_TYPE_MESSAGE = 'Envie um arquivo PDF.'
const FILE_TOO_LARGE_MESSAGE = 'Arquivo muito grande. Envie um curriculo de ate 5 MB.'
const SCANNED_PDF_MESSAGE = 'Nao conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionavel ou preencha manualmente.'
const EXTRACTION_FAILURE_MESSAGE = 'Nao foi possivel identificar dados suficientes no arquivo enviado.'
const NO_PROFILE_CHANGES_MESSAGE = 'Esse arquivo nao trouxe novas informacoes para o seu perfil atual.'
const START_IMPORT_FAILURE_MESSAGE = 'Nao foi possivel importar seu curriculo agora. Tente novamente em instantes.'

function mapProfileResponse(data: UserProfileRow) {
  return {
    id: data.id,
    source: data.source,
    cvState: data.cv_state,
    linkedinUrl: data.linkedin_url,
    profilePhotoUrl: data.profile_photo_url,
    extractedAt: data.extracted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function createEmptyCvState(): CVState {
  return {
    fullName: '',
    email: '',
    phone: '',
    summary: '',
    experience: [],
    skills: [],
    education: [],
  }
}

function mergeCvState(currentCvState: CVState, patch?: Partial<CVState>): CVState {
  if (!patch) {
    return currentCvState
  }

  return {
    ...currentCvState,
    ...patch,
    certifications: patch.certifications ?? currentCvState.certifications,
  }
}

export async function POST(req: NextRequest) {
  const appUser = await getCurrentAppUser(req)
  if (!appUser) {
    logError('[api/profile/upload] Unauthorized access attempt')
    return NextResponse.json({ error: AUTH_REQUIRED_MESSAGE }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    logError('[api/profile/upload] Invalid multipart payload', { appUserId: appUser.id })
    return NextResponse.json({ error: MISSING_FILE_MESSAGE }, { status: 400 })
  }

  const uploadedFile = formData.get('file')
  if (
    !uploadedFile
    || typeof uploadedFile === 'string'
    || typeof uploadedFile.arrayBuffer !== 'function'
  ) {
    return NextResponse.json({ error: MISSING_FILE_MESSAGE }, { status: 400 })
  }

  const metadata = FileMetadataSchema.safeParse({
    type: uploadedFile.type,
    size: uploadedFile.size,
  })

  if (!metadata.success) {
    const firstIssue = metadata.error.issues[0]
    const errorMessage = firstIssue?.path[0] === 'size'
      ? FILE_TOO_LARGE_MESSAGE
      : INVALID_FILE_TYPE_MESSAGE

    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  try {
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer())
    const parsedFile = await parseFile(
      {
        file_base64: fileBuffer.toString('base64'),
        mime_type: metadata.data.type,
      },
      appUser.id,
      undefined,
      req.signal,
    )

    if (!parsedFile.success) {
      const errorMessage = parsedFile.error.startsWith('PDF_SCANNED')
        ? SCANNED_PDF_MESSAGE
        : EXTRACTION_FAILURE_MESSAGE

      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const existingProfile = await getExistingUserProfile(appUser.id)
    const currentCvState = existingProfile
      ? existingProfile.cv_state as CVState
      : createEmptyCvState()

    const ingestionResult = await ingestResumeText(
      parsedFile.text,
      currentCvState,
      appUser.id,
      undefined,
      req.signal,
    )

    const nextCvState = mergeCvState(currentCvState, ingestionResult.patch?.cvState)

    if (ingestionResult.changedFields.length === 0 && !existingProfile) {
      return NextResponse.json({ error: EXTRACTION_FAILURE_MESSAGE }, { status: 400 })
    }

    if (ingestionResult.changedFields.length === 0) {
      logInfo('[api/profile/upload] Resume import skipped because no profile fields changed', {
        appUserId: appUser.id,
        fileType: metadata.data.type,
        fileSize: uploadedFile.size,
        strategy: ingestionResult.strategy,
        preservedFields: ingestionResult.preservedFields.join(','),
        existingProfileSource: existingProfile?.source ?? null,
      })

      return NextResponse.json({ error: NO_PROFILE_CHANGES_MESSAGE }, { status: 409 })
    }

    const profile = await saveImportedUserProfile({
      appUserId: appUser.id,
      cvState: nextCvState,
      source: 'pdf',
    })

    logInfo('[api/profile/upload] Resume imported', {
      appUserId: appUser.id,
      fileType: metadata.data.type,
      fileSize: uploadedFile.size,
      strategy: ingestionResult.strategy,
      changedFields: ingestionResult.changedFields.join(','),
      preservedFields: ingestionResult.preservedFields.join(','),
    })

    return NextResponse.json({
      success: true,
      profile: mapProfileResponse(profile),
      strategy: ingestionResult.strategy,
      changedFields: ingestionResult.changedFields,
      preservedFields: ingestionResult.preservedFields,
      warning: ingestionResult.confidenceScore !== undefined && ingestionResult.confidenceScore < 0.55
        ? 'Revise os dados importados antes de salvar. A confianca desta leitura foi baixa.'
        : undefined,
    })
  } catch (error) {
    logError('[api/profile/upload] Failed to import profile', {
      appUserId: appUser.id,
      ...serializeError(error),
    })

    return NextResponse.json(
      { error: START_IMPORT_FAILURE_MESSAGE },
      { status: 500 },
    )
  }
}
