import { spawnSync } from 'child_process'

const files = [
  'src/app/api/session/[id]/generate/route.test.ts',
  'src/app/api/file/[sessionId]/route.test.ts',
  'src/app/api/profile/smart-generation/route.test.ts',
  'src/app/api/session/[id]/versions/route.test.ts',
  'src/app/api/session/[id]/compare/route.test.ts',
  'src/app/api/session/[id]/comparison/route.test.ts',
  'src/app/api/preview-lock-transverse.test.ts',
  'src/lib/resume-generation/generate-billable-resume.test.ts',
  'src/lib/routes/session-comparison/decision.test.ts',
  'src/lib/routes/session-comparison/response.test.ts',
]

const command = `npx vitest run ${files.map((file) => `"${file}"`).join(' ')}`
const result = spawnSync(command, {
  stdio: 'inherit',
  shell: true,
})

if (result.error) {
  console.error(result.error)
}

process.exit(typeof result.status === 'number' ? result.status : 1)
