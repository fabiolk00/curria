export type TargetJobDetection = {
  targetJobDescription: string
  confidence: 'medium' | 'high'
}

export function normalizeForJobDescriptionDetection(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function looksLikeJobDescription(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 140) {
    return false
  }

  const normalized = normalizeForJobDescriptionDetection(trimmed)
  const sectionSignals = [
    'responsabilidades',
    'responsibility',
    'responsibilities',
    'requisitos',
    'requirements',
    'resumo dos requisitos',
    'requisitos desejaveis',
    'qualificacoes',
    'qualifications',
    'diferenciais',
    'nice to have',
    'o que oferecemos',
    'o que procuramos',
    'we are looking for',
    'job description',
  ]

  const sectionHits = sectionSignals.filter((signal) => normalized.includes(signal)).length
  const roleHit = /\b(analista|engenheiro|developer|desenvolvedor|cientista|gerente|coordenador|consultor|product|designer|arquiteto|devops|sre|qa|bi|dados|data)\b/.test(normalized)
  const hiringIntentHit = /\b(vaga|cargo|posicao|position|role|opportunity|buscamos|contratando)\b/.test(normalized)
  const summarizedRequirementsHit = normalized.includes('resumo dos requisitos') || normalized.includes('requisitos desejaveis')
  const keywordListHit = /(?:sql|python|r|looker|bigquery|google analytics|google tag manager|appsflyer|github|machine learning|etl|power bi|tableau|dbt|airflow|google sheets|sql server).*(?:,|\n).*(?:sql|python|r|looker|bigquery|google analytics|google tag manager|appsflyer|github|machine learning|etl|power bi|tableau|dbt|airflow|google sheets|sql server).*(?:,|\n).*(?:sql|python|r|looker|bigquery|google analytics|google tag manager|appsflyer|github|machine learning|etl|power bi|tableau|dbt|airflow|google sheets|sql server)/.test(normalized)

  return (
    sectionHits >= 2
    || (roleHit && hiringIntentHit && trimmed.length >= 220)
    || (summarizedRequirementsHit && keywordListHit && trimmed.length >= 180)
  )
}

export function detectTargetJobDescription(message: string): TargetJobDetection | undefined {
  const trimmed = message.trim()
  if (trimmed.length < 140) {
    return undefined
  }

  if (trimmed.includes('[Link da vaga:') || trimmed.includes('[ConteÃºdo extraÃ­do automaticamente]')) {
    return {
      targetJobDescription: trimmed,
      confidence: 'high',
    }
  }

  const normalized = normalizeForJobDescriptionDetection(trimmed)
  const sectionSignals = [
    'responsabilidades',
    'responsibility',
    'responsibilities',
    'requisitos',
    'requirements',
    'resumo dos requisitos',
    'requisitos desejaveis',
    'qualificacoes',
    'qualifications',
    'diferenciais',
    'nice to have',
    'o que procuramos',
    'we are looking for',
    'sobre a vaga',
    'about the role',
    'atribuicoes',
    'atividades',
    'job description',
  ]
  const sectionHits = sectionSignals.filter((signal) => normalized.includes(signal)).length
  const roleHit = /\b(analista|engenheiro|developer|desenvolvedor|cientista|gerente|coordenador|consultor|product|designer|arquiteto|devops|sre|qa|bi|dados|data)\b/.test(normalized)
  const hiringIntentHit = /\b(vaga|cargo|posicao|position|role|opportunity|buscamos|contratando)\b/.test(normalized)
  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const hasStructuredLayout = lines.length >= 5 || /(^|\n)\s*[-*â€¢]/.test(trimmed) || trimmed.includes(':')
  const summarizedRequirementsHit = normalized.includes('resumo dos requisitos') || normalized.includes('requisitos desejaveis')
  const keywordListHit = /(?:sql|python|r|looker|bigquery|google analytics|google tag manager|appsflyer|github|machine learning|etl|power bi|tableau|dbt|airflow|google sheets|sql server).*(?:,|\n).*(?:sql|python|r|looker|bigquery|google analytics|google tag manager|appsflyer|github|machine learning|etl|power bi|tableau|dbt|airflow|google sheets|sql server).*(?:,|\n).*(?:sql|python|r|looker|bigquery|google analytics|google tag manager|appsflyer|github|machine learning|etl|power bi|tableau|dbt|airflow|google sheets|sql server)/.test(normalized)
  let score = 0

  score += Math.min(sectionHits, 4) * 2
  if (roleHit) score += 2
  if (hiringIntentHit) score += 2
  if (hasStructuredLayout) score += 2
  if (summarizedRequirementsHit) score += 2
  if (keywordListHit) score += 2
  if (trimmed.length >= 260) score += 1

  if (sectionHits >= 2 && hasStructuredLayout) {
    return {
      targetJobDescription: trimmed,
      confidence: sectionHits >= 3 ? 'high' : 'medium',
    }
  }

  if (sectionHits >= 3) {
    return {
      targetJobDescription: trimmed,
      confidence: 'high',
    }
  }

  if (hiringIntentHit && roleHit && trimmed.length >= 220 && hasStructuredLayout) {
    return {
      targetJobDescription: trimmed,
      confidence: score >= 7 ? 'high' : 'medium',
    }
  }

  if (summarizedRequirementsHit && keywordListHit && trimmed.length >= 180) {
    return {
      targetJobDescription: trimmed,
      confidence: score >= 7 ? 'high' : 'medium',
    }
  }

  if (score >= 8) {
    return {
      targetJobDescription: trimmed,
      confidence: 'medium',
    }
  }

  return undefined
}
