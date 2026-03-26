"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import PhaseBadge from "@/components/phase-badge"
import ATSScoreBadge from "@/components/ats-score-badge"
import { Download } from "lucide-react"

type Phase = 'intake' | 'analysis' | 'dialog' | 'confirm' | 'generation'

interface Session {
  id: string
  phase: Phase
  atsScore?: number
  createdAt: string
}

interface SessionCardProps {
  session: Session
}

export default function SessionCard({ session }: SessionCardProps) {
  const isGeneration = session.phase === 'generation'
  
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Left: Date and Phase */}
        <div className="flex flex-col gap-2 sm:flex-1">
          <span className="text-sm text-muted-foreground">{session.createdAt}</span>
          <PhaseBadge phase={session.phase} />
        </div>
        
        {/* Center: ATS Score */}
        <div className="flex items-center sm:flex-1 sm:justify-center">
          {session.atsScore !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Score:</span>
              <ATSScoreBadge score={session.atsScore} showLabel={false} />
            </div>
          )}
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:flex-1 sm:justify-end">
          {isGeneration ? (
            <>
              <Button variant="outline" size="sm" onClick={() => {}}>
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => {}}>
                <Download className="h-4 w-4 mr-1" />
                DOCX
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href={`/dashboard?session=${session.id}`}>Continuar</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
