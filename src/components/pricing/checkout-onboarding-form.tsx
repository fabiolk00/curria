'use client'

import { useState } from 'react'
import { AlertCircle, CreditCard, Loader2, MapPin, ShieldCheck, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import Logo from '@/components/logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BRAZIL_STATE_CODES,
  isValidBrazilStateCode,
  isValidPostalCodeInput,
  normalizePostalCode,
  normalizeProvince,
} from '@/lib/billing/address'
import type { BillingInfo } from '@/lib/billing/customer-info'
import { buildCheckoutResumePath, type PaidPlanSlug } from '@/lib/billing/checkout-navigation'
import { getCheckoutErrorMessage } from '@/lib/asaas/checkout-errors'
import { navigateToUrl } from '@/lib/navigation/external'
import { PLANS, formatPrice } from '@/lib/plans'
import { cn } from '@/lib/utils'

const paidPlans: PaidPlanSlug[] = ['unit', 'monthly', 'pro']

const checkoutOnboardingSchema = z.object({
  plan: z.enum(['unit', 'monthly', 'pro']),
  cpfCnpj: z.string().min(11, 'CPF/CNPJ inválido').max(14, 'CPF/CNPJ inválido'),
  phoneNumber: z.string().min(10, 'Telefone inválido').max(11, 'Telefone inválido'),
  postalCode: z.string().refine(isValidPostalCodeInput, 'CEP inválido'),
  address: z.string().trim().min(3, 'Endereço obrigatório'),
  addressNumber: z.string().trim().min(1, 'Número obrigatório'),
  province: z.string().refine(isValidBrazilStateCode, 'Selecione um estado'),
})

type CheckoutOnboardingFormValues = z.infer<typeof checkoutOnboardingSchema>

