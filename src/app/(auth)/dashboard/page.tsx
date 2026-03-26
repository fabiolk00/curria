import { Metadata } from "next"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db/sessions"
import { ChatInterface } from "@/components/dashboard/chat-interface"

export const metadata: Metadata = {
  title: "Dashboard - CurrIA",
  description: "Otimize seu currículo com IA",
}

interface DashboardPageProps {
  searchParams: { session?: string }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const userName = user?.firstName || "Você"

  // If a specific session is requested via query param, use it
  const requestedSessionId = searchParams.session

  // Get user sessions
  let sessions = await db.getUserSessions(userId)

  if (sessions.length === 0) {
    // No sessions yet - create the first one
    await db.createSession(userId)
    // Fetch again to get the newly created session
    sessions = await db.getUserSessions(userId)
  }

  // Use requested session if provided and exists, otherwise use most recent
  let activeSessionId = requestedSessionId || sessions[0]?.id

  // Verify the requested session belongs to this user
  if (requestedSessionId) {
    const sessionExists = sessions.some(s => s.id === requestedSessionId)
    if (!sessionExists) {
      // Requested session doesn't exist or doesn't belong to user - use most recent
      activeSessionId = sessions[0]?.id
    }
  }

  if (!activeSessionId) {
    return <div className="p-8 text-center">Erro ao criar sessão. Tente novamente.</div>
  }

  return <ChatInterface sessionId={activeSessionId} userName={userName} />
}
