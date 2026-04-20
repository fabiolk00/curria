import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import type { BillingAnomalyReport } from '../src/types/billing'
import type { CreditReservation } from '../src/lib/db/credit-reservations'

type JsonRow = Record<string, unknown>
type SnapshotTransport = 'psql' | 'supabase_admin'
type SnapshotTable =
  | 'billing_checkouts'
  | 'credit_accounts'
  | 'user_quotas'
  | 'processed_events'
  | 'credit_reservations'
  | 'credit_ledger_entries'

type SnapshotFilters = {
  userId: string | null
  checkoutReference: string | null
  subscriptionId: string | null
  sessionId: string | null
}

type Snapshot = {
  generatedAt: string
  transport: SnapshotTransport
  filters: SnapshotFilters
  discovered: {
    userIds: string[]
    checkoutReferences: string[]
    subscriptionIds: string[]
    sessionIds: string[]
  }
  billing_checkouts: JsonRow[]
  credit_accounts: JsonRow[]
  user_quotas: JsonRow[]
  processed_events: JsonRow[]
  credit_reservations: JsonRow[]
  credit_ledger_entries: JsonRow[]
  billing_anomalies: BillingAnomalyReport
}

type HealthcheckResult = {
  generatedAt: string
  transport: SnapshotTransport
  envFileLoaded: boolean
  tables: Record<SnapshotTable, 'ok'>
  rpcCheck: {
    status: 'verified' | 'skipped'
    detail: string
  }
  user: {
    id: string | null
    exists: boolean | null
  }
}

type ProcessedEventPayload = {
  payment?: {
    externalReference?: string | null
    subscription?: string | null
  } | null
  subscription?: {
    externalReference?: string | null
    id?: string | null
  } | null
}

function getNamedExport<T>(
  module: Record<string, unknown>,
  exportName: string,
): T {
  const directExport = module[exportName]

  if (directExport) {
    return directExport as T
  }

  const defaultExport = module.default
  if (defaultExport && typeof defaultExport === 'object' && exportName in defaultExport) {
    return (defaultExport as Record<string, unknown>)[exportName] as T
  }

  throw new Error(`Failed to load ${exportName} from dynamic module import.`)
}

async function getSupabaseAdminClientDynamic() {
  const module = await import('../src/lib/db/supabase-admin')
  return getNamedExport<() => ReturnType<typeof import('../src/lib/db/supabase-admin').getSupabaseAdminClient>>(
    module,
    'getSupabaseAdminClient',
  )()
}

async function summarizeBillingAnomaliesFromReservationsDynamic(
  reservations: CreditReservation[],
): Promise<BillingAnomalyReport> {
  const module = await import('../src/lib/billing/billing-anomaly-summary')
  return getNamedExport<(typeof import('../src/lib/billing/billing-anomaly-summary'))['summarizeBillingAnomaliesFromReservations']>(
    module,
    'summarizeBillingAnomaliesFromReservations',
  )(reservations)
}

const BILLING_CHECKOUT_COLUMNS = [
  'id',
  'user_id',
  'checkout_reference',
  'plan',
  'amount_minor',
  'currency',
  'status',
  'asaas_link',
  'asaas_payment_id',
  'asaas_subscription_id',
  'created_at',
  'updated_at',
].join(', ')

const CREDIT_ACCOUNT_COLUMNS = [
  'id',
  'user_id',
  'credits_remaining',
  'created_at',
  'updated_at',
].join(', ')

const USER_QUOTA_COLUMNS = [
  'id',
  'user_id',
  'plan',
  'credits_remaining',
  'asaas_customer_id',
  'asaas_subscription_id',
  'renews_at',
  'status',
  'created_at',
  'updated_at',
].join(', ')

const PROCESSED_EVENT_COLUMNS = [
  'id',
  'event_id',
  'event_type',
  'event_fingerprint',
  'processed_at',
  'created_at',
  'event_payload',
].join(', ')

