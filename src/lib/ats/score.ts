import type { ATSIssue, ATSScoreResult } from '@/types/cv'

const SECTION_HEADINGS = {
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'career history',
    'employment',
    'experiência',
    'experiências',
    'experiência profissional',
    'experiências profissionais',
  ],
  education: [
    'education',
    'academic background',
    'qualifications',
    'academic history',
    'educação',
    'formação',
  ],
  skills: [
    'skills',
    'technical skills',
    'competencies',
    'technologies',
    'core skills',
    'habilidades',
    'competencias',
    'ferramentas',
    'tecnologias',
  ],
  summary: [
    'summary',
    'profile',
    'objective',
    'about me',
    'professional summary',
    'resumo',
    'resumo profissional',
    'perfil profissional',
    'objetivo',
  ],
} as const

const METRIC_PATTERN = /\d+(%|x|×|\s*(million|billion|k\b))?|\$|R\$|doubled|tripled|halved/i
const ACTION_VERBS = [
  'led',
  'built',
  'reduced',
  'increased',
  'designed',
  'launched',
  'managed',
  'delivered',
  'created',
  'improved',
  'developed',
  'architected',
  'implemented',
  'drove',
  'scaled',
  'liderei',
  'construi',
  'reduzi',
  'aumentei',
  'projetei',
  'lancei',
  'gerenciei',
  'entreguei',
  'criei',
  'melhorei',
  'desenvolvi',
  'implementei',
  'otimizei',
  'automatizei',
  'estruturei',
  'coordenei',
  'atuei',
  'apoiei',
] as const

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function scoreATS(resumeText: string, jobDescription?: string): ATSScoreResult {
  const text = normalizeForComparison(resumeText)
  const lines = resumeText.split('\n').map((line) => line.trim()).filter(Boolean)
  const issues: ATSIssue[] = []

  let format = 20

  const tabCount = (resumeText.match(/\t/g) ?? []).length
  if (tabCount > 10) {
    format -= 10
    issues.push({
      severity: 'critical',
      section: 'format',
      message: 'Caracteres de tabulacao sugerem tabela ou layout em colunas. Isso pode atrapalhar o parsing ATS.',
    })
  }

  const pipeCount = (resumeText.match(/\|/g) ?? []).length
  if (pipeCount > 5) {
    format -= 8
    issues.push({
      severity: 'critical',
      section: 'format',
      message: 'Muitos pipes sugerem layout em tabela. Prefira bullets simples em texto corrido.',
    })
  }

  if (resumeText.length < 300) {
    format -= 10
    issues.push({
      severity: 'critical',
      section: 'format',
      message: 'Pouco texto foi extraido. O arquivo pode ter imagens ou conteudo escaneado; use OCR.',
    })
  }

  format = Math.max(0, format)

  let structure = 0

  for (const [key, variants] of Object.entries(SECTION_HEADINGS)) {
    if (variants.some((variant) => text.includes(normalizeForComparison(variant)))) {
      structure += 5
      continue
    }

    issues.push({
      severity: key === 'experience' ? 'critical' : 'warning',
      section: 'structure',
      message: `A seção "${key}" não foi detectada com clareza. Adicione um título explícito.`,
    })
  }

  let contact = 0
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)
  const phoneMatch = resumeText.match(/(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/)

  if (emailMatch) {
    contact += 5
  } else {
    issues.push({ severity: 'warning', section: 'contact', message: 'Nenhum e-mail encontrado em texto simples.' })
  }

  if (phoneMatch) {
    contact += 3
  } else {
    issues.push({ severity: 'warning', section: 'contact', message: 'Nenhum telefone encontrado em texto simples.' })
  }

  if (text.includes('linkedin')) {
    contact += 2
  }

  let keywords = 0
  if (jobDescription) {
    const jobDescriptionKeywords = extractKeywords(jobDescription)
    const matchedKeywords = jobDescriptionKeywords.filter((keyword) =>
      text.includes(normalizeForComparison(keyword)))
    const matchRate = jobDescriptionKeywords.length > 0
      ? matchedKeywords.length / jobDescriptionKeywords.length
      : 0
    keywords = Math.round(matchRate * 30)

    if (matchRate < 0.4) {
      issues.push({
        severity: 'warning',
        section: 'keywords',
        message: `Aderencia de keywords em ${Math.round(matchRate * 100)}% em relacao a vaga. Tente chegar a 60% ou mais.`,
      })
    }
  } else {
    const actionVerbsFound = ACTION_VERBS.filter((verb) => text.includes(normalizeForComparison(verb)))
    keywords = Math.min(30, actionVerbsFound.length * 4)

    if (actionVerbsFound.length < 4) {
      issues.push({
        severity: 'warning',
        section: 'keywords',
        message: 'Poucos verbos de acao fortes foram encontrados. Use verbos como desenvolvi, otimizei, liderei e implementei.',
      })
    }
  }

  let impact = 0
  const bulletLines = lines.filter((line) =>
    line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line))
  const bulletsWithMetrics = bulletLines.filter((line) => METRIC_PATTERN.test(line))

  if (bulletLines.length > 0) {
    const metricRate = bulletsWithMetrics.length / bulletLines.length
    impact = Math.round(metricRate * 20)

    if (metricRate < 0.3) {
      issues.push({
        severity: 'warning',
        section: 'experience',
        message: `Apenas ${bulletsWithMetrics.length} de ${bulletLines.length} bullets trazem numeros ou metricas. Adicione impacto quantificavel.`,
      })
    }
  } else {
    issues.push({
      severity: 'warning',
      section: 'experience',
      message: 'Nenhum bullet foi detectado na experiência. Use bullets para melhorar a leitura no ATS.',
    })
  }

  const total = format + structure + contact + keywords + impact

  return {
    total: Math.min(100, total),
    breakdown: { format, structure, keywords, contact, impact },
    issues: issues.sort((left, right) => severityOrder(left.severity) - severityOrder(right.severity)),
    suggestions: buildTopSuggestions(issues),
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'or', 'in', 'at', 'to', 'a', 'an', 'of', 'for', 'with', 'on', 'is', 'are', 'be', 'by',
    'para', 'com', 'sem', 'uma', 'um', 'das', 'dos', 'que', 'por', 'como', 'mais', 'menos', 'sobre',
    'nos', 'nas', 'ao', 'aos', 'de', 'da', 'do', 'em', 'na', 'no', 'e', 'ou',
  ])

  return normalizeForComparison(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .filter((word, index, allWords) => allWords.indexOf(word) === index)
    .slice(0, 40)
}

function severityOrder(severity: ATSIssue['severity']): number {
  return severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2
}

function buildTopSuggestions(issues: ATSIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity !== 'info')
    .slice(0, 3)
    .map((issue) => issue.message)
}
