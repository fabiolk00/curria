import { CVStateSchema } from '@/lib/cv/schema'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type { CVTimelineEntry, CVVersion, CVVersionScope, CVVersionSource } from '@/types/agent'
import type { CVState } from '@/types/cv'

type CVVersionRow = {
  id: string
  session_id: string
  target_resume_id?: string | null
  snapshot: unknown
  source: string
  created_at: string
}

function cloneCvState(snapshot: CVState): CVState {
  return structuredClone(snapshot)
}

function normalizeTargetResumeId(targetResumeId?: string): string | null {
  return targetResumeId ?? null
}

function compareCvVersionRecency(
  left: Pick<CVVersion, 'createdAt' | 'id'>,
  right: Pick<CVVersion, 'createdAt' | 'id'>,
): number {
  const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime()

  if (createdAtDelta !== 0) {
    return createdAtDelta
  }

  return left.id.localeCompare(right.id)
}

function serializeCvSnapshotForComparison(snapshot: CVState): string {
  return JSON.stringify({
    fullName: snapshot.fullName,
    email: snapshot.email,
    phone: snapshot.phone,
    linkedin: snapshot.linkedin ?? null,
    location: snapshot.location ?? null,
    summary: snapshot.summary,
    experience: snapshot.experience.map((entry) => ({
      title: entry.title,
      company: entry.company,
      location: entry.location ?? null,
      startDate: entry.startDate,
      endDate: entry.endDate,
      bullets: [...entry.bullets],
    })),
    skills: [...snapshot.skills],
    education: snapshot.education.map((entry) => ({
      degree: entry.degree,
      institution: entry.institution,
      year: entry.year,
      gpa: entry.gpa ?? null,
    })),
    certifications: snapshot.certifications?.map((entry) => ({
      name: entry.name,
      issuer: entry.issuer,
      year: entry.year ?? null,
    })) ?? null,
  })
}

function areCvSnapshotsIdentical(left: CVState, right: CVState): boolean {
  return serializeCvSnapshotForComparison(left) === serializeCvSnapshotForComparison(right)
}

function isCvVersionInComparisonScope(
  version: Pick<CVVersion, 'targetResumeId'>,
  targetResumeId?: string,
): boolean {
  return normalizeTargetResumeId(version.targetResumeId) === normalizeTargetResumeId(targetResumeId)
}

function getLatestRelevantCvVersion(
  versions: readonly CVVersion[],
  targetResumeId?: string,
): CVVersion | undefined {
  return versions.reduce<CVVersion | undefined>((latestVersion, version) => {
    if (!isCvVersionInComparisonScope(version, targetResumeId)) {
      return latestVersion
    }

    if (!latestVersion) {
      return version
    }

    return compareCvVersionRecency(version, latestVersion) > 0
      ? version
      : latestVersion
  }, undefined)
}

// Keep this aligned with the SQL write-path dedupe in create_cv_version_record.
export function shouldSkipCvVersionInsert(
  versions: readonly CVVersion[],
  nextSnapshot: CVState,
  targetResumeId?: string,
): boolean {
  const latestRelevantVersion = getLatestRelevantCvVersion(versions, targetResumeId)

  return latestRelevantVersion !== undefined
    && areCvSnapshotsIdentical(latestRelevantVersion.snapshot, nextSnapshot)
}

function mapCvVersionRow(row: CVVersionRow): CVVersion {
  const parsedSnapshot = CVStateSchema.parse(row.snapshot)

  return {
    id: row.id,
    sessionId: row.session_id,
    targetResumeId: row.target_resume_id ?? undefined,
    snapshot: cloneCvState(parsedSnapshot),
    source: row.source as CVVersionSource,
    createdAt: new Date(row.created_at),
  }
}

function getCVVersionScope(version: CVVersion): CVVersionScope {
  return version.source === 'target-derived' ? 'target-derived' : 'base'
}

function getCVVersionLabel(version: CVVersion): string {
  switch (version.source) {
    case 'ingestion':
      return 'Base Resume Imported'
    case 'rewrite':
      return 'Base Resume Updated'
    case 'manual':
      return 'Base Resume Edited'
    case 'target-derived':
      return version.targetResumeId
        ? `Target Resume Created (${version.targetResumeId})`
        : 'Target Resume Created'
  }
}

export function toTimelineEntry(version: CVVersion): CVTimelineEntry {
  return {
    ...version,
    label: getCVVersionLabel(version),
    timestamp: version.createdAt.toISOString(),
    scope: getCVVersionScope(version),
  }
}

export async function createCvVersion(input: {
  sessionId: string
  snapshot: CVState
  source: CVVersionSource
  targetResumeId?: string
}): Promise<CVVersion> {
  const supabase = getSupabaseAdminClient()
  const snapshot = cloneCvState(input.snapshot)
  const { data, error } = await supabase.rpc('create_cv_version_record', {
    p_session_id: input.sessionId,
    p_snapshot: snapshot,
    p_source: input.source,
    p_target_resume_id: input.targetResumeId ?? null,
  })

  if (error || !data) {
    throw new Error(`Failed to create CV version: ${error?.message}`)
  }

  return mapCvVersionRow(data as CVVersionRow)
}

async function getCvVersionsForSession(sessionId: string): Promise<CVVersion[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('cv_versions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .returns<CVVersionRow[]>()

  if (error || !data) {
    throw new Error(`Failed to load CV versions: ${error?.message}`)
  }

  return data.map(mapCvVersionRow)
}

export async function getLatestCvVersionForScope(
  sessionId: string,
  targetResumeId?: string,
): Promise<CVVersion | null> {
  const versions = await getCvVersionsForSession(sessionId)
  return getLatestRelevantCvVersion(versions, targetResumeId) ?? null
}

export async function getCvVersionForSession(sessionId: string, versionId: string): Promise<CVVersion | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('cv_versions')
    .select('*')
    .eq('session_id', sessionId)
    .eq('id', versionId)
    .maybeSingle<CVVersionRow>()

  if (error) {
    throw new Error(`Failed to load CV version: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapCvVersionRow(data)
}

export async function getCvTimelineForSession(
  sessionId: string,
  scope: CVVersionScope | 'all' = 'all',
): Promise<CVTimelineEntry[]> {
  const versions = await getCvVersionsForSession(sessionId)

  return versions
    .map(toTimelineEntry)
    .filter((version) => scope === 'all' || version.scope === scope)
}