const CREDIT_RESERVATION_COLUMNS = [
  'id',
  'user_id',
  'generation_intent_key',
  'job_id',
  'session_id',
  'resume_target_id',
  'resume_generation_id',
  'type',
  'status',
  'credits_reserved',
  'failure_reason',
  'reserved_at',
  'finalized_at',
  'released_at',
  'reconciliation_status',
  'metadata',
  'created_at',
  'updated_at',
].join(', ')

const CREDIT_LEDGER_COLUMNS = [
  'id',
  'user_id',
  'reservation_id',
  'generation_intent_key',
  'entry_type',
  'credits_delta',
  'balance_after',
  'job_id',
  'session_id',
  'resume_target_id',
  'resume_generation_id',
  'metadata',
  'created_at',
].join(', ')

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

async function loadEnvFile(envFile: string): Promise<boolean> {
  const envPath = path.join(process.cwd(), envFile)

  let fileContents: string
  try {
    fileContents = await readFile(envPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }

    throw error
  }

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = normalizeEnvValue(line.slice(separatorIndex + 1))

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }

  return true
}

function printHelp(): void {
  console.log([
    'Usage:',
    '  npx tsx scripts/check-staging-billing-state.ts --user <id>',
    '  npx tsx scripts/check-staging-billing-state.ts --checkout <ref>',
    '  npx tsx scripts/check-staging-billing-state.ts --subscription <id>',
    '  npx tsx scripts/check-staging-billing-state.ts --session <id>',
    '  npx tsx scripts/check-staging-billing-state.ts --healthcheck [--preflight-user <id>]',
    '',
    'Options:',
    '  --user <id>              Filter rows by user id',
    '  --checkout <ref>         Filter rows by checkout reference',
    '  --subscription <id>      Filter rows by Asaas subscription id',
    '  --session <id>           Filter export billing rows by session id',
    '  --healthcheck            Verify table access and optional test-user presence',
    '  --preflight-user <id>    User id to check during --healthcheck',
    '  --env-file <path>        Load a specific env file instead of .env.staging',
    '  --help                   Show this help text',
    '',
    'The snapshot includes:',
    '  - billing_checkouts',
    '  - credit_accounts',
    '  - user_quotas',
    '  - processed_events',
    '  - credit_reservations',
    '  - credit_ledger_entries',
    '  - billing_anomalies',
    '',
    'Database access modes:',
    '  - Preferred: psql + STAGING_DB_URL',
    '  - Fallback: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
  ].join('\n'))
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function commandAvailable(commandName: string): boolean {
  const result = spawnSync(commandName, ['--version'], {
    encoding: 'utf8',
  })

  return !result.error && result.status === 0
}

function hasSupabaseAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

function resolveTransport(): SnapshotTransport {
  if (process.env.STAGING_DB_URL?.trim() && commandAvailable('psql')) {
    return 'psql'
  }

  if (hasSupabaseAdminEnv()) {
    return 'supabase_admin'
  }

  if (process.env.STAGING_DB_URL?.trim()) {
    throw new Error(
      'STAGING_DB_URL is set but psql is unavailable. Install psql or provide NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the Supabase admin fallback.',
    )
  }

  throw new Error(
    'Missing staging database access. Provide STAGING_DB_URL with psql, or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the Supabase admin fallback.',
  )
}

function runPsqlJsonQuery(databaseUrl: string, sql: string): JsonRow[] {
  const query = `SELECT COALESCE(json_agg(row_to_json(result_row)), '[]'::json)
FROM (
${sql}
) AS result_row;`

  const result = spawnSync('psql', ['-X', '-t', '-A', '-d', databaseUrl, '-c', query], {
    encoding: 'utf8',
  })

  if (result.error) {
    if (result.error.message.includes('ENOENT')) {
      throw new Error('psql is required for direct staging billing snapshots but was not found on PATH.')
    }

    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'psql query failed')
  }

  const stdout = result.stdout.trim()
  if (!stdout) {
    return []
  }

  return JSON.parse(stdout) as JsonRow[]
}

