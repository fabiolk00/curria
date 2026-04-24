# Phase 100: Clarify ATS enhancement intent selector while preserving target-job generation behavior - Research

## User Constraints (from CONTEXT.md)

### Locked Decisions
- In scope: the ATS enhancement / target-job enhancement screen only. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Out of scope: the profile editing form, resume history, compare experience, backend behavior, generation contracts, and any new generation flow. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Preserve 100% of existing functionality and backend contracts. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Reuse the enhancement logic already in `src/components/resume/user-data-page.tsx`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Preserve and keep wiring around:
  - `targetJobDescription`
  - `setTargetJobDescription`
  - `generationMode`
  - `generationCopy`
  - `handleSetupGeneration`
  - `isRunningAtsEnhancement`
  - `currentCredits`
  - `getGenerationCopy`
  - `SetupGenerationMode` [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Preserve the existing endpoint choice:
  - `/api/profile/ats-enhancement`
  - `/api/profile/smart-generation` [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Add a UI-only intent state: `type EnhancementIntent = "ats" | "target_job"`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Default intent is `"ats"`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Keep `generationMode` as the behavior source of truth for the actual request flow if other logic depends on it. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- The new selector must use accessible `button` elements with `aria-pressed`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- ATS mode hides the large textarea and shows a compact ATS explanation card. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Target-job mode shows the textarea prominently with label, helper copy, and balanced height. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- The CTA copy must clearly match the visible intent:
  - ATS: `Melhorar para ATS (1 crédito)`
  - Target job: `Adaptar para esta vaga (1 crédito)` [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- The top bar must keep the existing back behavior and show the selected mode plus available credits. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- The right-hand value panel should be visually stronger but remain subtle, mostly white, with emerald accents only in the value bullets/highlights. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Selecting ATS must clear `targetJobDescription`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Typing into the textarea must keep or switch the UI intent to target-job mode. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Submitting target-job mode without a non-empty description must show a validation message and must not call `handleSetupGeneration`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Do not duplicate fetch logic, do not replace `handleSetupGeneration`, and do not change endpoint selection, credit logic, or route-after-success behavior. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Preserve:
  - back to profile behavior
  - missing ATS requirements dialog
  - rewrite validation failure dialog
  - success and error toasts
  - compare-page redirect after success
  - loading and disabled states
  - existing tests unless the UI contract intentionally updates them [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]

### Claude's Discretion
- None explicitly listed in `100-CONTEXT.md`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)
- No resume profile redesign work. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- No resume history work. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- No new generation pipeline or endpoint. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- No billing, validation-engine, or rewrite-rule changes. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless the user explicitly changes scope. [VERIFIED: codebase read - CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: codebase read - CLAUDE.md]
- Treat PDF profile upload and other onboarding expansion work as deferred unless reprioritized. [VERIFIED: codebase read - CLAUDE.md]
- Stay within Next.js 14 App Router, React 18, and TypeScript for this surface. [VERIFIED: codebase read - CLAUDE.md][VERIFIED: package.json]
- Use `@/*` imports, kebab-case filenames, camelCase functions, and named exports except where Next.js expects defaults. [VERIFIED: codebase read - CLAUDE.md]
- Keep route handlers thin, validate external input with `zod`, and prefer small, test-backed changes over broad rewrites. [VERIFIED: codebase read - CLAUDE.md]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: codebase read - CLAUDE.md]
- The client should stay relatively shallow, and large orchestration modules should not be rewritten for this phase. [VERIFIED: codebase read - CLAUDE.md]

## Standard Stack

- The screen already lives in the existing frontend stack: `next@14.2.3`, `react@18.3.1`, `typescript@5.4.5`, Tailwind CSS, and shadcn/Radix-style UI primitives. Newer registry releases exist as of 2026-04-24 (`next@16.2.4`, `react@19.2.5`, `typescript@6.0.3`), so Phase 100 should preserve the pinned project stack instead of bundling upgrades into a UI-only change. [VERIFIED: package.json][VERIFIED: npm registry]
- The current test stack for this screen is `vitest@1.6.0` with `@testing-library/react@16.3.2` for component coverage and `@playwright/test@1.59.1` for browser coverage. [VERIFIED: package.json][VERIFIED: npm registry]
- `user-data-page.tsx` already composes the enhancement panel from existing `Button`, `Badge`, `Dialog`, `Textarea`, and `cn(...)` utilities, so the selector should be built from the same primitives instead of a new state or form library. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:1-41,902-1019]

