import React, { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button, Card, CardContent, CardFooter, CardHeader, Input, Label, Separator, Alert, AlertDescription } from "../components/ui"
import Logo from "../components/logo"
import { AlertCircle, Eye, EyeOff, Loader2, Mail } from "lucide-react"

// Schemas
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

// Step indicator
function StepIndicator({ step }: { step: 'signup' | 'verify' }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-2">
      <span className={step === 'signup' ? 'font-semibold text-primary' : 'font-medium'}>
        Cadastro
      </span>
      <span className="text-muted-foreground/30">›</span>
      <span className={step === 'verify' ? 'font-semibold text-primary' : 'font-medium'}>
        Verificação
      </span>
    </div>
  )
}

export default function SignupPage() {
  const [step, setStep] = useState<'signup' | 'verify'>('signup')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
  })

  const verifyForm = useForm<VerifyData>({
    resolver: zodResolver(verifySchema),
  })

  const onSignUp = async (data: SignUpData) => {
    // Mock prepare verification
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setStep('verify')
    } catch (err) {
      signUpForm.setError('root', { message: 'Erro ao criar conta. Tente novamente.' })
    }
  }

  const onVerify = async (data: VerifyData) => {
    // Mock verification
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      navigate('/dashboard')
    } catch (err) {
      verifyForm.setError('root', { message: 'Código inválido. Tente novamente.' })
    }
  }

  const handleGoogleSignUp = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
      <Card className="w-full max-w-[400px] shadow-xl border-border/50">
        
        {step === 'verify' ? (
          <>
            <CardHeader className="text-center space-y-4 pt-8 pb-2">
              <div className="flex justify-center mb-2">
                <Logo linkTo="/" />
              </div>
              <StepIndicator step="verify" />
              <div className="flex flex-col items-center gap-4 pt-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight">Verifique seu e-mail</h1>
                  <p className="text-sm text-muted-foreground text-pretty px-4">
                    Enviamos um código de 6 dígitos. Verifique sua caixa de entrada.
                  </p>
                </div>
              </div>
            </CardHeader>

            <form onSubmit={verifyForm.handleSubmit(onVerify)} noValidate>
              <CardContent className="space-y-6 pt-4">
                <div className="space-y-3">
                  <Label htmlFor="code" className="sr-only">Código de verificação</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    className={`text-center text-3xl tracking-[0.5em] font-mono h-16 ${
                      verifyForm.formState.errors.code
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                    {...verifyForm.register('code')}
                  />
                  {verifyForm.formState.errors.code && (
                    <p className="text-sm text-destructive font-medium text-center">
                      {verifyForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                {verifyForm.formState.errors.root && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{verifyForm.formState.errors.root.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pb-8">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold"
                  disabled={verifyForm.formState.isSubmitting}
                >
                  {verifyForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Confirmar e entrar'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('signup')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Voltar e corrigir e-mail
                </button>
              </CardFooter>
            </form>
          </>
        ) : (
          <>
            <CardHeader className="text-center space-y-4 pt-8 pb-2">
              <div className="flex justify-center mb-2">
                <Logo linkTo="/" />
              </div>
              <StepIndicator step="signup" />
              <div className="space-y-2 pt-2">
                <h1 className="text-2xl font-bold tracking-tight">Criar sua conta</h1>
                <p className="text-sm font-semibold text-primary">
                  1 análise gratuita incluída
                </p>
                <p className="text-xs font-medium text-muted-foreground">Sem cartão de crédito</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-medium"
                onClick={handleGoogleSignUp}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Criar conta com Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium">ou continue com e-mail</span>
                </div>
              </div>
            </CardContent>

            <form onSubmit={signUpForm.handleSubmit(onSignUp)} noValidate>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    className={`h-11 ${
                      signUpForm.formState.errors.name
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                    {...signUpForm.register('name')}
                  />
                  {signUpForm.formState.errors.name && (
                    <p className="text-sm text-destructive font-medium">
                      {signUpForm.formState.errors.name.message}
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
                    className={`h-11 ${
                      signUpForm.formState.errors.email
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                    {...signUpForm.register('email')}
                  />
                  {signUpForm.formState.errors.email && (
                    <p className="text-sm text-destructive font-medium">
                      {signUpForm.formState.errors.email.message}
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
                      className={`h-11 pr-10 ${
                        signUpForm.formState.errors.password
                          ? 'border-destructive focus-visible:ring-destructive'
                          : ''
                      }`}
                      {...signUpForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {signUpForm.formState.errors.password && (
                    <p className="text-sm text-destructive font-medium">
                      {signUpForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {signUpForm.formState.errors.root && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{signUpForm.formState.errors.root.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-6 pb-8">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold"
                  disabled={signUpForm.formState.isSubmitting}
                >
                  {signUpForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar conta grátis'
                  )}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Já tem conta?{' '}
                  <Link
                    to="/login"
                    className="text-primary hover:underline font-semibold"
                  >
                    Entrar
                  </Link>
                </p>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}