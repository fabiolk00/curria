import fs from 'node:fs'
import path from 'node:path'

type TimestampConvention = 'none' | 'append_only' | 'mutable'
type IdConvention = 'generic' | 'domain'

type TableConvention = {
  id: IdConvention
  timestamps: TimestampConvention
  requiredFunctionInsertColumns?: string[]
}

type AuditFinding = {
  code:
    | 'UNCLASSIFIED_TABLE'
    | 'MISSING_ID_DEFAULT'
    | 'MISSING_CREATED_AT_DEFAULT'
    | 'MISSING_UPDATED_AT_DEFAULT'
    | 'MISSING_EXTRA_DEFAULT'
    | 'FUNCTION_INSERT_MISSING_ID'
    | 'FUNCTION_INSERT_MISSING_CREATED_AT'
    | 'FUNCTION_INSERT_MISSING_UPDATED_AT'
    | 'FUNCTION_INSERT_MISSING_REQUIRED_COLUMN'
  message: string
  table?: string
  file?: string
  functionName?: string
}

type TableState = {
  columns: Set<string>
  defaults: Map<string, string>
}

type FunctionInsert = {
  file: string
  functionName: string
  table: string
  columns: string[]
}

type FunctionDefinition = {
  file: string
  functionName: string
  inserts: FunctionInsert[]
}

const TABLE_CONVENTIONS: Record<string, TableConvention> = {
  users: {
    id: 'domain',
    timestamps: 'mutable',
  },
  user_auth_identities: {
    id: 'generic',
    timestamps: 'mutable',
  },
  credit_accounts: {
    id: 'domain',
    timestamps: 'mutable',
  },
  user_quotas: {
    id: 'generic',
    timestamps: 'mutable',
  },
  sessions: {
    id: 'generic',
    timestamps: 'mutable',
  },
  messages: {
    id: 'generic',
    timestamps: 'append_only',
  },
  api_usage: {
    id: 'generic',
    timestamps: 'append_only',
  },
  processed_events: {
    id: 'generic',
    timestamps: 'append_only',
    requiredFunctionInsertColumns: ['processed_at'],
  },
  billing_checkouts: {
    id: 'generic',
    timestamps: 'mutable',
  },
  customer_billing_info: {
    id: 'generic',
    timestamps: 'mutable',
  },
  job_applications: {
    id: 'generic',
    timestamps: 'mutable',
  },
  cv_versions: {
    id: 'generic',
    timestamps: 'append_only',
  },
  resume_targets: {
    id: 'generic',
    timestamps: 'mutable',
  },
  user_profiles: {
    id: 'domain',
    timestamps: 'mutable',
  },
  linkedin_import_jobs: {
    id: 'generic',
    timestamps: 'mutable',
  },
}

function normalizeIdentifier(value: string): string {
  return value.replaceAll('"', '').trim().toLowerCase()
}

function normalizeDefault(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function hasUuidDefault(value: string | undefined): boolean {
  const normalized = normalizeDefault(value)
  return normalized.includes('gen_random_uuid()')
}

function hasNowDefault(value: string | undefined): boolean {
  const normalized = normalizeDefault(value)
  return normalized.includes('now()') || normalized.includes('current_timestamp')
}

function getMigrationSortKey(file: string): [number, string] {
  const datedPrefix = /^(\d{8})_/i.exec(file)
  if (datedPrefix) {
    return [1, file.toLowerCase()]
  }

  return [0, file.toLowerCase()]
}

function compareMigrationFiles(left: string, right: string): number {
  const [leftGroup, leftKey] = getMigrationSortKey(left)
  const [rightGroup, rightKey] = getMigrationSortKey(right)

  if (leftGroup !== rightGroup) {
    return leftGroup - rightGroup
  }

  return leftKey.localeCompare(rightKey)
}

function getOrCreateTableState(tableStates: Map<string, TableState>, table: string): TableState {
  let tableState = tableStates.get(table)
  if (!tableState) {
    tableState = {
      columns: new Set<string>(),
      defaults: new Map<string, string>(),
    }
    tableStates.set(table, tableState)
  }

  return tableState
}

function parseCreateTables(sql: string, file: string, tableStates: Map<string, TableState>, createdTables: Set<string>): void {
  const createTablePattern = /create table(?: if not exists)?\s+(?:public\.)?("?[\w]+"?)\s*\(([\s\S]*?)\);\s*/gi
  let match: RegExpExecArray | null

  while ((match = createTablePattern.exec(sql)) !== null) {
    const table = normalizeIdentifier(match[1])
    const body = match[2]

    createdTables.add(table)
    const tableState = getOrCreateTableState(tableStates, table)

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '')
      if (!line || line.startsWith('--')) {
        continue
      }

      if (/^(constraint|primary key|foreign key|unique|check)\b/i.test(line)) {
        continue
      }

      const columnMatch = /^("?[\w]+"?)\s+/i.exec(line)
      if (!columnMatch) {
        continue
      }

      const column = normalizeIdentifier(columnMatch[1])
      tableState.columns.add(column)

      const defaultMatch = /\bdefault\s+([^,]+)/i.exec(line)
      if (defaultMatch) {
        tableState.defaults.set(column, defaultMatch[1].trim())
      }
    }
  }
}

