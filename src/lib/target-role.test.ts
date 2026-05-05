import { describe, expect, it } from 'vitest'

import { getDisplayableTargetRole, isPlaceholderTargetRole, isSuspiciousTargetRole } from '@/lib/target-role'

describe('target-role helpers', () => {
  it('hides internal placeholder roles from display surfaces', () => {
    expect(isPlaceholderTargetRole('Vaga Alvo')).toBe(true)
    expect(isPlaceholderTargetRole('Vaga Desconhecida')).toBe(true)
    expect(getDisplayableTargetRole('Vaga Alvo')).toBeNull()
    expect(getDisplayableTargetRole('Vaga Desconhecida')).toBeNull()
  })

  it('still marks section headings as suspicious without hiding the raw text', () => {
    expect(isSuspiciousTargetRole('Responsabilidades e Atribuições')).toBe(true)
    expect(getDisplayableTargetRole('Responsabilidades e Atribuições')).toBe('Responsabilidades e Atribuições')
  })

  it('keeps real role names available for display', () => {
    expect(isSuspiciousTargetRole('Analytics Engineer')).toBe(false)
    expect(getDisplayableTargetRole('Analytics Engineer')).toBe('Analytics Engineer')
  })
})
