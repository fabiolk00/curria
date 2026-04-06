import React from "react"

import { ResumeWorkspace } from "@/components/dashboard/resume-workspace"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { getUserBillingInfo } from "@/lib/asaas/quota"

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

  const appUser = await getCurrentAppUser()
  let billingInfo = null
  if (appUser) {
    try {
      billingInfo = await getUserBillingInfo(appUser.id)
    } catch (error) {
      console.error("[dashboard-page] failed to load billing info", error)
    }
  }

  const currentCredits = appUser?.creditAccount.creditsRemaining ?? 0
  const activeRecurringPlan = billingInfo?.hasActiveRecurringSubscription ? billingInfo.plan : null

  return (
    <ResumeWorkspace
      initialSessionId={initialSessionId || undefined}
      userName={'Voc\u00EA'}
      activeRecurringPlan={activeRecurringPlan}
      currentCredits={currentCredits}
    />
  )
}
