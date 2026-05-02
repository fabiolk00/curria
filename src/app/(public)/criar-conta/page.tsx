import type { Metadata } from "next"

import AuthShell from "@/components/auth/auth-shell"
import SignupForm from "@/components/auth/signup-form"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Criar conta - CurrIA",
  description: "Crie sua conta CurrIA",
  canonicalPath: "/criar-conta",
})

type AuthPageProps = {
  searchParams?: {
    redirect_to?: string | string[]
  }
}

function readRedirectTo(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function CriarContaPage({ searchParams }: AuthPageProps) {
  return (
    <AuthShell
      mode="signup"
      title="Criar conta"
      description=""
      redirectTo={readRedirectTo(searchParams?.redirect_to)}
    >
      <SignupForm />
    </AuthShell>
  )
}
