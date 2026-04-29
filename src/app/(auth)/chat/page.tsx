import { redirect } from "next/navigation"

import { buildResumeComparisonPath, PROFILE_SETUP_PATH } from "@/lib/routes/app"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface ChatPageProps {
  searchParams?: {
    session?: string | string[]
  }
}

// Deprecated compatibility route.
// The guided product flow starts at /profile-setup and opens generated resumes
// through /dashboard/resume/compare/[sessionId].
export default function ChatPage({ searchParams }: ChatPageProps) {
  const rawSessionParam = searchParams?.session
  const initialSessionId = Array.isArray(rawSessionParam)
    ? rawSessionParam[0]
    : rawSessionParam

  redirect(initialSessionId ? buildResumeComparisonPath(initialSessionId) : PROFILE_SETUP_PATH)
}
