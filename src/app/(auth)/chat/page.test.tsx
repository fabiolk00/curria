import React from "react"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import ChatPage, { dynamic, revalidate } from "./page"

const mockCurrentUser = vi.fn().mockResolvedValue({
  fullName: "Fabio Kroker",
  firstName: "Fabio",
  username: "fabiok",
})
const mockGetCurrentAppUser = vi.fn().mockResolvedValue(null)
const mockGetAiChatAccess = vi.fn().mockResolvedValue({
  allowed: false,
  title: "Chat com IA exclusivo do plano PRO",
  message: "Upgrade required",
  code: "PRO_PLAN_REQUIRED",
})

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => mockCurrentUser(),
}))

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: () => mockGetCurrentAppUser(),
}))

vi.mock("@/lib/billing/ai-chat-access.server", () => ({
  getAiChatAccess: (appUserId: string) => mockGetAiChatAccess(appUserId),
}))

vi.mock("@/lib/auth/e2e-auth", () => ({
  isE2EAuthEnabled: vi.fn(() => false),
}))

vi.mock("@/components/dashboard/resume-workspace", () => ({
  ResumeWorkspace: ({
    canAccessAiChat,
    initialSessionId,
    userName,
    activeRecurringPlan,
    currentCredits,
    aiChatAccessTitle,
    aiChatAccessMessage,
    aiChatUpgradeUrl,
  }: {
    canAccessAiChat?: boolean
    initialSessionId?: string
    userName?: string
    activeRecurringPlan?: string | null
    currentCredits?: number
    aiChatAccessTitle?: string
    aiChatAccessMessage?: string
    aiChatUpgradeUrl?: string
  }) => (
    <div
      data-testid="resume-workspace"
      data-can-access-ai-chat={String(canAccessAiChat ?? false)}
      data-session-id={initialSessionId ?? ""}
      data-user-name={userName ?? ""}
      data-plan={activeRecurringPlan ?? ""}
      data-credits={currentCredits ?? 0}
      data-chat-title={aiChatAccessTitle ?? ""}
      data-chat-message={aiChatAccessMessage ?? ""}
      data-chat-upgrade-url={aiChatUpgradeUrl ?? ""}
    />
  ),
}))

describe("ChatPage", () => {
  it("exports the chat page as force-dynamic with no revalidation", () => {
    expect(dynamic).toBe("force-dynamic")
    expect(revalidate).toBe(0)
  })

  it("renders safely without a session query param", async () => {
    mockGetCurrentAppUser.mockResolvedValueOnce(null)
    const jsx = await ChatPage({})
    render(jsx)

    const workspace = screen.getByTestId("resume-workspace")
    expect(workspace).toHaveAttribute("data-can-access-ai-chat", "false")
    expect(workspace).toHaveAttribute("data-session-id", "")
    expect(workspace).toHaveAttribute("data-user-name", "Fabio")
    expect(workspace).toHaveAttribute("data-credits", "0")
  })

  it("keeps /chat behind the AI chat gate for blocked paid users", async () => {
    mockGetCurrentAppUser.mockResolvedValueOnce({
      id: "usr_123",
      creditAccount: {
        id: "cred_123",
        userId: "usr_123",
        creditsRemaining: 7,
      },
    })
    mockGetAiChatAccess.mockResolvedValueOnce({
      allowed: false,
      plan: "monthly",
      status: "active",
      asaasSubscriptionId: "sub_monthly_123",
      title: "Chat com IA exclusivo do plano PRO",
      message: "Upgrade required",
      code: "PRO_PLAN_REQUIRED",
      upgradeUrl: "/finalizar-compra?plan=pro",
    })

    const jsx = await ChatPage({})
    render(jsx)

    const workspace = screen.getByTestId("resume-workspace")
    expect(mockGetAiChatAccess).toHaveBeenCalledWith("usr_123")
    expect(workspace).toHaveAttribute("data-can-access-ai-chat", "false")
    expect(workspace).toHaveAttribute("data-plan", "monthly")
    expect(workspace).toHaveAttribute("data-credits", "7")
    expect(workspace).toHaveAttribute("data-chat-title", "Chat com IA exclusivo do plano PRO")
    expect(workspace).toHaveAttribute("data-chat-message", "Upgrade required")
    expect(workspace).toHaveAttribute("data-chat-upgrade-url", "/finalizar-compra?plan=pro")
  })

  it("passes through a valid-looking session id without server-side resolution", async () => {
    const jsx = await ChatPage({
      searchParams: {
        session: "sess_valid_123",
      },
    })
    render(jsx)

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "sess_valid_123")
  })

  it("does not crash on an invalid-looking session id", async () => {
    const jsx = await ChatPage({
      searchParams: {
        session: "not-a-real-session",
      },
    })
    render(jsx)

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "not-a-real-session")
  })

  it("normalizes repeated session params to the first value", async () => {
    const jsx = await ChatPage({
      searchParams: {
        session: ["sess_first", "sess_second"],
      },
    })
    render(jsx)

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "sess_first")
  })

  it("keeps AI chat entitlement references on the normalized true-chat allowlist", () => {
    const allowed = [
      "src/app/(auth)/chat/page.tsx",
      "src/lib/agent/request-orchestrator.ts",
      "src/app/api/session/[id]/messages/route.ts",
      "src/app/api/session/[id]/ai-chat-snapshot/route.ts",
      "src/lib/billing/ai-chat-access.ts",
      "src/lib/billing/ai-chat-access.server.ts",
    ]

    const output = execFileSync("rg", [
      "-n",
      "getAiChatAccess|AiChatAccessCard",
      "src/app",
      "src/components",
      "src/lib",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ], {
      encoding: "utf8",
    })
    const hits = output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.replace(/\\/g, "/"))
    const unexpected = hits.filter((line) => !allowed.some((path) => line.startsWith(`${path}:`)))

    expect(unexpected).toEqual([])
    for (const path of allowed.slice(0, 4)) {
      expect(readFileSync(path, "utf8")).toMatch(/getAiChatAccess|AiChatAccessCard/)
    }
  })
})
