"use client"

import { useSignIn } from "@clerk/nextjs"
import { Eye, EyeOff } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"

import {
  AuthDivider,
  AuthErrorMessage,
  AuthField,
  AuthGoogleButton,
  AuthSubmitButton,
} from "@/components/auth/auth-form-ui"
import { getClerkErrorMessage } from "@/components/auth/clerk-error"
import { Button } from "@/components/ui/button"
import { getSafeRedirectPath } from "@/lib/auth/redirects"
import { navigateToUrl } from "@/lib/navigation/external"

export default function LoginForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect_to"))

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGooglePending, setIsGooglePending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isLoaded || !signIn || !setActive) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await signIn.create({
        strategy: "password",
        identifier: email,
        password,
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        navigateToUrl(redirectTo)
        return
      }

      setErrorMessage("Nao foi possivel entrar com esse metodo.")
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Nao foi possivel entrar agora."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!isLoaded || !signIn) {
      return
    }

    setIsGooglePending(true)
    setErrorMessage(null)

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectTo,
      })
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Nao foi possivel iniciar o login com Google."),
      )
      setIsGooglePending(false)
    }
  }

  return (
    <div className="space-y-6">
      <AuthGoogleButton
        pending={isGooglePending}
        onClick={handleGoogleLogin}
      />

      <AuthDivider />

      <form
        className="space-y-5"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <AuthErrorMessage message={errorMessage} />

        <AuthField
          id="login-email"
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail"
          value={email}
          onChange={setEmail}
        />

        <AuthField
          id="login-password"
          label="Senha"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Digite sua senha"
          value={password}
          onChange={setPassword}
          endAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="sr-only">Mostrar senha</span>
            </Button>
          }
        />

        <AuthSubmitButton
          label="Continuar"
          pending={isSubmitting}
          disabled={!isLoaded}
        />
      </form>
    </div>
  )
}
