import type { GeneratedOutput, ManualEditInput } from '@/types/agent'
import type {
  CompareSnapshotRef,
  CompareSnapshotsResponse,
  SerializedResumeTarget,
  SerializedTimelineEntry,
  SessionWorkspace,
} from '@/types/dashboard'

export class DashboardApiError extends Error {
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

export async function listVersions(
  sessionId: string,
  scope: 'all' | 'base' | 'target-derived' = 'all',
): Promise<SerializedTimelineEntry[]> {
  const response = await requestJson<{ sessionId: string; versions: SerializedTimelineEntry[] }>(
    `/api/session/${sessionId}/versions?scope=${scope}`,
  )

  return response.versions
}

export async function compareSnapshots(
  sessionId: string,
  left: CompareSnapshotRef,
  right: CompareSnapshotRef,
): Promise<CompareSnapshotsResponse> {
  return requestJson<CompareSnapshotsResponse>(`/api/session/${sessionId}/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ left, right }),
  })
}

export async function listTargets(sessionId: string): Promise<SerializedResumeTarget[]> {
  const response = await requestJson<{ targets: SerializedResumeTarget[] }>(
    `/api/session/${sessionId}/targets`,
  )

  return response.targets
}

export async function createTarget(sessionId: string, targetJobDescription: string): Promise<void> {
  await requestJson<{ target: SerializedResumeTarget }>(`/api/session/${sessionId}/targets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetJobDescription }),
  })
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

export async function applyGapAction(
  sessionId: string,
  input: { itemType: 'missing_skill' | 'weak_area' | 'suggestion'; itemValue: string },
): Promise<void> {
  await requestJson<{ result: unknown }>(`/api/session/${sessionId}/gap-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export async function generateResume(
  sessionId: string,
  input: { scope: 'base' } | { scope: 'target'; targetId: string },
): Promise<void> {
  await requestJson<{ success: true; scope: 'base' | 'target'; targetId?: string }>(
    `/api/session/${sessionId}/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  )
}

export async function getDownloadUrls(
  sessionId: string,
  targetId?: string,
): Promise<{ docxUrl: string; pdfUrl: string }> {
  const suffix = targetId ? `?targetId=${encodeURIComponent(targetId)}` : ''
  return requestJson<{ docxUrl: string; pdfUrl: string }>(`/api/file/${sessionId}${suffix}`)
}

export function isGeneratedOutputReady(generatedOutput?: GeneratedOutput): boolean {
  return generatedOutput?.status === 'ready' && Boolean(generatedOutput.docxPath && generatedOutput.pdfPath)
}
