import type { Metadata } from "next"

import UserDataPage from "@/components/resume/user-data-page"
import { getCurrentAppUser } from "@/lib/auth/app-user"

export const metadata: Metadata = {
  title: "Perfil profissional - CurrIA",
  description: "Configure e revise o perfil base que alimenta novas sess\u00f5es.",
}

export default async function NewResumePage() {
  const appUser = await getCurrentAppUser()

  return <UserDataPage currentCredits={appUser?.creditAccount.creditsRemaining ?? 0} />
}
