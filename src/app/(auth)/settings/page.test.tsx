import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Session } from "@/types/agent"
import type { AppUser } from "@/types/user"

import SettingsPage from "./page"

const mockGetCurrentAppUser = vi.fn()
const mockLoadOptionalBillingInfo = vi.fn()
const mockGetUserSessions = vi.fn()
const mockResolveSessionAtsReadiness = vi.fn()

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: () => mockGetCurrentAppUser(),
}))

vi.mock("@/lib/asaas/optional-billing-info", () => ({
  loadOptionalBillingInfo: (...args: unknown[]) => mockLoadOptionalBillingInfo(...args),
}))

vi.mock("@/lib/db/sessions", () => ({
  db: {
    getUserSessions: (...args: unknown[]) => mockGetUserSessions(...args),
  },
}))

vi.mock("@/lib/ats/scoring", () => ({
  resolveSessionAtsReadiness: (...args: unknown[]) => mockResolveSessionAtsReadiness(...args),
}))

const baseDate = new Date("2026-04-20T15:00:00.000Z")

function buildAppUser(options: {
  credits?: number
  displayName?: string
  primaryEmail?: string
  authEmail?: string
} = {}): AppUser {
  const credits = options.credits ?? 5
  const displayName = "displayName" in options ? options.displayName : "Maria Silva"
  const primaryEmail = "primaryEmail" in options ? options.primaryEmail : "maria@app.example"
  const authEmail = options.authEmail ?? "maria@auth.example"

  return {
    id: "usr_123",
    status: "active",
    displayName,
    primaryEmail,
    createdAt: baseDate,
    updatedAt: baseDate,
    authIdentity: {
      id: "identity_123",
      userId: "usr_123",
      provider: "clerk",
      providerSubject: "clerk_123",
      email: authEmail,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    creditAccount: {
      id: "credit_123",
      userId: "usr_123",
      creditsRemaining: credits,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  }
}

function buildSession(id: string, updatedAt = new Date("2026-04-21T12:00:00.000Z")): Session {
  return {
    id,
    userId: "usr_123",
    stateVersion: 1,
    phase: "generation",
    cvState: {} as Session["cvState"],
    agentState: {
      parseStatus: "empty",
      rewriteHistory: {},
    } as Session["agentState"],
    generatedOutput: {} as Session["generatedOutput"],
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date("2026-04-19T12:00:00.000Z"),
    updatedAt,
  }
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveSessionAtsReadiness.mockReturnValue({
      displayedReadinessScoreCurrent: 91,
      display: {
        formattedScorePtBr: "91",
        badgeTextPtBr: "Pronto",
      },
    })
  })

  it("renders the compact profile settings layout without Clerk/debug sections", async () => {
    mockGetCurrentAppUser.mockResolvedValue(buildAppUser())
    mockLoadOptionalBillingInfo.mockResolvedValue({
      billingNotice: null,
      billingInfo: {
        plan: "monthly",
        status: "active",
        creditsRemaining: 5,
        maxCredits: 12,
        hasActiveRecurringSubscription: true,
        renewsAt: "2026-05-15T12:00:00.000Z",
      },
    })
    mockGetUserSessions.mockResolvedValue([
      buildSession("sess_recent_123"),
      buildSession("sess_recent_456", new Date("2026-04-20T12:00:00.000Z")),
    ])

    const jsx = await SettingsPage()
    render(jsx)

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument()
    expect(screen.getByText("Gerencie seu perfil CurrIA")).toBeInTheDocument()
    expect(screen.getByLabelText("Avatar do perfil")).toHaveTextContent("MS")
    expect(screen.getByText("Nome")).toBeInTheDocument()
    expect(screen.getByText("Maria")).toBeInTheDocument()
    expect(screen.getByText("Sobrenome")).toBeInTheDocument()
    expect(screen.getByText("Silva")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("maria@app.example")).toBeInTheDocument()
    expect(screen.getByText("Plano")).toBeInTheDocument()
    expect(screen.getByText("Mensal")).toBeInTheDocument()
    expect(screen.getByText("Créditos disponíveis")).toBeInTheDocument()
    expect(screen.getByText("5 créditos")).toBeInTheDocument()

    expect(screen.getByText("2 últimos currículos gerados")).toBeInTheDocument()
    expect(screen.getByText("Currículo sess_recent_123")).toBeInTheDocument()
    expect(screen.getByText("Currículo sess_recent_456")).toBeInTheDocument()
    expect(screen.getAllByText("ATS 91")).toHaveLength(2)
    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/dashboard/resume/compare/sess_recent_123")
    expect(mockGetUserSessions).toHaveBeenCalledWith("usr_123", 2)
    expect(mockResolveSessionAtsReadiness).toHaveBeenCalledTimes(2)

    expect(screen.queryByText("Clerk user")).not.toBeInTheDocument()
    expect(screen.queryByText("App user")).not.toBeInTheDocument()
    expect(screen.queryByText("Conta de créditos")).not.toBeInTheDocument()
    expect(screen.queryByText("Zona sensível")).not.toBeInTheDocument()
    expect(screen.queryByText("Atividade de cobrança")).not.toBeInTheDocument()
  })

  it("uses account fallbacks when billing and generated resumes are unavailable", async () => {
    mockGetCurrentAppUser.mockResolvedValue(buildAppUser({
      credits: 0,
      displayName: undefined,
      primaryEmail: undefined,
      authEmail: "fallback@curria.test",
    }))
    mockLoadOptionalBillingInfo.mockResolvedValue({
      billingNotice: "Billing temporariamente indisponível.",
      billingInfo: null,
    })
    mockGetUserSessions.mockResolvedValue([])

    const jsx = await SettingsPage()
    render(jsx)

    expect(screen.getByLabelText("Avatar do perfil")).toHaveTextContent("FA")
    expect(screen.getAllByText("Não informado")).toHaveLength(3)
    expect(screen.getByText("fallback@curria.test")).toBeInTheDocument()
    expect(screen.getByText("0 créditos")).toBeInTheDocument()
    expect(screen.getByText("Nenhum currículo gerado ainda.")).toBeInTheDocument()
    expect(screen.queryAllByRole("link")).toHaveLength(0)
    expect(mockResolveSessionAtsReadiness).not.toHaveBeenCalled()
  })

  it("renders nothing when there is no authenticated app user", async () => {
    mockGetCurrentAppUser.mockResolvedValue(null)

    const jsx = await SettingsPage()

    expect(jsx).toBeNull()
    expect(mockLoadOptionalBillingInfo).not.toHaveBeenCalled()
    expect(mockGetUserSessions).not.toHaveBeenCalled()
  })
})
