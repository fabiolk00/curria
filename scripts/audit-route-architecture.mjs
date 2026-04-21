import fs from 'fs'
import path from 'path'

const rootDir = process.cwd()

const routeDirs = [
  path.join(rootDir, 'src', 'lib', 'routes'),
]

const approvedSignedUrlCallers = new Set([
  normalize('src/lib/agent/tools/generate-file.ts'),
  normalize('src/lib/routes/file-access/response.ts'),
  normalize('src/lib/resume-generation/generate-billable-resume.ts'),
])

const criticalRoutes = [
  {
    route: normalize('src/app/api/session/[id]/generate/route.ts'),
    modules: [
      normalize('src/lib/routes/session-generate/context.ts'),
      normalize('src/lib/routes/session-generate/decision.ts'),
      normalize('src/lib/routes/session-generate/response.ts'),
    ],
  },
  {
    route: normalize('src/app/api/file/[sessionId]/route.ts'),
    modules: [
      normalize('src/lib/routes/file-access/context.ts'),
      normalize('src/lib/routes/file-access/decision.ts'),
      normalize('src/lib/routes/file-access/response.ts'),
    ],
  },
  {
    route: normalize('src/app/api/profile/smart-generation/route.ts'),
    modules: [
      normalize('src/lib/routes/smart-generation/context.ts'),
      normalize('src/lib/routes/smart-generation/decision.ts'),
      normalize('src/lib/routes/smart-generation/response.ts'),
    ],
  },
  {
    route: normalize('src/app/api/session/[id]/compare/route.ts'),
    modules: [
      normalize('src/lib/routes/session-compare/context.ts'),
      normalize('src/lib/routes/session-compare/decision.ts'),
      normalize('src/lib/routes/session-compare/response.ts'),
      normalize('src/lib/routes/session-compare/types.ts'),
    ],
  },
  {
    route: normalize('src/app/api/session/[id]/comparison/route.ts'),
    modules: [
      normalize('src/lib/routes/session-comparison/context.ts'),
      normalize('src/lib/routes/session-comparison/decision.ts'),
      normalize('src/lib/routes/session-comparison/response.ts'),
      normalize('src/lib/routes/session-comparison/types.ts'),
    ],
  },
  {
    route: normalize('src/app/api/session/[id]/versions/route.ts'),
    modules: [
      normalize('src/lib/routes/session-versions/context.ts'),
      normalize('src/lib/routes/session-versions/decision.ts'),
      normalize('src/lib/routes/session-versions/response.ts'),
      normalize('src/lib/routes/session-versions/types.ts'),
    ],
  },
]

const violations = []

walk(path.join(rootDir, 'src'))
checkCriticalRoutes()

if (violations.length > 0) {
  console.error('Route architecture audit failed:\n')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log('Route architecture audit passed.')

function normalize(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'))
}

function walk(currentPath) {
  const stat = fs.statSync(currentPath)
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(currentPath)) {
      walk(path.join(currentPath, entry))
    }
    return
  }

  if (!/\.(ts|tsx|mts|cts)$/.test(currentPath)) {
    return
  }

  const content = fs.readFileSync(currentPath, 'utf8')
  const repoRelativePath = path.relative(rootDir, currentPath).replace(/\\/g, '/')

  if (repoRelativePath.includes('.test.')) {
    return
  }

  if (/createSignedResumeArtifactUrls(?:BestEffort)?\s*\(/.test(content) && !approvedSignedUrlCallers.has(currentPath)) {
    violations.push(`${repoRelativePath}: signed URL helper called outside approved chokepoints`)
  }

  if (
    repoRelativePath.startsWith('src/lib/routes/')
    && repoRelativePath.endsWith('/response.ts')
    && /(previewAccess|isLockedPreview|getPreviewLockSummary|buildLockedPreviewPdfUrl|canViewRealPreview)/.test(content)
  ) {
    violations.push(`${repoRelativePath}: response layer appears to interpret preview-lock semantics directly`)
  }

  if (
    repoRelativePath.startsWith('src/lib/routes/')
    && /(\/context\.ts|\/decision\.ts|\/policy\.ts)$/.test(repoRelativePath)
    && /NextResponse\.json\s*\(/.test(content)
  ) {
    violations.push(`${repoRelativePath}: non-response route layer should not construct NextResponse directly`)
  }

  if (
    repoRelativePath.startsWith('src/app/api/')
    && repoRelativePath.endsWith('/route.ts')
    && /createSignedResumeArtifactUrls(?:BestEffort)?/.test(content)
  ) {
    violations.push(`${repoRelativePath}: critical route imports low-level signing helper directly`)
  }
}

function checkCriticalRoutes() {
  for (const route of criticalRoutes) {
    for (const modulePath of route.modules) {
      if (!fs.existsSync(modulePath)) {
        violations.push(`${path.relative(rootDir, route.route).replace(/\\/g, '/')}: missing required module ${path.relative(rootDir, modulePath).replace(/\\/g, '/')}`)
      }
    }
  }
}
