import React from "react"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PreviewPanelProvider } from "@/context/preview-panel-context"
import { NEW_CONVERSATION_EVENT } from "./events"
import { ResumeWorkspace } from "./resume-workspace"

const {
  mockGetSessionWorkspace,
  mockIsGeneratedOutputReady,
} = vi.hoisted(() => ({
  mockGetSessionWorkspace: vi.fn(),
  mockIsGeneratedOutputReady: vi.fn(),
}))

vi.mock("@/lib/dashboard/workspace-client", () => ({
  getSessionWorkspace: mockGetSessionWorkspace,
  isGeneratedOutputReady: mockIsGeneratedOutputReady,
  generateResume: vi.fn(),
  getDownloadUrls: vi.fn().mockResolvedValue({ docxUrl: null, pdfUrl: null }),
  manualEditBaseSection: vi.fn(),
}))

vi.mock("./chat-interface", () => ({
  ChatInterface: ({
    onCreditsExhausted,
    onSessionChange,
    onAgentTurnCompleted,
    currentCredits,
    sessionId,
  }: {
    onCreditsExhausted?: () => void
    onSessionChange?: (sessionId: string) => void
    onAgentTurnCompleted?: (payload: {
      sessionId: string
      isNewSession: boolean
      phase: string
    }) => void
    currentCredits?: number
    sessionId?: string
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
      <div data-testid="chat-session-id">{sessionId ?? "none"}</div>
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

function renderWorkspace(ui: React.ReactElement) {
  return render(
    <PreviewPanelProvider>
      {ui}
    </PreviewPanelProvider>,
  )
}

describe("ResumeWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsGeneratedOutputReady.mockReturnValue(true)
    mockGetSessionWorkspace.mockResolvedValue(buildWorkspace())
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("syncs sessionId to URL via replaceState when session changes", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState")

    renderWorkspace(<ResumeWorkspace initialSessionId={undefined} userName="Fabio" />)

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

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_existing" userName="Fabio" />)

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
    renderWorkspace(<ResumeWorkspace initialSessionId="sess_123" userName="Fabio" />)

    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_123")
    })

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "sess_123")
    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-target-count", "0")
    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-base-output-ready", "true")

    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "false")

    await userEvent.click(screen.getByRole("button", { name: /trigger credits exhausted/i }))

    await waitFor(() => {
      expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
    })
  })

  it("keeps local credits unchanged after creating a free new session", async () => {
    renderWorkspace(
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
      expect(screen.getByTestId("chat-current-credits")).toHaveTextContent("1")
    })

    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-credits", "1")
  })

  it("clears the active session immediately when a new conversation starts", async () => {
    renderWorkspace(<ResumeWorkspace initialSessionId="sess_existing" userName="Fabio" />)

    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_existing")
      expect(screen.getByTestId("chat-session-id")).toHaveTextContent("sess_existing")
    })

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "sess_existing")

    act(() => {
      window.dispatchEvent(new Event(NEW_CONVERSATION_EVENT))
    })

    await waitFor(() => {
      expect(screen.getByTestId("chat-session-id")).toHaveTextContent("none")
    })

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "")
  })
})
