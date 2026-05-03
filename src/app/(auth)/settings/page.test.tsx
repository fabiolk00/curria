import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Session } from "@/types/agent"
import type { AppUser } from "@/types/user"

import SettingsPage from "./page"

const mockCurrentUser = vi.fn()
const mockGetCurrentAppUser = vi.fn()
const mockLoadOptionalBillingInfo = vi.fn()
const mockGetUserSessions = vi.fn()
const mockCanAccessOperationsDashboard = vi.fn()
const mockResolveSessionAtsReadiness = vi.fn()
const mockIsE2EAuthEnabled = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => mockCurrentUser(),
}))

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: () => mockGetCurrentAppUser(),
}))

vi.mock("@/lib/auth/e2e-auth", () => ({
  isE2EAuthEnabled: () => mockIsE2EAuthEnabled(),
}))

vi.mock("@/lib/asaas/optional-billing-info", () => ({
  loadOptionalBillingInfo: (...args: unknown[]) => mockLoadOptionalBillingInfo(...args),
}))

vi.mock("@/lib/db/sessions", () => ({
  db: {
    getUserSessions: (...args: unknown[]) => mockGetUserSessions(...args),
  },
}))

vi.mock("@/lib/auth/operations-access", () => ({
  canAccessOperationsDashboard: (...args: unknown[]) => mockCanAccessOperationsDashboard(...args),
}))

vi.mock("@/lib/ats/scoring", () => ({
  resolveSessionAtsReadiness: (...args: unknown[]) => mockResolveSessionAtsReadiness(...args),
}))

vi.mock("@/components/dashboard/plan-update-section", () => ({
  PlanUpdateSection: ({
    activeRecurringPlan,
    currentCredits,
  }: {
    activeRecurringPlan: string | null
    currentCredits: number
  }) => (
    <div
      data-testid="plan-update-section"
      data-active-recurring-plan={activeRecurringPlan ?? ""}
      data-current-credits={String(currentCredits)}
    >
      Controles de plano
    </div>
  ),
}))

vi.mock("@/components/dashboard/session-list", () => ({
  default: ({
    sessions,
    variant,
  }: {
    sessions: Array<{
      id: string
      atsReadiness?: {
        displayedReadinessScoreCurrent: number
      }
    }>
    variant?: string
  }) => (
    <div data-testid="session-list" data-variant={variant ?? ""}>
      {sessions.map((session) => (
        <span key={session.id}>
          {session.id}:{session.atsReadiness?.displayedReadinessScoreCurrent ?? "sem-score"}
        </span>
      ))}
    </div>
  ),
}))

vi.mock("@/components/dashboard/billing-activity-card", () => ({
  BillingActivityCard: ({ className }: { className?: string }) => (
    <div data-testid="billing-activity-card" data-class-name={className ?? ""}>
      Atividade de cobrança
    </div>
  ),
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

function buildSession(id = "sess_recent_123"): Session {
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
    updatedAt: new Date("2026-04-21T12:00:00.000Z"),
  }
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsE2EAuthEnabled.mockReturnValue(false)
    mockCanAccessOperationsDashboard.mockReturnValue(false)
    mockCurrentUser.mockResolvedValue({
      id: "clerk_123",
      fullName: "Maria do CurrIA",
      firstName: "Maria",
      username: "maria",
      primaryEmailAddress: {
        emailAddress: "maria@curria.test",
      },
      emailAddresses: [],
    })
    mockResolveSessionAtsReadiness.mockReturnValue({
      displayedReadinessScoreCurrent: 91,
      display: {
        formattedScorePtBr: "91",
        badgeTextPtBr: "Pronto",
      },
    })
  })

  it("renders account, plan, profile, recent activity, billing, support, and safety sections", async () => {
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
    mockGetUserSessions.mockResolvedValue([buildSession()])

    const jsx = await SettingsPage()
    render(jsx)

    expect(screen.getByRole("heading", { name: "Conta e uso do CurrIA" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Visão geral da conta" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Plano e créditos" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Currículo e perfil" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Zona sensível" })).toBeInTheDocument()
    expect(screen.queryByText(/seguidores|notificações|bloqueados/i)).not.toBeInTheDocument()

    expect(screen.getByText("Maria do CurrIA")).toBeInTheDocument()
    expect(screen.getByText("maria@curria.test")).toBeInTheDocument()
    expect(screen.getByText("Mensal")).toBeInTheDocument()
    expect(screen.getByText("5 créditos")).toBeInTheDocument()
    expect(screen.getByText("5 de 12")).toBeInTheDocument()
    expect(screen.getByText("Ativo")).toBeInTheDocument()

    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/profile-setup")
    expect(screen.getByRole("link", { name: "Gerar currículo" })).toHaveAttribute("href", "/generate-resume")
    expect(screen.getByRole("link", { name: "Ver histórico" })).toHaveAttribute("href", "/dashboard/resumes-history")
    expect(screen.getByRole("link", { name: "Abrir preços" })).toHaveAttribute("href", "/#pricing")

    expect(screen.getByTestId("plan-update-section")).toHaveAttribute("data-active-recurring-plan", "monthly")
    expect(screen.getByTestId("plan-update-section")).toHaveAttribute("data-current-credits", "5")
    expect(screen.getByTestId("session-list")).toHaveAttribute("data-variant", "compact")
    expect(screen.getByText("sess_recent_123:91")).toBeInTheDocument()
    expect(mockResolveSessionAtsReadiness).toHaveBeenCalledWith({
      session: expect.objectContaining({ id: "sess_recent_123" }),
    })

    expect(screen.getByTestId("billing-activity-card")).toHaveAttribute("data-class-name", "rounded-[8px] shadow-xs")
    expect(screen.getByText("usr_123")).toBeInTheDocument()
    expect(screen.getByText("clerk_123")).toBeInTheDocument()
    expect(screen.getByText("credit_123")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Não disponível" })).toBeDisabled()
    expect(mockLoadOptionalBillingInfo).toHaveBeenCalledWith("usr_123", "settings_page")
    expect(mockGetUserSessions).toHaveBeenCalledWith("usr_123", 4)
  })

  it("uses safe fallbacks when billing and recent sessions are unavailable", async () => {
    mockCurrentUser.mockResolvedValue(null)
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

    expect(screen.getByText("Conta CurrIA")).toBeInTheDocument()
    expect(screen.getByText("fallback@curria.test")).toBeInTheDocument()
    expect(screen.getByText("Não informado")).toBeInTheDocument()
    expect(screen.getByText("0 créditos")).toBeInTheDocument()
    expect(screen.getByText("0 disponíveis")).toBeInTheDocument()
    expect(screen.getByText("Billing temporariamente indisponível.")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma sessão recente ainda.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/#pricing")
    expect(screen.queryByTestId("plan-update-section")).not.toBeInTheDocument()
    expect(screen.queryByTestId("session-list")).not.toBeInTheDocument()
    expect(mockResolveSessionAtsReadiness).not.toHaveBeenCalled()
  })

  it("renders nothing when there is no authenticated app user", async () => {
    mockGetCurrentAppUser.mockResolvedValue(null)
    mockCurrentUser.mockResolvedValue(null)

    const jsx = await SettingsPage()

    expect(jsx).toBeNull()
    expect(mockLoadOptionalBillingInfo).not.toHaveBeenCalled()
    expect(mockGetUserSessions).not.toHaveBeenCalled()
  })
})