function parseAlterTables(sql: string, tableStates: Map<string, TableState>): void {
  const alterTablePattern = /alter table\s+(?:if exists\s+)?(?:public\.)?("?[\w]+"?)\s+([\s\S]*?);/gi
  let match: RegExpExecArray | null

  while ((match = alterTablePattern.exec(sql)) !== null) {
    const table = normalizeIdentifier(match[1])
    const body = match[2]
    const tableState = getOrCreateTableState(tableStates, table)

    const setDefaultPattern = /alter column\s+("?[\w]+"?)\s+set default\s+([^,;]+)/gi
    let defaultMatch: RegExpExecArray | null

    while ((defaultMatch = setDefaultPattern.exec(body)) !== null) {
      const column = normalizeIdentifier(defaultMatch[1])
      tableState.columns.add(column)
      tableState.defaults.set(column, defaultMatch[2].trim())
    }

    const addColumnPattern = /add column(?: if not exists)?\s+("?[\w]+"?)\s+([^\n,;]+)/gi
    let addMatch: RegExpExecArray | null

    while ((addMatch = addColumnPattern.exec(body)) !== null) {
      const column = normalizeIdentifier(addMatch[1])
      tableState.columns.add(column)

      const defaultMatch = /\bdefault\s+(.+)$/i.exec(addMatch[2])
      if (defaultMatch) {
        tableState.defaults.set(column, defaultMatch[1].trim())
      }
    }
  }
}

function parseFunctionInserts(sql: string, file: string): FunctionDefinition[] {
  const functions: FunctionDefinition[] = []
  const functionPattern = /create or replace function\s+("?[\w]+"?)\s*\([\s\S]*?\)\s*returns[\s\S]*?as\s+\$\$([\s\S]*?)\$\$/gi
  let functionMatch: RegExpExecArray | null

  while ((functionMatch = functionPattern.exec(sql)) !== null) {
    const functionName = normalizeIdentifier(functionMatch[1])
    const body = functionMatch[2]
    const inserts: FunctionInsert[] = []
    const insertPattern = /insert into\s+(?:public\.)?("?[\w]+"?)\s*\(([\s\S]*?)\)\s*(?:values|select)/gi
    let insertMatch: RegExpExecArray | null

    while ((insertMatch = insertPattern.exec(body)) !== null) {
      const table = normalizeIdentifier(insertMatch[1])
      const columns = insertMatch[2]
        .split(',')
        .map((column) => normalizeIdentifier(column))
        .filter(Boolean)

      inserts.push({
        file,
        functionName,
        table,
        columns,
      })
    }

    functions.push({
      file,
      functionName,
      inserts,
    })
  }

  return functions
}

function auditTableDefaults(tableStates: Map<string, TableState>, createdTables: Set<string>): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (const table of createdTables) {
    if (!TABLE_CONVENTIONS[table]) {
      findings.push({
        code: 'UNCLASSIFIED_TABLE',
        table,
        message: `Table "${table}" was created in migrations but is not classified in TABLE_CONVENTIONS.`,
      })
    }
  }

  for (const [table, convention] of Object.entries(TABLE_CONVENTIONS)) {
    const state = tableStates.get(table)
    if (!state) {
      continue
    }

    if (convention.id === 'generic' && !hasUuidDefault(state.defaults.get('id'))) {
      findings.push({
        code: 'MISSING_ID_DEFAULT',
        table,
        message: `Table "${table}" must end with a gen_random_uuid() default on id.`,
      })
    }

    if (convention.timestamps === 'append_only' || convention.timestamps === 'mutable') {
      if (!hasNowDefault(state.defaults.get('created_at'))) {
        findings.push({
          code: 'MISSING_CREATED_AT_DEFAULT',
          table,
          message: `Table "${table}" must end with a NOW() or CURRENT_TIMESTAMP default on created_at.`,
        })
      }
    }

    if (convention.timestamps === 'mutable' && !hasNowDefault(state.defaults.get('updated_at'))) {
      findings.push({
        code: 'MISSING_UPDATED_AT_DEFAULT',
        table,
        message: `Table "${table}" must end with a NOW() or CURRENT_TIMESTAMP default on updated_at.`,
      })
    }

    for (const requiredColumn of convention.requiredFunctionInsertColumns ?? []) {
      if (!hasNowDefault(state.defaults.get(requiredColumn))) {
        findings.push({
          code: 'MISSING_EXTRA_DEFAULT',
          table,
          message: `Table "${table}" must end with a NOW() or CURRENT_TIMESTAMP default on ${requiredColumn}.`,
        })
      }
    }
  }

  return findings
}

