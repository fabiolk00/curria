import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const baseURL = 'http://127.0.0.1:3000'
const command = process.execPath
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
const args = [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', '3000']
const rawEnv = {
  ...process.env,
  ASAAS_ACCESS_TOKEN: process.env.ASAAS_ACCESS_TOKEN ?? 'dummy',
  ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN ?? 'dummy',
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? 'sk_test_dummy',
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET ?? 'whsec_dummy',
  E2E_AUTH_BYPASS_SECRET: process.env.E2E_AUTH_BYPASS_SECRET ?? 'curria-e2e-secret',
  E2E_AUTH_ALLOW_LOCAL_DEV: process.env.E2E_AUTH_ALLOW_LOCAL_DEV ?? 'true',
  E2E_AUTH_ENABLED: 'true',
  E2E_SKIP_OPTIONAL_BILLING_INFO: process.env.E2E_SKIP_OPTIONAL_BILLING_INFO ?? 'true',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? baseURL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'pk_test_Y2xlcmsuY3VycmlhLmNvbS5iciQ',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:65535',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'sk-test-dummy',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dummy',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? 'dummy',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? 'https://dummy.upstash.io',
}
const env = Object.fromEntries(
  Object.entries(rawEnv)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)]),
)

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
})

const shutdown = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
