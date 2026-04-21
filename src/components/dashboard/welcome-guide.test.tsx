import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardWelcomeGuide } from "./welcome-guide"
import {
  DASHBOARD_WELCOME_GUIDE_CHAT_PATH,
  DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
  DASHBOARD_WELCOME_GUIDE_SESSIONS_PATH,
  dashboardWelcomeGuideTargets,
  getDashboardGuideTargetProps,
} from "@/lib/dashboard/welcome-guide"

const mockReplace = vi.fn()
const mockOpen = vi.fn()
const mockOpenMobile = vi.fn()
const mockCloseMobile = vi.fn()
let mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH
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
  showProfile = true,
  showAtsCta = true,
  showSessions = true,
  showNewConversation = true,
}: {
  showProfile?: boolean
  showAtsCta?: boolean
  showSessions?: boolean
  showNewConversation?: boolean
}) {
  return (
    <DashboardWelcomeGuide>
      <div>
        {showProfile ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileNav)}>
            Perfil
          </button>
        ) : null}
        {showAtsCta ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileAtsCta)}>
            Melhorar para ATS
          </button>
        ) : null}
        {showSessions ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.sessionsNav)}>
            Sessões
          </button>
        ) : null}
        {showNewConversation ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.newConversation)}>
            Nova conversa
          </button>
        ) : null}
      </div>
    </DashboardWelcomeGuide>
  )
}

describe("DashboardWelcomeGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH
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

  it("redirects to Perfil before opening the first step when the user enters /dashboard", async () => {
    mockPathname = DASHBOARD_WELCOME_GUIDE_CHAT_PATH

    const { rerender } = render(<TestTargets showProfile={false} showAtsCta={false} showSessions={false} showNewConversation={false} />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_WELCOME_GUIDE_PROFILE_PATH)
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH
    rerender(<TestTargets />)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()
  })

  it("opens on Perfil and advances through ATS, sessões and nova conversa in the expected order", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TestTargets />)

    const initialDialog = await screen.findByRole("dialog")
    expect(within(initialDialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.profileNav,
    )

    await user.click(within(initialDialog).getByRole("button", { name: "Próximo" }))

    const secondDialog = await screen.findByRole("dialog")
    expect(within(secondDialog).getByRole("heading", { name: "Melhorar para ATS" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.profileAtsCta,
    )

    await user.click(within(secondDialog).getByRole("button", { name: "Próximo" }))
    mockPathname = DASHBOARD_WELCOME_GUIDE_SESSIONS_PATH
    rerender(<TestTargets />)

    const thirdDialog = await screen.findByRole("dialog")
    expect(within(thirdDialog).getByRole("heading", { name: "Suas sessões" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.sessionsNav,
    )

    await user.click(within(thirdDialog).getByRole("button", { name: "Próximo" }))
    mockPathname = DASHBOARD_WELCOME_GUIDE_CHAT_PATH
    rerender(<TestTargets />)

    const finalDialog = await screen.findByRole("dialog")
    expect(within(finalDialog).getByRole("heading", { name: "Nova conversa" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.newConversation,
    )
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
    expect(within(dialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()
    expect(mockOpen).toHaveBeenCalled()
  })
})
