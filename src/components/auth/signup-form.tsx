"use client"

import { SignUp, useAuth } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

import Logo from "@/components/logo"
import { embeddedClerkAppearance } from "@/components/auth/clerk-appearance"
import { buildDefaultCheckoutOnboardingPath } from "@/lib/billing/checkout-navigation"
import { getSafeRedirectPath } from "@/lib/auth/redirects"
import { navigateToUrl } from "@/lib/navigation/external"

export default function SignupForm() {
  const { isLoaded, isSignedIn } = useAuth()
  const searchParams = useSearchParams()
  const requestedRedirectTo = searchParams.get("redirect_to")
  const redirectTo = getSafeRedirectPath(
    requestedRedirectTo,
    buildDefaultCheckoutOnboardingPath(),
  )
  const authenticatedRedirectTo = getSafeRedirectPath(requestedRedirectTo, "/dashboard")

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    navigateToUrl(authenticatedRedirectTo)
  }, [authenticatedRedirectTo, isLoaded, isSignedIn])

  return (
    <div className="space-y-5">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <Logo linkTo="/" />
        </div>
      </div>

      <SignUp
        routing="hash"
        forceRedirectUrl={redirectTo}
        signInUrl="/login"
        appearance={embeddedClerkAppearance}
      />
    </div>
  )
}
