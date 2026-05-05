function normalizeTargetRole(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function isPlaceholderTargetRole(value?: string | null): boolean {
  const normalized = normalizeTargetRole(value)

  if (!normalized) {
    return false
  }

  return /^(vaga\s+alvo|vaga\s+desconhecida|cargo\s+alvo|cargo\s+desconhecido|target\s+role|unknown\s+role)$/.test(normalized)
}

export function isSuspiciousTargetRole(value?: string | null): boolean {
  const normalized = normalizeTargetRole(value)

  if (!normalized) {
    return false
  }

  return /^(responsabilidades?(?:\s+e\s+atribuicoes)?|atribuicoes|requisitos(?:\s+e\s+qualificacoes)?|qualificacoes|descricao|atividades|about\s+the\s+job|about\s+the\s+role|job\s+description|responsibilities|requirements|qualifications|vaga\s+alvo|vaga\s+desconhecida|cargo\s+alvo|cargo\s+desconhecido|target\s+role|unknown\s+role)$/.test(normalized)
}

export function getDisplayableTargetRole(value?: string | null): string | null {
  const trimmed = value?.trim()

  if (!trimmed || isPlaceholderTargetRole(trimmed)) {
    return null
  }

  return trimmed
}
