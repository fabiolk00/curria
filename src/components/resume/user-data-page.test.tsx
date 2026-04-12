import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import UserDataPage from "./user-data-page"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("./resume-builder", () => ({
  ImportResumeModal: () => null,
}))

vi.mock("./visual-resume-editor", () => ({
  normalizeResumeData: (value?: unknown) => value ?? {
    fullName: "",
    email: "",
    phone: "",
    linkedin: "",
    location: "",
    summary: "",
    experience: [],
    skills: [],
    education: [],
    certifications: [],
  },
  VisualResumeEditor: () => <div data-testid="visual-resume-editor" />,
}))

describe("UserDataPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("disables the ATS enhancement button when the base profile is incomplete", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: {
          id: "profile_123",
          source: "manual",
          cvState: {
            fullName: "",
            email: "",
            phone: "",
            linkedin: "",
            location: "",
            summary: "",
            experience: [],
            skills: ["SQL"],
            education: [],
            certifications: [],
          },
          linkedinUrl: null,
          extractedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    })) as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await waitFor(() => {
      expect(screen.getByText("Melhorar para ATS (1 credito)")).toBeDisabled()
    })

    expect(screen.getByText("Complete seu curriculo para gerar uma versao ATS.")).toBeInTheDocument()
  })

  it("enables the ATS enhancement button when the base profile is ready", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: {
          id: "profile_123",
          source: "manual",
          cvState: {
            fullName: "Ana Silva",
            email: "ana@example.com",
            phone: "555-0100",
            linkedin: "https://linkedin.com/in/ana",
            location: "Sao Paulo",
            summary: "Analista de dados com foco em BI.",
            experience: [{
              title: "Analista de Dados",
              company: "Acme",
              location: "Sao Paulo",
              startDate: "2022",
              endDate: "2024",
              bullets: ["Criei dashboards executivos."],
            }],
            skills: ["SQL", "Power BI", "ETL", "Excel"],
            education: [],
            certifications: [],
          },
          linkedinUrl: null,
          extractedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    })) as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await waitFor(() => {
      expect(screen.getByText("Melhorar para ATS (1 credito)")).toBeEnabled()
    })

    expect(screen.getByText("Creditos disponiveis: 2")).toBeInTheDocument()
  })

  it("starts the ATS enhancement flow and redirects to the generated session", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: {
            id: "profile_123",
            source: "manual",
            cvState: {
              fullName: "Ana Silva",
              email: "ana@example.com",
              phone: "555-0100",
              linkedin: "https://linkedin.com/in/ana",
              location: "Sao Paulo",
              summary: "Analista de dados com foco em BI.",
              experience: [{
                title: "Analista de Dados",
                company: "Acme",
                location: "Sao Paulo",
                startDate: "2022",
                endDate: "2024",
                bullets: ["Criei dashboards executivos."],
              }],
              skills: ["SQL", "Power BI", "ETL", "Excel"],
              education: [],
              certifications: [],
            },
            linkedinUrl: null,
            extractedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: {
            id: "profile_123",
            source: "manual",
            cvState: {
              fullName: "Ana Silva",
              email: "ana@example.com",
              phone: "555-0100",
              linkedin: "https://linkedin.com/in/ana",
              location: "Sao Paulo",
              summary: "Analista de dados com foco em BI.",
              experience: [{
                title: "Analista de Dados",
                company: "Acme",
                location: "Sao Paulo",
                startDate: "2022",
                endDate: "2024",
                bullets: ["Criei dashboards executivos."],
              }],
              skills: ["SQL", "Power BI", "ETL", "Excel"],
              education: [],
              certifications: [],
            },
            linkedinUrl: null,
            extractedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: "sess_ats_123",
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    const button = await screen.findByText("Melhorar para ATS (1 credito)")
    await user.click(button)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard?session=sess_ats_123")
    })
  })
})
