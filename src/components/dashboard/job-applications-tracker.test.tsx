import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { JobApplicationsTracker } from "./job-applications-tracker"
import type {
  JobApplicationFormInput,
  JobApplicationStatus,
  SerializedJobApplication,
} from "@/types/dashboard"

type ActionResult =
  | { success: true }
  | { success: false; error: string }

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) => (open ? <div data-testid="alert-dialog-root">{children}</div> : null),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    disabled,
    onValueChange,
    children,
  }: {
    value?: string
    disabled?: boolean
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <select
      aria-label="Atualizar status"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder ?? null}</>,
}))

function buildApplication(
  overrides: Partial<SerializedJobApplication> = {},
): SerializedJobApplication {
  return {
    id: "app_123",
    userId: "usr_123",
    role: "Frontend Engineer",
    company: "Fintech Corp",
    status: "aguardando",
    salary: "R$ 12.000,00",
    location: "Remote",
    benefits: [
      { name: "VR", value: "R$ 1.200" },
      { name: "Plano de Saude" },
    ],
    resumeVersionLabel: "curriculo_v1.pdf",
    jobDescription: "Build dashboard flows and manage product UX.",
    notes: "Follow up on Friday",
    appliedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  }
}

function renderTracker(options?: {
  applications?: SerializedJobApplication[]
  locked?: boolean
  lockedEyebrow?: string
  lockedTitle?: string
  lockedMessage?: string | null
  loadErrorMessage?: string | null
  createApplicationAction?: (input: JobApplicationFormInput) => Promise<ActionResult>
  updateApplicationDetailsAction?: (input: {
    applicationId: string
    values: JobApplicationFormInput
  }) => Promise<ActionResult>
  updateApplicationStatusAction?: (input: {
    applicationId: string
    status: JobApplicationStatus
  }) => Promise<ActionResult>
  deleteApplicationAction?: (input: { applicationId: string }) => Promise<ActionResult>
}) {
  return render(
    <JobApplicationsTracker
      applications={options?.applications ?? [buildApplication()]}
      locked={options?.locked ?? false}
      lockedEyebrow={options?.lockedEyebrow}
      lockedTitle={options?.lockedTitle}
      lockedMessage={options?.lockedMessage}
      loadErrorMessage={options?.loadErrorMessage ?? null}
      createApplicationAction={options?.createApplicationAction ?? vi.fn().mockResolvedValue({ success: true })}
      updateApplicationDetailsAction={
        options?.updateApplicationDetailsAction ?? vi.fn().mockResolvedValue({ success: true })
      }
      updateApplicationStatusAction={
        options?.updateApplicationStatusAction ?? vi.fn().mockResolvedValue({ success: true })
      }
      deleteApplicationAction={
        options?.deleteApplicationAction ?? vi.fn().mockResolvedValue({ success: true })
      }
    />,
  )
}