## Existing Seams To Preserve

- `generationMode` is currently derived only from `targetJobDescription.trim()`: empty text means `"ats_enhancement"`, and non-empty text means `"job_targeting"`. That derivation is the current behavior seam. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447]
- `handleSetupGeneration()` currently does all behavior-critical work in one sequence: local ATS blocking check, requirements dialog, `persistProfile()`, endpoint selection, POST, 400 missing-items dialog, 422 rewrite-validation dialog, success toast, compare-route push, and loading cleanup. That sequence must stay intact. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:449-512]
- Endpoint choice is fixed inside the handler: ATS uses `/api/profile/ats-enhancement`, and target-job uses `/api/profile/smart-generation`. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:462-476]
- The generation POST body always sends `sanitizeResumeData(resumeData)` plus `targetJobDescription: trimOptional(targetJobDescription)`. Do not change that payload shape. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:466-475]
- `setupGenerationButtonDisabled` only depends on `isBusy || currentCredits < 1`; ATS readiness messaging does not disable the CTA today. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:580-586,999-1007]
- Visible panel copy and visuals currently come from `generationCopy = getGenerationCopy(generationMode)` and `generationFeatures = generationMode === "job_targeting" ? targetJobFeatures : atsFeatures`. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447,904-973]
- The missing-requirements dialog title and description are also driven by `generationCopy`, so any display-mode refactor has to keep those strings aligned with the visible user intent. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:1039-1058]
- The rewrite-validation dialog title and description depend on `rewriteValidationFailure.workflowMode`, which falls back to `data.workflowMode ?? generationMode`. That fallback must keep using behavior mode, not a cosmetic selector mode. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:486-492,1062-1122]
- The loading overlay title comes from `generationType={generationMode === "job_targeting" ? "JOB_TARGETING" : "ATS_ENHANCEMENT"}` and renders `Adaptando para a vaga` vs `Otimizando para ATS`. Keep that tied to request behavior. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:1125-1127][VERIFIED: codebase read - src/components/resume/generation-loading.tsx:134-155]
- Success navigation from this component is `router.push("/dashboard/resume/compare/:sessionId")`; do not change this component to push straight to `/dashboard`. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:500-506][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:302-310,438-440,546-555]
- The CTA currently carries dashboard guide targeting props via `getDashboardGuideTargetProps(dashboardWelcomeGuideTargets.profileAtsCta)`. That instrumentation should stay attached after the selector refactor. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:999-1007][VERIFIED: codebase read - src/lib/dashboard/welcome-guide.ts:6-8,42,68]
- The component tests and E2E tests already prove that typing a target job switches visible copy to job targeting, and clearing it returns visible copy to ATS. Those expectations must still hold, even if the trigger becomes an explicit selector plus typing. [VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:539-556,603-611][VERIFIED: codebase read - tests/e2e/profile-setup.spec.ts:404-472,475-508]

## Recommended UI Architecture

- Add `type EnhancementIntent = "ats" | "target_job"` as local UI state only, defaulting to `"ats"`. Do not send it to the server. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Keep `generationMode` exactly as it is today and continue using it for endpoint selection, payload semantics, loading overlay type, and rewrite-validation fallback. That preserves the current backend contract. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-512,1125-1127]
- Introduce a separate `displayMode` derived from `enhancementIntent`, and use `displayMode` for `generationCopy`, `generationFeatures`, the visible top-bar mode label, the visible CTA label, and textarea visibility. A separate display mode is necessary because explicit target-job intent can exist before any text is present, while `generationMode` cannot. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447,904-1019]
- ATS selector click should do only UI-local work: set intent to `"ats"`, clear `targetJobDescription`, and clear any local empty-target validation message. The context explicitly requires ATS selection to clear the target description. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Target-job selector click should set intent to `"target_job"` without changing the request handler. Typing in the textarea should keep or switch the intent to `"target_job"`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Add a tiny local preflight in the CTA click path: if `enhancementIntent === "target_job"` and `!targetJobDescription.trim()`, show a local validation message near the textarea and return before calling `handleSetupGeneration()`. This satisfies the new requirement without touching the handler internals. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:449-512]
- Keep empty-target validation local to the enhancement panel instead of reusing existing dialogs or toasts, because the current dialogs already represent ATS completeness failures and rewrite-validation failures, and the existing toast assertions cover server/schema errors. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:480-512,1039-1128][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:713-720]
- Keep the CTA enabled whenever `!isBusy && currentCredits >= 1`, even when target-job intent is selected and the textarea is empty, so the required validation message can appear on submit. Moving empty-target validation into the disabled state would hide the required user feedback path. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:585-586,999-1007]
- Preserve the existing `data-testid` hooks where the same elements still exist, especially `ats-panel-cta` and `target-job-description-input`, because the current unit and E2E coverage already depends on them. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:930-938,999-1007][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:424,539,603,830,950][VERIFIED: codebase read - tests/e2e/profile-setup.spec.ts:427,498,562]

