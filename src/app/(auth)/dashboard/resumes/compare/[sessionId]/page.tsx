import type { Metadata } from "next"

import { ResumeComparisonPage } from "@/components/resume/resume-comparison-page"

export const metadata: Metadata = {
  title: "Comparação do currículo - Trampofy",
  description: "Compare a versão base com a versão otimizada do seu currículo.",
}

export default function ResumeComparisonRoute({
  params,
}: {
  params: { sessionId: string }
}) {
  return <ResumeComparisonPage sessionId={params.sessionId} />
}
