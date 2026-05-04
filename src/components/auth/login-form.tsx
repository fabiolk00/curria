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
  AuthLinkedInButton,
  AuthSubmitButton,
} from "@/components/auth/auth-form-ui"
import { getClerkErrorMessage } from "@/components/auth/clerk-error"
import { Button } from "@/components/ui/button"
import { buildSsoCallbackPath, getSafeRedirectPath } from "@/lib/auth/redirects"
import { navigateToUrl } from "@/lib/navigation/external"
import { PROFILE_SETUP_PATH } from "@/lib/routes/app"

const POST_LOGIN_REDIRECT_PATH = PROFILE_SETUP_PATH

export default function LoginForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const searchParams = useSearchParams()
  const requestedRedirectTo = searchParams.get("redirect_to")
  const redirectTo = getSafeRedirectPath(requestedRedirectTo, POST_LOGIN_REDIRECT_PATH)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLinkedInPending, setIsLinkedInPending] = useState(false)
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

      setErrorMessage("Não foi possível entrar com esse método.")
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Não foi possível entrar agora."),
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
        redirectUrl: buildSsoCallbackPath(redirectTo),
        redirectUrlComplete: redirectTo,
      })
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Não foi possível iniciar o login com Google."),
      )
      setIsGooglePending(false)
    }
  }

  const handleLinkedInLogin = async () => {
    if (!isLoaded || !signIn) {
      return
    }

    setIsLinkedInPending(true)
    setErrorMessage(null)

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_linkedin_oidc",
        redirectUrl: buildSsoCallbackPath(redirectTo),
        redirectUrlComplete: redirectTo,
      })
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Não foi possível iniciar o login com LinkedIn."),
      )
      setIsLinkedInPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <AuthLinkedInButton
        pending={isLinkedInPending}
        onClick={handleLinkedInLogin}
      />

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