function runPsqlScalarQuery(databaseUrl: string, sql: string): string {
  const result = spawnSync('psql', ['-X', '-t', '-A', '-d', databaseUrl, '-c', sql], {
    encoding: 'utf8',
  })

  if (result.error) {
    if (result.error.message.includes('ENOENT')) {
      throw new Error('psql is required for direct staging billing health checks but was not found on PATH.')
    }

    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'psql query failed')
  }

  return result.stdout.trim()
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0))))
}

function mergeRowsById(...groups: JsonRow[][]): JsonRow[] {
  const rows = new Map<string, JsonRow>()

  for (const group of groups) {
    for (const row of group) {
      const id = typeof row.id === 'string' ? row.id : JSON.stringify(row)
      rows.set(id, row)
    }
  }

  return Array.from(rows.values())
}

function orValue(value: string): string {
  return value.replaceAll(',', '%2C')
}

async function selectRows(
  table: string,
  columns: string,
  filterColumn: string,
  values: string[],
  orderColumn: string,
): Promise<JsonRow[]> {
  if (values.length === 0) {
    return []
  }

  const supabase = await getSupabaseAdminClientDynamic()
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in(filterColumn, values)
    .order(orderColumn, { ascending: false })

  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`)
  }

  return (data ?? []) as unknown as JsonRow[]
}

async function selectRowsByEquality(
  table: string,
  columns: string,
  filterColumn: string,
  value: string,
  orderColumn: string,
): Promise<JsonRow[]> {
  const supabase = await getSupabaseAdminClientDynamic()
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq(filterColumn, value)
    .order(orderColumn, { ascending: false })

  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`)
  }

  return (data ?? []) as unknown as JsonRow[]
}

