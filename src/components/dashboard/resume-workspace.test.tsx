import React from "react"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResumeWorkspace } from "./resume-workspace"

const {
  mockGetSessionWorkspace,
  mockListVersions,
  mockIsGeneratedOutputReady,
} = vi.hoisted(() => ({
  mockGetSessionWorkspace: vi.fn(),
  mockListVersions: vi.fn(),
  mockIsGeneratedOutputReady: vi.fn(),
}))

vi.mock("@/lib/dashboard/workspace-client", () => ({
  getSessionWorkspace: mockGetSessionWorkspace,
  listVersions: mockListVersions,
  isGeneratedOutputReady: mockIsGeneratedOutputReady,
  applyGapAction: vi.fn(),
  compareSnapshots: vi.fn(),
  createTarget: vi.fn(),
  generateResume: vi.fn(),
  getDownloadUrls: vi.fn(),
  manualEditBaseSection: vi.fn(),
}))

vi.mock("./chat-interface", () => ({
  ChatInterface: ({
    onCreditsExhausted,
    onSessionChange,
    onAgentTurnCompleted,
    currentCredits,
  }: {
    onCreditsExhausted?: () => void
    onSessionChange?: (sessionId: string) => void
    onAgentTurnCompleted?: (payload: {
      sessionId: string
      isNewSession: boolean
      phase: string
    }) => void
    currentCredits?: number
  }) => (
    <>
      <button type="button" onClick={() => onCreditsExhausted?.()}>
        Trigger credits exhausted
      </button>
      <button type="button" onClick={() => onSessionChange?.("sess_new_from_agent")}>
        Simulate new session
      </button>
      <button
        type="button"
        onClick={() => onAgentTurnCompleted?.({
          sessionId: "sess_new_from_agent",
          isNewSession: true,
          phase: "intake",
        })}
      >
        Simulate new session done
      </button>
      <div data-testid="chat-current-credits">{currentCredits ?? 0}</div>
    </>
  ),
}))

vi.mock("./plan-update-dialog", () => ({
  PlanUpdateDialog: ({ isOpen, currentCredits }: { isOpen: boolean; currentCredits: number }) => (
    <div
      data-testid="plan-update-dialog"
      data-open={String(isOpen)}
      data-credits={String(currentCredits)}
    />
  ),
}))

vi.mock("./compare-drawer", () => ({
  CompareDrawer: () => null,
}))

vi.mock("./manual-edit-dialog", () => ({
  ManualEditDialog: () => null,
}))

vi.mock("@/components/ats-score-badge", () => ({
  default: () => null,
}))

vi.mock("@/components/phase-badge", () => ({
  default: () => null,
}))

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}))

function buildWorkspace() {
  return {
    session: {
      phase: "intake",
      stateVersion: 1,
      generatedOutput: { status: "ready" },
      atsScore: null,
      agentState: {
        gapAnalysis: null,
      },
      cvState: {
        fullName: "Fabio Silva",
        email: "fabio@example.com",
        phone: "11999999999",
        linkedin: "linkedin.com/in/fabio",
        location: "Sao Paulo",
        summary: "Resumo",
        skills: [],
        experience: [],
        education: [],
        certifications: [],
      },
    },
    targets: [],
  }
}

describe("ResumeWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsGeneratedOutputReady.mockReturnValue(true)
    mockGetSessionWorkspace.mockResolvedValue(buildWorkspace())
    mockListVersions.mockResolvedValue([])
  })

  it("syncs sessionId to URL via replaceState when session changes", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState")

    render(<ResumeWorkspace initialSessionId={undefined} userName="Fabio" />)

    await userEvent.click(screen.getByRole("button", { name: /^simulate new session$/i }))

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalled()
    })

    const lastCall = replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1]
    const updatedUrl = lastCall[2] as string
    expect(updatedUrl).toContain("session=sess_new_from_agent")

    replaceStateSpy.mockRestore()
  })

  it("does not call replaceState when the URL already has the same session param", async () => {
    // Set the current URL to already include the session param (same origin)
    const base = new URL(window.location.href)
    base.searchParams.set("session", "sess_existing")
    window.history.replaceState({}, "", base.toString())

    const replaceStateSpy = vi.spyOn(window.history, "replaceState")

    render(<ResumeWorkspace initialSessionId="sess_existing" userName="Fabio" />)

    // Wait for initial effects to settle
    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_existing")
    })

    // replaceState should not have been called since URL already matches
    expect(replaceStateSpy).not.toHaveBeenCalled()

    replaceStateSpy.mockRestore()
    // Clean up URL
    const clean = new URL(window.location.href)
    clean.searchParams.delete("session")
    window.history.replaceState({}, "", clean.toString())
  })

  it("opens the plan update modal when the chat reports exhausted credits", async () => {
    render(<ResumeWorkspace initialSessionId="sess_123" userName="Fabio" />)

    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_123")
    })

    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "false")

    await userEvent.click(screen.getByRole("button", { name: /trigger credits exhausted/i }))

    await waitFor(() => {
      expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
    })
  })

  it("decrements local credits after the first completed turn of a new session", async () => {
    render(
      <ResumeWorkspace
        initialSessionId={undefined}
        userName="Fabio"
        currentCredits={1}
      />,
    )

    expect(screen.getByTestId("chat-current-credits")).toHaveTextContent("1")
    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-credits", "1")

    await userEvent.click(screen.getByRole("button", { name: /simulate new session done/i }))

    await waitFor(() => {
      expect(screen.getByTestId("chat-current-credits")).toHaveTextContent("0")
    })

    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-credits", "0")
  })
})
