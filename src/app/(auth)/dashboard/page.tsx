import React from "react"
import { currentUser } from "@clerk/nextjs/server"

import { ResumeWorkspace } from "@/components/dashboard/resume-workspace"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { isE2EAuthEnabled } from "@/lib/auth/e2e-auth"
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

  const [appUser, clerkUser] = await Promise.all([
    getCurrentAppUser(),
    isE2EAuthEnabled() ? Promise.resolve(null) : currentUser(),
  ])
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
  const displayName =
    clerkUser?.firstName?.trim()
    || clerkUser?.fullName?.trim()
    || clerkUser?.username
    || "Você"

  return (
    <ResumeWorkspace
      initialSessionId={initialSessionId || undefined}
      userName={displayName}
      activeRecurringPlan={activeRecurringPlan}
      currentCredits={currentCredits}
    />
  )
}
