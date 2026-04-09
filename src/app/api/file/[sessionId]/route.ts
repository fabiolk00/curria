import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'
import { createSignedResumeArtifactUrls } from '@/lib/agent/tools/generate-file'

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(params.sessionId, appUser.id)
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const targetId = _req.nextUrl.searchParams.get('targetId')
  const target = targetId
    ? await getResumeTargetForSession(session.id, targetId)
    : null

  if (targetId && !target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const artifactMetadata = target?.generatedOutput ?? session.generatedOutput
  const { docxPath, pdfPath } = artifactMetadata

  if (!docxPath || !pdfPath) {
    return NextResponse.json(
      {
        docxUrl: null,
        pdfUrl: null,
        available: false,
      },
      { status: 200 },
    )
  }

  try {
    const signedUrls = await createSignedResumeArtifactUrls(docxPath, pdfPath)

    return NextResponse.json({
      docxUrl: signedUrls.docxUrl,
      pdfUrl: signedUrls.pdfUrl,
    })
  } catch (error) {
    console.error('[api/file]', error)
    return NextResponse.json(
      { error: 'Generated resume artifacts could not be retrieved.' },
      { status: 404 },
    )
  }
}
