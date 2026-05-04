import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { isE2EAuthEnabled } from '@/lib/auth/e2e-auth'
import { PreviewPanelProvider } from '@/context/preview-panel-context'
import { SidebarProvider } from '@/context/sidebar-context'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import { formatRenewalCountdown } from '@/lib/asaas/billing-display'
import { loadOptionalBillingInfo } from '@/lib/asaas/optional-billing-info'
import { getExistingUserProfile } from '@/lib/profile/user-profiles'
import { logWarn, serializeError } from '@/lib/observability/structured-log'

export const metadata = {
  title: 'Dashboard - Trampofy',
  description: 'Otimize seu currículo com IA',
}

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const e2eAuthEnabled = await isE2EAuthEnabled()
  const [appUser, clerkUser] = await Promise.all([
    getCurrentAppUser(),
    e2eAuthEnabled ? Promise.resolve(null) : currentUser(),
  ])
  if (!appUser) {
    redirect('/entrar')
  }

  const [billingLookup, profileLookup] = await Promise.allSettled([
    loadOptionalBillingInfo(appUser.id, 'auth_layout'),
    e2eAuthEnabled ? Promise.resolve(null) : getExistingUserProfile(appUser.id),
  ])

  const { billingInfo, billingNotice } = billingLookup.status === 'fulfilled'
    ? billingLookup.value
    : {
        billingInfo: null,
        billingNotice: 'Não foi possível carregar seus dados de cobrança neste momento.',
      }

  const userProfile = profileLookup.status === 'fulfilled'
    ? profileLookup.value
    : null

  if (profileLookup.status === 'rejected') {
    logWarn('auth.layout.profile_lookup_failed', {
      appUserId: appUser.id,
      success: false,
      surface: 'auth_layout',
      ...serializeError(profileLookup.reason),
    })
  }

  const sidebarUserImageUrl = userProfile?.profile_photo_url ?? clerkUser?.imageUrl ?? null
  const renewsIn = billingInfo?.hasActiveRecurringSubscription
    ? formatRenewalCountdown(billingInfo.renewsAt)
    : null
  const currentPlan = billingInfo?.plan ?? null
  const activeRecurringPlan = billingInfo?.hasActiveRecurringSubscription
    ? billingInfo.plan
    : null
  const displayName =
    appUser.displayName?.trim()
    || userProfile?.cv_state?.fullName?.trim()
    || clerkUser?.fullName?.trim()
    || clerkUser?.firstName?.trim()
    || clerkUser?.username
    || 'Conta Trampofy'
  const primaryEmail =
    appUser.primaryEmail
    || userProfile?.cv_state?.email?.trim()
    || clerkUser?.primaryEmailAddress?.emailAddress
    || clerkUser?.emailAddresses[0]?.emailAddress
    || ''

  return (
    <SidebarProvider>
      <PreviewPanelProvider>
        <DashboardShell
          billingNotice={billingNotice}
          creditsRemaining={billingInfo?.creditsRemaining}
          maxCredits={billingInfo?.maxCredits}
          renewsIn={renewsIn}
          currentPlan={currentPlan}
          activeRecurringPlan={activeRecurringPlan}
          userDisplayName={displayName}
          userEmail={primaryEmail}
          userImageUrl={sidebarUserImageUrl}
        >
          {children}
        </DashboardShell>
      </PreviewPanelProvider>
    </SidebarProvider>
  )
}

