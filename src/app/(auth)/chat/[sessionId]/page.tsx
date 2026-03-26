import { redirect } from "next/navigation"

interface ChatPageProps {
  params: { sessionId: string }
}

export default function LegacyChatPage({ params }: ChatPageProps) {
  // Redirect legacy /chat/[sessionId] URLs to /dashboard?session=[sessionId]
  // This maintains backwards compatibility for bookmarked URLs and external links
  redirect(`/dashboard?session=${params.sessionId}`)
}
