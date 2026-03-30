import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

type Phase = "intake" | "analysis" | "dialog" | "confirm" | "generation"

interface Session {
  id: string
  phase: Phase
  atsScore?: number
  createdAt: string
}

interface SessionListProps {
  sessions: Session[]
}

export default function SessionList({ sessions }: SessionListProps) {
  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Link key={session.id} href={`/dashboard?session=${session.id}`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Sessão {session.id.substring(0, 6)}...</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(session.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{session.phase}</Badge>
                {session.atsScore ? <Badge>ATS: {session.atsScore}</Badge> : null}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
