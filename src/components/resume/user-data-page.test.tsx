import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import UserDataPage from "./user-data-page"

const mockPush = vi.fn()
const mockGetDownloadUrls = vi.fn()
const mockGetBillingSummary = vi.fn()
const mockOverrideJobTargetingValidation = vi.fn()
const mockTrackAnalyticsEvent = vi.fn()
const mockAnchorClick = vi.fn()
const mockCreateObjectURL = vi.fn(() => "blob:curria-test")
const mockRevokeObjectURL = vi.fn()

let mockPathname = "/profile-setup"

type MockResumeData = {
  fullName: string
  email: string
  phone: string
  linkedin?: string
  location?: string
  summary: string
  experience: Array<{
    title: string
    company: string
    location?: string
    startDate: string
    endDate: string
    bullets: string[]
  }>
  skills: string[]
  education: Array<{
    degree: string
    institution: string
    year: string
    gpa?: string
  }>
  certifications?: Array<{
    name: string
    issuer: string
    year?: string
  }>
}

const baseResumeData: MockResumeData = {
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
}

function buildResumeData(overrides: Partial<MockResumeData> = {}): MockResumeData {
  return {
    ...baseResumeData,
    ...overrides,
  }
}

function buildProfileResponse(cvState: MockResumeData | null = baseResumeData, source = "manual") {
  return {
    profile: cvState
      ? {
          id: "profile_123",
          source,
          cvState,
          linkedinUrl: cvState.linkedin ?? null,
          profilePhotoUrl: null,
          extractedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : null,
  }
}

function createJsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const status = init.status ?? (init.ok === false ? 500 : 200)

  return {
    ok: init.ok ?? status < 400,
    status,
    json: async () => body,
  }
}

function createBlobResponse() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(["%PDF-1.4 CurrIA"], { type: "application/pdf" }),
    json: async () => ({}),
  }
}

function encodeUtf8AsMojibake(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join("")
}

function buildFetchMock(...responses: Array<ReturnType<typeof createJsonResponse> | ReturnType<typeof createBlobResponse>>) {
  const fetchMock = vi.fn()

  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response)
  })

  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)
  return fetchMock
}

async function openEnhancementMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Melhorar curr/i }))
}

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
    info: vi.fn(),
  },
}))

vi.mock("@/lib/dashboard/welcome-guide", () => ({
  dashboardWelcomeGuideTargets: {
    profileAtsCta: "profile-ats-cta",
  },
  getDashboardGuideTargetProps: () => ({}),
}))

vi.mock("@/lib/dashboard/workspace-client", () => ({
  getBillingSummary: (...args: unknown[]) => mockGetBillingSummary(...args),
  getDownloadUrls: (...args: unknown[]) => mockGetDownloadUrls(...args),
  overrideJobTargetingValidation: (...args: unknown[]) => mockOverrideJobTargetingValidation(...args),
  isInsufficientCreditsError: (error: unknown) => {
    return Boolean(
      error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "INSUFFICIENT_CREDITS",
    )
  },
}))

vi.mock("@/lib/dashboard/validation-override-cta", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dashboard/validation-override-cta")>(
    "@/lib/dashboard/validation-override-cta",
  )

  return actual
})

vi.mock("@/components/analytics/track-event", () => ({
  trackAnalyticsEvent: (...args: unknown[]) => mockTrackAnalyticsEvent(...args),
}))

vi.mock("@/components/dashboard/plan-update-dialog", () => ({
  PlanUpdateDialog: ({
    isOpen,
    currentCredits,
  }: {
    isOpen: boolean
    currentCredits: number
  }) => (
    <div
      data-testid="plan-update-dialog"
      data-open={String(isOpen)}
      data-credits={String(currentCredits)}
    />
  ),
}))

vi.mock("./generation-loading", () => ({
  GenerationLoading: ({
    isLoading,
    generationType,
  }: {
    isLoading: boolean
    generationType: string
  }) => (
    isLoading
      ? <div data-testid="generation-loading">{generationType}</div>
      : null
  ),
}))

vi.mock("./resume-builder", () => ({
  ImportResumeModal: ({
    isOpen,
    onClose,
    onImportStarted,
    onImportSuccess,
  }: {
    isOpen: boolean
    onClose: () => void
    onImportStarted?: (source: "linkedin" | "pdf") => void
    onImportSuccess: (data: MockResumeData, profilePhotoUrl?: string | null, source?: string | null) => void
  }) => (
    isOpen ? (
      <div role="dialog" aria-label="Importar perfil profissional">
        <p>Importar perfil profissional</p>
        <button type="button" onClick={() => onImportStarted?.("linkedin")}>
          mock-import-start
        </button>
        <button
          type="button"
          onClick={() => onImportSuccess(buildResumeData({
            fullName: "Bruna Costa",
            email: "bruna@example.com",
            phone: "555-0200",
            linkedin: "https://linkedin.com/in/bruna",
            location: "Recife",
            summary: "Product designer com foco em ATS.",
            experience: [],
            skills: ["Figma", "UX Writing", "Design Systems"],
            education: [],
            certifications: [],
          }), null, "pdf")}
        >
          mock-import-success
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    ) : null
  ),
}))

