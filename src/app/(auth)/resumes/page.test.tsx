import React from "react"
import { describe, expect, it, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import ResumesPage, { dynamic, revalidate } from "./page"

const { mockGetCurrentAppUser, mockGetJobApplicationsForUser, mockGetUserBillingInfo } = vi.hoisted(() => ({
  mockGetCurrentAppUser: vi.fn(),
  mockGetJobApplicationsForUser: vi.fn(),
  mockGetUserBillingInfo: vi.fn(),
}))

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: mockGetCurrentAppUser,
}))

vi.mock("@/lib/db/job-applications", () => ({
  getJobApplicationsForUser: mockGetJobApplicationsForUser,
}))

vi.mock("@/lib/asaas/quota", () => ({
  getUserBillingInfo: mockGetUserBillingInfo,
}))

vi.mock("./actions", () => ({
  createJobApplicationAction: vi.fn(),
  updateJobApplicationDetailsAction: vi.fn(),
  updateJobApplicationStatusAction: vi.fn(),
  deleteJobApplicationAction: vi.fn(),
}))

vi.mock("@/components/dashboard/job-applications-tracker", () => ({
  JobApplicationsTracker: ({
    applications,
    locked,
    lockedEyebrow,
    lockedTitle,
    lockedMessage,
    loadErrorMessage,
  }: {
    applications: Array<{ id: string; appliedAt: string }>
    locked?: boolean
    lockedEyebrow?: string
    lockedTitle?: string
    lockedMessage?: string | null
    loadErrorMessage?: string | null
  }) => (
    <div
      data-testid="job-applications-tracker"
      data-count={applications.length}
      data-first-id={applications[0]?.id ?? ""}
      data-first-applied-at={applications[0]?.appliedAt ?? ""}
      data-locked={locked ? "true" : "false"}
      data-locked-eyebrow={lockedEyebrow ?? ""}
      data-locked-title={lockedTitle ?? ""}
      data-locked-message={lockedMessage ?? ""}
      data-load-error={loadErrorMessage ?? ""}
    />
  ),
}))

describe("ResumesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserBillingInfo.mockResolvedValue({ plan: "monthly" })
  })

  it("exports the route as force-dynamic with no revalidation", () => {
    expect(dynamic).toBe("force-dynamic")
    expect(revalidate).toBe(0)
  })

  it("returns null when there is no authenticated app user", async () => {
    mockGetCurrentAppUser.mockResolvedValue(null)

    const jsx = await ResumesPage()

    expect(jsx).toBeNull()
    expect(mockGetJobApplicationsForUser).not.toHaveBeenCalled()
  })

  it("loads the current user's applications and serializes dates for the tracker", async () => {
    mockGetCurrentAppUser.mockResolvedValue({ id: "usr_123" })
    mockGetJobApplicationsForUser.mockResolvedValue([
      {
        id: "app_123",
        userId: "usr_123",
        role: "Frontend Engineer",
        company: "Fintech Corp",
        status: "aguardando",
        salary: "R$ 12.000,00",
        location: "Remote",
        benefits: [],
        resumeVersionLabel: "curriculo_v1.pdf",
        jobDescription: "Build dashboards",
        notes: "Priority",
        appliedAt: new Date("2026-04-01T12:00:00.000Z"),
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        updatedAt: new Date("2026-04-02T12:00:00.000Z"),
      },
    ])

    const jsx = await ResumesPage()
    render(jsx)

    expect(mockGetJobApplicationsForUser).toHaveBeenCalledWith("usr_123")
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-count", "1")
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-first-id", "app_123")
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute(
      "data-first-applied-at",
      "2026-04-01T12:00:00.000Z",
    )
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-locked", "false")
  })

  it("locks the tracker when the user is on free access", async () => {
    mockGetCurrentAppUser.mockResolvedValue({ id: "usr_123" })
    mockGetUserBillingInfo.mockResolvedValue(null)

    const jsx = await ResumesPage()
    render(jsx)

    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-locked", "true")
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-locked-eyebrow", "")
    expect(mockGetJobApplicationsForUser).not.toHaveBeenCalled()
  })

  it("locks the tracker with a neutral message when billing lookup fails", async () => {
    mockGetCurrentAppUser.mockResolvedValue({ id: "usr_123" })
    mockGetUserBillingInfo.mockRejectedValue(new Error("billing down"))

    const jsx = await ResumesPage()
    render(jsx)

    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-locked", "true")
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute(
      "data-locked-eyebrow",
      "Acesso indisponivel",
    )
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute(
      "data-locked-title",
      "Nao foi possivel validar seu plano",
    )
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute(
      "data-locked-message",
      "Nao foi possivel verificar seu acesso ao gerenciamento de vagas agora. Atualize a pagina ou tente novamente em instantes.",
    )
    expect(mockGetJobApplicationsForUser).not.toHaveBeenCalled()
  })

  it("shows a graceful load error when job applications cannot be loaded", async () => {
    mockGetCurrentAppUser.mockResolvedValue({ id: "usr_123" })
    mockGetJobApplicationsForUser.mockRejectedValue(new Error("Could not find the table"))

    const jsx = await ResumesPage()
    render(jsx)

    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute("data-count", "0")
    expect(screen.getByTestId("job-applications-tracker")).toHaveAttribute(
      "data-load-error",
      "Could not find the table",
    )
  })
})
