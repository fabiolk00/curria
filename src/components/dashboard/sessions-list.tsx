'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { buildResumeComparisonPath } from '@/lib/routes/app'
import { cn } from '@/lib/utils'

type SessionItem = {
  id: string
  createdAt: string
}

type SessionsResponse = {
  sessions?: SessionItem[]
}

export function SessionsList() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/session`)
        const data = await response.json() as SessionsResponse
        if (data.sessions) {
          const sessionList = data.sessions
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((session) => ({ id: session.id, createdAt: session.createdAt }))
          setSessions(sessionList)
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSessions()
  }, [])

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffHours < 1) return 'Agora'
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays === 1) return '1 dia atrás'
    if (diffDays < 7) return `${diffDays} dias atrás`
    return date.toLocaleDateString('pt-BR')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground/60" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-sidebar-foreground/30 mb-4" />
        <p className="text-lg text-sidebar-foreground/70">Nenhuma sessão encontrada</p>
        <p className="text-sm text-sidebar-foreground/50 mt-2">Gere um currÃ­culo para visualizar seu histÃ³rico aqui.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => router.push(buildResumeComparisonPath(session.id))}
          className={cn(
            'flex items-center gap-4 rounded-lg px-4 py-3 text-left transition-colors border',
            'border-border/30 hover:border-border/50 hover:bg-sidebar-accent/30 text-sidebar-foreground'
          )}
        >
          <FileText className="h-5 w-5 shrink-0 text-sidebar-foreground/60" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Sessão #{session.id.slice(0, 6)}</p>
            <p className="text-xs text-sidebar-foreground/50">{formatTime(session.createdAt)}</p>
          </div>
          <p className="text-xs text-sidebar-foreground/40 shrink-0">{new Date(session.createdAt).toLocaleDateString('pt-BR')}</p>
        </button>
      ))}
    </div>
  )
}
