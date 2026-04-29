"use client"

export const ARTIFACT_REFRESH_EVENT = "curria:artifact-refresh"

export type ArtifactRefreshDetail = {
  sessionId: string
  targetId?: string | null
}
