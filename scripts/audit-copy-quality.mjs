import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TARGET_DIRS = ['src']
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx'])

const mojibakePatterns = [
  /Ãƒ[^\p{L}\s]/gu,
  /Ã‚[^\p{L}\s]/gu,
  /ï¿½/g,
]

const suspiciousAsciiTerms = [
  ['Nao', 'Não'],
  ['nao', 'não'],
  ['curriculo', 'currículo'],
  ['versao', 'versão'],
  ['descricao', 'descrição'],
  ['experiencia', 'experiência'],
  ['experiencias', 'experiências'],
  ['educacao', 'educação'],
  ['formacao', 'formação'],
  ['instituicao', 'instituição'],
  ['secao', 'seção'],
  ['secoes', 'seções'],
  ['publico', 'público'],
  ['informacoes', 'informações'],
  ['credito', 'crédito'],
  ['creditos', 'créditos'],
  ['possivel', 'possível'],
  ['voce', 'você'],
  ['ate', 'até'],
  ['concluida', 'concluída'],
  ['automatica', 'automática'],
  ['selecionavel', 'selecionável'],
]

function walk(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir)
  const entries = readdirSync(absoluteDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name)
    const absolutePath = path.join(ROOT, relativePath)

    if (entry.isDirectory()) {
      files.push(...walk(relativePath))
      continue
    }

    if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      continue
    }

    if (statSync(absolutePath).isFile()) {
      files.push(relativePath)
    }
  }

  return files
}

function getLineNumber(text, index) {
  return text.slice(0, index).split('\n').length
}

function collectMojibakeIssues(filePath, text) {
  const issues = []

  for (const pattern of mojibakePatterns) {
    for (const match of text.matchAll(pattern)) {
      issues.push({
        filePath,
        line: getLineNumber(text, match.index ?? 0),
        type: 'mojibake',
        excerpt: text.split('\n')[getLineNumber(text, match.index ?? 0) - 1]?.trim() ?? '',
      })
    }
  }

  return issues
}

