import type { ATSScoreResult, ATSIssue } from '@/types/cv'

const SECTION_HEADINGS = {
  experience: ['experience', 'work experience', 'professional experience', 'career history', 'employment'],
  education:  ['education', 'academic background', 'qualifications', 'academic history'],
  skills:     ['skills', 'technical skills', 'competencies', 'technologies', 'core skills'],
  summary:    ['summary', 'profile', 'objective', 'about me', 'professional summary'],
}

const METRIC_PATTERN  = /\d+(%|x|×|\s*(million|billion|k\b))?|\$|R\$|doubled|tripled|halved/gi
const ACTION_VERBS    = ['led','built','reduced','increased','designed','launched','managed','delivered',
                         'created','improved','developed','architected','implemented','drove','scaled']

export function scoreATS(resumeText: string, jobDescription?: string): ATSScoreResult {
  const text  = resumeText.toLowerCase()
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean)
  const issues: ATSIssue[] = []

  // ── Format (20 pts) ──────────────────────────────────────────────────
  let format = 20

  const tabCount = (resumeText.match(/\t/g) ?? []).length
  if (tabCount > 10) {
    format -= 10
    issues.push({ severity: 'critical', section: 'format',
      message: 'Tab characters detected — likely a table or multi-column layout. ATS parsers may misread this.' })
  }

  const pipeCount = (resumeText.match(/\|/g) ?? []).length
  if (pipeCount > 5) {
    format -= 8
    issues.push({ severity: 'critical', section: 'format',
      message: 'Pipe characters suggest a table layout. Use plain text bullet points instead.' })
  }

  if (resumeText.length < 300) {
    format -= 10
    issues.push({ severity: 'critical', section: 'format',
      message: 'Very little text was extracted. The file may contain images or scanned content — use OCR.' })
  }

  format = Math.max(0, format)

  // ── Structure (20 pts) ───────────────────────────────────────────────
  let structure = 0
  const foundSections: string[] = []

  for (const [key, variants] of Object.entries(SECTION_HEADINGS)) {
    if (variants.some(v => text.includes(v))) {
      foundSections.push(key)
      structure += 5
    } else {
      issues.push({ severity: key === 'experience' ? 'critical' : 'warning',
        section: 'structure',
        message: `No "${key}" section detected. Add a clearly labeled heading.` })
    }
  }

  // ── Contact info (10 pts) ────────────────────────────────────────────
  let contact = 0
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)
  const phoneMatch = resumeText.match(/(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/)

  if (emailMatch) contact += 5
  else issues.push({ severity: 'warning', section: 'contact', message: 'Nenhum e-mail encontrado em texto simples.' })

  if (phoneMatch) contact += 3
  else issues.push({ severity: 'warning', section: 'contact', message: 'Nenhum telefone encontrado em texto simples.' })

  if (text.includes('linkedin')) contact += 2

  // ── Keyword density (30 pts) ─────────────────────────────────────────
  let keywords = 0
  if (jobDescription) {
    const jdWords  = extractKeywords(jobDescription)
    const matched  = jdWords.filter(kw => text.includes(kw.toLowerCase()))
    const rate     = jdWords.length > 0 ? matched.length / jdWords.length : 0
    keywords       = Math.round(rate * 30)

    if (rate < 0.4) {
      issues.push({ severity: 'warning', section: 'keywords',
        message: `Only ${Math.round(rate * 100)}% keyword match with the job description. Aim for 60%+.` })
    }
  } else {
    const actionVerbsFound = ACTION_VERBS.filter(v => text.includes(v))
    keywords = Math.min(30, actionVerbsFound.length * 4)

    if (actionVerbsFound.length < 4) {
      issues.push({ severity: 'warning', section: 'keywords',
        message: 'Few strong action verbs found. Use verbs like Led, Built, Increased, Reduced.' })
    }
  }

  // ── Quantified impact (20 pts) ───────────────────────────────────────
  let impact = 0
  const bulletLines = lines.filter(l => l.startsWith('-') || l.startsWith('•') || l.startsWith('*') || /^\d+\./.test(l))
  const bulletsWithMetrics = bulletLines.filter(l => METRIC_PATTERN.test(l))

  if (bulletLines.length > 0) {
    const rate = bulletsWithMetrics.length / bulletLines.length
    impact     = Math.round(rate * 20)

    if (rate < 0.3) {
      issues.push({ severity: 'warning', section: 'experience',
        message: `Only ${bulletsWithMetrics.length} of ${bulletLines.length} bullet points have metrics. Add numbers to show impact.` })
    }
  } else {
    issues.push({ severity: 'warning', section: 'experience',
      message: 'No bullet points detected in experience section. Use bullet points for ATS readability.' })
  }

  const total = format + structure + contact + keywords + impact

  const suggestions = buildTopSuggestions(issues)

  return {
    total: Math.min(100, total),
    breakdown: { format, structure, keywords, contact, impact },
    issues: issues.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity)),
    suggestions,
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the','and','or','in','at','to','a','an','of','for','with','on','is','are','be','by'])
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 40)
}

function severityOrder(s: ATSIssue['severity']): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : 2
}

function buildTopSuggestions(issues: ATSIssue[]): string[] {
  return issues
    .filter(i => i.severity !== 'info')
    .slice(0, 3)
    .map(i => i.message)
}
