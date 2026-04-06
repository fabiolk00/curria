import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CheckoutOnboardingForm } from '@/components/pricing/checkout-onboarding-form'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getBillingInfo } from '@/lib/billing/customer-info'
import { buildCheckoutResumePath, isPaidPlanSlug } from '@/lib/billing/checkout-navigation'

export const metadata: Metadata = {
  title: 'Checkout - CurrIA',
  description: 'Complete seus dados de faturamento para continuar o checkout da CurrIA',
}

type CheckoutPageProps = {
  searchParams?: {
    plan?: string | string[]
  }
}

function readPlan(planParam: string | string[] | undefined) {
  const rawPlan = Array.isArray(planParam) ? planParam[0] : planParam
  return isPaidPlanSlug(rawPlan) ? rawPlan : null
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const selectedPlan = readPlan(searchParams?.plan)
  if (!selectedPlan) {
    redirect('/pricing')
  }

  const appUser = await getCurrentAppUser()
  if (!appUser) {
    redirect(`/login?redirect_to=${encodeURIComponent(buildCheckoutResumePath(selectedPlan))}`)
  }

  let billingInfo = null
  try {
    billingInfo = await getBillingInfo(appUser.id)
  } catch {
    billingInfo = null
  }

  return (
    <CheckoutOnboardingForm
      initialPlan={selectedPlan}
      initialBillingInfo={billingInfo}
    />
  )
}
