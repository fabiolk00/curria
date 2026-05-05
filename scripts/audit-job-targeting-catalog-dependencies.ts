import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, normalize, relative, resolve } from 'node:path'

const repoRoot = process.cwd()
const forbiddenFragments = [
  'src/lib/agent/job-targeting/catalog/catalog-loader',
  'src/lib/agent/job-targeting/catalog/domain-packs',
  'src/lib/agent/job-targeting/catalog/generic-taxonomy.json',
  'data-bi.json',
  'generic-taxonomy.json',
  'business-admin.json',
  'finance.json',
  'hr.json',
  'marketing.json',
  'operations.json',
  'sales.json',
  'software-engineering.json',
  'catalog-loader',
  'domain-packs',
  'taxonomy',
]

const entrypoints = [
  'src/lib/agent/job-targeting/compatibility/assessment.ts',
  'src/lib/agent/job-targeting/compatibility/llm-matcher.ts',
  'src/lib/agent/job-targeting-pipeline.ts',
  'src/lib/agent/tools/build-targeting-plan.ts',
  'src/lib/agent/job-targeting/rewrite-target-plan.ts',
  'src/lib/agent/job-targeting/validation-policy.ts',
  'src/lib/agent/job-targeting/safe-targeting-emphasis.ts',
]

const uiOnlyBoundaries: string[] = [
  // No UI-only catalog boundary exists in this repository as of 2026-05-04.
  // If one is introduced, document its concrete path here and add an entrypoint
  // comment in that module stating: "UI-only catalog boundary; not for matching."
]

function toRepoPath(filePath: string): string {
  return normalize(relative(repoRoot, filePath)).replace(/\\/g, '/')
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(fullPath)
    }

    return ['.ts', '.tsx', '.json'].includes(extname(entry.name)) ? [fullPath] : []
  })
}

const allFiles = new Set(walk(join(repoRoot, 'src')).map((file) => resolve(file)))

function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return resolveCandidate(join(repoRoot, 'src', specifier.slice(2)))
  }

  if (specifier.startsWith('.')) {
    return resolveCandidate(join(dirname(fromFile), specifier))
  }

  return null
}

function resolveCandidate(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.json`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
  ].map((candidate) => resolve(candidate))

  return candidates.find((candidate) => allFiles.has(candidate) || existsSync(candidate)) ?? null
}

function readDependencies(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8')
  const imports = [
    ...source.matchAll(/import\s+(?:type\s+)?[^'"]*['"]([^'"]+)['"]/g),
    ...source.matchAll(/export\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/import\(['"]([^'"]+)['"]\)/g),
  ].map((match) => match[1])

  return imports
    .map((specifier) => resolveImport(filePath, specifier))
    .filter((item): item is string => Boolean(item))
}

function isForbidden(filePath: string): boolean {
  const repoPath = toRepoPath(filePath)
  const uiOnly = uiOnlyBoundaries.some((boundary) => repoPath.startsWith(boundary))

  return !uiOnly && forbiddenFragments.some((fragment) => repoPath.includes(fragment))
}

function findForbiddenDependencies(entrypoint: string) {
  const root = resolve(repoRoot, entrypoint)
  const stack = [{ file: root, path: [root] }]
  const visited = new Set<string>()
  const findings: Array<{ entrypoint: string; dependencyPath: string[] }> = []

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current.file)) {
      continue
    }

    visited.add(current.file)

    if (isForbidden(current.file)) {
      findings.push({
        entrypoint,
        dependencyPath: current.path.map(toRepoPath),
      })
      continue
    }

    for (const dependency of readDependencies(current.file)) {
      stack.push({
        file: dependency,
        path: [...current.path, dependency],
      })
    }
  }

  return findings
}

const findings = entrypoints.flatMap(findForbiddenDependencies)

if (findings.length > 0) {
  console.error('Job-targeting catalog dependency audit failed.')
  console.error(JSON.stringify({
    uiOnlyBoundaries,
    findings,
  }, null, 2))
  process.exit(1)
}

console.log('Job-targeting catalog dependency audit passed.')
