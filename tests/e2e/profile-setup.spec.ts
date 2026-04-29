import { expect, test, type Page } from "@playwright/test"

import { authenticateE2EUser, clearE2EAuth } from "./fixtures/auth-session"
import { buildMockWorkspace, installCoreFunnelApiMocks } from "./fixtures/api-mocks"

function buildReadyProfileResponse() {
  return {
    dashboardWelcomeGuideSeen: true,
    profile: {
      id: "profile_123",
      source: "manual",
      cvState: {
        fullName: "Ana Silva",
        email: "ana@example.com",
        phone: "+55 11 99999-0000",
        linkedin: "https://linkedin.com/in/ana-silva",
        location: "Sao Paulo, BR",
        summary: "Backend engineer focused on platform reliability.",
        experience: [{
          title: "Senior Backend Engineer",
          company: "CurrIA",
          location: "Sao Paulo, BR",
          startDate: "2022",
          endDate: "Atual",
          bullets: ["Liderei a plataforma principal da empresa."],
        }],
        skills: ["TypeScript", "Node.js", "AWS", "PostgreSQL"],
        education: [{
          degree: "Bacharel em Ciencia da Computacao",
          institution: "USP",
          year: "2020",
        }],
        certifications: [{
          name: "AWS Cloud Practitioner",
          issuer: "Amazon",
          year: "2024",
        }],
      },
      profilePhotoUrl: null,
      createdAt: "2026-04-10T11:00:00.000Z",
      updatedAt: "2026-04-10T11:00:00.000Z",
      extractedAt: "2026-04-10T11:00:00.000Z",
      linkedinUrl: "https://linkedin.com/in/ana-silva",
    },
  }
}

function buildComparisonResponse(
  sessionId: string,
  options: {
    generationType?: "ATS_ENHANCEMENT" | "JOB_TARGETING"
    targetJobDescription?: string
  } = {},
) {
  const originalCvState = buildReadyProfileResponse().profile.cvState

  return {
    sessionId,
    generationType: options.generationType ?? "ATS_ENHANCEMENT",
    targetJobDescription: options.targetJobDescription,
    originalCvState,
    optimizedCvState: {
      ...originalCvState,
      summary: `${originalCvState.summary} Otimizado para a vaga alvo.`,
    },
    originalScore: {
      total: 78,
      label: "78",
    },
    optimizedScore: {
      total: 91,
      label: "91",
    },
    optimizationSummary: {
      changedSections: ["summary", "experience"],
      notes: ["Resumo fortalecido e bullets reescritos."],
    },
  }
}

async function installComparisonApiMock(
  page: Page,
  sessionId: string,
  options: {
    generationType?: "ATS_ENHANCEMENT" | "JOB_TARGETING"
    targetJobDescription?: string
  } = {},
): Promise<void> {
  await page.route(`**/api/session/${sessionId}/comparison`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildComparisonResponse(sessionId, options)),
    })
  })
}

async function bootstrapProfileSetupPage(
  page: Page,
  options: {
    creditsRemaining?: number
    profile?: ReturnType<typeof buildReadyProfileResponse> | { profile: null; dashboardWelcomeGuideSeen?: boolean }
    sessionId?: string
  } = {},
): Promise<void> {
  const sessionId = options.sessionId ?? "sess_e2e_profile"
  const workspace = buildMockWorkspace(sessionId)

  await installCoreFunnelApiMocks(page, {
    sessionId,
    workspace,
    profile: options.profile ?? { profile: null, dashboardWelcomeGuideSeen: true },
  })

  await authenticateE2EUser(page, {
    appUserId: "usr_e2e_profile",
    displayName: "Profile Test User",
    email: "profile@example.com",
    creditsRemaining: options.creditsRemaining ?? 3,
  })

  await page.goto("/profile-setup")
  await expect(page.getByTestId("user-data-page")).toBeVisible()
  await dismissDashboardGuideIfVisible(page)
}

async function dismissDashboardGuideIfVisible(page: Page): Promise<void> {
  const skipButton = page.getByRole("button", { name: /Pular/i })

  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click()
    await expect(skipButton).toBeHidden()
  }
}

async function openEditor(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Editar perfil" }).click()
  await expect(page.getByPlaceholder("Nome completo")).toBeVisible()
}

async function openEnhancement(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Melhorar curr/i }).click()
  await expect(page.getByTestId("ats-panel-cta")).toBeVisible()
}

