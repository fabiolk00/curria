import { Badge } from "../ui/badge"
import { Card, CardContent } from "../ui/card"

type Phase = 'intake' | 'analysis' | 'dialog' | 'confirm' | 'generation'

interface Session {
  id: string
  phase: Phase
  atsScore?: number
  createdAt: string
}

interface SessionListProps {
  sessions: Session[]
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Card key={session.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Sessão {session.id.substring(0, 6)}...</p>
              <p className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{session.phase}</Badge>
              {session.atsScore && <Badge>ATS: {session.atsScore}</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
