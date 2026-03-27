import { Metadata } from "next"
import { currentUser } from "@clerk/nextjs/server"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { db } from "@/lib/db/sessions"
import { ResumeWorkspace } from "@/components/dashboard/resume-workspace"

export const metadata: Metadata = {
  title: "Dashboard - CurrIA",
  description: "Otimize seu currículo com IA",
}

interface DashboardPageProps {
  searchParams: { session?: string }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const appUser = await getCurrentAppUser()
  if (!appUser) return null

  const user = await currentUser()
  const userName = user?.firstName || "Você"

  // If a specific session is requested via query param, use it
  const requestedSessionId = searchParams.session

  // Get user sessions
  const sessions = await db.getUserSessions(appUser.id)

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

  return <ResumeWorkspace initialSessionId={activeSessionId} userName={userName} />
}
