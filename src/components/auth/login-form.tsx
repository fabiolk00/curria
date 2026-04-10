"use client"

import { SignIn } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"

import Logo from "@/components/logo"
import { embeddedClerkAppearance } from "@/components/auth/clerk-appearance"
import { getSafeRedirectPath } from "@/lib/auth/redirects"

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect_to"))

  return (
    <div className="space-y-5">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <Logo linkTo="/" />
        </div>
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl={redirectTo}
        signUpUrl="/signup"
        appearance={embeddedClerkAppearance}
      />
    </div>
  )
}
