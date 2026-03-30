import { Metadata } from "next"
import { BarChart3, Clock3, Plus, Sparkles } from "lucide-react"

import SessionList from "@/components/dashboard/session-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { db } from "@/lib/db/sessions"

import { createSession } from "../dashboard/actions"

export const metadata: Metadata = {
  title: "Meus Curriculos - CurrIA",
  description: "Historico de curriculos analisados",
}

export default async function ResumesPage() {
  const appUser = await getCurrentAppUser()
  if (!appUser) return null

  const sessions = await db.getUserSessions(appUser.id)
  const bestScore = sessions.reduce<number | null>((best, session) => {
    const score = session.atsScore?.total
    if (score === undefined) {
      return best
    }

    if (best === null || score > best) {
      return score
    }

    return best
  }, null)
  const generatedCount = sessions.filter((session) => session.generatedOutput.status === "ready").length

  const formattedSessions = sessions.map((session) => ({
    id: session.id,
    phase: session.phase,
    atsScore: session.atsScore?.total,
    createdAt: session.updatedAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }))

  return (
    <div className="relative overflow-hidden px-4 py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.14),transparent_62%)]" />
      <div className="pointer-events-none absolute right-0 top-24 h-72 w-72 bg-[radial-gradient(circle,oklch(var(--chart-2)/0.08),transparent_65%)] blur-3xl" />

      <div className="relative space-y-6">
        <div className="rounded-[2rem] border border-border/60 bg-card/90 p-6 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)] lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]">
                Biblioteca pessoal
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight lg:text-4xl">Meus curriculos</h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Historico completo das suas analises, scores e geracoes para retomar qualquer sessao com rapidez.
              </p>
            </div>

            <form action={createSession}>
              <Button type="submit" className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                Novo curriculo
              </Button>
            </form>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card className="rounded-[1.5rem] border-border/60 bg-background/75 py-0 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Sessoes
                  </p>
                  <p className="mt-1 text-2xl font-black">{sessions.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-border/60 bg-background/75 py-0 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Arquivos prontos
                  </p>
                  <p className="mt-1 text-2xl font-black">{generatedCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-border/60 bg-background/75 py-0 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Melhor ATS
                  </p>
                  <p className="mt-1 text-2xl font-black">{bestScore ?? "--"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card/90 p-6 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)] lg:p-8">
          {formattedSessions.length > 0 ? (
            <SessionList sessions={formattedSessions} />
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border/60 px-6 py-12 text-center text-muted-foreground">
              Voce ainda nao tem nenhum curriculo analisado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
