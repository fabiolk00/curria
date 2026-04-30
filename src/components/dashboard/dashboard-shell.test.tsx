import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type React from "react"

import DashboardShell from "./dashboard-shell"

const mockOpenMobile = vi.fn()
const mockUseIsMobile = vi.fn(() => false)
const mockUsePathname = vi.fn(() => "/profile-setup")

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}))

vi.mock("@/context/sidebar-context", () => ({
  useSidebarContext: () => ({
    openMobile: mockOpenMobile,
  }),
}))

vi.mock("@/components/dashboard/sidebar", () => ({
  DashboardSidebar: () => <aside data-testid="dashboard-sidebar">Sidebar</aside>,
}))

vi.mock("@/components/dashboard/welcome-guide", () => ({
  DashboardWelcomeGuide: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-welcome-guide">{children}</div>
  ),
}))

describe("DashboardShell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseIsMobile.mockReturnValue(false)
    mockUsePathname.mockReturnValue("/profile-setup")
  })

  it("renders dashboard navigation on normal authenticated pages", () => {
    render(
      <DashboardShell>
        <div>Profile content</div>
      </DashboardShell>,
    )

    expect(screen.getByTestId("dashboard-sidebar")).toBeInTheDocument()
    expect(screen.getByText("Profile content")).toBeInTheDocument()
  })

  it("hides the global dashboard sidebar on resume comparison pages", () => {
    mockUsePathname.mockReturnValue("/dashboard/resumes/compare/session_123")

    render(
      <DashboardShell>
        <div>Resume comparison content</div>
      </DashboardShell>,
    )

    expect(screen.queryByTestId("dashboard-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Abrir menu" })).not.toBeInTheDocument()
    expect(screen.getByText("Resume comparison content")).toBeInTheDocument()
  })

  it("hides the global dashboard sidebar on the legacy singular resume comparison route", () => {
    mockUsePathname.mockReturnValue("/dashboard/resume/compare/session_ats")

    render(
      <DashboardShell>
        <div>ATS enhancement comparison content</div>
      </DashboardShell>,
    )

    expect(screen.queryByTestId("dashboard-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Abrir menu" })).not.toBeInTheDocument()
    expect(screen.getByText("ATS enhancement comparison content")).toBeInTheDocument()
  })
})