Recommended state split: [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447,904-1019]

```tsx
type EnhancementIntent = "ats" | "target_job"

const [enhancementIntent, setEnhancementIntent] = useState<EnhancementIntent>("ats")
const [targetJobValidationMessage, setTargetJobValidationMessage] = useState<string | null>(null)

const generationMode: SetupGenerationMode =
  targetJobDescription.trim() ? "job_targeting" : "ats_enhancement"

const displayMode: SetupGenerationMode =
  enhancementIntent === "target_job" ? "job_targeting" : "ats_enhancement"

const generationCopy = getGenerationCopy(displayMode)
const generationFeatures = displayMode === "job_targeting" ? targetJobFeatures : atsFeatures

const handleEnhancementSubmit = () => {
  if (enhancementIntent === "target_job" && !targetJobDescription.trim()) {
    setTargetJobValidationMessage("...")
    return
  }

  void handleSetupGeneration()
}
```

## Don't Hand-Roll

- Do not duplicate `handleSetupGeneration()` or split ATS and target-job into separate fetch implementations. The existing handler already owns persist, endpoints, dialogs, toasts, and routing. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:449-512]
- Do not drive backend behavior from `enhancementIntent`; drive backend behavior from the existing `generationMode` seam. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447,462-476]
- Do not add a new endpoint or remap the current endpoints. `/api/profile/ats-enhancement` and `/api/profile/smart-generation` are the locked contracts for this screen. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:462-476]
- Do not change success routing to bypass the compare page. Preserve the current compare-route handoff. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:500-506]
- Do not drop the guide-target props from the CTA. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:999-1007]
- Do not expand scope into import, profile save, preview-column layout, or editor behavior. Those paths are separate and already covered elsewhere in the same component test file and E2E spec. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:394-443,601-898][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:1231-1387][VERIFIED: codebase read - tests/e2e/profile-setup.spec.ts:86-272]

## Common Pitfalls

- If `enhancementIntent` becomes the only mode state, the screen will change backend semantics, because explicit target-job selection can exist with an empty textarea while the current request mode cannot. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447]
- If visible copy keeps following `generationMode`, the new selector will look broken: target-job can be selected, but the panel will still show ATS badge/title/helper/features until text exists. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447,904-1019]
- If the local empty-target check runs after `handleSetupGeneration()`, the user can see the ATS completeness dialog or trigger persistence/network work when the locked contract says to block locally first. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:449-512]
- If ATS selection hides the textarea without clearing `targetJobDescription`, `generationMode` will stay in `job_targeting` and silently keep target-job request behavior. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447]
- If empty target-job state is expressed only as `disabled`, the required validation message path disappears and the state becomes ambiguous to the user. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- If the selector is built from non-button elements, the phase will miss the explicit accessibility requirement for `button` plus `aria-pressed`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- If tests are updated broadly instead of around the enhancement panel, the phase will create churn without increasing protection on the actual seam. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx][VERIFIED: codebase read - tests/e2e/profile-setup.spec.ts]

## Test Strategy