async function ensureProfileShell(page: Page): Promise<void> {
  const backButton = page.getByTestId("enhancement-back-button")

  if (await backButton.isVisible().catch(() => false)) {
    await backButton.click()
  }
}

async function fillMinimumReadyProfile(page: Page): Promise<void> {
  await page.getByPlaceholder("Nome completo").fill("Ana Teste")
  await page.getByPlaceholder("Email").fill("ana@example.com")
  await page.getByPlaceholder("Telefone").fill("+55 11 99999-0000")
  await page.getByPlaceholder("LinkedIn").fill("https://linkedin.com/in/ana-teste")
  await page.getByPlaceholder(/Localiza/i).fill("Sao Paulo, BR")
  await page.getByPlaceholder(/Escreva um resumo curto/i).fill("Backend engineer focused on platform reliability.")
  await page.getByPlaceholder(/Uma skill por linha/i).fill("TypeScript\nNode.js\nAWS")
}

test.describe("manual profile setup", () => {
  test("redirects guests away from /profile-setup", async ({ page }) => {
    await clearE2EAuth(page)
    await page.goto("/profile-setup")

    await expect(page).toHaveURL(/\/(login|entrar)(?:\?.*)?$/)
  })

  test("redirects guests away from /dashboard/resumes/new as well", async ({ page }) => {
    await clearE2EAuth(page)
    await page.goto("/dashboard/resumes/new")

    await expect(page).toHaveURL(/\/(login|entrar)(?:\?.*)?$/)
  })

  test("redirects guests away from /dashboard/resume/new as well", async ({ page }) => {
    await clearE2EAuth(page)
    await page.goto("/dashboard/resume/new")

    await expect(page).toHaveURL(/\/(login|entrar)(?:\?.*)?$/)
  })

  test("saves canonical profile data from the editor flow", async ({ page }) => {
    let savedProfilePayload: Record<string, unknown> | null = null

    await installCoreFunnelApiMocks(page, {
      profile: { profile: null, dashboardWelcomeGuideSeen: true },
      onProfileSave: async (payload) => {
        savedProfilePayload = payload
      },
    })
    await authenticateE2EUser(page, {
      appUserId: "usr_e2e_profile",
      displayName: "Profile Test User",
      email: "profile@example.com",
    })

    await page.goto("/profile-setup")
    await openEditor(page)
    await fillMinimumReadyProfile(page)
    await page.getByTestId("profile-save-button").click()

    await expect(page).toHaveURL(/\/profile-setup(?:\?.*)?$/)
    await expect(page.getByTestId("user-data-page")).toBeVisible()

    expect(savedProfilePayload).toEqual({
      education: [],
      email: "ana@example.com",
      experience: [],
      fullName: "Ana Teste",
      linkedin: "https://linkedin.com/in/ana-teste",
      location: "Sao Paulo, BR",
      phone: "+55 11 99999-0000",
      skills: ["TypeScript", "Node.js", "AWS"],
      summary: "Backend engineer focused on platform reliability.",
    })
  })

  test("does not render a cancelar action in the profile shell", async ({ page }) => {
    await bootstrapProfileSetupPage(page)

    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0)
  })

  test("opens and closes the import modal from the profile header", async ({ page }) => {
    await bootstrapProfileSetupPage(page)

    await page.getByRole("button", { name: "Importar do LinkedIn ou PDF" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("Importar perfil profissional")).toBeVisible()

    await page.getByRole("button", { name: "Fechar" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
  })

  test("imports a base profile from PDF and fills the existing editor", async ({ page }) => {
    await bootstrapProfileSetupPage(page)

    await page.route("**/api/profile/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          profile: {
            cvState: {
              fullName: "Bruna Costa",
              email: "bruna@example.com",
              phone: "+55 11 98888-7777",
              linkedin: "https://linkedin.com/in/bruna-costa",
              location: "Recife, BR",
              summary: "Product designer with strong ATS-friendly storytelling.",
              experience: [],
              skills: ["Figma", "UX Writing", "Design Systems"],
              education: [],
              certifications: [],
            },
            profilePhotoUrl: null,
            source: "pdf",
          },
        }),
      })
    })

    await page.getByRole("button", { name: "Importar do LinkedIn ou PDF" }).click()
    await page.locator("#resume-file-upload").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.1\n%CurrIA E2E PDF\n%%EOF"),
    })
    await page.getByRole("dialog").getByRole("button", { name: "Importar arquivo" }).first().click()

    await expect(page.getByRole("dialog")).toBeHidden()
    await ensureProfileShell(page)
    await expect(page.getByText(/Base salva a partir de curr/i)).toBeVisible()
    await expect(page.getByRole("link", { name: "bruna@example.com" })).toBeVisible()
    await expect(page.getByText("Recife, BR")).toBeVisible()
    await expect(page.getByTestId("user-data-page")).toContainText("Figma")
  })

  test("imports a base profile from LinkedIn and applies it to the existing editor", async ({ page }) => {
    let profileState: ReturnType<typeof buildReadyProfileResponse> | { profile: null; dashboardWelcomeGuideSeen?: boolean } = {
      profile: null,
      dashboardWelcomeGuideSeen: true,
    }

    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profileState),
      })
    })

    await page.route("**/api/profile/extract", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobId: "job_linkedin_123" }),
      })
    })

    await page.route("**/api/profile/status/*", async (route) => {
      profileState = {
        dashboardWelcomeGuideSeen: true,
        profile: {
          id: "profile_linkedin_123",
          source: "linkedin",
          cvState: {
            fullName: "Clara Nogueira",
            email: "clara@example.com",
            phone: "+55 21 97777-6666",
            linkedin: "https://linkedin.com/in/clara-nogueira",
            location: "Rio de Janeiro, BR",
            summary: "Product manager with strong discovery and delivery experience.",
            experience: [],
            skills: ["Product Strategy", "Roadmaps", "Stakeholder Management"],
            education: [],
            certifications: [],
          },
          profilePhotoUrl: null,
          createdAt: "2026-04-10T11:00:00.000Z",
          updatedAt: "2026-04-10T11:00:00.000Z",
          extractedAt: "2026-04-10T11:00:00.000Z",
          linkedinUrl: "https://linkedin.com/in/clara-nogueira",
        },
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "completed" }),
      })
    })

    await authenticateE2EUser(page, {
      appUserId: "usr_e2e_profile",
      displayName: "Profile Test User",
      email: "profile@example.com",
      creditsRemaining: 3,
    })

    await page.goto("/profile-setup")
    await expect(page.getByTestId("user-data-page")).toBeVisible()

    await page.getByRole("button", { name: "Importar do LinkedIn ou PDF" }).click()
    await page.getByPlaceholder("https://www.linkedin.com/in/seu-perfil").fill("https://linkedin.com/in/clara-nogueira")
    await page.getByRole("dialog").getByRole("button", { name: "Importar do LinkedIn" }).click()

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 })
    await ensureProfileShell(page)
    await expect(page.getByText(/Base salva a partir do LinkedIn/i)).toBeVisible()
    await expect(page.getByRole("link", { name: "clara@example.com" })).toBeVisible()
    await expect(page.getByText("Rio de Janeiro, BR")).toBeVisible()
    await expect(page.getByTestId("user-data-page")).toContainText("Product Strategy")
  })

  test("keeps the ATS action disabled when the user has no credits", async ({ page }) => {
    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 0,
      profile: buildReadyProfileResponse(),
    })
    await openEnhancement(page)

    const atsButton = page.getByTestId("ats-panel-cta")

    await expect(atsButton).toBeDisabled()
    await expect(page.getByText(/0 cr.ditos dispon/i)).toBeVisible()
  })

  test("shows a friendly ATS modal when profile details are still missing", async ({ page }) => {
    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 2,
      profile: {
        dashboardWelcomeGuideSeen: true,
        profile: {
          ...buildReadyProfileResponse().profile,
          cvState: {
            ...buildReadyProfileResponse().profile.cvState,
            education: [{
              degree: "Bacharel em Ciencia da Computacao",
              institution: "",
              year: "2020",
            }],
          },
        },
      },
    })
    await openEnhancement(page)

    await page.getByTestId("ats-panel-cta").click()

    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("Complete seu perfil antes de melhorar para ATS")).toBeVisible()
    await expect(page).toHaveURL(/\/profile-setup(?:\?.*)?$/)
  })

  test("starts ATS enhancement from a ready base profile and lands on the compare page", async ({ page }) => {
    const sessionId = "sess_ats_profile_setup"
    let smartGenerationPayload: Record<string, unknown> | null = null
    let legacyAtsRouteCalled = false

    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 2,
      profile: buildReadyProfileResponse(),
      sessionId,
    })
    await installComparisonApiMock(page, sessionId, {
      generationType: "ATS_ENHANCEMENT",
    })

    await page.route("**/api/profile/smart-generation", async (route) => {
      smartGenerationPayload = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId,
        }),
      })
    })
    await page.route("**/api/profile/ats-enhancement", async (route) => {
      legacyAtsRouteCalled = true
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Legacy ATS route should not be called from profile setup." }),
      })
    })

    await openEnhancement(page)
    await page.getByTestId("ats-panel-cta").click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/resume/compare/${sessionId}$`))
    await expect(page.getByTestId("resume-comparison-view")).toBeVisible()

    expect(legacyAtsRouteCalled).toBe(false)
    expect(smartGenerationPayload).toEqual({
      certifications: [
        {
          issuer: "Amazon",
          name: "AWS Cloud Practitioner",
          year: "2024",
        },
      ],
      education: [
        {
          degree: "Bacharel em Ciencia da Computacao",
          institution: "USP",
          year: "2020",
        },
      ],
      email: "ana@example.com",
      experience: [
        {
          bullets: ["Liderei a plataforma principal da empresa."],
          company: "CurrIA",
          endDate: "Atual",
          location: "Sao Paulo, BR",
          startDate: "2022",
          title: "Senior Backend Engineer",
        },
      ],
      fullName: "Ana Silva",
      linkedin: "https://linkedin.com/in/ana-silva",
      location: "Sao Paulo, BR",
      phone: "+55 11 99999-0000",
      skills: ["TypeScript", "Node.js", "AWS", "PostgreSQL"],
      summary: "Backend engineer focused on platform reliability.",
    })
  })

  test("switches to job targeting from the enhancement mode when a target job is provided", async ({ page }) => {
    const sessionId = "sess_target_profile_setup"
    const targetJobDescription =
      "Vaga para senior backend engineer com foco em AWS, arquitetura distribuida e confiabilidade."
    let targetingPayload: Record<string, unknown> | null = null

    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 2,
      profile: buildReadyProfileResponse(),
      sessionId,
    })
    await installComparisonApiMock(page, sessionId, {
      generationType: "JOB_TARGETING",
      targetJobDescription,
    })

    await page.route("**/api/profile/smart-generation", async (route) => {
      targetingPayload = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId,
        }),
      })
    })

    await openEnhancement(page)
    await page.getByTestId("enhancement-intent-target-job").click()
    await page.getByTestId("target-job-description-input").fill(targetJobDescription)
    await expect(page.getByText(/Adapte seu curr/i)).toBeVisible()
    await page.getByTestId("ats-panel-cta").click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/resume/compare/${sessionId}$`))
    await expect(page.getByTestId("resume-comparison-view")).toBeVisible()

    expect(targetingPayload).toEqual({
      certifications: [
        {
          issuer: "Amazon",
          name: "AWS Cloud Practitioner",
          year: "2024",
        },
      ],
      education: [
        {
          degree: "Bacharel em Ciencia da Computacao",
          institution: "USP",
          year: "2020",
        },
      ],
      email: "ana@example.com",
      experience: [
        {
          bullets: ["Liderei a plataforma principal da empresa."],
          company: "CurrIA",
          endDate: "Atual",
          location: "Sao Paulo, BR",
          startDate: "2022",
          title: "Senior Backend Engineer",
        },
      ],
      fullName: "Ana Silva",
      linkedin: "https://linkedin.com/in/ana-silva",
      location: "Sao Paulo, BR",
      phone: "+55 11 99999-0000",
      skills: ["TypeScript", "Node.js", "AWS", "PostgreSQL"],
      summary: "Backend engineer focused on platform reliability.",
      targetJobDescription,
    })
  })

  test("blocks empty target-job submit locally before generation starts", async ({ page }) => {
    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 2,
      profile: buildReadyProfileResponse(),
    })

    let smartGenerationCalled = false
    let atsEnhancementCalled = false
    await page.route("**/api/profile/smart-generation", async (route) => {
      smartGenerationCalled = true
      await route.abort()
    })
    await page.route("**/api/profile/ats-enhancement", async (route) => {
      atsEnhancementCalled = true
      await route.abort()
    })

    await openEnhancement(page)
    await page.getByTestId("enhancement-intent-target-job").click()
    await page.getByTestId("ats-panel-cta").click()

    await expect(page.getByText("Cole a descrição da vaga para adaptar seu currículo.")).toBeVisible()
    await expect(page.getByTestId("target-job-description-input")).toBeFocused()
    await expect(page).toHaveURL(/\/profile-setup(?:\?.*)?$/)
    expect(smartGenerationCalled).toBe(false)
    expect(atsEnhancementCalled).toBe(false)
  })
})
