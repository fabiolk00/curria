'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getUserBillingInfo } from '@/lib/asaas/quota'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { JOB_APPLICATION_STATUSES, createJobApplication, deleteJobApplication, updateJobApplication } from '@/lib/db/job-applications'
import type { JobApplication, JobApplicationFormInput, SerializedJobApplication } from '@/types/dashboard'

const JOB_APPLICATIONS_PAID_PLAN_MESSAGE =
  'O gerenciamento de vagas faz parte dos planos pagos.'
const JOB_APPLICATIONS_ACCESS_UNAVAILABLE_MESSAGE =
  'Nao foi possivel verificar seu acesso ao gerenciamento de vagas agora. Tente novamente em instantes.'

const JobApplicationBenefitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  value: z.string().trim().max(200).optional(),
})

const JobApplicationFormSchema = z.object({
  role: z.string().trim().min(1).max(160),
  company: z.string().trim().min(1).max(160),
  salary: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  benefits: z.array(JobApplicationBenefitSchema).max(20),
  resumeVersionLabel: z.string().trim().min(1).max(160),
  jobDescription: z.string().trim().max(20000).optional(),
  notes: z.string().trim().max(5000).optional(),
  appliedAt: z.string().trim().optional(),
})

const UpdateJobApplicationStatusSchema = z.object({
  applicationId: z.string().trim().min(1),
  status: z.enum(JOB_APPLICATION_STATUSES),
})

const UpdateJobApplicationDetailsSchema = z.object({
  applicationId: z.string().trim().min(1),
  values: JobApplicationFormSchema,
})

const DeleteJobApplicationSchema = z.object({
  applicationId: z.string().trim().min(1),
})

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeFormInput(input: JobApplicationFormInput): JobApplicationFormInput {
  const parsed = JobApplicationFormSchema.parse(input)

  return {
    role: parsed.role,
    company: parsed.company,
    salary: normalizeOptionalString(parsed.salary),
    location: normalizeOptionalString(parsed.location),
    benefits: parsed.benefits.map((benefit) => ({
      name: benefit.name,
      value: normalizeOptionalString(benefit.value),
    })),
    resumeVersionLabel: parsed.resumeVersionLabel,
    jobDescription: normalizeOptionalString(parsed.jobDescription),
    notes: normalizeOptionalString(parsed.notes),
    appliedAt: normalizeOptionalString(parsed.appliedAt),
  }
}

function serializeJobApplication(application: JobApplication): SerializedJobApplication {
  return {
    ...application,
    appliedAt: application.appliedAt.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

async function requireAppUserId(): Promise<string> {
  const appUser = await getCurrentAppUser()

  if (!appUser) {
    throw new Error('Unauthorized')
  }

  return appUser.id
}

async function requirePaidJobApplicationsAccess(): Promise<string> {
  const userId = await requireAppUserId()

  try {
    const billingInfo = await getUserBillingInfo(userId)

    if (!billingInfo || billingInfo.plan === 'free') {
      throw new Error(JOB_APPLICATIONS_PAID_PLAN_MESSAGE)
    }

    return userId
  } catch (error) {
    if (error instanceof Error && error.message === JOB_APPLICATIONS_PAID_PLAN_MESSAGE) {
      throw error
    }

    throw new Error(JOB_APPLICATIONS_ACCESS_UNAVAILABLE_MESSAGE)
  }
}

function revalidateTrackerPath(): void {
  revalidatePath('/resumes')
}

export async function createJobApplicationAction(
  input: JobApplicationFormInput,
): Promise<ActionResult<SerializedJobApplication>> {
  try {
    const userId = await requirePaidJobApplicationsAccess()
    const normalizedInput = normalizeFormInput(input)

    const created = await createJobApplication({
      userId,
      ...normalizedInput,
    })

    revalidateTrackerPath()

    return {
      success: true,
      data: serializeJobApplication(created),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel criar a vaga.',
    }
  }
}

export async function updateJobApplicationDetailsAction(input: {
  applicationId: string
  values: JobApplicationFormInput
}): Promise<ActionResult<SerializedJobApplication>> {
  try {
    const parsed = UpdateJobApplicationDetailsSchema.parse(input)
    const userId = await requirePaidJobApplicationsAccess()
    const normalizedValues = normalizeFormInput(parsed.values)

    await updateJobApplication(userId, parsed.applicationId, normalizedValues)

    revalidateTrackerPath()

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel atualizar a vaga.',
    }
  }
}

export async function updateJobApplicationStatusAction(input: {
  applicationId: string
  status: (typeof JOB_APPLICATION_STATUSES)[number]
}): Promise<ActionResult> {
  try {
    const parsed = UpdateJobApplicationStatusSchema.parse(input)
    const userId = await requirePaidJobApplicationsAccess()

    await updateJobApplication(userId, parsed.applicationId, {
      status: parsed.status,
    })

    revalidateTrackerPath()

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel atualizar o status.',
    }
  }
}

export async function deleteJobApplicationAction(input: {
  applicationId: string
}): Promise<ActionResult> {
  try {
    const parsed = DeleteJobApplicationSchema.parse(input)
    const userId = await requirePaidJobApplicationsAccess()

    await deleteJobApplication(userId, parsed.applicationId)

    revalidateTrackerPath()

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel excluir a vaga.',
    }
  }
}
