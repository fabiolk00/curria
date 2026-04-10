"use client"

import { SignIn } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"

import { embeddedClerkAppearance } from "@/components/auth/clerk-appearance"
import { getSafeRedirectPath } from "@/lib/auth/redirects"

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect_to"))

  return (
    <div className="space-y-5">
      <SignIn
        routing="hash"
        forceRedirectUrl={redirectTo}
        signUpUrl="/signup"
        appearance={embeddedClerkAppearance}
      />
    </div>
  )
}
