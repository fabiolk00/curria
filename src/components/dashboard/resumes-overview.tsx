import { Bot, FileText, Plus } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import SessionList from "./session-list"

type ResumeSession = {
  id: string
  phase: "intake" | "analysis" | "dialog" | "confirm" | "generation"
  atsScore?: number
  createdAt: string
}

type ResumesOverviewProps = {
  sessions: ResumeSession[]
  createSessionAction: (formData: FormData) => void | Promise<void>
}

export function ResumesOverview({ sessions, createSessionAction }: ResumesOverviewProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl space-y-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-10 w-10 text-primary" />
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]">
            Biblioteca CurrIA
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Todos os seus curriculos em um so lugar
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Retome qualquer sessao, revise scores anteriores e volte para o workspace sem perder o contexto da sua busca.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <form action={createSessionAction}>
              <Button type="submit" size="lg" className="font-semibold">
                <Plus className="mr-2 h-4 w-4" />
                Novo curriculo
              </Button>
            </form>
            <Button asChild variant="outline" size="lg" className="font-semibold">
              <Link href="/dashboard">
                <FileText className="mr-2 h-4 w-4" />
                Ir para o workspace
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          {sessions.length > 0 ? (
            <SessionList sessions={sessions} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              Voce ainda nao tem nenhum curriculo analisado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
