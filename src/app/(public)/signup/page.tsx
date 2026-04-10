import { Metadata } from "next"

import AuthShell from "@/components/auth/auth-shell"
import SignupForm from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Criar conta - CurrIA",
  description: "Crie sua conta CurrIA",
}

export default function SignupPage() {
  return (
    <AuthShell
      mode="signup"
      eyebrow="Nova conta"
      title="Crie sua conta e salve cada versao do seu curriculo"
      description="Cadastre-se para manter vagas-alvo, historico de otimizacoes e o PDF final sempre ligados ao seu perfil."
    >
        <SignupForm />
    </AuthShell>
  )
}