function collectAsciiCopyIssues(filePath, text) {
  const issues = []
  const lines = text.split('\n')

  lines.forEach((line, index) => {
    if (!/['"`]/.test(line)) {
      return
    }

    const trimmedLine = line.trim()
    const isTechnicalMatchingLine = (
      trimmedLine.includes('.includes(')
      || trimmedLine.includes('.match(')
      || trimmedLine.includes('.test(')
      || trimmedLine.startsWith('return /')
      || trimmedLine.startsWith('const rolePattern = /')
      || trimmedLine.startsWith('const pattern = new RegExp(')
      || trimmedLine.includes('stopWords = new Set([')
      || trimmedLine.includes("'experience', 'experiencia'")
      || (trimmedLine.includes("'experience'") && trimmedLine.includes("'experiencia'"))
      // SEO route slugs and canonicals must stay ASCII-safe in URLs.
      || trimmedLine.includes('/curriculo-')
      || trimmedLine.startsWith('slug:')
      || trimmedLine.startsWith('slug=')
      || trimmedLine.startsWith('canonical:')
      || trimmedLine.includes('buildRoleLandingMetadata("curriculo-')
      || trimmedLine.includes("buildRoleLandingMetadata('curriculo-")
      || trimmedLine.startsWith('"curriculo-')
      || trimmedLine.startsWith("'curriculo-")
    )

    if (isTechnicalMatchingLine) {
      return
    }

    for (const [term, suggestion] of suspiciousAsciiTerms) {
      const pattern = new RegExp(`\\b${term}\\b`)
      if (!pattern.test(line)) {
        continue
      }

      issues.push({
        filePath,
        line: index + 1,
        type: 'ptbr-copy',
        term,
        suggestion,
        excerpt: line.trim(),
      })
    }
  })

  return issues
}

function issueKey(issue) {
  if (issue.type === 'mojibake') {
    return `${issue.filePath}:${issue.line}:mojibake`
  }

  return `${issue.filePath}:${issue.line}:${issue.term}`
}

const args = new Set(process.argv.slice(2))
const reportPathArgIndex = process.argv.indexOf('--write-report')
const reportPath = reportPathArgIndex >= 0 ? process.argv[reportPathArgIndex + 1] : null
const baselinePathArgIndex = process.argv.indexOf('--baseline')
const baselinePath = baselinePathArgIndex >= 0 ? process.argv[baselinePathArgIndex + 1] : null
const writeBaselineArgIndex = process.argv.indexOf('--write-baseline')
const writeBaselinePath = writeBaselineArgIndex >= 0 ? process.argv[writeBaselineArgIndex + 1] : null
const failOnCopy = args.has('--fail-on-copy')

const sourceFiles = TARGET_DIRS.flatMap((dir) => walk(dir))
const mojibakeIssues = []
const copyIssues = []

for (const filePath of sourceFiles) {
  const text = readFileSync(path.join(ROOT, filePath), 'utf8')
  mojibakeIssues.push(...collectMojibakeIssues(filePath, text))
  copyIssues.push(...collectAsciiCopyIssues(filePath, text))
}

const currentBaselineSnapshot = {
  filesScanned: sourceFiles.length,
  mojibakeIssueKeys: mojibakeIssues.map(issueKey).sort(),
  copyIssueKeys: copyIssues.map(issueKey).sort(),
}

if (reportPath) {
  const lines = [
    '# PT-BR Copy Audit',
    '',
    `- Files scanned: ${sourceFiles.length}`,
    `- Mojibake issues: ${mojibakeIssues.length}`,
    `- PT-BR copy review issues: ${copyIssues.length}`,
    '',
    '## Mojibake',
  ]

  if (mojibakeIssues.length === 0) {
    lines.push('', 'Nenhum mojibake encontrado.')
  } else {
    for (const issue of mojibakeIssues) {
      lines.push('', `- ${issue.filePath}:${issue.line} - ${issue.excerpt}`)
    }
  }

  lines.push('', '## PT-BR Copy Review')

  if (copyIssues.length === 0) {
    lines.push('', 'Nenhuma string suspeita encontrada.')
  } else {
    for (const issue of copyIssues) {
      lines.push('', `- ${issue.filePath}:${issue.line} - \`${issue.term}\` -> \`${issue.suggestion}\``, `  ${issue.excerpt}`)
    }
  }

  writeFileSync(path.join(ROOT, reportPath), `${lines.join('\n')}\n`, 'utf8')
}

if (writeBaselinePath) {
  writeFileSync(
    path.join(ROOT, writeBaselinePath),
    `${JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      ...currentBaselineSnapshot,
    }, null, 2)}\n`,
    'utf8',
  )
}

let newMojibakeIssues = []
let newCopyIssues = []

if (baselinePath) {
  const baseline = JSON.parse(readFileSync(path.join(ROOT, baselinePath), 'utf8'))
  const knownMojibakeIssueKeys = new Set(baseline.mojibakeIssueKeys ?? [])
  const knownCopyIssueKeys = new Set(baseline.copyIssueKeys ?? [])

  newMojibakeIssues = mojibakeIssues.filter((issue) => !knownMojibakeIssueKeys.has(issueKey(issue)))
  newCopyIssues = copyIssues.filter((issue) => !knownCopyIssueKeys.has(issueKey(issue)))
}

if (mojibakeIssues.length > 0) {
  console.error(`Copy encoding audit failed: found ${mojibakeIssues.length} mojibake issue(s).`)
  process.exit(1)
}

if (baselinePath && newMojibakeIssues.length > 0) {
  console.error(`Copy encoding audit failed: found ${newMojibakeIssues.length} new mojibake issue(s) beyond baseline.`)
  process.exit(1)
}

if (baselinePath && newCopyIssues.length > 0) {
  console.error(`PT-BR copy audit failed: found ${newCopyIssues.length} new review issue(s) beyond baseline.`)
  process.exit(1)
}

if (failOnCopy && copyIssues.length > 0) {
  console.error(`PT-BR copy audit failed: found ${copyIssues.length} review issue(s).`)
  process.exit(1)
}

const baselineSummary = baselinePath
  ? ` New vs baseline: mojibake ${newMojibakeIssues.length}, copy ${newCopyIssues.length}.`
  : ''

console.log(
  `Copy encoding audit passed. Mojibake: ${mojibakeIssues.length}. PT-BR review issues: ${copyIssues.length}.${baselineSummary}`,
)
