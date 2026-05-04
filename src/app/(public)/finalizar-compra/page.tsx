import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CheckoutOnboardingForm } from "@/components/pricing/checkout-onboarding-form"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { getBillingInfo } from "@/lib/billing/customer-info"
import { buildCheckoutResumePath, isPaidPlanSlug } from "@/lib/billing/checkout-navigation"
import { PUBLIC_ROUTES, PUBLIC_SECTION_ROUTES } from "@/lib/routes/public"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Finalizar compra - Trampofy",
  description: "Complete seus dados de faturamento para continuar a assinatura da Trampofy.",
  canonicalPath: "/finalizar-compra",
})

type CheckoutPageProps = {
  searchParams?: {
    plan?: string | string[]
  }
}

function readPlan(planParam: string | string[] | undefined) {
  const rawPlan = Array.isArray(planParam) ? planParam[0] : planParam
  return isPaidPlanSlug(rawPlan) ? rawPlan : null
}

export default async function FinalizarCompraPage({ searchParams }: CheckoutPageProps) {
  const selectedPlan = readPlan(searchParams?.plan)
  if (!selectedPlan) {
    redirect(PUBLIC_SECTION_ROUTES.pricing)
  }

  const appUser = await getCurrentAppUser()
  if (!appUser) {
    redirect(
      `${PUBLIC_ROUTES.login}?redirect_to=${encodeURIComponent(
        buildCheckoutResumePath(selectedPlan),
      )}`,
    )
  }

  let billingInfo = null
  try {
    billingInfo = await getBillingInfo(appUser.id)
  } catch {
    billingInfo = null
  }

  return <CheckoutOnboardingForm initialPlan={selectedPlan} initialBillingInfo={billingInfo} />
}
