import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardWelcomeGuide } from "./welcome-guide"
import {
  DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH,
  DASHBOARD_WELCOME_GUIDE_SETTINGS_PATH,
  DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
  DASHBOARD_WELCOME_GUIDE_RESUMES_PATH,
  dashboardWelcomeGuideTargets,
  getDashboardGuideTargetProps,
} from "@/lib/dashboard/welcome-guide"

const mockReplace = vi.fn()
const mockOpen = vi.fn()
const mockOpenMobile = vi.fn()
const mockCloseMobile = vi.fn()
let mockPathname = DASHBOARD_WELCOME_GUIDE_SETTINGS_PATH
let backendWelcomeGuideSeen = false

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/context/sidebar-context", () => ({
  useSidebarContext: () => ({
    open: mockOpen,
    openMobile: mockOpenMobile,
    closeMobile: mockCloseMobile,
  }),
}))

function TestTargets({
  showSettings = true,
  showProfile = true,
  showGenerateResume = true,
  showResumes = true,
}: {
  showSettings?: boolean
  showProfile?: boolean
  showGenerateResume?: boolean
  showResumes?: boolean
}) {
  return (
    <DashboardWelcomeGuide>
      <div>
        {showSettings ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.settingsNav)}>
            Configurações
          </button>
        ) : null}
        {showProfile ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileNav)}>
            Perfil
          </button>
        ) : null}
        {showGenerateResume ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.generateResumeNav)}>
            Gerar currículo
          </button>
        ) : null}
        {showResumes ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.resumesNav)}>
            Currículos
          </button>
        ) : null}
      </div>
    </DashboardWelcomeGuide>
  )
}

describe("DashboardWelcomeGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = DASHBOARD_WELCOME_GUIDE_SETTINGS_PATH
    backendWelcomeGuideSeen = false
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string" && input === "/api/profile" && (!init || !init.method || init.method === "GET")) {
        return new Response(JSON.stringify({
          profile: null,
          dashboardWelcomeGuideSeen: backendWelcomeGuideSeen,
        }), { status: 200 })
      }

      if (typeof input === "string" && input === "/api/profile" && init?.method === "PATCH") {
        backendWelcomeGuideSeen = true
        return new Response(JSON.stringify({
          dashboardWelcomeGuideSeen: true,
        }), { status: 200 })
      }

      throw new Error(`Unhandled fetch call: ${String(input)}`)
    }) as unknown as typeof fetch)
  })

  it("does not start the guide on the true chat route", async () => {
    mockPathname = "/chat"

    render(<TestTargets showProfile={false} showGenerateResume={false} showResumes={false} />)

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens on Settings and advances through profile, resumes and resume generation", async () => {
    const user = userEvent.setup()
    mockPathname = DASHBOARD_WELCOME_GUIDE_SETTINGS_PATH
    const { rerender } = render(<TestTargets />)

    const initialDialog = await screen.findByRole("dialog")
    expect(within(initialDialog).getByRole("heading", { name: "Configurações" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.settingsNav,
    )

    await user.click(within(initialDialog).getByRole("button", { name: /Pr/ }))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_WELCOME_GUIDE_PROFILE_PATH)
    })
    mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH
    rerender(<TestTargets />)

    const secondDialog = await screen.findByRole("dialog")
    expect(within(secondDialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.profileNav,
    )

    await user.click(within(secondDialog).getByRole("button", { name: /Pr/ }))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_WELCOME_GUIDE_RESUMES_PATH)
    })
    mockPathname = DASHBOARD_WELCOME_GUIDE_RESUMES_PATH
    rerender(<TestTargets />)

    const thirdDialog = await screen.findByRole("dialog")
    expect(within(thirdDialog).getByRole("heading", { name: "Histórico de currículos" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.resumesNav,
    )

    await user.click(within(thirdDialog).getByRole("button", { name: /Pr/ }))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH)
    })
    mockPathname = DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH
    rerender(<TestTargets />)

    const fourthDialog = await screen.findByRole("dialog")
    expect(within(fourthDialog).getByRole("heading", { name: "Gerar currículo" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.generateResumeNav,
    )
  })

  it("starts directly on the concrete generate resume step when that route is open", async () => {
    mockPathname = DASHBOARD_WELCOME_GUIDE_GENERATE_RESUME_PATH

    render(<TestTargets showProfile={false} showResumes={false} />)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Gerar currículo" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.generateResumeNav,
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("closes with Pular and persists the guide as seen", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<TestTargets />)

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Pular" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(backendWelcomeGuideSeen).toBe(true)

    unmount()
    render(<TestTargets />)

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("waits for the target to render before showing the guide", async () => {
    const { rerender } = render(<TestTargets showProfile={false} />)

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    rerender(<TestTargets />)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Configurações" })).toBeInTheDocument()
    expect(mockOpen).toHaveBeenCalled()
  })
})
