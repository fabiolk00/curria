'use client'

import { useCallback, useEffect, useState } from 'react'

import { getSessionWorkspace } from '@/lib/dashboard/workspace-client'
import type { SessionWorkspace } from '@/types/dashboard'
import type { CVState } from '@/types/cv'

export function selectCvStateFromWorkspace(
  workspace: SessionWorkspace,
  targetId?: string | null,
): CVState {
  if (!targetId) {
    return workspace.session.cvState
  }

  const target = workspace.targets.find((entry) => entry.id === targetId)
  if (!target) {
    throw new Error('Target resume not found.')
  }

  return target.derivedCvState
}

type UseSessionCvStateResult = {
  cvState: CVState | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSessionCvState(
  sessionId: string,
  targetId?: string | null,
): UseSessionCvStateResult {
  const [cvState, setCvState] = useState<CVState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const workspace = await getSessionWorkspace(sessionId)
      setCvState(structuredClone(selectCvStateFromWorkspace(workspace, targetId)))
    } catch (fetchError) {
      setCvState(null)
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Nao foi possivel carregar o curriculo.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, targetId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { cvState, isLoading, error, refetch }
}