- Keep `src/components/resume/user-data-page.test.tsx` as the main proof surface. It already covers ATS happy-path endpoint selection, target-job happy-path endpoint selection, loading overlay, credit gating, ATS requirements dialog, schema-error toast handling, and compare-route push. [VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:107-311,313-720,1018-1228,1400-1415]
- Update only enhancement-panel tests in that file. Do not rewrite import, save, cancel, or editor tests for this phase. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:1231-1387]
- Add one unit test for the new default UI: ATS intent selected, ATS explanation visible, textarea hidden, CTA label `Melhorar para ATS (1 crédito)`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Add one unit test for the new explicit target-job path: selecting target-job reveals the textarea, target-job helper copy, and CTA label `Adaptar para esta vaga (1 crédito)`. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Add one unit test for the new local guard: target-job intent plus empty textarea shows a validation message, performs no extra fetches after profile load, and does not navigate. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- Update existing target-job happy-path tests so they select target-job before typing, then keep the current endpoint and navigation assertions against `/api/profile/smart-generation` and `/dashboard/resume/compare/:sessionId`. [VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:443-556]
- Keep the ATS happy-path tests asserting `/api/profile/ats-enhancement`, the compare-route push, and the ATS loading title `Otimizando para ATS`. [VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:206-311,313-441][VERIFIED: codebase read - src/components/resume/generation-loading.tsx:134-155]
- Keep the current 400 missing-items dialog, 422 rewrite-validation dialog, and schema-error toast tests. Only adjust their setup steps if the target-job textarea is hidden behind explicit target-job selection. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:480-512,1039-1128][VERIFIED: codebase read - src/components/resume/user-data-page.test.tsx:697-720,1018-1228]
- Update only the enhancement-screen steps in `tests/e2e/profile-setup.spec.ts`. ATS and target-job browser flows should keep asserting the same payload semantics and session landing behavior, but target-job flows will need to click the new selector before filling the textarea. [VERIFIED: codebase read - tests/e2e/profile-setup.spec.ts:339-508]
- Add one E2E smoke test for explicit target-job selection with an empty textarea, and assert that the browser stays on the setup screen and shows the local validation message. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]
- The existing repo commands already support focused validation through `vitest run` and `playwright test`; no new test toolchain is needed for this phase. [VERIFIED: package.json]

## Open Questions (resolved if possible)

1. Should visible panel copy follow the new selector or the old request seam?
   - Resolved: visible copy should follow the explicit selector through a separate `displayMode`, while request semantics stay on `generationMode`. That is the only way to support explicit target-job selection before a description exists without changing backend behavior. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-447,904-1019]

2. Should empty target-job submission reuse the ATS completeness dialog?
   - Resolved: no. The ATS completeness dialog is already tied to `getAtsEnhancementBlockingItems(...)` and server `missingItems` handling inside `handleSetupGeneration()`, so empty target-job must be blocked locally before that flow runs. [VERIFIED: codebase read - src/components/resume/user-data-page.tsx:449-512,1039-1058][VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md]

3. Does Phase 100 need backend or generation-pipeline changes?
   - Resolved: no. The context explicitly keeps backend behavior, generation contracts, billing, rewrite rules, and endpoint semantics out of scope, and the current component already contains the correct request seams to preserve. [VERIFIED: codebase read - .planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md][VERIFIED: codebase read - src/components/resume/user-data-page.tsx:445-512]

## Sources

- `c:/CurrIA/.planning/phases/CURRIA-100-clarify-ats-enhancement-intent-selector-while-preserving-tar/100-CONTEXT.md` - locked UI and behavior contract. [VERIFIED: codebase read]
- `c:/CurrIA/src/components/resume/user-data-page.tsx` - current screen state, handlers, dialogs, endpoints, routing, and CTA wiring. [VERIFIED: codebase read]
- `c:/CurrIA/src/components/resume/generation-loading.tsx` - loading title behavior for ATS vs target-job flows. [VERIFIED: codebase read]
- `c:/CurrIA/src/components/resume/user-data-page.test.tsx` - component-level regression expectations. [VERIFIED: codebase read]
- `c:/CurrIA/tests/e2e/profile-setup.spec.ts` - browser-level regression expectations around the setup funnel. [VERIFIED: codebase read]
- `c:/CurrIA/CLAUDE.md` - project constraints and engineering invariants. [VERIFIED: codebase read]
- `c:/CurrIA/package.json` plus npm registry lookups on 2026-04-24 - local stack versions and current registry versions. [VERIFIED: package.json][VERIFIED: npm registry]
