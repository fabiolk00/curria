"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useSignUp } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Logo from "@/components/logo"
import { AlertCircle, Eye, EyeOff, Loader2, Mail } from "lucide-react"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const signUpSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

type SignUpData = z.infer<typeof signUpSchema>

const verifySchema = z.object({
  code: z.string().length(6, 'O código deve ter 6 dígitos'),
})

type VerifyData = z.infer<typeof verifySchema>

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 'signup' | 'verify' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <span className={step === 'signup' ? 'font-medium text-primary' : ''}>
        Cadastro
      </span>
      <span className="text-muted-foreground/40">›</span>
      <span className={step === 'verify' ? 'font-medium text-primary' : ''}>
        Verificação
      </span>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function SignupForm() {
  const [step, setStep] = useState<'signup' | 'verify'>('signup')
  const [showPassword, setShowPassword] = useState(false)
  const { signUp, isLoaded, setActive } = useSignUp()
  const router = useRouter()

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
  })

  const verifyForm = useForm<VerifyData>({
    resolver: zodResolver(verifySchema),
  })

  const onSignUp = async (data: SignUpData) => {
    if (!isLoaded) return

    try {
      await signUp.create({
        firstName: data.name.split(' ')[0],
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        emailAddress: data.email,
        password: data.password,
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setStep('verify')
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        'Erro ao criar conta. Tente novamente.'
      signUpForm.setError('root', { message })
    }
  }

  const onVerify = async (data: VerifyData) => {
    if (!isLoaded) return

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: data.code,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        'Código inválido. Tente novamente.'
      verifyForm.setError('root', { message })
    }
  }

  // ── Verification step ───────────────────────────────────────────────────

  if (step === 'verify') {
    const {
      formState: { errors, isSubmitting },
    } = verifyForm

    return (
      <Card className="w-full max-w-[400px]">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="flex justify-center">
            <Logo linkTo="/" />
          </div>
          <StepIndicator step="verify" />
          <div className="flex flex-col items-center gap-3 pt-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Verifique seu e-mail</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um código de 6 dígitos. Verifique sua caixa de entrada.
              </p>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={verifyForm.handleSubmit(onVerify)} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificação</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
                aria-invalid={!!errors.code}
                aria-describedby={errors.code ? 'code-error' : undefined}
                className={`text-center text-2xl tracking-[0.5em] font-mono h-12 ${
                  errors.code
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
                {...verifyForm.register('code')}
              />
              {errors.code && (
                <p id="code-error" className="text-sm text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>

            {errors.root && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Confirmar e entrar'
              )}
            </Button>
            <button
              type="button"
              onClick={() => setStep('signup')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar e corrigir e-mail
            </button>
          </CardFooter>
        </form>
      </Card>
    )
  }

  // ── Sign-up step ────────────────────────────────────────────────────────

  const {
    formState: { errors, isSubmitting },
  } = signUpForm

  return (
    <Card className="w-full max-w-[400px]">
      <CardHeader className="text-center space-y-3 pb-4">
        <div className="flex justify-center">
          <Logo linkTo="/" />
        </div>
        <StepIndicator step="signup" />
        <div className="space-y-1 pt-1">
          <h1 className="text-xl font-semibold">Criar sua conta</h1>
          <p className="text-sm font-medium text-primary">
            1 análise gratuita incluída
          </p>
          <p className="text-xs text-muted-foreground">Sem cartão de crédito</p>
        </div>
      </CardHeader>

      <form onSubmit={signUpForm.handleSubmit(onSignUp)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome completo"
              autoComplete="name"
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={
                errors.name
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              {...signUpForm.register('name')}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={
                errors.email
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              {...signUpForm.register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
                className={
                  errors.password
                    ? 'border-destructive focus-visible:ring-destructive pr-10'
                    : 'pr-10'
                }
                {...signUpForm.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Criar conta grátis'
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Já tem conta?{' '}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
