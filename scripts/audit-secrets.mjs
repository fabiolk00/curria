#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ALLOWED_TRACKED_ENV_FILES = new Set([
  '.env.example',
  '.env.staging.example',
])

export const SECRET_ASSIGNMENT_NAMES = new Set([
  'ANTHROPIC_API_KEY',
  'ASAAS_ACCESS_TOKEN',
  'ASAAS_WEBHOOK_TOKEN',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'CRON_SECRET',
  'DATABASE_URL',
  'DIRECT_URL',
  'E2E_AUTH_BYPASS_SECRET',
  'LINKDAPI_API_KEY',
  'OPENAI_API_KEY',
  'STAGING_ASAAS_ACCESS_TOKEN',
  'STAGING_ASAAS_WEBHOOK_TOKEN',
  'STAGING_DB_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
])

const EXACT_PLACEHOLDER_VALUES = new Set([
  'curria-e2e-secret',
  'dummy',
  'pk_test_dummy',
  'sk-test-dummy',
  'sk_test_dummy',
  'whsec_dummy',
])

const PLACEHOLDER_SUBSTRINGS = [
  'replace_me',
  'replace-me',
  'example.com',
  'example.org',
  'example.net',
  'localhost',
  '127.0.0.1',
  'your-project.supabase.co',
  'project.supabase.co',
  'dummy.upstash.io',
]

const GENERIC_SECRET_PATTERNS = [
  {
    label: 'OpenAI-style API key',
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    label: 'GitHub token',
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  },
  {
    label: 'AWS access key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    label: 'Google API key',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    label: 'Slack token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    label: 'Webhook signing secret',
    regex: /\bwhsec_[A-Za-z0-9]{20,}\b/g,
  },
]

const PRIVATE_KEY_PATTERN = /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/
const TEXT_ENCODINGS = ['utf8', 'utf-8']

function getTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
  })

  return output.split('\0').filter(Boolean)
}

function readTextFile(path) {
  for (const encoding of TEXT_ENCODINGS) {
    try {
      return readFileSync(path, encoding)
    } catch {
      // Try the next encoding or fall through.
    }
  }

  return null
}

function isBinaryContent(content) {
  return content.includes('\0')
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length
}

function normalizeAssignedValue(rawValue) {
  return rawValue.trim().replace(/^[`'"]|[`'"]$/g, '')
}

export function looksPlaceholder(value) {
  if (!value) {
    return true
  }

  const normalized = value.trim().toLowerCase()

  if (EXACT_PLACEHOLDER_VALUES.has(normalized)) {
    return true
  }

  return PLACEHOLDER_SUBSTRINGS.some((token) => normalized.includes(token))
}

export function isTrackedEnvFilePath(filePath) {
  return /(^|\/)\.env(?:\.|$)/.test(filePath)
}

export function extractAssignedCandidates(rawValue) {
  const expression = rawValue
    .trim()
    .replace(/\s+#.*$/, '')
    .replace(/[;,]\s*$/, '')

  if (!expression) {
    return []
  }

  const quotedValues = [...expression.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)]
    .map((match) => match[2].trim())
    .filter(Boolean)

  if (quotedValues.length > 0) {
    return quotedValues
  }

  if (expression.includes('process.env')) {
    return []
  }

  const normalized = normalizeAssignedValue(expression)
  return normalized ? [normalized] : []
}

export function findSecretAssignments(path, content) {
  const findings = []
  const lines = content.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^[`'"]?([A-Z0-9_]+)[`'"]?\s*[:=]\s*(.+)$/)
    if (!match) {
      continue
    }

    const [, name, rawValue] = match
    if (!SECRET_ASSIGNMENT_NAMES.has(name)) {
      continue
    }

    const candidates = extractAssignedCandidates(rawValue)
    const suspiciousValue = candidates.find((value) => !looksPlaceholder(value))

    if (!suspiciousValue) {
      continue
    }

    findings.push({
      path,
      line: index + 1,
      reason: `Suspicious committed value for ${name}`,
    })
  }

  return findings
}

function findGenericSecrets(path, content) {
  const findings = []

  for (const { label, regex } of GENERIC_SECRET_PATTERNS) {
    regex.lastIndex = 0

    let match
    while ((match = regex.exec(content)) !== null) {
      if (looksPlaceholder(match[0])) {
        continue
      }

      findings.push({
        path,
        line: getLineNumber(content, match.index),
        reason: `${label} pattern detected`,
      })
    }
  }

  return findings
}

function main() {
  const trackedFiles = getTrackedFiles()
  const findings = []

  for (const filePath of trackedFiles) {
    if (isTrackedEnvFilePath(filePath) && !ALLOWED_TRACKED_ENV_FILES.has(filePath)) {
      findings.push({
        path: filePath,
        line: 1,
        reason: 'Tracked env file is not allowed',
      })
      continue
    }

    if (filePath.endsWith('.pem')) {
      findings.push({
        path: filePath,
        line: 1,
        reason: 'Tracked PEM file detected',
      })
      continue
    }

    const content = readTextFile(filePath)
    if (content === null || isBinaryContent(content)) {
      continue
    }

    if (PRIVATE_KEY_PATTERN.test(content)) {
      findings.push({
        path: filePath,
        line: getLineNumber(content, content.indexOf('-----BEGIN')),
        reason: 'Private key material detected',
      })
    }

    findings.push(...findSecretAssignments(filePath, content))
    findings.push(...findGenericSecrets(filePath, content))
  }

  if (findings.length > 0) {
    console.error('Secret audit failed. Remove or replace the following committed secrets or sensitive files:')

    for (const finding of findings) {
      console.error(`- ${finding.path}:${finding.line} - ${finding.reason}`)
    }

    process.exit(1)
  }

  console.log(`Secret audit passed for ${trackedFiles.length} tracked files.`)
}

export function isDirectExecution(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  if (!argv1) {
    return false
  }

  return fileURLToPath(metaUrl) === path.resolve(argv1)
}

if (isDirectExecution()) {
  main()
}
