import { ArrowRight } from "lucide-react"
import Link from "next/link"

import ATSScoreBadge from "@/components/ats-score-badge"
import PhaseBadge from "@/components/phase-badge"
import { Card, CardContent } from "@/components/ui/card"

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
    <div className="grid gap-4">
      {sessions.map((session) => (
        <Link key={session.id} href={`/dashboard?session=${session.id}`}>
          <Card className="cursor-pointer rounded-[1.5rem] border border-border/60 bg-background/75 py-0 shadow-none transition-all hover:-translate-y-0.5 hover:border-border hover:bg-background">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">Sessao {session.id.substring(0, 8)}</p>
                  <PhaseBadge phase={session.phase} />
                  {session.atsScore !== undefined ? <ATSScoreBadge score={session.atsScore} /> : null}
                </div>
                <p className="text-sm text-muted-foreground">{session.createdAt}</p>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Abrir workspace
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
