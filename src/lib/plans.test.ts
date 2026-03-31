import { describe, it, expect } from 'vitest'
import { PLANS, formatPrice, getPlan } from './plans'

describe('Plans', () => {
  it('has correct credit allocations', () => {
    expect(PLANS.free.credits).toBe(1)
    expect(PLANS.unit.credits).toBe(3)
    expect(PLANS.monthly.credits).toBe(20)
    expect(PLANS.pro.credits).toBe(40)
  })

  it('has correct prices in centavos', () => {
    expect(PLANS.free.price).toBe(0)
    expect(PLANS.unit.price).toBe(1990)
    expect(PLANS.monthly.price).toBe(3990)
    expect(PLANS.pro.price).toBe(6990)
  })

  it('only monthly and pro are subscription plans', () => {
    expect(PLANS.free.billing).toBe('once')
    expect(PLANS.unit.billing).toBe('once')
    expect(PLANS.monthly.billing).toBe('monthly')
    expect(PLANS.pro.billing).toBe('monthly')
  })

  it('only mensal is highlighted', () => {
    expect(PLANS.free.highlighted).toBe(false)
    expect(PLANS.unit.highlighted).toBe(false)
    expect(PLANS.monthly.highlighted).toBe(true)
    expect(PLANS.pro.highlighted).toBe(false)
  })

  it('every plan has at least 3 features', () => {
    Object.values(PLANS).forEach((plan) => {
      expect(plan.features.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('no plan has unlimited credits (-1 or Infinity)', () => {
    Object.values(PLANS).forEach((plan) => {
      expect(plan.credits).toBeGreaterThan(0)
      expect(plan.credits).toBeLessThan(1000)
      expect(plan.credits).not.toBe(-1)
    })
  })

  describe('formatPrice', () => {
    it('formats zero correctly', () => {
      expect(formatPrice(0)).toBe('R$ 0')
    })

    it('formats prices without decimals', () => {
      expect(formatPrice(1990)).toBe('R$ 19.90')
      expect(formatPrice(3990)).toBe('R$ 39.90')
      expect(formatPrice(6990)).toBe('R$ 69.90')
    })

    it('adds period suffix when provided', () => {
      expect(formatPrice(3990, '/mês')).toBe('R$ 39.90/mês')
      expect(formatPrice(6990, '/mês')).toBe('R$ 69.90/mês')
    })
  })

  describe('getPlan', () => {
    it('returns plan for valid slug', () => {
      expect(getPlan('free')).toEqual(PLANS.free)
      expect(getPlan('unit')).toEqual(PLANS.unit)
      expect(getPlan('monthly')).toEqual(PLANS.monthly)
      expect(getPlan('pro')).toEqual(PLANS.pro)
    })

    it('returns null for invalid slug', () => {
      expect(getPlan('invalid')).toBeNull()
      expect(getPlan('')).toBeNull()
    })
  })
})
