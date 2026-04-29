import { redirect } from "next/navigation"

import { buildResumeComparisonPath } from "@/lib/routes/app"

interface ChatPageProps {
  params: { sessionId: string }
}

// Deprecated compatibility route.
// Legacy chat URLs now open the generated resume comparison surface.
export default function LegacyChatPage({ params }: ChatPageProps) {
  redirect(buildResumeComparisonPath(params.sessionId))
}