type CheckoutOnboardingFormProps = {
  initialPlan: PaidPlanSlug
  initialBillingInfo: BillingInfo | null
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function CheckoutOnboardingForm({
  initialPlan,
  initialBillingInfo,
}: CheckoutOnboardingFormProps) {
  const router = useRouter()
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutOnboardingFormValues>({
    resolver: zodResolver(checkoutOnboardingSchema),
    defaultValues: {
      plan: initialPlan,
      cpfCnpj: initialBillingInfo?.cpfCnpj ?? '',
      phoneNumber: initialBillingInfo?.phoneNumber ?? '',
      postalCode: initialBillingInfo?.postalCode ?? '',
      address: initialBillingInfo?.address ?? '',
      addressNumber: initialBillingInfo?.addressNumber ?? '',
      province: initialBillingInfo?.province ? normalizeProvince(initialBillingInfo.province) : '',
    },
  })

  const selectedPlan = watch('plan')
  const cpfCnpjField = register('cpfCnpj')
  const phoneField = register('phoneNumber')
  const postalCodeField = register('postalCode')

  async function onSubmit(values: CheckoutOnboardingFormValues) {
    setSubmissionError(null)

    const normalizedValues: CheckoutOnboardingFormValues = {
      ...values,
      cpfCnpj: onlyDigits(values.cpfCnpj),
      phoneNumber: onlyDigits(values.phoneNumber),
      postalCode: normalizePostalCode(values.postalCode),
      address: values.address.trim(),
      addressNumber: values.addressNumber.trim(),
      province: normalizeProvince(values.province),
    }

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedValues),
    })

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (
      response.ok
      && typeof payload === 'object'
      && payload !== null
      && 'url' in payload
      && typeof payload.url === 'string'
      && payload.url.length > 0
    ) {
      navigateToUrl(payload.url)
      return
    }

    if (response.status === 401) {
      router.push(`/login?redirect_to=${encodeURIComponent(buildCheckoutResumePath(normalizedValues.plan))}`)
      return
    }

    setSubmissionError(getCheckoutErrorMessage(payload))
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.15),transparent_45%)]" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(var(--chart-2)/0.12),transparent_60%)] blur-3xl" />

      <div className="relative w-full max-w-[640px]">
        <div className="mb-8 flex justify-center">
          <Logo linkTo="/" />
        </div>

        <Card className="border-border/50 py-0 shadow-xl">
          <CardHeader className="space-y-3 pb-2 pt-8 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Complete seu cadastro</CardTitle>
            <CardDescription className="mx-auto max-w-xl text-base">
              Precisamos de algumas informações adicionais para configurar seu faturamento e iniciar o checkout com segurança.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-8 pt-4">
              <input type="hidden" {...register('plan')} />

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span>Plano escolhido</span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {paidPlans.map((plan) => {
                    const config = PLANS[plan]
                    const isSelected = selectedPlan === plan
                    const period = config.billing === 'monthly' ? '/mês' : ''

                    return (
                      <button
                        key={plan}
                        type="button"
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-primary/40 hover:bg-background',
                        )}
                        onClick={() => setValue('plan', plan, { shouldValidate: true })}
                      >
                        <div className="font-bold">{config.name}</div>
                        <div className="mt-2 text-2xl font-black tracking-tight">
                          {formatPrice(config.price)}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">{period}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <User className="h-5 w-5 text-primary" />
                  <span>Dados pessoais</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                    <Input
                      id="cpfCnpj"
                      placeholder="Somente números"
                      inputMode="numeric"
                      maxLength={14}
                      aria-invalid={!!errors.cpfCnpj}
                      {...cpfCnpjField}
                      onChange={(event) => {
                        setValue('cpfCnpj', onlyDigits(event.target.value), { shouldValidate: true })
                      }}
                    />
                    {errors.cpfCnpj ? (
                      <p className="text-sm font-medium text-destructive">{errors.cpfCnpj.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Telefone / WhatsApp</Label>
                    <Input
                      id="phoneNumber"
                      placeholder="Somente números com DDD"
                      inputMode="tel"
                      maxLength={11}
                      aria-invalid={!!errors.phoneNumber}
                      {...phoneField}
                      onChange={(event) => {
                        setValue('phoneNumber', onlyDigits(event.target.value), { shouldValidate: true })
                      }}
                    />
                    {errors.phoneNumber ? (
                      <p className="text-sm font-medium text-destructive">{errors.phoneNumber.message}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>Endereço de faturamento</span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="postalCode">CEP</Label>
                    <Input
                      id="postalCode"
                      placeholder="Somente números"
                      inputMode="numeric"
                      maxLength={8}
                      aria-invalid={!!errors.postalCode}
                      {...postalCodeField}
                      onChange={(event) => {
                        setValue('postalCode', onlyDigits(event.target.value), { shouldValidate: true })
                      }}
                    />
                    {errors.postalCode ? (
                      <p className="text-sm font-medium text-destructive">{errors.postalCode.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Rua / Avenida</Label>
                    <Input
                      id="address"
                      placeholder="Ex: Rua das Flores"
                      aria-invalid={!!errors.address}
                      {...register('address')}
                    />
                    {errors.address ? (
                      <p className="text-sm font-medium text-destructive">{errors.address.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="addressNumber">Número</Label>
                    <Input
                      id="addressNumber"
                      placeholder="Ex: 123"
                      aria-invalid={!!errors.addressNumber}
                      {...register('addressNumber')}
                    />
                    {errors.addressNumber ? (
                      <p className="text-sm font-medium text-destructive">{errors.addressNumber.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="province">Estado (UF)</Label>
                    <Controller
                      name="province"
                      control={control}
                      render={({ field }) => (
                        <select
                          id="province"
                          ref={field.ref}
                          name={field.name}
                          value={field.value ?? ''}
                          aria-invalid={!!errors.province}
                          className={cn(
                            'border-input bg-transparent h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none',
                            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                            'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
                            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                          )}
                          onBlur={field.onBlur}
                          onChange={(event) => {
                            field.onChange(normalizeProvince(event.target.value))
                          }}
                        >
                          <option value="">Selecione o estado</option>
                          {BRAZIL_STATE_CODES.map((stateCode) => (
                            <option key={stateCode} value={stateCode}>
                              {stateCode}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    {errors.province ? (
                      <p className="text-sm font-medium text-destructive">{errors.province.message}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {submissionError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>

            <CardFooter className="flex flex-col gap-4 bg-muted/20 pt-6">
              <Button type="submit" className="h-12 w-full text-base font-bold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Finalizar cadastro e ir para o pagamento'
                )}
              </Button>

              <div className="mt-2 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Ambiente seguro. Seus dados estão protegidos para o checkout.</span>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
