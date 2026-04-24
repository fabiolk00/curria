import type { Metadata } from "next"

import { GeneratedResumeHistoryPage } from "@/components/resume/generated-resume-history-page"

export const metadata: Metadata = {
  title: "Histórico de currículos - CurrIA",
  description: "Acesse os últimos currículos gerados pela IA, com download protegido e abertura da versão certa.",
}

export default function ResumesHistoryPage() {
  return <GeneratedResumeHistoryPage />
}
