import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import UserDataPage from "./user-data-page"

const mockPush = vi.fn()
let mockPathname = "/dashboard/resume/new"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("./resume-builder", () => ({
  ImportResumeModal: ({ onImportSuccess }: { onImportSuccess: (data: unknown, profilePhotoUrl?: string | null, source?: string | null) => void }) => (
    <button
      type="button"
      onClick={() => onImportSuccess({
        fullName: "Ana Silva",
        email: "ana@example.com",
        phone: "555-0100",
        summary: "Imported summary",
        experience: [],
        skills: [],
        education: [],
      }, null, "pdf")}
    >
      mock-import
    </button>
  ),
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
    mockPathname = "/dashboard/resume/new"
  })

  it("loads the saved profile with a no-store fetch to avoid stale setup data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: null,
      }),
    }))

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await screen.findByText("Perfil ainda nao salvo")

    expect(fetchMock).toHaveBeenCalledWith("/api/profile", expect.objectContaining({
      credentials: "include",
      cache: "no-store",
    }))
  })

  it("opens a friendly modal when the base profile is incomplete for ATS", async () => {
    const user = userEvent.setup()
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

    const atsButton = await screen.findByText("Melhorar para ATS (1 credito)")
    expect(atsButton).toBeEnabled()
    expect(screen.getByText("Complete seu curriculo para gerar uma versao ATS.")).toBeInTheDocument()

    await user.click(atsButton)

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Dados pessoais: adicione seu nome completo.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "• Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("• Experiencia: inclua pelo menos uma experiencia profissional.")).toBeInTheDocument()
    expect(screen.getByText("• Educacao: adicione pelo menos uma formacao academica.")).toBeInTheDocument()
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
            education: [{
              degree: "Bacharel em Sistemas de Informacao",
              institution: "USP",
              year: "2020",
            }],
            certifications: [{
              name: "AWS Cloud Practitioner",
              issuer: "Amazon",
              year: "2024",
            }],
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

    expect(screen.getByText("Creditos disponiveis")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
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
              education: [{
                degree: "Bacharel em Sistemas de Informacao",
                institution: "USP",
                year: "2020",
              }],
              certifications: [{
                name: "AWS Cloud Practitioner",
                issuer: "Amazon",
                year: "2024",
              }],
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
              education: [{
                degree: "Bacharel em Sistemas de Informacao",
                institution: "USP",
                year: "2020",
              }],
              certifications: [{
                name: "AWS Cloud Practitioner",
                issuer: "Amazon",
                year: "2024",
              }],
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

  it("shows a friendly ATS modal when a deeper validation item is still missing", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => ({
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
            education: [{
              degree: "Bacharel em Sistemas de Informacao",
              institution: "",
              year: "2023",
            }],
            certifications: [{
              name: "AWS Cloud Practitioner",
              issuer: "Amazon",
              year: "2024",
            }],
          },
          linkedinUrl: null,
          extractedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    }))

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByText("Melhorar para ATS (1 credito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Formacao 1: adicione a instituicao.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("shows a friendly ATS modal for partially filled experience rows before starting ATS", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => ({
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
              title: "",
              company: "",
              location: "",
              startDate: "2022",
              endDate: "2024",
              bullets: [],
            }],
            skills: ["SQL", "Power BI", "ETL", "Excel"],
            education: [{
              degree: "Bacharel em Sistemas de Informacao",
              institution: "USP",
              year: "2020",
            }],
            certifications: [{
              name: "AWS Cloud Practitioner",
              issuer: "Amazon",
              year: "2024",
            }],
          },
          linkedinUrl: null,
          extractedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    }))

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByText("Melhorar para ATS (1 credito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Experiencia 1: adicione o cargo.")).toBeInTheDocument()
    expect(screen.getByText("• Experiencia 1: adicione a empresa.")).toBeInTheDocument()
    expect(screen.getByText("• Experiencia 1: adicione pelo menos um resultado ou responsabilidade.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("shows a friendly ATS modal when required ATS sections are still empty", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => ({
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
            summary: "",
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
    }))

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByText("Melhorar para ATS (1 credito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(
      screen.getByText(
        "• Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("• Educacao: adicione pelo menos uma formacao academica.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("shows the ATS modal when the server returns missing items after validation", async () => {
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
              education: [{
                degree: "Bacharel em Sistemas de Informacao",
                institution: "USP",
                year: "2020",
              }],
              certifications: [{
                name: "AWS Cloud Practitioner",
                issuer: "Amazon",
                year: "2024",
              }],
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
              education: [{
                degree: "Bacharel em Sistemas de Informacao",
                institution: "USP",
                year: "2020",
              }],
              certifications: [{
                name: "AWS Cloud Practitioner",
                issuer: "Amazon",
                year: "2024",
              }],
            },
            linkedinUrl: null,
            profilePhotoUrl: null,
            extractedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Complete seu curriculo para gerar uma versao ATS.",
          missingItems: ["Experiencia 1: adicione pelo menos um resultado ou responsabilidade."],
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByText("Melhorar para ATS (1 credito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Experiencia 1: adicione pelo menos um resultado ou responsabilidade.")).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("updates the source badge when a PDF import succeeds", async () => {
    const user = userEvent.setup()

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: null,
      }),
    })) as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByText("mock-import"))

    expect(screen.getByText("Base salva a partir de curriculo importado")).toBeInTheDocument()
  })

  it("renders cancelar and salvar below the editor and keeps salvar black", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: null,
      }),
    })) as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    const editor = await screen.findByTestId("visual-resume-editor")
    const cancelarButton = screen.getByRole("button", { name: "Cancelar" })
    const salvarButton = screen.getByTestId("profile-save-button")

    expect(
      editor.compareDocumentPosition(cancelarButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      cancelarButton.compareDocumentPosition(salvarButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(salvarButton).toHaveClass("bg-black", "text-white")
  })

  it("keeps the current setup route after saving without forcing a same-route push", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: null,
        }),
      })
      .mockResolvedValueOnce({
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
              skills: [],
              education: [],
              certifications: [],
            },
            linkedinUrl: null,
            profilePhotoUrl: null,
            extractedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByTestId("profile-save-button"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it("redirects to /dashboard/resume/new after saving when opened from another route", async () => {
    const user = userEvent.setup()
    mockPathname = "/dashboard"

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: null,
        }),
      })
      .mockResolvedValueOnce({
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
              skills: [],
              education: [],
              certifications: [],
            },
            linkedinUrl: null,
            profilePhotoUrl: null,
            extractedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByTestId("profile-save-button"))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/new")
    })
  })

  it("locks the ATS card process copy on the setup page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: null,
      }),
    })) as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    expect(await screen.findByText("Melhorar meu curriculo para ATS")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Usa o seu perfil base para gerar uma versao ATS em pt-BR seguindo o modelo padrao da plataforma: estrutura linear, sem elementos que atrapalham parsing, linguagem objetiva e foco em verdade, matching e clareza.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("parse e leitura estruturada do curriculo")).toBeInTheDocument()
    expect(screen.getByText("keyword matching e gap analysis quando houver vaga")).toBeInTheDocument()
    expect(screen.getByText("reescrita estrategica de resumo e bullets")).toBeInTheDocument()
    expect(screen.getByText("template ATS em PDF textual, simples e pt-BR")).toBeInTheDocument()
    expect(screen.getByTestId("ats-panel-badge")).toHaveClass("bg-foreground", "text-background")
    expect(screen.getByTestId("ats-feature-analysis")).toHaveClass("border-emerald-500/50", "bg-emerald-50")
    expect(screen.getByTestId("ats-panel-cta")).toHaveClass("bg-emerald-600", "text-white")
    expect(screen.getByText("Melhorar para ATS (1 credito)")).toBeInTheDocument()
  })

  it("renders the base preview sections in the requested order", async () => {
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
            linkedin: "",
            location: "Sao Paulo",
            summary: "Analista de dados com foco em BI.",
            experience: [],
            skills: ["SQL"],
            education: [
              {
                degree: "Bacharel em Sistemas de Informacao",
                institution: "USP",
                year: "2023",
              },
            ],
            certifications: [
              {
                name: "AWS Cloud Practitioner",
                issuer: "Amazon",
                year: "2024",
              },
            ],
          },
          linkedinUrl: null,
          extractedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    })) as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    const personalHeading = await screen.findByText("Dados pessoais")
    const summaryHeading = screen.getByText("Resumo")
    const skillsHeading = screen.getAllByText("Skills").find((element) => element.tagName === "H4")
    const experienceHeading = screen.getByText("Experiencia")
    const educationHeading = screen.getByText("Educacao")
    const certificationsHeading = screen.getByText("Certificacoes")

    if (!skillsHeading) {
      throw new Error("Expected preview Skills heading to be rendered as an H4 element.")
    }

    expect(
      personalHeading.compareDocumentPosition(summaryHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      summaryHeading.compareDocumentPosition(skillsHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      skillsHeading.compareDocumentPosition(experienceHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      experienceHeading.compareDocumentPosition(educationHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      educationHeading.compareDocumentPosition(certificationsHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(await screen.findByText("Educacao")).toBeInTheDocument()
    expect(screen.getByText("Bacharel em Sistemas de Informacao")).toBeInTheDocument()
    expect(screen.getByText("USP - 2023")).toBeInTheDocument()
    expect(screen.getByText("• AWS Cloud Practitioner")).toBeInTheDocument()
  })
})