function auditFunctionInserts(inserts: FunctionInsert[]): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (const insert of inserts) {
    const convention = TABLE_CONVENTIONS[insert.table]
    if (!convention) {
      continue
    }

    if (convention.id === 'generic' && !insert.columns.includes('id')) {
      findings.push({
        code: 'FUNCTION_INSERT_MISSING_ID',
        file: insert.file,
        functionName: insert.functionName,
        table: insert.table,
        message: `Function "${insert.functionName}" inserts into "${insert.table}" without an explicit id column.`,
      })
    }

    if ((convention.timestamps === 'append_only' || convention.timestamps === 'mutable')
      && !insert.columns.includes('created_at')) {
      findings.push({
        code: 'FUNCTION_INSERT_MISSING_CREATED_AT',
        file: insert.file,
        functionName: insert.functionName,
        table: insert.table,
        message: `Function "${insert.functionName}" inserts into "${insert.table}" without an explicit created_at column.`,
      })
    }

    if (convention.timestamps === 'mutable' && !insert.columns.includes('updated_at')) {
      findings.push({
        code: 'FUNCTION_INSERT_MISSING_UPDATED_AT',
        file: insert.file,
        functionName: insert.functionName,
        table: insert.table,
        message: `Function "${insert.functionName}" inserts into "${insert.table}" without an explicit updated_at column.`,
      })
    }

    for (const requiredColumn of convention.requiredFunctionInsertColumns ?? []) {
      if (!insert.columns.includes(requiredColumn)) {
        findings.push({
          code: 'FUNCTION_INSERT_MISSING_REQUIRED_COLUMN',
          file: insert.file,
          functionName: insert.functionName,
          table: insert.table,
          message: `Function "${insert.functionName}" inserts into "${insert.table}" without an explicit ${requiredColumn} column.`,
        })
      }
    }
  }

  return findings
}

export function auditDatabaseConventions(repoRoot: string = process.cwd()): AuditFinding[] {
  const migrationsDir = path.join(repoRoot, 'prisma', 'migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort(compareMigrationFiles)

  const tableStates = new Map<string, TableState>()
  const createdTables = new Set<string>()
  const latestFunctionDefinitions = new Map<string, FunctionDefinition>()

  for (const migrationFile of migrationFiles) {
    const fullPath = path.join(migrationsDir, migrationFile)
    const sql = fs.readFileSync(fullPath, 'utf8')

    parseCreateTables(sql, migrationFile, tableStates, createdTables)
    parseAlterTables(sql, tableStates)

    for (const functionDefinition of parseFunctionInserts(sql, migrationFile)) {
      latestFunctionDefinitions.set(functionDefinition.functionName, functionDefinition)
    }
  }

  const functionInserts = Array.from(latestFunctionDefinitions.values())
    .flatMap((functionDefinition) => functionDefinition.inserts)

  return [
    ...auditTableDefaults(tableStates, createdTables),
    ...auditFunctionInserts(functionInserts),
  ]
}

export function formatAuditFindings(findings: AuditFinding[]): string {
  if (findings.length === 0) {
    return 'Database convention audit passed.'
  }

  const lines = findings.map((finding) => {
    const location = [finding.file, finding.functionName, finding.table].filter(Boolean).join(' | ')
    return location.length > 0
      ? `- [${finding.code}] ${location}: ${finding.message}`
      : `- [${finding.code}] ${finding.message}`
  })

  return [
    'Database convention audit failed:',
    ...lines,
  ].join('\n')
}