function getPayloadText(
  payload: unknown,
  pathSegments: string[],
): string | null {
  let current: unknown = payload

  for (const segment of pathSegments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' && current.length > 0 ? current : null
}

function matchesProcessedEvent(
  row: JsonRow,
  checkoutReferences: string[],
  userIds: string[],
  subscriptionIds: string[],
): boolean {
  const payload = row.event_payload as ProcessedEventPayload | null | undefined
  const paymentExternalReference = getPayloadText(payload, ['payment', 'externalReference'])
  const subscriptionExternalReference = getPayloadText(payload, ['subscription', 'externalReference'])
  const paymentSubscriptionId = getPayloadText(payload, ['payment', 'subscription'])
  const payloadSubscriptionId = getPayloadText(payload, ['subscription', 'id'])

  const acceptedExternalReferences = new Set<string>()
  for (const checkoutReference of checkoutReferences) {
    acceptedExternalReferences.add(`curria:v1:c:${checkoutReference}`)

    for (const userId of userIds) {
      acceptedExternalReferences.add(`curria:v1:u:${userId}:c:${checkoutReference}`)
    }
  }

  return (
    (paymentExternalReference ? acceptedExternalReferences.has(paymentExternalReference) : false)
    || (subscriptionExternalReference ? acceptedExternalReferences.has(subscriptionExternalReference) : false)
    || (paymentSubscriptionId ? subscriptionIds.includes(paymentSubscriptionId) : false)
    || (payloadSubscriptionId ? subscriptionIds.includes(payloadSubscriptionId) : false)
  )
}

function buildSnapshot(
  transport: SnapshotTransport,
  filters: SnapshotFilters,
  billingCheckouts: JsonRow[],
  creditAccounts: JsonRow[],
  userQuotas: JsonRow[],
  processedEvents: JsonRow[],
  creditReservations: JsonRow[],
  creditLedgerEntries: JsonRow[],
  billingAnomalies: BillingAnomalyReport,
): Snapshot {
  const discoveredUserIds = unique([
    filters.userId,
    ...billingCheckouts.map((row) => (typeof row.user_id === 'string' ? row.user_id : null)),
    ...creditReservations.map((row) => (typeof row.user_id === 'string' ? row.user_id : null)),
    ...creditLedgerEntries.map((row) => (typeof row.user_id === 'string' ? row.user_id : null)),
  ])

  const discoveredCheckoutRefs = unique([
    filters.checkoutReference,
    ...billingCheckouts.map((row) => (typeof row.checkout_reference === 'string' ? row.checkout_reference : null)),
  ])

  const discoveredSubscriptionIds = unique([
    filters.subscriptionId,
    ...billingCheckouts.map((row) => (typeof row.asaas_subscription_id === 'string' ? row.asaas_subscription_id : null)),
    ...userQuotas.map((row) => (typeof row.asaas_subscription_id === 'string' ? row.asaas_subscription_id : null)),
  ])

  const discoveredSessionIds = unique([
    filters.sessionId,
    ...creditReservations.map((row) => (typeof row.session_id === 'string' ? row.session_id : null)),
    ...creditLedgerEntries.map((row) => (typeof row.session_id === 'string' ? row.session_id : null)),
  ])

  return {
    generatedAt: new Date().toISOString(),
    transport,
    filters,
    discovered: {
      userIds: discoveredUserIds,
      checkoutReferences: discoveredCheckoutRefs,
      subscriptionIds: discoveredSubscriptionIds,
      sessionIds: discoveredSessionIds,
    },
    billing_checkouts: billingCheckouts,
    credit_accounts: creditAccounts,
    user_quotas: userQuotas,
    processed_events: processedEvents,
    credit_reservations: creditReservations,
    credit_ledger_entries: creditLedgerEntries,
    billing_anomalies: billingAnomalies,
  }
}

function buildDiscoveredIds(
  filters: SnapshotFilters,
  billingCheckouts: JsonRow[],
  userQuotas: JsonRow[],
  creditReservations: JsonRow[] = [],
  creditLedgerEntries: JsonRow[] = [],
): {
  userIds: string[]
  checkoutReferences: string[]
  subscriptionIds: string[]
  sessionIds: string[]
} {
  return {
    userIds: unique([
      filters.userId,
      ...billingCheckouts.map((row) => (typeof row.user_id === 'string' ? row.user_id : null)),
      ...creditReservations.map((row) => (typeof row.user_id === 'string' ? row.user_id : null)),
      ...creditLedgerEntries.map((row) => (typeof row.user_id === 'string' ? row.user_id : null)),
    ]),
    checkoutReferences: unique([
      filters.checkoutReference,
      ...billingCheckouts.map((row) => (typeof row.checkout_reference === 'string' ? row.checkout_reference : null)),
    ]),
    subscriptionIds: unique([
      filters.subscriptionId,
      ...billingCheckouts.map((row) => (typeof row.asaas_subscription_id === 'string' ? row.asaas_subscription_id : null)),
      ...userQuotas.map((row) => (typeof row.asaas_subscription_id === 'string' ? row.asaas_subscription_id : null)),
    ]),
    sessionIds: unique([
      filters.sessionId,
      ...creditReservations.map((row) => (typeof row.session_id === 'string' ? row.session_id : null)),
      ...creditLedgerEntries.map((row) => (typeof row.session_id === 'string' ? row.session_id : null)),
    ]),
  }
}

function mapSnapshotReservationRow(row: JsonRow): CreditReservation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    generationIntentKey: String(row.generation_intent_key),
    jobId: typeof row.job_id === 'string' ? row.job_id : undefined,
    sessionId: typeof row.session_id === 'string' ? row.session_id : undefined,
    resumeTargetId: typeof row.resume_target_id === 'string' ? row.resume_target_id : undefined,
    resumeGenerationId: typeof row.resume_generation_id === 'string' ? row.resume_generation_id : undefined,
    type: String(row.type) as CreditReservation['type'],
    status: String(row.status) as CreditReservation['status'],
    creditsReserved: Number(row.credits_reserved),
    failureReason: typeof row.failure_reason === 'string' ? row.failure_reason : undefined,
    reservedAt: new Date(String(row.reserved_at)),
    finalizedAt: typeof row.finalized_at === 'string' ? new Date(row.finalized_at) : undefined,
    releasedAt: typeof row.released_at === 'string' ? new Date(row.released_at) : undefined,
    reconciliationStatus: String(row.reconciliation_status) as CreditReservation['reconciliationStatus'],
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }
}

