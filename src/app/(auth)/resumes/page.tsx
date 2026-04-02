import React from "react"
import type { Metadata } from "next"

import { JobApplicationsTracker } from "@/components/dashboard/job-applications-tracker"
import { getUserBillingInfo } from "@/lib/asaas/quota"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { getJobApplicationsForUser } from "@/lib/db/job-applications"
import type { JobApplication, SerializedJobApplication } from "@/types/dashboard"

import {
  createJobApplicationAction,
  deleteJobApplicationAction,
  updateJobApplicationDetailsAction,
  updateJobApplicationStatusAction,
} from "./actions"

export const metadata: Metadata = {
  title: "Minhas Vagas - CurrIA",
  description: "Acompanhe manualmente o status das suas candidaturas.",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

const BILLING_ACCESS_UNAVAILABLE_TITLE = "Nao foi possivel validar seu plano"
const BILLING_ACCESS_UNAVAILABLE_EYEBROW = "Acesso indisponivel"
const BILLING_ACCESS_UNAVAILABLE_MESSAGE =
  "Nao foi possivel verificar seu acesso ao gerenciamento de vagas agora. Atualize a pagina ou tente novamente em instantes."

function serializeJobApplication(application: JobApplication): SerializedJobApplication {
  return {
    ...application,
    appliedAt: application.appliedAt.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

export default async function ResumesPage() {
  const appUser = await getCurrentAppUser()

  if (!appUser) {
    return null
  }

  const accessResult = await getUserBillingInfo(appUser.id)
    .then((billingInfo) => ({
      locked: billingInfo === null || billingInfo.plan === "free",
      lockedEyebrow: undefined as string | undefined,
      lockedTitle: undefined as string | undefined,
      lockedMessage: undefined as string | undefined,
    }))
    .catch(() => ({
      locked: true,
      lockedEyebrow: BILLING_ACCESS_UNAVAILABLE_EYEBROW,
      lockedTitle: BILLING_ACCESS_UNAVAILABLE_TITLE,
      lockedMessage: BILLING_ACCESS_UNAVAILABLE_MESSAGE,
    }))

  const applicationsResult = accessResult.locked
    ? {
        applications: [] as JobApplication[],
        loadErrorMessage: null as string | null,
      }
    : await getJobApplicationsForUser(appUser.id)
        .then((applications) => ({ applications, loadErrorMessage: null as string | null }))
        .catch((error: unknown) => ({
          applications: [] as JobApplication[],
          loadErrorMessage:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar suas vagas agora. Tente novamente em instantes.",
        }))

  return (
    <JobApplicationsTracker
      applications={applicationsResult.applications.map(serializeJobApplication)}
      loadErrorMessage={applicationsResult.loadErrorMessage}
      locked={accessResult.locked}
      lockedEyebrow={accessResult.lockedEyebrow}
      lockedTitle={accessResult.lockedTitle}
      lockedMessage={accessResult.lockedMessage}
      createApplicationAction={createJobApplicationAction}
      updateApplicationDetailsAction={updateJobApplicationDetailsAction}
      updateApplicationStatusAction={updateJobApplicationStatusAction}
      deleteApplicationAction={deleteJobApplicationAction}
    />
  )
}
