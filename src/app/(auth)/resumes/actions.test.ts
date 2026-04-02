import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createJobApplicationAction,
  deleteJobApplicationAction,
  updateJobApplicationDetailsAction,
  updateJobApplicationStatusAction,
} from "./actions"

const {
  mockGetCurrentAppUser,
  mockGetUserBillingInfo,
  mockCreateJobApplication,
  mockUpdateJobApplication,
  mockDeleteJobApplication,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetCurrentAppUser: vi.fn(),
  mockGetUserBillingInfo: vi.fn(),
  mockCreateJobApplication: vi.fn(),
  mockUpdateJobApplication: vi.fn(),
  mockDeleteJobApplication: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: mockGetCurrentAppUser,
}))

vi.mock("@/lib/asaas/quota", () => ({
  getUserBillingInfo: mockGetUserBillingInfo,
}))

vi.mock("@/lib/db/job-applications", () => ({
  JOB_APPLICATION_STATUSES: ["entrevista", "aguardando", "sem_retorno", "negativa"],
  createJobApplication: mockCreateJobApplication,
  updateJobApplication: mockUpdateJobApplication,
  deleteJobApplication: mockDeleteJobApplication,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}))

describe("resumes actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentAppUser.mockResolvedValue({ id: "usr_123" })
    mockGetUserBillingInfo.mockResolvedValue({ plan: "monthly" })
  })

  it("creates a manual application, normalizes optional fields, and revalidates /resumes", async () => {
    mockCreateJobApplication.mockResolvedValue({
      id: "app_123",
      userId: "usr_123",
      role: "Frontend Engineer",
      company: "Fintech Corp",
      status: "aguardando",
      salary: undefined,
      location: "Remote",
      benefits: [{ name: "VR", value: undefined }],
      resumeVersionLabel: "curriculo_v1.pdf",
      jobDescription: undefined,
      notes: "Follow up next week",
      appliedAt: new Date("2026-04-01T12:00:00.000Z"),
      createdAt: new Date("2026-04-01T12:00:00.000Z"),
      updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    })

    const result = await createJobApplicationAction({
      role: "  Frontend Engineer  ",
      company: "  Fintech Corp  ",
      salary: "   ",
      location: "  Remote ",
      benefits: [{ name: "VR", value: "   " }],
      resumeVersionLabel: "  curriculo_v1.pdf ",
      jobDescription: " ",
      notes: "  Follow up next week ",
      appliedAt: "2026-04-01",
    })

    expect(mockCreateJobApplication).toHaveBeenCalledWith({
      userId: "usr_123",
      role: "Frontend Engineer",
      company: "Fintech Corp",
      salary: undefined,
      location: "Remote",
      benefits: [{ name: "VR", value: undefined }],
      resumeVersionLabel: "curriculo_v1.pdf",
      jobDescription: undefined,
      notes: "Follow up next week",
      appliedAt: "2026-04-01",
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith("/resumes")
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: "app_123",
        role: "Frontend Engineer",
        appliedAt: "2026-04-01T12:00:00.000Z",
      }),
    })
  })

  it("rejects oversized benefits payloads without touching the database", async () => {
    const result = await createJobApplicationAction({
      role: "Frontend Engineer",
      company: "Fintech Corp",
      resumeVersionLabel: "curriculo_v1.pdf",
      benefits: Array.from({ length: 21 }, (_, index) => ({
        name: `Benefit ${index}`,
      })),
    })

    expect(result.success).toBe(false)
    expect(mockCreateJobApplication).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("updates manual details using the authenticated user scope", async () => {
    const result = await updateJobApplicationDetailsAction({
      applicationId: "app_123",
      values: {
        role: "Senior Frontend Engineer",
        company: "Fintech Corp",
        salary: "R$ 15.000,00",
        location: "Remote",
        benefits: [{ name: "VR", value: "R$ 1.200" }],
        resumeVersionLabel: "curriculo_v2.pdf",
        jobDescription: "Build dashboard flows",
        notes: "Priority role",
        appliedAt: "2026-04-02",
      },
    })

    expect(mockUpdateJobApplication).toHaveBeenCalledWith("usr_123", "app_123", {
      role: "Senior Frontend Engineer",
      company: "Fintech Corp",
      salary: "R$ 15.000,00",
      location: "Remote",
      benefits: [{ name: "VR", value: "R$ 1.200" }],
      resumeVersionLabel: "curriculo_v2.pdf",
      jobDescription: "Build dashboard flows",
      notes: "Priority role",
      appliedAt: "2026-04-02",
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith("/resumes")
    expect(result).toEqual({ success: true })
  })

  it("updates only the controlled status field", async () => {
    const result = await updateJobApplicationStatusAction({
      applicationId: "app_123",
      status: "entrevista",
    })

    expect(mockUpdateJobApplication).toHaveBeenCalledWith("usr_123", "app_123", {
      status: "entrevista",
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith("/resumes")
    expect(result).toEqual({ success: true })
  })

  it("returns unauthorized when no current app user exists", async () => {
    mockGetCurrentAppUser.mockResolvedValue(null)

    const result = await deleteJobApplicationAction({
      applicationId: "app_123",
    })

    expect(result).toEqual({
      success: false,
      error: "Unauthorized",
    })
    expect(mockDeleteJobApplication).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("rejects free users before touching the database", async () => {
    mockGetUserBillingInfo.mockResolvedValue(null)

    const result = await createJobApplicationAction({
      role: "Frontend Engineer",
      company: "Fintech Corp",
      resumeVersionLabel: "curriculo_v1.pdf",
      benefits: [],
    })

    expect(result).toEqual({
      success: false,
      error: "O gerenciamento de vagas faz parte dos planos pagos.",
    })
    expect(mockCreateJobApplication).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("returns a neutral access error when billing lookup fails", async () => {
    mockGetUserBillingInfo.mockRejectedValue(new Error("billing down"))

    const result = await updateJobApplicationStatusAction({
      applicationId: "app_123",
      status: "entrevista",
    })

    expect(result).toEqual({
      success: false,
      error: "Nao foi possivel verificar seu acesso ao gerenciamento de vagas agora. Tente novamente em instantes.",
    })
    expect(mockUpdateJobApplication).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
