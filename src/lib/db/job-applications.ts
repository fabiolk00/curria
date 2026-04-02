import { z } from 'zod'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type {
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationBenefit,
  JobApplicationStatus,
  JobApplicationSummary,
  UpdateJobApplicationInput,
} from '@/types/dashboard'

export const JOB_APPLICATION_STATUSES = ['entrevista', 'aguardando', 'sem_retorno', 'negativa'] as const
export const JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE =
  'O gerenciamento de vagas ainda nao esta disponivel neste ambiente.'

const JobApplicationStatusSchema = z.enum(JOB_APPLICATION_STATUSES)

const JobApplicationBenefitSchema = z.object({
  name: z.string().min(1),
  value: z.string().optional(),
})

const JobApplicationRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  role: z.string(),
  company: z.string(),
  status: JobApplicationStatusSchema,
  salary: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  benefits: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(JobApplicationBenefitSchema),
  ),
  resume_version_label: z.string(),
  job_description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  applied_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const CreateJobApplicationInputSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  status: JobApplicationStatusSchema.default('aguardando'),
  salary: z.string().optional(),
  location: z.string().optional(),
  benefits: z.array(JobApplicationBenefitSchema).default([]),
  resumeVersionLabel: z.string().min(1),
  jobDescription: z.string().optional(),
  notes: z.string().optional(),
  appliedAt: z.union([z.date(), z.string().min(1)]).optional(),
})

const UpdateJobApplicationInputSchema = z.object({
  role: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  status: JobApplicationStatusSchema.optional(),
  salary: z.string().optional(),
  location: z.string().optional(),
  benefits: z.array(JobApplicationBenefitSchema).optional(),
  resumeVersionLabel: z.string().min(1).optional(),
  jobDescription: z.string().optional(),
  notes: z.string().optional(),
  appliedAt: z.union([z.date(), z.string().min(1)]).optional(),
})

type JobApplicationRow = z.infer<typeof JobApplicationRowSchema>

function isMissingJobApplicationsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes("job_applications") &&
    (
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("not found")
    )
  )
}

function toJobApplicationsError(action: string, error: unknown): Error {
  if (isMissingJobApplicationsTableError(error)) {
    return new Error(JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE)
  }

  if (error instanceof Error) {
    return new Error(`Failed to ${action}: ${error.message}`)
  }

  return new Error(`Failed to ${action}.`)
}

function cloneBenefits(benefits: JobApplicationBenefit[]): JobApplicationBenefit[] {
  return structuredClone(benefits)
}

function toIsoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid applied date: ${String(value)}`)
  }

  return date.toISOString()
}

function normalizeNullableString(value: string | undefined): string | null {
  return value ?? null
}

function mapJobApplicationRow(row: JobApplicationRow): JobApplication {
  const parsed = JobApplicationRowSchema.parse(row)

  return {
    id: parsed.id,
    userId: parsed.user_id,
    role: parsed.role,
    company: parsed.company,
    status: parsed.status,
    salary: parsed.salary ?? undefined,
    location: parsed.location ?? undefined,
    benefits: cloneBenefits(parsed.benefits),
    resumeVersionLabel: parsed.resume_version_label,
    jobDescription: parsed.job_description ?? undefined,
    notes: parsed.notes ?? undefined,
    appliedAt: new Date(parsed.applied_at),
    createdAt: new Date(parsed.created_at),
    updatedAt: new Date(parsed.updated_at),
  }
}

function buildJobApplicationStats(): JobApplicationSummary {
  return {
    total: 0,
    byStatus: {
      entrevista: 0,
      aguardando: 0,
      sem_retorno: 0,
      negativa: 0,
    },
  }
}

function normalizeCreatePayload(input: CreateJobApplicationInput) {
  const parsed = CreateJobApplicationInputSchema.parse(input)

  return {
    user_id: parsed.userId,
    role: parsed.role,
    company: parsed.company,
    status: parsed.status,
    salary: normalizeNullableString(parsed.salary),
    location: normalizeNullableString(parsed.location),
    benefits: cloneBenefits(parsed.benefits),
    resume_version_label: parsed.resumeVersionLabel,
    job_description: normalizeNullableString(parsed.jobDescription),
    notes: normalizeNullableString(parsed.notes),
    applied_at: toIsoTimestamp(parsed.appliedAt ?? new Date()),
  }
}

function normalizeUpdatePayload(input: UpdateJobApplicationInput) {
  const parsed = UpdateJobApplicationInputSchema.parse(input)
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.role !== undefined) update.role = parsed.role
  if (parsed.company !== undefined) update.company = parsed.company
  if (parsed.status !== undefined) update.status = parsed.status
  if (parsed.salary !== undefined) update.salary = normalizeNullableString(parsed.salary)
  if (parsed.location !== undefined) update.location = normalizeNullableString(parsed.location)
  if (parsed.benefits !== undefined) update.benefits = cloneBenefits(parsed.benefits)
  if (parsed.resumeVersionLabel !== undefined) update.resume_version_label = parsed.resumeVersionLabel
  if (parsed.jobDescription !== undefined) update.job_description = normalizeNullableString(parsed.jobDescription)
  if (parsed.notes !== undefined) update.notes = normalizeNullableString(parsed.notes)
  if (parsed.appliedAt !== undefined) update.applied_at = toIsoTimestamp(parsed.appliedAt)

  return update
}

export async function createJobApplication(input: CreateJobApplicationInput): Promise<JobApplication> {
  const normalized = CreateJobApplicationInputSchema.parse(input)

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('job_applications')
    .insert(normalizeCreatePayload(normalized))
    .select('*')
    .single()

  if (error || !data) {
    throw toJobApplicationsError('create job application', error)
  }

  return mapJobApplicationRow(data as JobApplicationRow)
}

export async function getJobApplicationsForUser(userId: string): Promise<JobApplication[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .returns<JobApplicationRow[]>()

  if (error || !data) {
    throw toJobApplicationsError('load job applications', error)
  }

  return data.map(mapJobApplicationRow)
}

export async function getJobApplicationForUser(
  userId: string,
  applicationId: string,
): Promise<JobApplication | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .eq('id', applicationId)
    .maybeSingle<JobApplicationRow>()

  if (error) {
    throw toJobApplicationsError('load job application', error)
  }

  if (!data) {
    return null
  }

  return mapJobApplicationRow(data)
}

export async function updateJobApplication(
  userId: string,
  applicationId: string,
  patch: UpdateJobApplicationInput,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('job_applications')
    .update(normalizeUpdatePayload(patch))
    .eq('user_id', userId)
    .eq('id', applicationId)

  if (error) {
    throw toJobApplicationsError('update job application', error)
  }
}

export async function deleteJobApplication(userId: string, applicationId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('job_applications')
    .delete()
    .eq('user_id', userId)
    .eq('id', applicationId)

  if (error) {
    throw toJobApplicationsError('delete job application', error)
  }
}

export async function getJobApplicationSummaryForUser(userId: string): Promise<JobApplicationSummary> {
  const applications = await getJobApplicationsForUser(userId)

  return applications.reduce<JobApplicationSummary>((summary, application) => {
    summary.total += 1
    summary.byStatus[application.status] += 1
    return summary
  }, buildJobApplicationStats())
}
