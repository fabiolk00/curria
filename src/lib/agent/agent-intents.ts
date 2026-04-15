import { looksLikeJobDescription } from '@/lib/agent/vacancy-analysis'

export type RewriteFocus = 'summary' | 'experience' | 'skills'

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isGenerationApproval(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || /\b(nao|not|cancel|depois)\b/.test(normalized)) {
    return false
  }

  return /\b(aceito|aceito gerar|aceito a geracao|confirmo a geracao)\b/.test(normalized)
}

export function isGenerationRequest(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || /\b(nao|not|cancel|depois)\b/.test(normalized)) {
    return false
  }

  return (
    /\b(pode gerar|gerar agora|gere o arquivo|gere os arquivos|gere o curriculo|gere meu curriculo)\b/.test(normalized)
    || (
      /\b(gere|gerar|gera|exporte|exportar|baixar|baixe|download)\b/.test(normalized)
      && /\b(arquivo|arquivos|curriculo|pdf|docx|versao final)\b/.test(normalized)
    )
  )
}

export function isDialogContinuationApproval(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || /\b(nao|not|cancel|depois)\b/.test(normalized)) {
    return false
  }

  return /^(sim|ok|okay|pode|pode fazer|pode seguir|segue|continue|continua|vai|manda ver|bora)$/.test(normalized)
}

export function resolveRewriteFocus(message: string): RewriteFocus | null {
  const normalized = normalizeText(message)

  if (!normalized) {
    return null
  }

  if (/\b(resumo|summary|perfil profissional)\b/.test(normalized)) {
    return 'summary'
  }

  if (/\b(experiencia|experience|historico)\b/.test(normalized)) {
    return 'experience'
  }

  if (/\b(competencia|competencias|skills|habilidades)\b/.test(normalized)) {
    return 'skills'
  }

  return null
}

export function isDialogRewriteRequest(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized || looksLikeJobDescription(message)) {
    return false
  }

  if (resolveRewriteFocus(message)) {
    return true
  }

  return /\b(reescreva|reescrever|reescreve|rewrite|adapte|adaptar|ajuste|ajustar|melhore|melhorar|refaca|refazer)\b/.test(normalized)
}

export function isCareerFitOverrideConfirmation(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized) {
    return false
  }

  return (
    /\b(entendo|compreendo|eu entendo)\b/.test(normalized)
    && /\b(quero continuar|quero prosseguir|mesmo assim quero continuar|ainda assim quero continuar|prosseguir mesmo assim|continuar mesmo assim)\b/.test(normalized)
  )
}

export { looksLikeJobDescription }
