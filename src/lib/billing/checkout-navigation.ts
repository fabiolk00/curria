import type { PlanSlug } from '@/lib/plans'

export type PaidPlanSlug = Exclude<PlanSlug, 'free'>

export function isPaidPlanSlug(value: string | null | undefined): value is PaidPlanSlug {
  return value === 'unit' || value === 'monthly' || value === 'pro'
}

export function buildCheckoutResumePath(plan: PaidPlanSlug): string {
  return `/pricing?checkoutPlan=${plan}`
}

export function buildCheckoutOnboardingPath(plan: PaidPlanSlug): string {
  return `/checkout?plan=${plan}`
}
