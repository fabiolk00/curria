import type {
  GeneratedOutput,
  ManualEditInput,
  ResumeEditorSaveInput,
  ResumeEditorSaveOutput,
} from '@/types/agent'
import type {
  BillingHistoryResponse,
  DownloadUrlsResponse,
  GenerateResumeResponse,
  ResumeComparisonResponse,
  ResumeGenerationHistoryResponse,
  SessionWorkspace,
} from '@/types/dashboard'

class DashboardApiError extends Error {
  status: number
  code?: string
  payload?: unknown

  constructor(message: string, status: number, options?: { code?: string; payload?: unknown }) {
    super(message)
    this.name = 'DashboardApiError'
    this.status = status
    this.code = options?.code
    this.payload = options?.payload
  }
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload = await response.json() as unknown

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Request failed.'
    const code = typeof payload === 'object' && payload !== null && 'code' in payload
      ? String((payload as { code: unknown }).code)
      : undefined
    throw new DashboardApiError(message, response.status, {
      code,
      payload,
    })
  }

  return payload as T
}

export function isExportAlreadyProcessingError(error: unknown): error is DashboardApiError {
  return error instanceof DashboardApiError && error.code === 'EXPORT_ALREADY_PROCESSING'
}

export async function getSessionWorkspace(sessionId: string): Promise<SessionWorkspace> {
  return requestJson<SessionWorkspace>(`/api/session/${sessionId}`)
}

export async function getResumeComparison(sessionId: string): Promise<ResumeComparisonResponse> {
  return requestJson<ResumeComparisonResponse>(`/api/session/${sessionId}/comparison`)
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
): Promise<DownloadUrlsResponse> {
  const suffix = targetId ? `?targetId=${encodeURIComponent(targetId)}` : ''
  return requestJson<DownloadUrlsResponse>(
    `/api/file/${sessionId}${suffix}`,
  )
}

export async function getBillingHistory(limit = 10): Promise<BillingHistoryResponse> {
  const searchParams = new URLSearchParams({
    limit: String(limit),
  })

  return requestJson<BillingHistoryResponse>(`/api/billing/history?${searchParams.toString()}`)
}

export async function getResumeGenerationHistory(
  page = 1,
  limit = 4,
): Promise<ResumeGenerationHistoryResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  return requestJson<ResumeGenerationHistoryResponse>(
    `/api/profile/resume-generations?${searchParams.toString()}`,
  )
}

export function isGeneratedOutputReady(generatedOutput?: GeneratedOutput): boolean {
  return generatedOutput?.status === 'ready'
    && (Boolean(generatedOutput.pdfPath) || generatedOutput.previewAccess?.locked === true)
}
