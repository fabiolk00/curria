"use client"

import { useAuth, useSignUp } from "@clerk/nextjs"
import { Eye, EyeOff } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"

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
import { buildDefaultCheckoutOnboardingPath } from "@/lib/billing/checkout-navigation"
import { navigateToUrl } from "@/lib/navigation/external"

export default function SignupForm() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp()
  const searchParams = useSearchParams()
  const requestedRedirectTo = searchParams.get("redirect_to")
  const redirectTo = getSafeRedirectPath(
    requestedRedirectTo,
    buildDefaultCheckoutOnboardingPath(),
  )
  const authenticatedRedirectTo = getSafeRedirectPath(requestedRedirectTo, "/dashboard")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGooglePending, setIsGooglePending] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    navigateToUrl(authenticatedRedirectTo)
  }, [authenticatedRedirectTo, isLoaded, isSignedIn])

  const completeSession = async (sessionId: string | null) => {
    if (!sessionId || !setActive) {
      return false
    }

    await setActive({ session: sessionId })
    navigateToUrl(redirectTo)
    return true
  }

  const startEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isSignUpLoaded || !signUp) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      })

      if (result.status === "complete") {
        const completed = await completeSession(result.createdSessionId)

        if (completed) {
          return
        }
      }

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      })
      setNeedsVerification(true)
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Nao foi possivel criar sua conta agora."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const verifyEmailCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isSignUpLoaded || !signUp) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      })

      if (result.status === "complete") {
        const completed = await completeSession(result.createdSessionId)

        if (completed) {
          return
        }
      }

      setErrorMessage("Nao foi possivel verificar o codigo informado.")
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Nao foi possivel verificar seu e-mail."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendVerificationCode = async () => {
    if (!isSignUpLoaded || !signUp) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      })
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Nao foi possivel reenviar o codigo."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignup = async () => {
    if (!isSignUpLoaded || !signUp) {
      return
    }

    setIsGooglePending(true)
    setErrorMessage(null)

    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectTo,
      })
    } catch (error) {
      setErrorMessage(
        getClerkErrorMessage(error, "Nao foi possivel iniciar o cadastro com Google."),
      )
      setIsGooglePending(false)
    }
  }

  if (needsVerification) {
    return (
      <div className="space-y-6">
        <AuthErrorMessage message={errorMessage} />

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Verifique seu e-mail
          </h3>
          <p className="text-sm text-muted-foreground">
            Enviamos um codigo para {email}. Digite abaixo para concluir sua conta.
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => void verifyEmailCode(event)}
        >
          <AuthField
            id="signup-verification-code"
            label="Codigo"
            autoComplete="one-time-code"
            placeholder="Digite o codigo"
            value={verificationCode}
            onChange={setVerificationCode}
          />

          <div className="space-y-3">
            <AuthSubmitButton
              label="Verificar"
              pending={isSubmitting}
              disabled={!isSignUpLoaded}
            />

            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-xl text-foreground/70 hover:bg-muted hover:text-foreground"
              onClick={() => void resendVerificationCode()}
              disabled={isSubmitting || !isSignUpLoaded}
            >
              Reenviar codigo
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthGoogleButton
        pending={isGooglePending}
        onClick={handleGoogleSignup}
      />

      <AuthDivider />

      <form
        className="space-y-5"
        onSubmit={(event) => void startEmailSignup(event)}
      >
        <AuthErrorMessage message={errorMessage} />

        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            id="signup-first-name"
            label="Primeiro nome"
            autoComplete="given-name"
            placeholder="Primeiro nome"
            value={firstName}
            onChange={setFirstName}
          />
          <AuthField
            id="signup-last-name"
            label="Sobrenome"
            autoComplete="family-name"
            placeholder="Sobrenome"
            value={lastName}
            onChange={setLastName}
          />
        </div>

        <AuthField
          id="signup-email"
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail"
          value={email}
          onChange={setEmail}
        />

        <AuthField
          id="signup-password"
          label="Senha"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
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
          disabled={!isSignUpLoaded}
        />
      </form>
    </div>
  )
}