export async function createPsqlSnapshot(filters: SnapshotFilters): Promise<Snapshot> {
  const databaseUrl = process.env.STAGING_DB_URL
  if (!databaseUrl) {
    throw new Error('Missing STAGING_DB_URL for direct psql snapshot mode.')
  }

  const checkoutClauses = [
    filters.userId ? `user_id = ${escapeSqlLiteral(filters.userId)}` : null,
    filters.checkoutReference ? `checkout_reference = ${escapeSqlLiteral(filters.checkoutReference)}` : null,
    filters.subscriptionId ? `asaas_subscription_id = ${escapeSqlLiteral(filters.subscriptionId)}` : null,
  ].filter((clause): clause is string => Boolean(clause))

  const reservationSeedClauses = [
    filters.userId ? `user_id = ${escapeSqlLiteral(filters.userId)}` : null,
    filters.sessionId ? `session_id = ${escapeSqlLiteral(filters.sessionId)}` : null,
  ].filter((clause): clause is string => Boolean(clause))

  const seededReservations = reservationSeedClauses.length > 0
    ? runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${CREDIT_RESERVATION_COLUMNS}
       FROM credit_reservations
       WHERE ${reservationSeedClauses.join(' OR ')}
       ORDER BY updated_at DESC`,
    )
    : []

  const billingCheckouts = checkoutClauses.length > 0
    ? runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${BILLING_CHECKOUT_COLUMNS}
       FROM billing_checkouts
       WHERE ${checkoutClauses.join(' OR ')}
       ORDER BY created_at DESC`,
    )
    : []

  const discoveredIds = buildDiscoveredIds(filters, billingCheckouts, [], seededReservations)

  const creditAccounts = discoveredIds.userIds.length > 0
    ? runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${CREDIT_ACCOUNT_COLUMNS}
       FROM credit_accounts
       WHERE user_id IN (${discoveredIds.userIds.map(escapeSqlLiteral).join(', ')})
       ORDER BY updated_at DESC`,
    )
    : []

  const userQuotas = (() => {
    const quotaClauses = [
      discoveredIds.userIds.length > 0
        ? `user_id IN (${discoveredIds.userIds.map(escapeSqlLiteral).join(', ')})`
        : null,
      discoveredIds.subscriptionIds.length > 0
        ? `asaas_subscription_id IN (${discoveredIds.subscriptionIds.map(escapeSqlLiteral).join(', ')})`
        : null,
    ].filter((clause): clause is string => Boolean(clause))

    if (quotaClauses.length === 0) {
      return [] as JsonRow[]
    }

    return runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${USER_QUOTA_COLUMNS}
       FROM user_quotas
       WHERE ${quotaClauses.join(' OR ')}
       ORDER BY updated_at DESC`,
    )
  })()

  const refreshedDiscoveredIds = buildDiscoveredIds(filters, billingCheckouts, userQuotas, seededReservations)
  const processedEventClauses: string[] = []

  if (refreshedDiscoveredIds.subscriptionIds.length > 0) {
    const sqlValues = refreshedDiscoveredIds.subscriptionIds.map(escapeSqlLiteral).join(', ')
    processedEventClauses.push(`COALESCE(event_payload->'payment'->>'subscription', event_payload->'subscription'->>'id') IN (${sqlValues})`)
  }

  if (refreshedDiscoveredIds.checkoutReferences.length > 0) {
    for (const checkoutReference of refreshedDiscoveredIds.checkoutReferences) {
      processedEventClauses.push(
        `COALESCE(event_payload->'payment'->>'externalReference', event_payload->'subscription'->>'externalReference') = ${escapeSqlLiteral(`curria:v1:c:${checkoutReference}`)}`,
      )
    }
  }

  if (refreshedDiscoveredIds.checkoutReferences.length > 0 && refreshedDiscoveredIds.userIds.length > 0) {
    for (const checkoutReference of refreshedDiscoveredIds.checkoutReferences) {
      for (const userId of refreshedDiscoveredIds.userIds) {
        processedEventClauses.push(
          `COALESCE(event_payload->'payment'->>'externalReference', event_payload->'subscription'->>'externalReference') = ${escapeSqlLiteral(`curria:v1:u:${userId}:c:${checkoutReference}`)}`,
        )
      }
    }
  }

  const processedEvents = processedEventClauses.length > 0
    ? runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${PROCESSED_EVENT_COLUMNS}
       FROM processed_events
       WHERE ${processedEventClauses.join(' OR ')}
       ORDER BY processed_at DESC`,
    )
    : []

  const reservationClauses = [
    refreshedDiscoveredIds.userIds.length > 0
      ? `user_id IN (${refreshedDiscoveredIds.userIds.map(escapeSqlLiteral).join(', ')})`
      : null,
    refreshedDiscoveredIds.sessionIds.length > 0
      ? `session_id IN (${refreshedDiscoveredIds.sessionIds.map(escapeSqlLiteral).join(', ')})`
      : null,
  ].filter((clause): clause is string => Boolean(clause))

  const creditReservations = reservationClauses.length > 0
    ? runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${CREDIT_RESERVATION_COLUMNS}
       FROM credit_reservations
       WHERE ${reservationClauses.join(' OR ')}
       ORDER BY updated_at DESC`,
    )
    : seededReservations

  const reservationIntentKeys = unique(
    creditReservations.map((row) => (typeof row.generation_intent_key === 'string' ? row.generation_intent_key : null)),
  )
  const ledgerClauses = [
    refreshedDiscoveredIds.userIds.length > 0
      ? `user_id IN (${refreshedDiscoveredIds.userIds.map(escapeSqlLiteral).join(', ')})`
      : null,
    refreshedDiscoveredIds.sessionIds.length > 0
      ? `session_id IN (${refreshedDiscoveredIds.sessionIds.map(escapeSqlLiteral).join(', ')})`
      : null,
    reservationIntentKeys.length > 0
      ? `generation_intent_key IN (${reservationIntentKeys.map(escapeSqlLiteral).join(', ')})`
      : null,
  ].filter((clause): clause is string => Boolean(clause))

  const creditLedgerEntries = ledgerClauses.length > 0
    ? runPsqlJsonQuery(
      databaseUrl,
      `SELECT ${CREDIT_LEDGER_COLUMNS}
       FROM credit_ledger_entries
       WHERE ${ledgerClauses.join(' OR ')}
       ORDER BY created_at DESC`,
    )
    : []

  const billingAnomalies = await summarizeBillingAnomaliesFromReservationsDynamic(
    creditReservations.map(mapSnapshotReservationRow),
  )

  return buildSnapshot(
    'psql',
    filters,
    billingCheckouts,
    creditAccounts,
    userQuotas,
    processedEvents,
    creditReservations,
    creditLedgerEntries,
    billingAnomalies,
  )
}

