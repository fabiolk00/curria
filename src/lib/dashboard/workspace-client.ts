import type {
  GeneratedOutput,
  ManualEditInput,
  ResumeEditorSaveInput,
  ResumeEditorSaveOutput,
} from '@/types/agent'
import type { GenerateResumeResponse, SessionWorkspace } from '@/types/dashboard'

class DashboardApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DashboardApiError'
    this.status = status
  }
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload = await response.json() as unknown

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Request failed.'
    throw new DashboardApiError(message, response.status)
  }

  return payload as T
}

export async function getSessionWorkspace(sessionId: string): Promise<SessionWorkspace> {
  return requestJson<SessionWorkspace>(`/api/session/${sessionId}`)
}

export async function manualEditBaseSection(
  sessionId: string,
  input: ManualEditInput,
): Promise<{ changed: boolean }> {
  const response = await requestJson<{
    success: true
    section: string
    section_data: unknown
    changed: boolean
  }>(`/api/session/${sessionId}/manual-edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return {
    changed: response.changed,
  }
}

export async function saveEditedResume(
  sessionId: string,
  input: ResumeEditorSaveInput,
): Promise<{ changed: boolean }> {
  const response = await requestJson<Extract<ResumeEditorSaveOutput, { success: true }>>(
    `/api/session/${sessionId}/manual-edit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  )

  return {
    changed: response.changed,
  }
}

export async function generateResume(
  sessionId: string,
  input: { scope: 'base' } | { scope: 'target'; targetId: string },
  clientRequestId?: string,
): Promise<GenerateResumeResponse> {
  return requestJson<GenerateResumeResponse>(
    `/api/session/${sessionId}/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
        clientRequestId,
      }),
    },
  )
}

export async function getDownloadUrls(
  sessionId: string,
  targetId?: string,
): Promise<{ docxUrl: string | null; pdfUrl: string | null; available?: boolean }> {
  const suffix = targetId ? `?targetId=${encodeURIComponent(targetId)}` : ''
  return requestJson<{ docxUrl: string | null; pdfUrl: string | null; available?: boolean }>(
    `/api/file/${sessionId}${suffix}`,
  )
}

export function isGeneratedOutputReady(generatedOutput?: GeneratedOutput): boolean {
  return generatedOutput?.status === 'ready' && Boolean(generatedOutput.pdfPath)
}
