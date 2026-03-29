import React from "react"

import { ResumeWorkspace } from "@/components/dashboard/resume-workspace"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface DashboardPageProps {
  searchParams?: {
    session?: string | string[]
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const rawSessionParam = searchParams?.session
  const initialSessionId = Array.isArray(rawSessionParam)
    ? rawSessionParam[0]
    : rawSessionParam

  return (
    <ResumeWorkspace
      initialSessionId={initialSessionId || undefined}
      userName={'Voc\u00EA'}
    />
  )
}
