import React from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { DASHBOARD_RESUMES_HISTORY_PATH } from "@/lib/routes/app"

export const metadata: Metadata = {
  title: "Minhas Vagas - Trampofy",
  description: "Acompanhe manualmente o status das suas candidaturas.",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ResumesPage() {
  redirect(DASHBOARD_RESUMES_HISTORY_PATH)
}
