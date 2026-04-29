import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardSidebar } from "./sidebar"

const mockReplace = vi.fn()
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockCloseMobile = vi.fn()
const mockSignOut = vi.fn()
const mockUseIsMobile = vi.fn(() => false)
const mockUsePathname = vi.fn(() => "/profile-setup")

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({
    signOut: mockSignOut,
  }),
  useUser: () => ({
    user: null,
  }),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}))

vi.mock("@/context/sidebar-context", () => ({
  useSidebarContext: () => ({
    isMounted: true,
    isMobileOpen: false,
    closeMobile: mockCloseMobile,
  }),
}))

vi.mock("@/components/dashboard/session-documents-panel", () => ({
  SessionDocumentsPanel: ({ isSidebarOpen }: { isSidebarOpen: boolean }) => (
    <div data-testid="session-documents-panel" data-open={String(isSidebarOpen)} />
  ),
}))

vi.mock("@/components/dashboard/plan-update-dialog", () => ({
  PlanUpdateDialog: () => null,
}))

vi.mock("@/components/logo", () => ({
  default: () => <div>Logo</div>,
}))

describe("DashboardSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseIsMobile.mockReturnValue(false)
    mockUsePathname.mockReturnValue("/profile-setup")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ profile: null }), {
          status: 200,
        })) as unknown as typeof fetch,
    )
  })

  it("keeps the desktop sidebar collapsed with guided generation navigation", async () => {
    render(<DashboardSidebar />)

    const profileLink = screen.getByRole("link", { name: "Perfil" })
    const resumesLink = screen.getByRole("link", { name: "Currículos" })
    const generateButton = screen.getByRole("button", { name: "Gerar currículo" })
    const accountButton = screen.getByRole("button", { name: "Abrir menu da conta" })

    expect(profileLink).toHaveAttribute("href", "/profile-setup")
    expect(resumesLink).toHaveAttribute("href", "/dashboard/resumes-history")
    expect(generateButton).toHaveClass(
      "h-10",
      "w-10",
      "justify-center",
      "hover:bg-sidebar-accent/50",
      "hover:text-sidebar-foreground",
    )
    expect(accountButton).toHaveClass(
      "h-10",
      "w-10",
      "justify-center",
      "rounded-lg",
    )
    expect(
      resumesLink.compareDocumentPosition(generateButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)
    expect(screen.queryByRole("link", { name: "Sessões" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nova conversa" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Expandir sidebar")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Recolher sidebar")).not.toBeInTheDocument()
    expect(screen.getByTestId("session-documents-panel")).toHaveAttribute("data-open", "false")
  })

  it("opens the existing account dropdown on avatar click in collapsed desktop mode", async () => {
    const user = userEvent.setup()

    render(<DashboardSidebar />)

    await user.click(screen.getByRole("button", { name: "Abrir menu da conta" }))

    expect(await screen.findByText("Sair")).toBeInTheDocument()
    expect(screen.getByText("Ver planos")).toBeInTheDocument()
  })

  it("routes the primary action to guided profile setup", async () => {
    const user = userEvent.setup()

    render(<DashboardSidebar />)

    await user.click(screen.getByRole("button", { name: "Gerar currículo" }))

    expect(mockPush).toHaveBeenCalledWith("/profile-setup")
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("shows history navigation without Pro chat access props", async () => {
    render(<DashboardSidebar />)

    expect(screen.queryByRole("link", { name: "Sessões" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Currículos" })).toHaveAttribute("href", "/dashboard/resumes-history")
  })
})
