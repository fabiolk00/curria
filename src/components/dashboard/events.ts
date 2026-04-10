"use client"

export const NEW_CONVERSATION_EVENT = "curria:new-conversation"
export const SESSION_SYNC_EVENT = "curria:session-sync"

export type SessionSyncDetail = {
  sessionId: string | null
}