export async function createSupabaseSnapshot(filters: SnapshotFilters): Promise<Snapshot> {
  const billingCheckouts = mergeRowsById(
    filters.userId
      ? await selectRowsByEquality(
        'billing_checkouts',
        BILLING_CHECKOUT_COLUMNS,
        'user_id',
        filters.userId,
        'created_at',
      )
      : [],
    filters.checkoutReference
      ? await selectRowsByEquality(
        'billing_checkouts',
        BILLING_CHECKOUT_COLUMNS,
        'checkout_reference',
        filters.checkoutReference,
        'created_at',
      )
      : [],
    filters.subscriptionId
      ? await selectRowsByEquality(
        'billing_checkouts',
        BILLING_CHECKOUT_COLUMNS,
        'asaas_subscription_id',
        filters.subscriptionId,
        'created_at',
      )
      : [],
  )

  const initialIds = buildDiscoveredIds(filters, billingCheckouts, [])

  const creditReservations = mergeRowsById(
    await selectRows(
      'credit_reservations',
      CREDIT_RESERVATION_COLUMNS,
      'user_id',
      initialIds.userIds,
      'updated_at',
    ),
    filters.sessionId
      ? await selectRowsByEquality(
        'credit_reservations',
        CREDIT_RESERVATION_COLUMNS,
        'session_id',
        filters.sessionId,
        'updated_at',
      )
      : [],
  )
  const refreshedIdsFromReservations = buildDiscoveredIds(filters, billingCheckouts, [], creditReservations)
  const creditAccounts = await selectRows(
    'credit_accounts',
    CREDIT_ACCOUNT_COLUMNS,
    'user_id',
    refreshedIdsFromReservations.userIds,
    'updated_at',
  )

  const userQuotas = mergeRowsById(
    await selectRows(
      'user_quotas',
      USER_QUOTA_COLUMNS,
      'user_id',
      refreshedIdsFromReservations.userIds,
      'updated_at',
    ),
    await selectRows(
      'user_quotas',
      USER_QUOTA_COLUMNS,
      'asaas_subscription_id',
      refreshedIdsFromReservations.subscriptionIds,
      'updated_at',
    ),
  )
  const reservationIntentKeys = unique(
    creditReservations.map((row) => (typeof row.generation_intent_key === 'string' ? row.generation_intent_key : null)),
  )
  const creditLedgerEntries = mergeRowsById(
    await selectRows(
      'credit_ledger_entries',
      CREDIT_LEDGER_COLUMNS,
      'user_id',
      refreshedIdsFromReservations.userIds,
      'created_at',
    ),
    filters.sessionId
      ? await selectRowsByEquality(
        'credit_ledger_entries',
        CREDIT_LEDGER_COLUMNS,
        'session_id',
        filters.sessionId,
        'created_at',
      )
      : [],
    await selectRows(
      'credit_ledger_entries',
      CREDIT_LEDGER_COLUMNS,
      'generation_intent_key',
      reservationIntentKeys,
      'created_at',
    ),
  )

  const refreshedIds = buildDiscoveredIds(filters, billingCheckouts, userQuotas, creditReservations, creditLedgerEntries)
  const supabase = await getSupabaseAdminClientDynamic()
  const { data: processedEventRows, error: processedEventError } = await supabase
    .from('processed_events')
    .select(PROCESSED_EVENT_COLUMNS)
    .order('processed_at', { ascending: false })
    .limit(500)

  if (processedEventError) {
    throw new Error(`Failed to read processed_events: ${processedEventError.message}`)
  }

  const processedEvents = ((processedEventRows ?? []) as unknown as JsonRow[])
    .filter((row) => matchesProcessedEvent(
      row,
      refreshedIds.checkoutReferences,
      refreshedIds.userIds,
      refreshedIds.subscriptionIds,
    ))
  const billingAnomalies = await summarizeBillingAnomaliesFromReservationsDynamic(
    creditReservations.map(mapSnapshotReservationRow),
  )

  return buildSnapshot(
    'supabase_admin',
    filters,
    billingCheckouts,
    creditAccounts,
    userQuotas,
    processedEvents,
    creditReservations,
    creditLedgerEntries,
    billingAnomalies,
  )
}

