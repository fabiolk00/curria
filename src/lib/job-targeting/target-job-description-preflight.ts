export type TargetJobDescriptionPreflightResult =
  | {
      ok: true
      reason: 'short_explicit' | 'vacancy_shape' | 'not_confidently_invalid'
      diagnostics: TargetJobDescriptionPreflightDiagnostics
    }
  | {
      ok: false
      reason: 'empty' | 'conversation_or_code_not_vacancy'
      message: string
      diagnostics: TargetJobDescriptionPreflightDiagnostics
    }

export type TargetJobDescriptionPreflightDiagnostics = {
  charCount: number
  lineCount: number
  vacancyScore: number
  conversationScore: number
  codeArtifactScore: number
}

const INVALID_TARGET_JOB_DESCRIPTION_MESSAGE = 'Cole a descricao real da vaga. O texto informado parece uma conversa, analise ou trecho tecnico, nao uma vaga com cargo, responsabilidades e requisitos.'

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function countMatches(patterns: RegExp[], text: string): number {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

function countRepeatedMatches(pattern: RegExp, text: string): number {
  return [...text.matchAll(pattern)].length
}

function getLineCount(text: string): number {
  return text.split(/\n+/u).map((line) => line.trim()).filter(Boolean).length
}

export function assessTargetJobDescriptionPreflight(
  value: string | undefined,
): TargetJobDescriptionPreflightResult {
  const text = value?.trim() ?? ''
  const normalized = normalize(text)
  const lineCount = getLineCount(text)
  const charCount = text.length

  const vacancyScore = countMatches([
    /\b(vaga|cargo|posicao|oportunidade|contratando|buscamos|procuramos|sobre a vaga|about the role|job description)\b/u,
    /\b(responsabilidades|atribuicoes|atividades|requisitos|qualificacoes|requirements|responsibilities|qualifications)\b/u,
    /\b(desejavel|diferenciais|nice to have|beneficios|modelo de trabalho|remoto|hibrido|clt|pj)\b/u,
    /\b(analista|engenheiro|especialista|desenvolvedor|developer|consultor|coordenador|gerente|designer|cientista|arquiteto)\b/u,
    /\b(experiencia|conhecimento|dominio|vivencia|formacao|certificacao|stack|habilidades)\b/u,
  ], normalized)

  const conversationScore = countMatches([
    /\b(sim|nao|resumo|resumo honesto|o problema|o bug|o fim|minha resposta|eu faria|eu nao|voce|isso aqui|ou seja)\b/u,
    /\b(runtime|matcher|prompt|source of truth|source_of_truth|shadow|golden cases|hardcode|pipeline|frontend|backend)\b/u,
    /\b(no llm|na ui|nos golden|no legacy|no caminho|em producao|ate cutover)\b/u,
    /\b(commit|push|pr\d?|script|teste protegido|catalogo|micro-catalogo)\b/u,
  ], normalized)

  const codeArtifactScore =
    countMatches([
      /`[^`]+`/u,
      /\b[a-z0-9-]+\.(ts|tsx|js|jsx|md|json|toml)\b/u,
      /\bsrc\/|src\\/u,
      /\b[A-Z_]{3,}_[A-Z0-9_]+\b/u,
      /\b[a-z]+[A-Z][a-zA-Z]+\b/u,
    ], text)
    + Math.min(countRepeatedMatches(/\b[a-z0-9-]+\.(ts|tsx|js|jsx|md|json|toml)\b/giu, text), 3)

  const diagnostics = {
    charCount,
    lineCount,
    vacancyScore,
    conversationScore,
    codeArtifactScore,
  }

  if (!text) {
    return {
      ok: false,
      reason: 'empty',
      message: 'Cole a descricao da vaga para adaptar seu curriculo.',
      diagnostics,
    }
  }

  if (charCount < 140) {
    return {
      ok: true,
      reason: 'short_explicit',
      diagnostics,
    }
  }

  if (vacancyScore >= 3) {
    return {
      ok: true,
      reason: 'vacancy_shape',
      diagnostics,
    }
  }

  if (
    conversationScore >= 2
    && codeArtifactScore >= 2
    && vacancyScore <= 1
    && lineCount >= 3
  ) {
    return {
      ok: false,
      reason: 'conversation_or_code_not_vacancy',
      message: INVALID_TARGET_JOB_DESCRIPTION_MESSAGE,
      diagnostics,
    }
  }

  if (conversationScore >= 3 && vacancyScore === 0 && lineCount >= 3) {
    return {
      ok: false,
      reason: 'conversation_or_code_not_vacancy',
      message: INVALID_TARGET_JOB_DESCRIPTION_MESSAGE,
      diagnostics,
    }
  }

  return {
    ok: true,
    reason: 'not_confidently_invalid',
    diagnostics,
  }
}

export { INVALID_TARGET_JOB_DESCRIPTION_MESSAGE }
