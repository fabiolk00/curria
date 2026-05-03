import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

import { getSafeRedirectPath } from "@/lib/auth/redirects"
import { PROFILE_SETUP_PATH } from "@/lib/routes/app"

type SSOCallbackPageProps = {
  searchParams?: {
    redirect_to?: string | string[]
  }
}

function readRedirectTo(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function SSOCallback({ searchParams }: SSOCallbackPageProps) {
  const redirectTo = getSafeRedirectPath(
    readRedirectTo(searchParams?.redirect_to),
    PROFILE_SETUP_PATH,
  )

  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl={redirectTo}
      signInForceRedirectUrl={redirectTo}
      signUpFallbackRedirectUrl={redirectTo}
      signUpForceRedirectUrl={redirectTo}
    />
  )
}