function createPsqlHealthcheck(envFileLoaded: boolean, preflightUserId: string | null): HealthcheckResult {
  const databaseUrl = process.env.STAGING_DB_URL
  if (!databaseUrl) {
    throw new Error('Missing STAGING_DB_URL for direct psql healthcheck mode.')
  }

  if (runPsqlScalarQuery(databaseUrl, 'SELECT 1;') !== '1') {
    throw new Error('Database connectivity check returned an unexpected result.')
  }

  const tablesFound = Number(runPsqlScalarQuery(
    databaseUrl,
    `SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('billing_checkouts', 'credit_accounts', 'user_quotas', 'processed_events', 'credit_reservations', 'credit_ledger_entries');`,
  ))

  if (tablesFound !== 6) {
    throw new Error(`Expected billing tables are missing (${tablesFound}/6 found).`)
  }

  const rpcCount = Number(runPsqlScalarQuery(
    databaseUrl,
    `SELECT COUNT(*) FROM information_schema.routines
     WHERE routine_schema = 'public'
       AND routine_name IN (
         'apply_billing_credit_grant_event',
         'apply_billing_subscription_metadata_event',
         'reserve_credit_for_generation_intent',
         'finalize_credit_reservation',
         'release_credit_reservation'
       );`,
  ))

  if (rpcCount !== 5) {
    throw new Error(`Expected billing RPC functions are missing (${rpcCount}/5 found).`)
  }

  const userExists = preflightUserId
    ? runPsqlScalarQuery(
      databaseUrl,
      `SELECT COUNT(*) FROM users WHERE id = ${escapeSqlLiteral(preflightUserId)};`,
    ) === '1'
    : null

  return {
    generatedAt: new Date().toISOString(),
    transport: 'psql',
    envFileLoaded,
    tables: {
      billing_checkouts: 'ok',
      credit_accounts: 'ok',
      user_quotas: 'ok',
      processed_events: 'ok',
      credit_reservations: 'ok',
      credit_ledger_entries: 'ok',
    },
    rpcCheck: {
      status: 'verified',
      detail: 'Verified checkout and export-reservation RPC functions through information_schema.routines.',
    },
    user: {
      id: preflightUserId,
      exists: userExists,
    },
  }
}