describe("JobApplicationsTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a manual application through the modal and parses benefits lines", async () => {
    const user = userEvent.setup()
    const createApplicationAction = vi.fn().mockResolvedValue({ success: true })

    renderTracker({
      applications: [],
      createApplicationAction,
    })

    await user.click(screen.getByRole("button", { name: /adicionar primeira vaga/i }))
    await user.type(screen.getByLabelText("Cargo"), "Senior Frontend Engineer")
    await user.type(screen.getByLabelText("Empresa"), "Fintech Corp")
    await user.type(screen.getByLabelText("Salario"), "R$ 15.000,00")
    await user.type(screen.getByLabelText("Localizacao"), "Remote")
    await user.type(screen.getByLabelText("Nome do curriculo enviado"), "curriculo_v3.pdf")
    await user.clear(screen.getByLabelText("Beneficios"))
    await user.type(screen.getByLabelText("Beneficios"), "VR | R$ 1.200{enter}Plano de Saude")
    await user.type(screen.getByLabelText("Descricao da vaga"), "Build dashboard flows")
    await user.type(screen.getByLabelText("Observacoes"), "Critical role")
    await user.click(screen.getByRole("button", { name: /criar vaga/i }))

    await waitFor(() => {
      expect(createApplicationAction).toHaveBeenCalledWith({
        role: "Senior Frontend Engineer",
        company: "Fintech Corp",
        salary: "R$ 15.000,00",
        location: "Remote",
        resumeVersionLabel: "curriculo_v3.pdf",
        benefits: [
          { name: "VR", value: "R$ 1.200" },
          { name: "Plano de Saude", value: undefined },
        ],
        jobDescription: "Build dashboard flows",
        notes: "Critical role",
        appliedAt: expect.any(String),
      })
    })

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Vaga criada com sucesso.")).toBeInTheDocument()
  })

  it("prefills the edit modal and submits updated manual fields", async () => {
    const user = userEvent.setup()
    const updateApplicationDetailsAction = vi.fn().mockResolvedValue({ success: true })

    renderTracker({
      updateApplicationDetailsAction,
    })

    await user.click(screen.getByRole("button", { name: /editar/i }))

    const companyInput = screen.getByLabelText("Empresa")
    await user.clear(companyInput)
    await user.type(companyInput, "New Fintech")

    const notesInput = screen.getByLabelText("Observacoes")
    await user.clear(notesInput)
    await user.type(notesInput, "Updated notes")

    await user.click(screen.getByRole("button", { name: /salvar alteracoes/i }))

    await waitFor(() => {
      expect(updateApplicationDetailsAction).toHaveBeenCalledWith({
        applicationId: "app_123",
        values: expect.objectContaining({
          company: "New Fintech",
          notes: "Updated notes",
          role: "Frontend Engineer",
        }),
      })
    })

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Vaga atualizada com sucesso.")).toBeInTheDocument()
  })

  it("updates the controlled status field from the tracker card", async () => {
    const user = userEvent.setup()
    const updateApplicationStatusAction = vi.fn().mockResolvedValue({ success: true })

    renderTracker({
      updateApplicationStatusAction,
    })

    await user.selectOptions(screen.getByLabelText("Atualizar status"), "entrevista")

    await waitFor(() => {
      expect(updateApplicationStatusAction).toHaveBeenCalledWith({
        applicationId: "app_123",
        status: "entrevista",
      })
    })

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Status atualizado com sucesso.")).toBeInTheDocument()
  })

  it("confirms and deletes an application", async () => {
    const user = userEvent.setup()
    const deleteApplicationAction = vi.fn().mockResolvedValue({ success: true })

    renderTracker({
      deleteApplicationAction,
    })

    await user.click(screen.getByRole("button", { name: /excluir/i }))
    await user.click(screen.getByRole("button", { name: /excluir vaga/i }))

    await waitFor(() => {
      expect(deleteApplicationAction).toHaveBeenCalledWith({
        applicationId: "app_123",
      })
    })

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Vaga excluida com sucesso.")).toBeInTheDocument()
  })

  it("filters and searches across a larger application set", async () => {
    const user = userEvent.setup()
    const applications = Array.from({ length: 18 }, (_, index) =>
      buildApplication({
        id: `app_${index}`,
        role: index % 2 === 0 ? `Frontend Role ${index}` : `Backend Role ${index}`,
        company: index % 3 === 0 ? `Fintech ${index}` : `Other ${index}`,
        status: index % 4 === 0 ? "entrevista" : "aguardando",
      }),
    )

    renderTracker({ applications })

    expect(screen.getByText("18")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Em Entrevista" }))
    expect(screen.getByText("Frontend Role 0")).toBeInTheDocument()
    expect(screen.queryByText("Backend Role 1")).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/buscar por empresa ou cargo/i), "Fintech 12")
    expect(screen.getByText("Frontend Role 12")).toBeInTheDocument()
    expect(screen.queryByText("Frontend Role 0")).not.toBeInTheDocument()
  })

  it("shows action errors and avoids refresh on failure", async () => {
    const user = userEvent.setup()
    const createApplicationAction = vi.fn().mockResolvedValue({
      success: false,
      error: "DB exploded",
    })

    renderTracker({
      applications: [],
      createApplicationAction,
    })

    await user.click(screen.getByRole("button", { name: /adicionar primeira vaga/i }))
    await user.type(screen.getByLabelText("Cargo"), "Senior Frontend Engineer")
    await user.type(screen.getByLabelText("Empresa"), "Fintech Corp")
    await user.type(screen.getByLabelText("Nome do curriculo enviado"), "curriculo_v3.pdf")
    await user.click(screen.getByRole("button", { name: /criar vaga/i }))

    await waitFor(() => {
      expect(screen.getByText("DB exploded")).toBeInTheDocument()
    })

    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("locks the page for free access with blurred, disabled interactions", async () => {
    const { container } = renderTracker({
      applications: [buildApplication()],
      locked: true,
    })

    expect(screen.getByText(/gerenciamento de vagas bloqueado/i)).toBeInTheDocument()
    expect(
      screen.getByText(/gerenciamento de vagas faz parte dos planos pagos/i),
    ).toBeInTheDocument()

    const lockedContent = container.querySelector('[aria-hidden="true"]')
    expect(lockedContent).toHaveClass("pointer-events-none", "select-none", "blur-[4px]")

    const searchInput = container.querySelector('input[placeholder="Buscar por empresa ou cargo..."]')
    expect(searchInput).toBeDisabled()

    const disabledButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) =>
        button.textContent?.match(/Adicionar Vaga|Editar|Excluir/i) && (button as HTMLButtonElement).disabled,
    )
    expect(disabledButtons).toHaveLength(3)
  })

  it("shows a load error banner when applications fail to load", () => {
    renderTracker({
      applications: [],
      loadErrorMessage: "Could not find the table 'public.job_applications' in the schema cache",
    })

    expect(screen.getByText(/nao foi possivel carregar suas candidaturas agora/i)).toBeInTheDocument()
    expect(screen.getByText(/schema cache/i)).toBeInTheDocument()
    expect(
      screen.getByText(/gerenciamento de vagas ainda nao esta disponivel neste ambiente/i),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /adicionar vaga/i })).toBeDisabled()
    expect(screen.getByPlaceholderText(/buscar por empresa ou cargo/i)).toBeDisabled()
    expect(screen.queryByRole("button", { name: /adicionar primeira vaga/i })).not.toBeInTheDocument()
  })

  it("renders a custom locked message when access validation is unavailable", () => {
    renderTracker({
      applications: [],
      locked: true,
      lockedEyebrow: "Acesso indisponivel",
      lockedTitle: "Nao foi possivel validar seu plano",
      lockedMessage:
        "Nao foi possivel verificar seu acesso ao gerenciamento de vagas agora. Atualize a pagina ou tente novamente em instantes.",
    })

    expect(screen.getByText(/acesso indisponivel/i)).toBeInTheDocument()
    expect(screen.getByText(/nao foi possivel validar seu plano/i)).toBeInTheDocument()
    expect(
      screen.getByText(/nao foi possivel verificar seu acesso ao gerenciamento de vagas agora/i),
    ).toBeInTheDocument()
  })
})
