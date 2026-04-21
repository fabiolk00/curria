import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardWelcomeGuide } from "./welcome-guide"
import {
  DASHBOARD_WELCOME_GUIDE_PROFILE_PATH,
  DASHBOARD_WELCOME_GUIDE_STORAGE_KEY,
  dashboardWelcomeGuideTargets,
  getDashboardGuideTargetProps,
} from "@/lib/dashboard/welcome-guide"

const mockReplace = vi.fn()
const mockOpen = vi.fn()
const mockOpenMobile = vi.fn()
const mockCloseMobile = vi.fn()
let mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH

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
  showNewConversation = true,
  showAtsCta = true,
}: {
  showProfile?: boolean
  showNewConversation?: boolean
  showAtsCta?: boolean
}) {
  return (
    <DashboardWelcomeGuide>
      <div>
        {showProfile ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileNav)}>
            Perfil
          </button>
        ) : null}
        {showNewConversation ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.newConversation)}>
            Nova conversa
          </button>
        ) : null}
        {showAtsCta ? (
          <button type="button" {...getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileAtsCta)}>
            Melhorar para ATS
          </button>
        ) : null}
      </div>
    </DashboardWelcomeGuide>
  )
}

describe("DashboardWelcomeGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    })
  })

  it("redirects to Perfil before opening the first step when the user enters /dashboard", async () => {
    mockPathname = "/dashboard"

    const { rerender } = render(<TestTargets showProfile={false} showNewConversation={false} showAtsCta={false} />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_WELCOME_GUIDE_PROFILE_PATH)
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    mockPathname = DASHBOARD_WELCOME_GUIDE_PROFILE_PATH
    rerender(<TestTargets />)

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()
  })

  it("opens on Perfil and advances through Nova conversa in the expected order", async () => {
    const user = userEvent.setup()
    render(<TestTargets />)

    const initialDialog = await screen.findByRole("dialog")
    expect(within(initialDialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.profileNav,
    )

    await user.click(within(initialDialog).getByRole("button", { name: "Próximo" }))

    const secondDialog = await screen.findByRole("dialog")
    expect(within(secondDialog).getByRole("heading", { name: "Nova conversa" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.newConversation,
    )

    await user.click(within(secondDialog).getByRole("button", { name: "Próximo" }))

    const finalDialog = await screen.findByRole("dialog")
    expect(within(finalDialog).getByRole("heading", { name: "Próximo passo recomendado" })).toBeInTheDocument()
    expect(screen.getByTestId("dashboard-welcome-guide-spotlight")).toHaveAttribute(
      "data-target-id",
      dashboardWelcomeGuideTargets.profileAtsCta,
    )
  })

  it("closes with Pular and persists the guide as seen", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<TestTargets />)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Seu perfil" })).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Pular" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(DASHBOARD_WELCOME_GUIDE_STORAGE_KEY)).toBe("seen")

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