vi.mock("./visual-resume-editor", () => ({
  normalizeResumeData: (value?: Partial<MockResumeData>) => ({
    fullName: value?.fullName ?? "",
    email: value?.email ?? "",
    phone: value?.phone ?? "",
    linkedin: value?.linkedin ?? "",
    location: value?.location ?? "",
    summary: value?.summary ?? "",
    experience: value?.experience ?? [],
    skills: value?.skills ?? [],
    education: value?.education ?? [],
    certifications: value?.certifications ?? [],
  }),
  VisualResumeEditor: ({
    value,
    onChange,
    importProgressSource,
  }: {
    value: MockResumeData
    onChange: (next: MockResumeData) => void
    importProgressSource?: string | null
  }) => {
    const experience = value.experience[0] ?? {
      title: "",
      company: "",
      location: "",
      startDate: "",
      endDate: "",
      bullets: [],
    }
    const education = value.education[0] ?? {
      degree: "",
      institution: "",
      year: "",
      gpa: "",
    }
    const certification = value.certifications?.[0] ?? {
      name: "",
      issuer: "",
      year: "",
    }

    return (
      <div
        data-testid="visual-resume-editor"
        data-import-source={importProgressSource ?? "idle"}
      >
        <button type="button" aria-expanded="true">Dados pessoais</button>
        <input
          placeholder="Nome completo"
          value={value.fullName}
          onChange={(event) => onChange({ ...value, fullName: event.target.value })}
        />
        <input
          placeholder="Email"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
        />
        <input
          placeholder="Telefone"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
        />
        <input
          placeholder="LinkedIn"
          value={value.linkedin ?? ""}
          onChange={(event) => onChange({ ...value, linkedin: event.target.value })}
        />
        <input
          placeholder="Localização"
          value={value.location ?? ""}
          onChange={(event) => onChange({ ...value, location: event.target.value })}
        />

        <button type="button" aria-expanded="true">Resumo profissional</button>
        <textarea
          placeholder="Escreva um resumo curto com sua proposta de valor"
          value={value.summary}
          onChange={(event) => onChange({ ...value, summary: event.target.value })}
        />

        <button type="button" aria-expanded="true">Experiência</button>
        <input
          placeholder="Cargo"
          value={experience.title}
          onChange={(event) => onChange({
            ...value,
            experience: [{
              ...experience,
              title: event.target.value,
            }],
          })}
        />

        <button type="button" aria-expanded="true">Skills</button>
        <textarea
          placeholder="Uma skill por linha"
          value={value.skills.join("\n")}
          onChange={(event) => onChange({
            ...value,
            skills: event.target.value.split("\n"),
          })}
        />

        <button type="button" aria-expanded="true">Educação</button>
        <input
          placeholder="Curso"
          value={education.degree}
          onChange={(event) => onChange({
            ...value,
            education: [{
              ...education,
              degree: event.target.value,
            }],
          })}
        />

        <button type="button" aria-expanded="true">Certificações</button>
        <input
          placeholder="Nome da certificação"
          value={certification.name}
          onChange={(event) => onChange({
            ...value,
            certifications: [{
              ...certification,
              name: event.target.value,
            }],
          })}
        />
      </div>
    )
  },
}))

