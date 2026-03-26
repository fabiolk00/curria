import { Metadata } from "next"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db/sessions"
import SessionList from "@/components/dashboard/session-list"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { createSession } from "../dashboard/actions"

export const metadata: Metadata = {
  title: "Meus Currículos - CurrIA",
  description: "Histórico de currículos analisados",
}

export default async function ResumesPage() {
  const { userId } = await auth()
  if (!userId) return null

  const sessions = await db.getUserSessions(userId)

  const formattedSessions = sessions.map((session) => ({
    id: session.id,
    phase: session.phase,
    atsScore: session.atsScore?.total,
    createdAt: session.createdAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Meus Currículos</h1>
          <p className="text-muted-foreground">
            Histórico de todas as suas análises de currículo
          </p>
        </div>
        <form action={createSession}>
          <Button type="submit">
            <Plus className="h-4 w-4 mr-2" />
            Novo currículo
          </Button>
        </form>
      </div>

      {formattedSessions.length > 0 ? (
        <SessionList sessions={formattedSessions} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Você ainda não tem nenhum currículo analisado.
        </div>
      )}
    </div>
  )
}
