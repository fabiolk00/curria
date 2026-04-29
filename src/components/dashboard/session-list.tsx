import Link from "next/link"

import type { AtsReadinessDisplayContract } from "@/lib/ats/scoring/types"
import ATSScoreBadge from "@/components/ats-score-badge"
import { AtsReadinessStatusBadge } from "@/components/ats-readiness-status-badge"
import PhaseBadge from "@/components/phase-badge"
import { Card, CardContent } from "@/components/ui/card"
import { buildResumeComparisonPath } from "@/lib/routes/app"

type Phase = "intake" | "analysis" | "dialog" | "confirm" | "generation"

interface Session {
  id: string
  phase: Phase
  atsReadiness?: {
    displayedReadinessScoreCurrent: number
    display: AtsReadinessDisplayContract
  }
  createdAt: string
}

interface SessionListProps {
  sessions: Session[]
}

export default function SessionList({ sessions }: SessionListProps) {
  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Link key={session.id} href={buildResumeComparisonPath(session.id)}>
          <Card className="cursor-pointer rounded-2xl border border-border/60 py-0 shadow-none transition-colors hover:bg-muted/50">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium">Sessão {session.id.substring(0, 6)}...</p>
                <p className="text-xs text-muted-foreground">{session.createdAt}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PhaseBadge phase={session.phase} />
                {session.atsReadiness?.display ? (
                  <>
                    <ATSScoreBadge
                      score={session.atsReadiness.displayedReadinessScoreCurrent}
                      formattedScore={session.atsReadiness.display.formattedScorePtBr}
                    />
                    <AtsReadinessStatusBadge
                      badgeText={session.atsReadiness.display.badgeTextPtBr}
                    />
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
