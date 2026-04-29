import fs from "node:fs"

import { expect, test, type Page, type TestInfo } from "@playwright/test"

import type { RecoverableValidationBlock } from "../../src/types/agent"
import { authenticateE2EUser } from "./fixtures/auth-session"
import { installCoreFunnelApiMocks } from "./fixtures/api-mocks"

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
        summary: "Profissional de BI com foco em dados e automacao.",
        experience: [{
          title: "Analista de Dados",
          company: "Acme",
          location: "Sao Paulo, BR",
          startDate: "2022",
          endDate: "Atual",
          bullets: ["Criei dashboards e integracoes para areas de negocio."],
        }],
        skills: ["SQL", "Power BI", "Power Automate"],
        education: [{
          degree: "Bacharel em Sistemas de Informacao",
          institution: "USP",
          year: "2020",
        }],
        certifications: [],
      },
      profilePhotoUrl: null,
      createdAt: "2026-04-10T11:00:00.000Z",
      updatedAt: "2026-04-10T11:00:00.000Z",
      extractedAt: "2026-04-10T11:00:00.000Z",
      linkedinUrl: "https://linkedin.com/in/ana-silva",
    },
  }
}

function buildComparisonResponse(sessionId: string) {
  const originalCvState = buildReadyProfileResponse().profile.cvState

  return {
    sessionId,
    generationType: "JOB_TARGETING" as const,
    targetJobDescription: "Vaga para Analista de Sistemas de RH",
    originalCvState,
    optimizedCvState: {
      ...originalCvState,
      summary: "Profissional de BI e dados com experiencia em dashboards, automacao e integracao de dados.",
    },
    optimizationSummary: {
      changedSections: ["summary"],
      notes: ["Resumo ajustado para a vaga alvo."],
    },
  }
}

function buildRecoverableBlock(overrideToken: string): RecoverableValidationBlock {
  return {
    status: "validation_blocked_recoverable" as const,
    overrideToken,
    expiresAt: "2099-04-27T16:30:00.000Z",
    modal: {
      title: "Encontramos pontos que podem exagerar sua experiencia",
      description: "A adaptacao para esta vaga ficou mais agressiva do que o seu curriculo original comprova.",
      primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
      problemBullets: [
        "A versao pode ter declarado requisitos da vaga como experiencia direta.",
      ],
      reassurance: "Voce ainda pode gerar o curriculo, mas recomendamos revisar.",
      actions: {
        secondary: { label: "Fechar", action: "close" as const },
        primary: {
          label: "Gerar mesmo assim (1 crédito)",
          action: "override_generate" as const,
          creditCost: 1,
        },
      },
    } as const,
  }
}

async function installAnalyticsCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const analyticsEvents: Array<[string, string, Record<string, unknown>]> = []
    ;(window as typeof window & { __curriaAnalyticsEvents?: typeof analyticsEvents }).__curriaAnalyticsEvents = analyticsEvents
    window.gtag = (...args: unknown[]) => {
      const [action, eventName, params] = args as [string, string, Record<string, unknown>]
      analyticsEvents.push([action, eventName, params ?? {}])
    }
  })
}

async function readAnalyticsEvents(page: Page) {
  return page.evaluate(() => {
    return (window as typeof window & {
      __curriaAnalyticsEvents?: Array<[string, string, Record<string, unknown>]>
    }).__curriaAnalyticsEvents ?? []
  })
}

async function saveEvidence(
  page: Page,
  testInfo: TestInfo,
  name: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  })
  fs.writeFileSync(
    testInfo.outputPath(`${name}.json`),
    JSON.stringify(payload, null, 2),
    "utf8",
  )
}

test.describe("recoverable validation credit refresh", () => {
  test("profile setup keeps the blocked version and flips the CTA after credit refresh", async ({ page }, testInfo) => {
    const sessionId = "sess_e2e_recoverable_profile"
    const overrideToken = "override_profile_token"
    let billingCredits = 1
    let smartGenerationCalls = 0
    let overrideCalls = 0
    const overrideTokens: string[] = []

    await installAnalyticsCapture(page)
    await installCoreFunnelApiMocks(page, {
      sessionId,
      profile: buildReadyProfileResponse(),
    })
    await page.route("**/api/profile/smart-generation", async (route) => {
      smartGenerationCalls += 1
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId,
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
          recoverableValidationBlock: buildRecoverableBlock(overrideToken),
        }),
      })
    })
    await page.route("**/api/billing/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          currentCredits: billingCredits,
          currentPlan: "plus",
          activeRecurringPlan: null,
        }),
      })
    })
    await page.route(`**/api/session/${sessionId}/job-targeting/override`, async (route) => {
      overrideCalls += 1
      const body = route.request().postDataJSON() as {
        overrideToken: string
        consumeCredit: boolean
      }
      overrideTokens.push(body.overrideToken)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId,
          creditsUsed: 1,
          resumeGenerationId: "gen_e2e_profile_override",
          generationType: "JOB_TARGETING",
        }),
      })
    })
    await page.route(`**/api/session/${sessionId}/comparison`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildComparisonResponse(sessionId)),
      })
    })

    await authenticateE2EUser(page, {
      appUserId: "usr_e2e_profile_recoverable",
      displayName: "Recoverable Profile User",
      email: "recoverable-profile@example.com",
      creditsRemaining: 1,
    })

    await page.goto("/profile-setup")
    await page.getByRole("button", { name: /Melhorar curr/i }).click()
    await page.getByTestId("enhancement-intent-target-job").click()
    await page.getByTestId("target-job-description-input").fill("Vaga para Analista de Sistemas de RH")
    await page.getByTestId("ats-panel-cta").click()

    await expect(page.getByRole("button", { name: "Gerar mesmo assim (1 crédito)" })).toBeVisible()

    billingCredits = 0
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"))
    })

    await expect(page.getByRole("button", { name: "Adicionar créditos" })).toBeVisible()
    await page.getByRole("button", { name: "Adicionar créditos" }).click()
    await expect(page.getByRole("dialog").filter({ hasText: "Escolha seu novo plano" })).toBeVisible()

    await saveEvidence(page, testInfo, "profile-setup-pricing-open", {
      billingCredits,
      smartGenerationCalls,
      overrideCalls,
    })

    billingCredits = 1
    await page.keyboard.press("Escape")
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"))
    })

    await expect(page.getByRole("button", { name: "Gerar mesmo assim (1 crédito)" })).toBeVisible()
    await page.getByRole("button", { name: "Gerar mesmo assim (1 crédito)" }).click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/resume/compare/${sessionId}$`))

    const analyticsEvents = await readAnalyticsEvents(page)
    expect(smartGenerationCalls).toBe(1)
    expect(overrideCalls).toBe(1)
    expect(overrideTokens).toEqual([overrideToken])
    expect(analyticsEvents).toContainEqual([
      "event",
      "agent.job_targeting.validation_override_credit_added",
      expect.objectContaining({
        source: "profile_setup",
      }),
    ])

    await saveEvidence(page, testInfo, "profile-setup-override-success", {
      billingCredits,
      smartGenerationCalls,
      overrideCalls,
      overrideTokens,
      analyticsEvents,
    })
  })
})
