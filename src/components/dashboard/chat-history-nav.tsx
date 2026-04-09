'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, MessageCircle, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebarContext } from '@/context/sidebar-context'
import { cn } from '@/lib/utils'

type ChatHistoryNavProps = {
  isOpen: boolean
}

type SessionItem = {
  id: string
  createdAt: string
}

export function ChatHistoryNav({ isOpen }: ChatHistoryNavProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { closeMobile } = useSidebarContext()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const currentSessionId = searchParams.get('session') || undefined

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/session`)
        const data = await response.json() as { sessions?: any[] }
        if (data.sessions) {
          const sessionList = data.sessions
            .sort((a: any, b: any) => new Date(b.session.createdAt).getTime() - new Date(a.session.createdAt).getTime())
            .slice(0, 5)
            .map((ws: any) => ({ id: ws.session.id, createdAt: ws.session.createdAt }))
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
    if (diffHours < 1) return 'Now'
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays === 1) return '1d'
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('pt-BR')
  }

  // New Chat button
  const newChatBtn = (
    <button
      onClick={() => {
        router.push('/dashboard')
        closeMobile()
      }}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-colors',
        isOpen
          ? 'gap-3 px-3 py-2 w-full hover:bg-sidebar-accent/50'
          : 'h-10 w-10 justify-center px-0 py-0 hover:bg-sidebar-accent/50',
        'text-sidebar-foreground/70 hover:text-sidebar-foreground',
      )}
      title="New chat"
    >
      <Plus className="h-4 w-4 shrink-0 text-sidebar-foreground/75" strokeWidth={1.75} />
    </button>
  )

  if (!isOpen) {
    return (
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>{newChatBtn}</TooltipTrigger>
          <TooltipContent side="right">New Chat</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {newChatBtn}

      {isLoading ? (
        <div className="flex items-center justify-center py-2 px-3">
          <Loader2 className="h-3 w-3 animate-spin text-sidebar-foreground/60" />
        </div>
      ) : sessions.length > 0 ? (
        sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => {
              router.push(`/dashboard?session=${session.id}`)
              closeMobile()
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              currentSessionId === session.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            )}
            title={`Chat ${formatTime(session.createdAt)}`}
          >
            <MessageCircle className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">#{session.id.slice(0, 6)}</span>
            <span className="flex-shrink-0 text-sidebar-foreground/50">{formatTime(session.createdAt)}</span>
          </button>
        ))
      ) : null}
    </div>
  )
}
