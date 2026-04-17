import { execSync } from 'node:child_process'

const budgetMs = Number(process.env.RESUME_BUILDER_RUNTIME_BUDGET_MS ?? '5000')
const command = process.platform === 'win32'
  ? 'npm run test:profile:resume-builder'
  : 'npm run test:profile:resume-builder'

let stdout = ''

try {
  stdout = execSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  process.stdout.write(stdout)
} catch (error) {
  if (typeof error?.stdout === 'string') {
    process.stdout.write(error.stdout)
  }

  if (typeof error?.stderr === 'string') {
    process.stderr.write(error.stderr)
  }

  process.exit(typeof error?.status === 'number' ? error.status : 1)
}

const plainStdout = stdout.replace(/\u001b\[[0-9;]*m/g, '')

function parseTimingMs(label) {
  const match = plainStdout.match(new RegExp(`${label}\\s+([0-9.]+)(ms|s)`))
  if (!match) {
    return null
  }

  const value = Number(match[1])
  if (Number.isNaN(value)) {
    return null
  }

  return match[2] === 's'
    ? Math.round(value * 1000)
    : Math.round(value)
}

const testsMs = parseTimingMs('tests')
const collectMs = parseTimingMs('collect')
const environmentMs = parseTimingMs('environment')

const durationMs = testsMs !== null && collectMs !== null && environmentMs !== null
  ? testsMs + collectMs + environmentMs
  : parseTimingMs('Duration')

if (durationMs === null || Number.isNaN(durationMs)) {
  console.error('Parsed runtime was not a valid number.')
  process.exit(1)
}

if (durationMs > budgetMs) {
  console.error(`Resume-builder runtime budget exceeded: ${durationMs}ms > ${budgetMs}ms.`)
  process.exit(1)
}

console.log(`Resume-builder runtime budget passed: ${durationMs}ms <= ${budgetMs}ms.`)
