'use client'

import { useEffect, useState } from 'react'
import { Plus, MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SessionWorkspace } from '@/types/dashboard'

type ChatHistorySidebarProps = {
  currentSessionId?: string
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  isLoading?: boolean
}

type SessionListItem = {
  id: string
  createdAt: string
  messageCount: number
}

export function ChatHistorySidebar({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  isLoading = false,
}: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    try {
      setIsLoadingSessions(true)
      const response = await fetch(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/session`)
      const data = await response.json() as { sessions?: SessionWorkspace[] }

      if (data.sessions) {
        // Get last 5 sessions, most recent first
        const sessionList = data.sessions
          .sort((a, b) => new Date(b.session.createdAt).getTime() - new Date(a.session.createdAt).getTime())
          .slice(0, 5)
          .map((ws) => ({
            id: ws.session.id,
            createdAt: ws.session.createdAt,
            messageCount: ws.session.messageCount,
          }))

        setSessions(sessionList)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      // Silently fail in tests
    } finally {
      setIsLoadingSessions(false)
    }
  }

  function formatSessionTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) {
      return 'Just now'
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`
    }
    if (diffDays === 1) {
      return '1d ago'
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`
    }

    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="border-b border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Chats</h2>
        <Button
          onClick={onNewChat}
          disabled={isLoading}
          className="w-full gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingSessions ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32 px-4 text-center">
            <p className="text-xs text-muted-foreground">No chats yet. Start a new conversation!</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors group ${
                  currentSessionId === session.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate font-medium">Chat #{session.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatSessionTime(session.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
