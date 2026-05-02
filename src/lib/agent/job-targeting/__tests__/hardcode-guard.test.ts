import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const scanRoots = [
  'src/lib/agent/job-targeting/compatibility',
  'src/lib/agent/job-targeting/domain-equivalents.ts',
  'src/lib/agent/job-targeting/skill-adjacency.ts',
]

const allowedPathPatterns = [
  /[/\\]catalog[/\\].+\.json$/u,
  /[/\\]__fixtures__[/\\]golden-cases[/\\].+\.json$/u,
  /[/\\]__tests__[/\\].+\.test\.ts$/u,
]

const forbiddenRuntimeExamples = [
  { label: 'Power BI', pattern: /Power\s*BI/iu },
  { label: 'Power Query', pattern: /Power\s*Query/iu },
  { label: 'Totvs', pattern: /Totvs/iu },
  { label: 'Java', pattern: /\bJava\b/iu },
  { label: 'Salesforce', pattern: /Salesforce/iu },
  { label: 'SAP', pattern: /\bSAP\b/iu },
  { label: 'Google Ads', pattern: /Google\s*Ads/iu },
  { label: 'Excel', pattern: /\bExcel\b/iu },
  { label: 'Tableau', pattern: /Tableau/iu },
  { label: 'HubSpot', pattern: /HubSpot/iu },
  { label: 'AutoCAD', pattern: /AutoCAD/iu },
  { label: 'CRM', pattern: /\bCRM\b/iu },
  { label: 'ERP', pattern: /\bERP\b/iu },
]

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function isAllowedDataOrTestPath(filePath: string): boolean {
  return allowedPathPatterns.some((pattern) => pattern.test(filePath))
}

function collectFiles(root: string): string[] {
  if (!existsSync(root)) {
    return []
  }

  const stat = statSync(root)
  if (stat.isFile()) {
    return [root]
  }

  return readdirSync(root)
    .flatMap((entry) => collectFiles(join(root, entry)))
}

function lineNumberForIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/u).length
}

describe('job targeting runtime hardcode guard', () => {
  it('keeps fixture-specific catalog terms out of runtime compatibility sources', () => {
    const runtimeFiles = scanRoots
      .flatMap(collectFiles)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !isAllowedDataOrTestPath(filePath))
      .map(normalizePath)
      .sort()

    expect(runtimeFiles).toEqual(expect.arrayContaining([
      'src/lib/agent/job-targeting/compatibility/evidence-extraction.ts',
      'src/lib/agent/job-targeting/compatibility/matcher.ts',
      'src/lib/agent/job-targeting/compatibility/requirement-decomposition.ts',
      'src/lib/agent/job-targeting/compatibility/types.ts',
      'src/lib/agent/job-targeting/domain-equivalents.ts',
      'src/lib/agent/job-targeting/skill-adjacency.ts',
    ]))

    const violations = runtimeFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')

      return forbiddenRuntimeExamples.flatMap(({ label, pattern }) => {
        const match = pattern.exec(source)

        return match?.index === undefined
          ? []
          : [`${filePath}:${lineNumberForIndex(source, match.index)} contains ${label}`]
      })
    })

    expect(violations).toEqual([])
  })
})
