import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { isE2EAuthEnabled } from '@/lib/auth/e2e-auth'
import { PreviewPanelProvider } from '@/context/preview-panel-context'
import { SidebarProvider } from '@/context/sidebar-context'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import { formatRenewalCountdown } from '@/lib/asaas/billing-display'
import { getUserBillingInfo } from '@/lib/asaas/quota'

export const metadata = {
  title: 'Dashboard - CurrIA',
  description: 'Otimize seu currículo com IA',
}

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [appUser, clerkUser] = await Promise.all([
    getCurrentAppUser(),
    isE2EAuthEnabled() ? Promise.resolve(null) : currentUser(),
  ])
  if (!appUser) {
    redirect('/login')
  }

  let billingInfo = null
  try {
    billingInfo = await getUserBillingInfo(appUser.id)
  } catch (error) {
    console.error('[auth-layout] failed to load billing info', error)
  }

  const renewsIn = billingInfo?.hasActiveRecurringSubscription
    ? formatRenewalCountdown(billingInfo.renewsAt)
    : null
  const currentPlan = billingInfo?.plan ?? null
  const activeRecurringPlan = billingInfo?.hasActiveRecurringSubscription
    ? billingInfo.plan
    : null
  const displayName =
    clerkUser?.fullName?.trim()
    || clerkUser?.firstName?.trim()
    || clerkUser?.username
    || 'Conta CurrIA'
  const primaryEmail =
    clerkUser?.primaryEmailAddress?.emailAddress
    || clerkUser?.emailAddresses[0]?.emailAddress
    || ''

  return (
    <SidebarProvider>
      <PreviewPanelProvider>
        <DashboardShell
          creditsRemaining={billingInfo?.creditsRemaining}
          maxCredits={billingInfo?.maxCredits}
          renewsIn={renewsIn}
          currentPlan={currentPlan}
          activeRecurringPlan={activeRecurringPlan}
          userDisplayName={displayName}
          userEmail={primaryEmail}
          userImageUrl={clerkUser?.imageUrl ?? null}
        >
          {children}
        </DashboardShell>
      </PreviewPanelProvider>
    </SidebarProvider>
  )
}
