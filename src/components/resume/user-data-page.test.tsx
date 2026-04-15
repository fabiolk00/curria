import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

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

    await screen.findByText("Perfil ainda não salvo")

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

    const atsButton = await screen.findByText("Melhorar para ATS (1 crédito)")
    expect(atsButton).toBeEnabled()
    expect(screen.getByText("Complete seu currículo para gerar uma versão ATS.")).toBeInTheDocument()

    await user.click(atsButton)

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Dados pessoais: adicione seu nome completo.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "• Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("• Experiência: inclua pelo menos uma experiência profissional.")).toBeInTheDocument()
    expect(screen.getByText("• Educação: adicione pelo menos uma formação acadêmica.")).toBeInTheDocument()
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
      expect(screen.getByText("Melhorar para ATS (1 crédito)")).toBeEnabled()
    })

    expect(screen.getByText("Créditos disponíveis")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("opens the generated comparison before following to the dashboard session", async () => {
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
          generationType: "ATS_ENHANCEMENT",
          originalCvState: {
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
          optimizedCvState: {
            fullName: "Ana Silva",
            email: "ana@example.com",
            phone: "555-0100",
            linkedin: "https://linkedin.com/in/ana",
            location: "Sao Paulo",
            summary: "Analista de dados com foco em BI, ETL e dashboards orientados a resultado.",
            experience: [{
              title: "Analista de Dados",
              company: "Acme",
              location: "Sao Paulo",
              startDate: "2022",
              endDate: "2024",
              bullets: ["Criei dashboards executivos com foco em indicadores prioritários."],
            }],
            skills: ["SQL", "Power BI", "ETL", "Dashboards"],
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
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    const button = await screen.findByText("Melhorar para ATS (1 crédito)")
    await user.click(button)

    expect(await screen.findByTestId("resume-comparison-view")).toBeInTheDocument()
    expect(screen.getByText("Confira a versão otimizada para ATS")).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Seguir com esta versão ATS" }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard?session=sess_ats_123")
    })
    expect(fetchMock).toHaveBeenLastCalledWith("/api/profile/smart-generation", expect.objectContaining({
      method: "POST",
    }))
  })

  it("shows the comparison screen for job targeting before continuing to the dashboard", async () => {
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
          sessionId: "sess_target_123",
          generationType: "JOB_TARGETING",
          originalCvState: {
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
          optimizedCvState: {
            fullName: "Ana Silva",
            email: "ana@example.com",
            phone: "555-0100",
            linkedin: "https://linkedin.com/in/ana",
            location: "Sao Paulo",
            summary: "Analista de dados sênior com foco em produto, SQL e indicadores para a vaga alvo.",
            experience: [{
              title: "Analista de Dados",
              company: "Acme",
              location: "Sao Paulo",
              startDate: "2022",
              endDate: "2024",
              bullets: ["Criei dashboards executivos com foco em produto e acompanhamento de KPIs."],
            }],
            skills: ["SQL", "Power BI", "Produto", "KPIs"],
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
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    fireEvent.change(await screen.findByTestId("target-job-description-input"), {
      target: { value: "Vaga para analista de dados senior com foco em produto e SQL." },
    })

    expect(screen.getByText("Adaptar meu currículo para esta vaga")).toBeInTheDocument()
    expect(screen.getByText("Adaptar para vaga (1 crédito)")).toBeInTheDocument()

    await user.click(screen.getByText("Adaptar para vaga (1 crédito)"))

    expect(await screen.findByTestId("resume-comparison-view")).toBeInTheDocument()
    expect(screen.getByText("Confira a versão adaptada para a vaga")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Seguir com esta versão para a vaga" }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard?session=sess_target_123")
    })

    expect(fetchMock).toHaveBeenLastCalledWith("/api/profile/smart-generation", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"targetJobDescription\":\"Vaga para analista de dados senior com foco em produto e SQL.\""),
    }))
  })

  it("returns to ATS mode when the target job description is cleared", async () => {
    const user = userEvent.setup()
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

    const input = await screen.findByTestId("target-job-description-input")
    fireEvent.change(input, { target: { value: "Vaga para analista." } })

    expect(screen.getByText("Adaptar meu currículo para esta vaga")).toBeInTheDocument()

    await user.clear(input)

    expect(screen.getByText("Melhorar meu currículo para ATS")).toBeInTheDocument()
    expect(screen.getByText("Melhorar para ATS (1 crédito)")).toBeInTheDocument()
  })

  it("shows a readable message when the smart-generation route returns a schema error object", async () => {
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
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            fieldErrors: {
              targetJobDescription: ["Descricao da vaga muito longa."],
            },
          },
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    fireEvent.change(await screen.findByTestId("target-job-description-input"), {
      target: { value: "Vaga para analista de dados senior com foco em produto e SQL." },
    })
    await user.click(screen.getByText("Adaptar para vaga (1 crédito)"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Descricao da vaga muito longa.")
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

    await user.click(await screen.findByText("Melhorar para ATS (1 crédito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Formação 1: adicione a instituição.")).toBeInTheDocument()
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

    await user.click(await screen.findByText("Melhorar para ATS (1 crédito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Experiência 1: adicione o cargo.")).toBeInTheDocument()
    expect(screen.getByText("• Experiência 1: adicione a empresa.")).toBeInTheDocument()
    expect(screen.getByText("• Experiência 1: adicione pelo menos um resultado ou responsabilidade.")).toBeInTheDocument()
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

    await user.click(await screen.findByText("Melhorar para ATS (1 crédito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(
      screen.getByText(
        "• Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("• Educação: adicione pelo menos uma formação acadêmica.")).toBeInTheDocument()
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
          error: "Complete seu currículo para gerar uma versão ATS.",
          missingItems: ["Experiência 1: adicione pelo menos um resultado ou responsabilidade."],
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByText("Melhorar para ATS (1 crédito)"))

    expect(screen.getByText("Complete seu perfil antes de melhorar para ATS")).toBeInTheDocument()
    expect(screen.getByText("• Experiência 1: adicione pelo menos um resultado ou responsabilidade.")).toBeInTheDocument()
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

    expect(screen.getByText("Base salva a partir de currículo importado")).toBeInTheDocument()
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

    expect(await screen.findByText("Melhorar meu currículo para ATS")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Usa o seu perfil base para gerar uma versão ATS em pt-BR seguindo o modelo padrão da plataforma: estrutura linear, sem elementos que atrapalham parsing, linguagem objetiva e foco em verdade, matching e clareza.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Construção e leitura estruturada do currículo")).toBeInTheDocument()
    expect(screen.getByText("Score ATS geral, clareza e legibilidade do currículo.")).toBeInTheDocument()
    expect(screen.getByText("Reescrita estratégica de resumo e bullets.")).toBeInTheDocument()
    expect(screen.getByText("Template ATS em PDF textual, simples e objetivo.")).toBeInTheDocument()
    expect(screen.getByTestId("ats-panel-badge")).toHaveClass("bg-foreground", "text-background")
    expect(screen.getByTestId("ats-feature-analysis")).toHaveClass("border-emerald-500/50", "bg-emerald-50")
    expect(screen.getByTestId("ats-panel-cta")).toHaveClass("bg-emerald-600", "text-white")
    expect(screen.getByText("Melhorar para ATS (1 crédito)")).toBeInTheDocument()
    expect(screen.getByTestId("target-job-description-input")).toBeInTheDocument()
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
    const educationHeading = screen.getByText("Educação")
    const certificationsHeading = screen.getByText("Certificações")

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

    expect(await screen.findByText("Educação")).toBeInTheDocument()
    expect(screen.getByText("Bacharel em Sistemas de Informacao")).toBeInTheDocument()
    expect(screen.getByText("USP - 2023")).toBeInTheDocument()
    expect(screen.getByText("• AWS Cloud Practitioner")).toBeInTheDocument()
  })
})
