import type { Metadata } from "next"

import AuthShell from "@/components/auth/auth-shell"
import LoginForm from "@/components/auth/login-form"
import { buildPublicPageMetadata } from "@/lib/seo/public-metadata"

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Entrar - Trampofy",
  description: "Entre na sua conta Trampofy",
  canonicalPath: "/entrar",
})

type AuthPageProps = {
  searchParams?: {
    redirect_to?: string | string[]
  }
}

function readRedirectTo(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function EntrarPage({ searchParams }: AuthPageProps) {
  return (
    <AuthShell
      mode="login"
      title="Entrar na sua conta"
      description=""
      redirectTo={readRedirectTo(searchParams?.redirect_to)}
    >
      <LoginForm />
    </AuthShell>
  )
}
