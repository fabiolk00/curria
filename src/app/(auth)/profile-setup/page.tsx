import type { Metadata } from "next"
import { currentUser } from "@clerk/nextjs/server"

import UserDataPage from "@/components/resume/user-data-page"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { isE2EAuthEnabled } from "@/lib/auth/e2e-auth"
import { loadOptionalBillingInfo } from "@/lib/asaas/optional-billing-info"
import type { PlanSlug } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Perfil profissional - CurrIA",
  description: "Configure e revise o perfil base que alimenta novas sessões.",
}

export default async function ProfileSetupPage() {
  const [appUser, clerkUser] = await Promise.all([
    getCurrentAppUser(),
    isE2EAuthEnabled() ? Promise.resolve(null) : currentUser(),
  ])
  const billingInfo = appUser
    ? (await loadOptionalBillingInfo(appUser.id, "profile_setup")).billingInfo
    : null
  const activeRecurringPlan: PlanSlug | null =
    billingInfo?.hasActiveRecurringSubscription ? billingInfo.plan : null

  return (
    <UserDataPage
      activeRecurringPlan={activeRecurringPlan}
      currentCredits={appUser?.creditAccount.creditsRemaining ?? 0}
      currentAppUserId={appUser?.id ?? null}
      userImageUrl={clerkUser?.imageUrl ?? null}
    />
  )
}
