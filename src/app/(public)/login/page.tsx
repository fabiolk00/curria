import { Metadata } from "next"

import AuthShell from "@/components/auth/auth-shell"
import LoginForm from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Entrar - CurrIA",
  description: "Entre na sua conta CurrIA",
}

export default function LoginPage() {
  return (
    <AuthShell
      mode="login"
      eyebrow="Conta CurrIA"
      title="Entre e volte para o seu curriculo alvo"
      description="Acesse suas sessoes, analises ATS e arquivos gerados com o fluxo nativo do Clerk embutido na interface da CurrIA."
    >
        <LoginForm />
    </AuthShell>
  )
}
