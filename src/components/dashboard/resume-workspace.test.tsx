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
  }: {
    onCreditsExhausted?: () => void
  }) => (
    <button type="button" onClick={() => onCreditsExhausted?.()}>
      Trigger credits exhausted
    </button>
  ),
}))

vi.mock("./plan-update-dialog", () => ({
  PlanUpdateDialog: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="plan-update-dialog" data-open={String(isOpen)} />
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
})
