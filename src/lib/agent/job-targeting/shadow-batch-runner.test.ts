import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadShadowCases } from '@/lib/agent/job-targeting/shadow-batch-runner'
import type { JobTargetingShadowCase } from '@/lib/agent/job-targeting/shadow-case-types'

describe('shadow batch case loading', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'curria-shadow-loader-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  async function writeCase(testCase: JobTargetingShadowCase): Promise<string> {
    const input = path.join(tempDir, 'case.jsonl')
    await writeFile(input, `${JSON.stringify(testCase)}\n`, 'utf8')
    return input
  }

  it('loads optional provided gap analysis from shadow cases', async () => {
    const input = await writeCase({
      id: 'provided-gap',
      source: 'synthetic',
      cvState: {
        fullName: 'Pessoa Teste',
        email: 'teste@example.com',
        phone: '+55 11 99999-0000',
        summary: 'Analista com experiencia em dados.',
        experience: [],
        skills: ['SQL'],
        education: [],
        certifications: [],
      },
      targetJobDescription: 'Requisitos: SQL',
      gapAnalysis: {
        matchScore: 92,
        missingSkills: [],
        weakAreas: [],
        improvementSuggestions: [],
      },
      metadata: {
        anonymized: true,
      },
    })

    const [loaded] = await loadShadowCases(input)

    expect(loaded?.gapAnalysis?.matchScore).toBe(92)
    await expect(readFile(input, 'utf8')).resolves.toContain('"gapAnalysis"')
  })

  it('rejects real anonymized cases without anonymization metadata', async () => {
    const input = await writeCase({
      id: 'bad-real-case',
      source: 'real_anonymized',
      cvState: {
        fullName: 'Pessoa Teste',
        email: 'teste@example.com',
        phone: '+55 11 99999-0000',
        summary: 'Analista com experiencia em dados.',
        experience: [],
        skills: ['SQL'],
        education: [],
        certifications: [],
      },
      targetJobDescription: 'Requisitos: SQL',
    })

    await expect(loadShadowCases(input)).rejects.toThrow(/must be anonymized/u)
  })
})