describe("UserDataPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mockPathname = "/profile-setup"
    mockGetDownloadUrls.mockReset()
    mockGetBillingSummary.mockReset()
    mockOverrideJobTargetingValidation.mockReset()
    mockTrackAnalyticsEvent.mockReset()
    window.localStorage.clear()

    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    })
    Object.defineProperty(window.HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: mockAnchorClick,
      writable: true,
    })
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      configurable: true,
      value: mockCreateObjectURL,
      writable: true,
    })
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      value: mockRevokeObjectURL,
      writable: true,
    })
  })

  it("loads the saved profile and renders CRM cards from existing profile data", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    expect(await screen.findByText("Ana Silva")).toBeInTheDocument()
    expect(screen.getAllByText("Analista de Dados").length).toBeGreaterThan(0)
    expect(screen.getByText("Base salva manualmente")).toBeInTheDocument()
    expect(screen.getByText("Criei dashboards executivos.")).toBeInTheDocument()
    expect(screen.getByText("AWS Cloud Practitioner")).toBeInTheDocument()
  })

  it("does not render a cancel action in the profile shell", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await screen.findByText("Ana Silva")

    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument()
  })

  it("opens the existing import flow from the profile header", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByRole("button", { name: /Importar do LinkedIn ou PDF/i }))

    expect(screen.getByRole("dialog", { name: /Importar perfil profissional/i })).toBeInTheDocument()
  })

  it("keeps import connected to the editor by switching into the existing editor view", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse(null)))

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByRole("button", { name: /Importar do LinkedIn ou PDF/i }))
    await user.click(screen.getByRole("button", { name: "mock-import-start" }))

    expect(await screen.findByTestId("visual-resume-editor")).toHaveAttribute("data-import-source", "linkedin")
    expect(screen.getByRole("heading", { name: /Edite seu curr/i })).toBeInTheDocument()
  })

  it("saves edited profile data through the existing save flow", async () => {
    const user = userEvent.setup()
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse(null)),
      createJsonResponse(buildProfileResponse(buildResumeData({
        fullName: "Ana Teste",
        email: "ana@example.com",
        phone: "+55 11 99999-0000",
        linkedin: "https://linkedin.com/in/ana-teste",
        location: "Sao Paulo, BR",
        summary: "Backend engineer focused on reliability.",
        experience: [],
        skills: ["TypeScript", "Node.js"],
        education: [],
        certifications: [],
      }))),
    )

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByRole("button", { name: /Editar perfil/i }))

    const fullNameInput = await screen.findByPlaceholderText("Nome completo")
    const emailInput = screen.getByPlaceholderText("Email")
    const phoneInput = screen.getByPlaceholderText("Telefone")
    const linkedinInput = screen.getByPlaceholderText("LinkedIn")
    const locationInput = screen.getByPlaceholderText("Localização")
    const summaryInput = screen.getByPlaceholderText(/Escreva um resumo curto/i)
    const skillsInput = screen.getByPlaceholderText(/Uma skill por linha/i)

    await user.clear(fullNameInput)
    await user.type(fullNameInput, "  Ana Teste  ")
    await user.clear(emailInput)
    await user.type(emailInput, " ana@example.com ")
    await user.clear(phoneInput)
    await user.type(phoneInput, " +55 11 99999-0000 ")
    await user.clear(linkedinInput)
    await user.type(linkedinInput, " https://linkedin.com/in/ana-teste ")
    await user.clear(locationInput)
    await user.type(locationInput, " Sao Paulo, BR ")
    await user.clear(summaryInput)
    await user.type(summaryInput, " Backend engineer focused on reliability. ")
    await user.clear(skillsInput)
    await user.type(skillsInput, "TypeScript{enter}Node.js{enter}  ")

    await user.click(screen.getByTestId("profile-save-button"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profile", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        fullName: "Ana Teste",
        email: "ana@example.com",
        phone: "+55 11 99999-0000",
        linkedin: "https://linkedin.com/in/ana-teste",
        location: "Sao Paulo, BR",
        summary: "Backend engineer focused on reliability.",
        experience: [],
        skills: ["TypeScript", "Node.js"],
        education: [],
      }),
    }))
    expect(toast.success).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("renders working edit buttons for every required resume section", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await screen.findByText("Ana Silva")

    expect(screen.getByRole("button", { name: /Editar resumo profissional/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Editar experi/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Editar skills/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Editar educa/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Editar certific/i })).toBeInTheDocument()
  })

  it("reuses the existing editor flow when a section edit button is clicked", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await user.click(await screen.findByRole("button", { name: /Editar resumo profissional/i }))

    const summaryInput = await screen.findByPlaceholderText(/Escreva um resumo curto/i)

    expect(screen.getByTestId("visual-resume-editor")).toBeInTheDocument()
    await waitFor(() => {
      expect(summaryInput).toHaveFocus()
    })
  })

  it("opens enhancement mode with ATS selected by default", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)

    expect(screen.getByTestId("ats-panel-cta")).toBeInTheDocument()
    expect(screen.getByTestId("enhancement-intent-ats")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("enhancement-intent-target-job")).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByTestId("target-job-description-input")).not.toBeInTheDocument()
    expect(screen.getByText(/Modo:/i)).toHaveTextContent("Modo: Melhoria ATS geral")
    expect(screen.getByText("Melhorar para ATS (1 crédito)")).toBeInTheDocument()
    expect(screen.getByText(/Cr.ditos dispon/i)).toBeInTheDocument()
  })

  it("returns to the profile view from enhancement mode", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-back-button"))

    expect(await screen.findByText("Ana Silva")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Melhorar curr/i })).toBeInTheDocument()
  })

  it("keeps the ATS enhancement flow wired to Smart Generation and compare redirect", async () => {
    const user = userEvent.setup()
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        success: true,
        sessionId: "sess_ats_123",
      }),
    )

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("ats-panel-cta"))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_ats_123")
    })

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/profile/smart-generation", expect.objectContaining({
      method: "POST",
      body: expect.not.stringContaining("targetJobDescription"),
    }))
    expect(fetchMock).not.toHaveBeenCalledWith("/api/profile/ats-enhancement", expect.anything())
    expect(toast.success).toHaveBeenCalled()
    expect(window.localStorage.getItem("curria:last-profile-generation-session-id")).toBe("sess_ats_123")
  })

  it("shows the vacancy textarea and CTA after selecting target-job intent", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))

    expect(screen.getByTestId("enhancement-intent-target-job")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("target-job-description-input")).toBeInTheDocument()
    expect(screen.getByText("Adaptar para esta vaga (1 crédito)")).toBeInTheDocument()
  })

  it("clears the target-job description when switching back to ATS intent", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para analista de dados.")
    await user.click(screen.getByTestId("enhancement-intent-ats"))
    await user.click(screen.getByTestId("enhancement-intent-target-job"))

    expect(screen.getByTestId("target-job-description-input")).toHaveValue("")
  })

  it("shows local validation and does not call generation when target-job intent is empty", async () => {
    const user = userEvent.setup()
    const fetchMock = buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    const targetJobTextarea = screen.getByTestId("target-job-description-input")
    await user.click(screen.getByTestId("ats-panel-cta"))

    expect(screen.getByRole("alert")).toHaveTextContent("Cole a descrição da vaga para adaptar seu currículo.")
    expect(targetJobTextarea).toHaveFocus()
    expect(targetJobTextarea).toHaveAttribute("aria-invalid", "true")
    expect(targetJobTextarea).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("target-job-description-error"),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("keeps target-job generation wired to the existing textarea and smart-generation handler", async () => {
    const user = userEvent.setup()
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        success: true,
        sessionId: "sess_target_123",
      }),
    )

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(
      screen.getByTestId("target-job-description-input"),
      "Vaga para analista de dados senior com foco em produto e SQL.",
    )
    await user.click(screen.getByTestId("ats-panel-cta"))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_target_123")
    })

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/profile/smart-generation", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"targetJobDescription\":\"Vaga para analista de dados senior com foco em produto e SQL.\""),
    }))
  })

  it("blocks a fast double-click before a second target-job start request is sent", async () => {
    const user = userEvent.setup()
    let resolveGeneration: (response: ReturnType<typeof createJsonResponse>) => void = () => {}
    const generationResponse = new Promise<ReturnType<typeof createJsonResponse>>((resolve) => {
      resolveGeneration = resolve
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonResponse(buildProfileResponse()))
      .mockResolvedValueOnce(createJsonResponse(buildProfileResponse()))
      .mockImplementationOnce(() => generationResponse)

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(
      screen.getByTestId("target-job-description-input"),
      "Vaga para analista de marketing e eventos.",
    )

    const cta = screen.getByTestId("ats-panel-cta")
    await user.dblClick(cta)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/profile/smart-generation", expect.objectContaining({
      method: "POST",
    }))
    expect(cta).toBeDisabled()

    resolveGeneration(createJsonResponse({
      success: true,
      sessionId: "sess_target_once",
    }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_target_once")
    })
  })

  it("reuses the backend running session instead of surfacing a generic error", async () => {
    const user = userEvent.setup()
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        status: "already_running",
        sessionId: "sess_existing_running",
        message: "Essa adaptacao ja esta em andamento.",
      }, { status: 202 }),
    )

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(
      screen.getByTestId("target-job-description-input"),
      "Vaga para analista de marketing e eventos.",
    )
    await user.click(screen.getByTestId("ats-panel-cta"))

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("Essa adaptacao ja esta em andamento.")
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(toast.error).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("surfaces success warnings in the completion toast when job targeting saves with observations", async () => {
    const user = userEvent.setup()
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        success: true,
        sessionId: "sess_target_warning_123",
        warnings: ["O resumo otimizado menciona skill sem evidência no currículo original."],
      }),
    )

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(
      screen.getByTestId("target-job-description-input"),
      "Vaga para analista de dados senior com foco em produto e SQL.",
    )
    await user.click(screen.getByTestId("ats-panel-cta"))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_target_warning_123")
    })

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Revise este ponto antes de usar a versão final"),
    )
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("skill sem evidência no currículo original"),
    )
  })

  it("sanitizes mojibake warnings before showing the success toast", async () => {
    const user = userEvent.setup()
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        success: true,
        sessionId: "sess_target_warning_mojibake_123",
        warnings: [
          encodeUtf8AsMojibake("O resumo otimizado menciona skill sem evid\u00EAncia no curr\u00EDculo original."),
          encodeUtf8AsMojibake("O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evid\u00EAncia equivalente no curr\u00EDculo original."),
        ],
      }),
    )

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(
      screen.getByTestId("target-job-description-input"),
      "Vaga para analista de dados senior com foco em produto e SQL.",
    )
    await user.click(screen.getByTestId("ats-panel-cta"))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_target_warning_mojibake_123")
    })

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Revise estes pontos antes de usar a vers\u00E3o final"),
    )
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("skill sem evid\u00EAncia no curr\u00EDculo original"),
    )
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("cargo alvo sem evid\u00EAncia equivalente no curr\u00EDculo original"),
    )
    expect(toast.success).not.toHaveBeenCalledWith(
      expect.stringContaining(encodeUtf8AsMojibake("evid\u00EAncia")),
    )
    expect(toast.success).not.toHaveBeenCalledWith(
      expect.stringContaining(encodeUtf8AsMojibake("curr\u00EDculo")),
    )
  })

  it("shows the missing ATS requirements dialog when the profile is incomplete", async () => {
    const user = userEvent.setup()
    buildFetchMock(createJsonResponse(buildProfileResponse(buildResumeData({
      fullName: "",
      summary: "",
      experience: [],
      education: [],
      skills: ["SQL"],
      certifications: [],
    }))))

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("ats-panel-cta"))

    expect(screen.getByText(/Complete seu perfil antes de melhorar para ATS/i)).toBeInTheDocument()
    expect(screen.getByText(/Dados pessoais: adicione seu nome completo/i)).toBeInTheDocument()
    expect(screen.getAllByText(/inclua pelo menos uma experi/i).length).toBeGreaterThan(0)
  })

  it("shows the rewrite validation dialog when the API returns validation issues", async () => {
    const user = userEvent.setup()
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        workflowMode: "job_targeting",
        rewriteValidation: {
          blocked: true,
          valid: false,
          hardIssues: [{
            severity: "high",
            message: "A experiência otimizada introduziu empresa ou combinação cargo/empresa inexistente no currículo original.",
            section: "experience",
          }],
          softWarnings: [{
            severity: "medium",
            message: "O resumo otimizado menciona skill sem evidência no currículo original.",
            section: "summary",
          }],
          issues: [{
            severity: "high",
            message: "A experiência otimizada introduziu empresa ou combinação cargo/empresa inexistente no currículo original.",
            section: "experience",
          }, {
            severity: "medium",
            message: "O resumo otimizado menciona skill sem evidência no currículo original.",
            section: "summary",
          }],
        },
        targetRole: "Vaga Alvo",
        targetRoleConfidence: "low",
      }, {
        ok: false,
        status: 422,
      }),
    )

    render(<UserDataPage currentCredits={2} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para analista de dados.")
    await user.click(screen.getByTestId("ats-panel-cta"))

    expect(await screen.findByRole("heading", { name: /automaticamente/i })).toBeInTheDocument()
    expect(screen.getByText(/o que bloqueou automaticamente/i)).toBeInTheDocument()
    expect(screen.getByText(/outros pontos para revisar/i)).toBeInTheDocument()
    expect(screen.getByText(/empresa ou combinação cargo\/empresa inexistente/i)).toBeInTheDocument()
    expect(screen.getByText(/skill sem evidência no currículo original/i)).toBeInTheDocument()
    expect(screen.getByText(/bug de leitura da vaga/i)).toBeInTheDocument()
    expect(screen.getByText(/não conseguimos identificar com confiança o cargo-alvo/i)).toBeInTheDocument()
    expect(screen.queryByText("Vaga Alvo")).not.toBeInTheDocument()
  })

  it("uses override generation when the recoverable validation modal has enough credits", async () => {
    const user = userEvent.setup()
    mockOverrideJobTargetingValidation.mockResolvedValue({
      success: true,
      sessionId: "sess_override_123",
      creditsUsed: 1,
      resumeGenerationId: "gen_override_123",
      generationType: "JOB_TARGETING",
    })
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        sessionId: "sess_override_123",
        workflowMode: "job_targeting",
        rewriteValidation: {
          blocked: true,
          valid: false,
          hardIssues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
          softWarnings: [],
          issues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
        },
        recoverableValidationBlock: {
          status: "validation_blocked_recoverable",
          overrideToken: "override_token_123",
          expiresAt: "2099-04-27T16:00:00.000Z",
          modal: {
            title: "Encontramos pontos que podem exagerar sua experiência",
            description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
            primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
            problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
            reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
            actions: {
              secondary: { label: "Fechar", action: "close" },
              primary: {
                label: "Gerar mesmo assim (1 crédito)",
                action: "override_generate",
                creditCost: 1,
              },
            },
          },
        },
      }, {
        ok: false,
        status: 422,
      }),
    )

    render(<UserDataPage currentCredits={1} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para analista de dados.")
    await user.click(screen.getByTestId("ats-panel-cta"))

    const overrideButton = await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" })
    const scrollContainer = await screen.findByTestId("rewrite-validation-dialog-scroll")
    expect(scrollContainer.className).toContain("overflow-y-auto")
    expect(scrollContainer.className).toContain("min-h-0")
    expect(screen.getByText("Você usará 1 crédito para gerar esta versão.")).toBeInTheDocument()

    await user.click(overrideButton)

    await waitFor(() => {
      expect(mockOverrideJobTargetingValidation).toHaveBeenCalledWith("sess_override_123", {
        overrideToken: "override_token_123",
        consumeCredit: true,
      })
    })
    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "false")
  })

  it("renders the low-fit warning modal with human copy for off-target vacancies", async () => {
    const user = userEvent.setup()
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        sessionId: "sess_low_fit_modal_123",
        workflowMode: "job_targeting",
        rewriteValidation: {
          blocked: true,
          valid: false,
          recoverable: true,
          hardIssues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "A vaga de Desenvolvedor Java ficou distante demais do histórico comprovado no currículo original para geração automática segura.",
          }],
          softWarnings: [],
          issues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "A vaga de Desenvolvedor Java ficou distante demais do histórico comprovado no currículo original para geração automática segura.",
          }],
        },
        recoverableValidationBlock: {
          status: "validation_blocked_recoverable",
          overrideToken: "override_token_low_fit_123",
          expiresAt: "2099-04-27T16:00:00.000Z",
          modal: {
            title: "Esta vaga parece muito distante do seu currículo atual",
            description: "Encontramos poucos pontos comprovados no seu currículo para os requisitos principais desta vaga.",
            primaryProblem: "A vaga pede Java, Spring Boot, JPA/Hibernate, mensageria, Docker e CI/CD, mas seu histórico atual sustenta melhor outra trajetória profissional.",
            problemBullets: [
              "Seu currículo comprova melhor experiência em BI, Engenharia de Dados, SQL e Python.",
              "Encontramos alguns pontos próximos, como Git, APIs REST e SQL, mas eles não sustentam uma apresentação direta como Desenvolvedor Java.",
            ],
            reassurance: "Isso não significa que você não pode se candidatar. Significa apenas que essa versão pode ficar pouco aderente ou parecer forçada.",
            recommendation: "Você pode gerar mesmo assim e revisar manualmente antes de enviar.",
            actions: {
              secondary: { label: "Fechar", action: "close" },
              primary: {
                label: "Gerar mesmo assim (1 crédito)",
                action: "override_generate",
                creditCost: 1,
              },
            },
          },
        },
      }, {
        ok: false,
        status: 422,
      }),
    )

    render(<UserDataPage currentCredits={1} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para desenvolvedor Java.")
    await user.click(screen.getByTestId("ats-panel-cta"))

    expect(await screen.findByText("Esta vaga parece muito distante do seu currículo atual")).toBeInTheDocument()
    expect(screen.getByText(/Java, Spring Boot, JPA\/Hibernate, mensageria, Docker e CI\/CD/i)).toBeInTheDocument()
    expect(screen.getByText(/BI, Engenharia de Dados, SQL e Python/i)).toBeInTheDocument()
    expect(screen.getByText(/Git, APIs REST e SQL/i)).toBeInTheDocument()
    expect(screen.queryByText(/unsupported_gap|targetEvidence|hardIssue|pipeline/i)).not.toBeInTheDocument()
  })

  it("switches the recoverable validation CTA to pricing when credits are missing", async () => {
    const user = userEvent.setup()
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        sessionId: "sess_override_pricing_123",
        workflowMode: "job_targeting",
        rewriteValidation: {
          blocked: true,
          valid: false,
          hardIssues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
          softWarnings: [],
          issues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
        },
        recoverableValidationBlock: {
          status: "validation_blocked_recoverable",
          overrideToken: "override_token_pricing_123",
          expiresAt: "2099-04-27T16:00:00.000Z",
          modal: {
            title: "Encontramos pontos que podem exagerar sua experiência",
            description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
            primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
            problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
            reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
            actions: {
              secondary: { label: "Fechar", action: "close" },
              primary: {
                label: "Gerar mesmo assim (1 crédito)",
                action: "override_generate",
                creditCost: 1,
              },
            },
          },
        },
      }, {
        ok: false,
        status: 422,
      }),
    )

    const view = render(<UserDataPage currentCredits={1} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para analista de dados.")
    await user.click(screen.getByTestId("ats-panel-cta"))
    await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" })

    view.rerender(<UserDataPage currentCredits={0} />)

    const pricingButton = await screen.findByRole("button", { name: "Adicionar créditos" })
    expect(screen.getByText("Você precisa de 1 crédito para gerar esta versão.")).toBeInTheDocument()

    await user.click(pricingButton)

    expect(mockOverrideJobTargetingValidation).not.toHaveBeenCalled()
    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
  })

  it("updates the recoverable validation CTA after credits are added without rerunning targeting", async () => {
    const user = userEvent.setup()
    mockOverrideJobTargetingValidation.mockResolvedValue({
      success: true,
      sessionId: "sess_override_credit_refresh_123",
      creditsUsed: 1,
      resumeGenerationId: "gen_override_credit_refresh_123",
      generationType: "JOB_TARGETING",
    })
    mockGetBillingSummary.mockResolvedValue({
      currentCredits: 1,
      currentPlan: "plus",
      activeRecurringPlan: null,
    })
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        sessionId: "sess_override_credit_refresh_123",
        workflowMode: "job_targeting",
        rewriteValidation: {
          blocked: true,
          valid: false,
          hardIssues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
          softWarnings: [],
          issues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
        },
        recoverableValidationBlock: {
          status: "validation_blocked_recoverable",
          overrideToken: "override_token_credit_refresh_123",
          expiresAt: "2099-04-27T16:00:00.000Z",
          modal: {
            title: "Encontramos pontos que podem exagerar sua experiência",
            description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
            primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
            problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
            reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
            actions: {
              secondary: { label: "Fechar", action: "close" },
              primary: {
                label: "Gerar mesmo assim (1 crédito)",
                action: "override_generate",
                creditCost: 1,
              },
            },
          },
        },
      }, {
        ok: false,
        status: 422,
      }),
    )

    const view = render(<UserDataPage currentCredits={1} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para analista de dados.")
    await user.click(screen.getByTestId("ats-panel-cta"))

    expect(await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" })).toBeInTheDocument()

    view.rerender(<UserDataPage currentCredits={0} />)

    expect(await screen.findByRole("button", { name: "Adicionar créditos" })).toBeInTheDocument()

    window.dispatchEvent(new Event("focus"))

    const overrideButton = await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" })
    expect(screen.getByText("Você usará 1 crédito para gerar esta versão.")).toBeInTheDocument()

    await user.click(overrideButton)

    await waitFor(() => {
      expect(mockOverrideJobTargetingValidation).toHaveBeenCalledWith("sess_override_credit_refresh_123", {
        overrideToken: "override_token_credit_refresh_123",
        consumeCredit: true,
      })
    })
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      "agent.job_targeting.validation_override_credit_added",
      expect.objectContaining({
        source: "profile_setup",
        availableCredits: 1,
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("opens pricing instead of redirecting when override returns insufficient credits", async () => {
    const user = userEvent.setup()
    mockOverrideJobTargetingValidation.mockRejectedValue({
      code: "INSUFFICIENT_CREDITS",
      message: "Você não tem créditos suficientes para gerar esta versão.",
      openPricing: true,
    })
    buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        sessionId: "sess_override_backend_credit_123",
        workflowMode: "job_targeting",
        rewriteValidation: {
          blocked: true,
          valid: false,
          hardIssues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
          softWarnings: [],
          issues: [{
            severity: "high",
            section: "summary",
            issueType: "target_role_overclaim",
            message: "O resumo assumiu o cargo alvo diretamente.",
          }],
        },
        recoverableValidationBlock: {
          status: "validation_blocked_recoverable",
          overrideToken: "override_token_backend_credit_123",
          expiresAt: "2099-04-27T16:00:00.000Z",
          modal: {
            title: "Encontramos pontos que podem exagerar sua experiência",
            description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
            primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
            problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
            reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
            actions: {
              secondary: { label: "Fechar", action: "close" },
              primary: {
                label: "Gerar mesmo assim (1 crédito)",
                action: "override_generate",
                creditCost: 1,
              },
            },
          },
        },
      }, {
        ok: false,
        status: 422,
      }),
    )

    render(<UserDataPage currentCredits={1} />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("enhancement-intent-target-job"))
    await user.type(screen.getByTestId("target-job-description-input"), "Vaga para analista de dados.")
    await user.click(screen.getByTestId("ats-panel-cta"))
    await user.click(await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" }))

    await waitFor(() => {
      expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
    })
    expect(mockPush).not.toHaveBeenCalledWith("/dashboard/resume/compare/sess_override_backend_credit_123")
  })

  it("contains long experience content inside a scrollable section card", async () => {
    const longBullets = Array.from({ length: 18 }, (_, index) => `Resultado relevante ${index + 1}`)
    buildFetchMock(createJsonResponse(buildProfileResponse(buildResumeData({
      experience: [{
        title: "Senior Backend Engineer",
        company: "CurrIA",
        location: "Sao Paulo",
        startDate: "2020",
        endDate: "Atual",
        bullets: longBullets,
      }],
    }))))

    render(<UserDataPage currentCredits={2} />)

    const card = await screen.findByTestId("experience-section-card")
    const content = card.lastElementChild

    expect(content).not.toBeNull()
    expect(content).toHaveClass("overflow-y-auto")
    expect(within(card).getByText("Resultado relevante 18")).toBeInTheDocument()
  })

  it("keeps shared top spacing below resume section headers at pt-1.5 across cards", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse(buildResumeData({
      summary: "Resumo enxuto para validar o espaçamento.",
      experience: [{
        title: "Senior Backend Engineer",
        company: "CurrIA",
        location: "Sao Paulo",
        startDate: "2020",
        endDate: "Atual",
        bullets: ["Entregou melhorias importantes."],
      }],
      skills: ["SQL", "Python"],
    }))))

    render(<UserDataPage currentCredits={2} />)

    const summaryCard = await screen.findByTestId("summary-section-card")
    const experienceCard = await screen.findByTestId("experience-section-card")
    const skillsCard = await screen.findByTestId("skills-section-card")
    const summaryContent = summaryCard.lastElementChild
    const firstExperienceArticle = within(experienceCard).getByText("Senior Backend Engineer").closest("article")

    expect(summaryCard).toHaveClass("gap-0")
    expect(experienceCard).toHaveClass("gap-0")
    expect(skillsCard).toHaveClass("gap-0")
    expect(summaryContent).not.toBeNull()
    expect(summaryContent).toHaveClass("pt-1.5")
    expect(firstExperienceArticle).not.toBeNull()
    expect(firstExperienceArticle).not.toHaveClass("pt-2.5")
  })

  it("keeps the certifications card visible with its edit action even when empty", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse(buildResumeData({
      certifications: [],
    }))))

    render(<UserDataPage currentCredits={2} />)

    const card = await screen.findByTestId("certifications-section-card")

    expect(within(card).getByRole("button", { name: /Editar certific/i })).toBeInTheDocument()
    expect(within(card).getByText(/Nenhuma certific/i)).toBeInTheDocument()
  })

  it("keeps download honest and disabled when no generated PDF is available", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse()))

    render(<UserDataPage currentCredits={2} />)

    const downloadButton = await screen.findByRole("button", { name: /Download PDF/i })

    expect(downloadButton).toBeDisabled()
    expect(screen.getByText(/gerar uma vers/i)).toBeInTheDocument()
    expect(mockGetDownloadUrls).not.toHaveBeenCalled()
  })

  it("ignores the legacy global last-generated session key when a scoped app user id is provided", async () => {
    buildFetchMock(createJsonResponse(buildProfileResponse()))
    window.localStorage.setItem("curria:last-profile-generation-session-id", "sess_legacy_other_user")

    render(<UserDataPage currentCredits={2} currentAppUserId="usr_current" />)

    const downloadButton = await screen.findByRole("button", { name: /Download PDF/i })

    expect(downloadButton).toBeDisabled()
    expect(mockGetDownloadUrls).not.toHaveBeenCalled()
  })

  it("uses the existing file download flow when a generated PDF is available", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem("curria:last-profile-generation-session-id", "sess_download_123")
    mockGetDownloadUrls
      .mockResolvedValueOnce({
        available: true,
        docxUrl: null,
        pdfUrl: "https://files.curria.test/cv.pdf",
        pdfFileName: "Curriculo-Ana.pdf",
        generationStatus: "ready",
      })
      .mockResolvedValueOnce({
        available: true,
        docxUrl: null,
        pdfUrl: "https://files.curria.test/cv.pdf",
        pdfFileName: "Curriculo-Ana.pdf",
        generationStatus: "ready",
      })
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createBlobResponse(),
    )

    render(<UserDataPage currentCredits={2} />)

    const downloadButton = await screen.findByRole("button", { name: /Download PDF/i })

    await waitFor(() => {
      expect(downloadButton).toBeEnabled()
    })

    await user.click(downloadButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("https://files.curria.test/cv.pdf")
    })

    expect(mockGetDownloadUrls).toHaveBeenNthCalledWith(
      1,
      "sess_download_123",
      undefined,
      expect.objectContaining({
        trigger: "profile_last_generated",
        onSessionIdRecovered: expect.any(Function),
      }),
    )
    expect(mockGetDownloadUrls).toHaveBeenNthCalledWith(
      2,
      "sess_download_123",
      undefined,
      expect.objectContaining({
        trigger: "profile_last_generated",
        onSessionIdRecovered: expect.any(Function),
      }),
    )
    expect(mockAnchorClick).toHaveBeenCalled()
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it("auto-heals a stale stored session id before enabling the profile PDF download", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem("curria:last-profile-generation-session-id", "sess_stale_123")
    mockGetDownloadUrls
      .mockImplementationOnce(async (_sessionId: string, _targetId: unknown, options?: {
        trigger?: string
        onSessionIdRecovered?: (sessionId: string) => void
      }) => {
        options?.onSessionIdRecovered?.("sess_fresh_456")

        return {
          available: true,
          docxUrl: null,
          pdfUrl: "https://files.curria.test/cv-fresh.pdf",
          pdfFileName: "Curriculo-Ana-Atualizado.pdf",
          generationStatus: "ready",
        }
      })
      .mockResolvedValueOnce({
        available: true,
        docxUrl: null,
        pdfUrl: "https://files.curria.test/cv-fresh.pdf",
        pdfFileName: "Curriculo-Ana-Atualizado.pdf",
        generationStatus: "ready",
      })
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createBlobResponse(),
    )

    render(<UserDataPage currentCredits={2} />)

    const downloadButton = await screen.findByRole("button", { name: /Download PDF/i })

    await waitFor(() => {
      expect(downloadButton).toBeEnabled()
    })

    expect(window.localStorage.getItem("curria:last-profile-generation-session-id")).toBe("sess_fresh_456")

    await user.click(downloadButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("https://files.curria.test/cv-fresh.pdf")
    })

    expect(mockGetDownloadUrls).toHaveBeenNthCalledWith(
      1,
      "sess_stale_123",
      undefined,
      expect.objectContaining({
        trigger: "profile_last_generated",
        onSessionIdRecovered: expect.any(Function),
      }),
    )
    expect(mockGetDownloadUrls).toHaveBeenNthCalledWith(
      2,
      "sess_fresh_456",
      undefined,
      expect.objectContaining({
        trigger: "profile_last_generated",
        onSessionIdRecovered: expect.any(Function),
      }),
    )
  })

  it("stores the last generated session id in a user-scoped key when appUserId is available", async () => {
    const user = userEvent.setup()
    const fetchMock = buildFetchMock(
      createJsonResponse(buildProfileResponse()),
      createJsonResponse(buildProfileResponse()),
      createJsonResponse({
        success: true,
        sessionId: "sess_scoped_123",
      }),
    )

    render(<UserDataPage currentCredits={2} currentAppUserId="usr_scoped" />)

    await openEnhancementMode(user)
    await user.click(screen.getByTestId("ats-panel-cta"))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_scoped_123")
    })

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/profile/smart-generation", expect.objectContaining({
      method: "POST",
      body: expect.not.stringContaining("targetJobDescription"),
    }))
    expect(fetchMock).not.toHaveBeenCalledWith("/api/profile/ats-enhancement", expect.anything())
    expect(window.localStorage.getItem("curria:last-profile-generation-session-id:usr_scoped")).toBe("sess_scoped_123")
    expect(window.localStorage.getItem("curria:last-profile-generation-session-id")).toBeNull()
  })
})