async function assertTableReadable(table: string): Promise<void> {
  const supabase = await getSupabaseAdminClientDynamic()
  const { error } = await supabase
    .from(table)
    .select('id')
    .limit(1)

  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`)
  }
}

async function createSupabaseHealthcheck(
  envFileLoaded: boolean,
  preflightUserId: string | null,
): Promise<HealthcheckResult> {
  for (const table of ['billing_checkouts', 'credit_accounts', 'user_quotas', 'processed_events', 'credit_reservations', 'credit_ledger_entries']) {
    await assertTableReadable(table)
  }

  let userExists: boolean | null = null

  if (preflightUserId) {
    const supabase = await getSupabaseAdminClientDynamic()
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', preflightUserId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to read users: ${error.message}`)
    }

    userExists = Boolean(data?.id)
  }

  return {
    generatedAt: new Date().toISOString(),
    transport: 'supabase_admin',
    envFileLoaded,
    tables: {
      billing_checkouts: 'ok',
      credit_accounts: 'ok',
      user_quotas: 'ok',
      processed_events: 'ok',
      credit_reservations: 'ok',
      credit_ledger_entries: 'ok',
    },
    rpcCheck: {
      status: 'skipped',
      detail: 'psql unavailable; table access was verified through the Supabase admin fallback and live checkout/export replay will exercise the same billing RPC paths.',
    },
    user: {
      id: preflightUserId,
      exists: userExists,
    },
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean' },
      healthcheck: { type: 'boolean' },
      user: { type: 'string' },
      checkout: { type: 'string' },
      subscription: { type: 'string' },
      session: { type: 'string' },
      'preflight-user': { type: 'string' },
      'env-file': { type: 'string' },
    },
    allowPositionals: false,
  })

  if (values.help) {
    printHelp()
    return
  }

  const envFile = values['env-file'] ?? '.env.staging'
  const envFileLoaded = await loadEnvFile(envFile)
  const transport = resolveTransport()

  if (values.healthcheck) {
    const result = transport === 'psql'
      ? createPsqlHealthcheck(envFileLoaded, values['preflight-user'] ?? null)
      : await createSupabaseHealthcheck(envFileLoaded, values['preflight-user'] ?? null)

    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (!values.user && !values.checkout && !values.subscription && !values.session) {
    printHelp()
    throw new Error('At least one filter is required: --user, --checkout, --subscription, or --session.')
  }

  const filters: SnapshotFilters = {
    userId: values.user ?? null,
    checkoutReference: values.checkout ?? null,
    subscriptionId: values.subscription ?? null,
    sessionId: values.session ?? null,
  }

  const snapshot = transport === 'psql'
    ? await createPsqlSnapshot(filters)
    : await createSupabaseSnapshot(filters)

  console.log(JSON.stringify(snapshot, null, 2))
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : null
const moduleFile = path.resolve(fileURLToPath(import.meta.url))

if (entryFile === moduleFile) {
  main().catch((error) => {
    console.error('[check-staging-billing-state] Failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
