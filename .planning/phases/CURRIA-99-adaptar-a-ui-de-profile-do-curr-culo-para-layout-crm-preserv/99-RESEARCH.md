# Phase 99: Adaptar a UI de profile do curriculo para layout CRM preservando 100% da logica e funcionalidade existente - Research

**Researched:** 2026-04-24 [VERIFIED: 99-CONTEXT.md]
**Domain:** Brownfield resume profile UI shell adaptation in Next.js/React without changing profile, import, ATS, or routing logic. [VERIFIED: 99-PRD.md] [VERIFIED: src/components/resume/user-data-page.tsx]
**Confidence:** MEDIUM. The implementation seam is clear in local code, but the setup-page download contract is ambiguous because the PRD requests it while the current page and its tests do not expose it. [VERIFIED: 99-PRD.md] [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace the current sidebar and KPI-shell presentation with the approved clean CRM-style page layout. [VERIFIED: 99-CONTEXT.md]
- Keep a white background, rounded section cards, subtle borders, compact profile header, black primary action buttons, and a two-column information layout. [VERIFIED: 99-CONTEXT.md]
- Do not reintroduce a global dashboard header inside this component. [VERIFIED: 99-CONTEXT.md]
- Do not keep the current preview sidebar or KPI cards unless a specific existing behavior truly depends on them. [VERIFIED: 99-CONTEXT.md]
- `src/components/resume/user-data-page.tsx` remains the canonical source of truth for handlers, state, and network calls. [VERIFIED: 99-CONTEXT.md]
- Existing flows must be preserved instead of rewritten: import modal, save, enhancement, dialogs, generation loading, and any download behavior already present in the current implementation. [VERIFIED: 99-CONTEXT.md]
- Use the current `VisualResumeEditor` rather than building a disconnected second editor. [VERIFIED: 99-CONTEXT.md]
- If edit buttons are added to section cards, they must trigger real section-edit behavior by opening, focusing, or revealing the existing editor state. [VERIFIED: 99-CONTEXT.md]
- Keep disabled, loading, toast, and validation behavior functionally identical to the current implementation. [VERIFIED: 99-CONTEXT.md]
- Render from the real page state (`resumeData`, normalized/sanitized data, `template`, existing profile response) rather than mock examples. [VERIFIED: 99-CONTEXT.md]
- Preserve current empty-state behavior and do not hardcode sample content into the production page. [VERIFIED: 99-CONTEXT.md]
- Long content must remain accessible through scroll-safe section containers rather than truncation-only rendering. [VERIFIED: 99-CONTEXT.md]
- Update or add focused tests to lock preserved behavior while asserting the new edit affordances and layout-specific overflow behavior. [VERIFIED: 99-CONTEXT.md]
- Do not rely on brittle snapshot-only coverage. [VERIFIED: 99-CONTEXT.md]

### Claude's Discretion
- None specified in `99-CONTEXT.md`. [VERIFIED: 99-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)
- Resume history redesign or new history routes. [VERIFIED: 99-CONTEXT.md]
- Replacing the current editing flow with a brand-new editor. [VERIFIED: 99-CONTEXT.md]
- Changing current API endpoints, credits semantics, or rewrite logic. [VERIFIED: 99-CONTEXT.md]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESUME-PROFILE-CRM-01 | The page must adopt the approved CRM-style layout with compact header, two-column section cards, black primary actions, and no KPI/sidebar shells while preserving current data sources, save/load flow, import flow, enhancement flow, dialogs, toasts, and route contracts. [VERIFIED: .planning/REQUIREMENTS.md] | Keep all side effects, fetches, dialogs, and routing in `user-data-page.tsx`; replace only the preview/KPI shell with read-only CRM cards rendered from `sanitizeResumeData(resumeData)` and `cvStateToTemplateData(...)`; preserve `ImportResumeModal`, `GenerationLoading`, and current CTA/test seams. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] |
| RESUME-PROFILE-EDIT-01 | Section edit affordances must trigger the real existing editing behavior by reusing `VisualResumeEditor`, preserving section expand/focus semantics, disabled/loading states, and canonical `resumeData` normalization plus sanitization. [VERIFIED: .planning/REQUIREMENTS.md] | Add a small external section-focus request API to `VisualResumeEditor` instead of building a second editor; keep the editor mounted on the page and have CRM card edit buttons open, scroll to, and focus the relevant existing section. [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: src/components/resume/user-data-page.tsx] |
| RESUME-PROFILE-TEST-01 | Focused regressions must prove load/save, import modal access, section edit actions, ATS and target-job setup flows, missing-requirements and rewrite-validation dialogs, empty-state rendering, and overflow-safe long-content behavior without snapshot-only assertions. [VERIFIED: .planning/REQUIREMENTS.md] | Preserve current RTL and E2E seams, replace the preview-order assertion with CRM-shell assertions, add editor-focus tests in `visual-resume-editor.test.tsx`, and keep `profile-save-button`, `target-job-description-input`, `ats-panel-cta`, and modal/toast flows stable. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: src/components/resume/visual-resume-editor.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Preserve the existing brownfield product surface unless the user explicitly changes scope. [VERIFIED: CLAUDE.md]
- Prefer reliability, billing safety, observability, and verification over net-new feature breadth. [VERIFIED: CLAUDE.md]
- Follow the surrounding file style; newer frontend files often use double quotes. [VERIFIED: CLAUDE.md]
- Use `@/*` imports, kebab-case filenames, camelCase functions, and named exports except where Next.js expects default exports. [VERIFIED: CLAUDE.md]
- Keep route handlers thin, validate external input with `zod`, and prefer structured server logs through `logInfo`, `logWarn`, and `logError`. [VERIFIED: CLAUDE.md]
- Treat `cvState` as canonical resume truth and `agentState` as operational context only. [VERIFIED: CLAUDE.md]
- Preserve dispatcher and `ToolPatch` patterns when changing agent flows. This phase should avoid touching them because the page already uses profile-specific endpoints rather than direct agent patches. [VERIFIED: CLAUDE.md] [VERIFIED: src/components/resume/user-data-page.tsx]
- Prefer small, test-backed changes over broad rewrites in sensitive flows. [VERIFIED: CLAUDE.md]

## Summary

`src/components/resume/user-data-page.tsx` currently owns all profile-side effects that matter for this phase: initial `GET /api/profile` load, `PUT /api/profile` save, LinkedIn/PDF import handoff, ATS and target-job generation dispatch, missing-items modal, rewrite-validation modal, toast behavior, and routing to `/dashboard/resume/compare/:sessionId`. Those seams are already centralized and should remain in this file. [VERIFIED: src/components/resume/user-data-page.tsx]

The safest implementation is to delete only the presentation shell that is clearly cosmetic today: the left preview sidebar, its collapse toggle, and the KPI/stat cards. In their place, render read-only CRM cards from the existing derived data seam (`sanitizeResumeData(resumeData)` -> `cvStateToTemplateData(...)`) and keep the real `VisualResumeEditor` mounted as the only editing surface. Card edit buttons should not edit local card state; they should send a section-focus request into `VisualResumeEditor`, open the corresponding section if needed, scroll the editor into view, and focus the first real control. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] [VERIFIED: 99-CONTEXT.md]

The zip reference is useful only for visual shell patterns. Its `ResumeProfilePage` uses local `viewMode`, hardcoded credits, a fake timeout for generation, and `console.log` for download, so importing its behavior would violate the locked brownfield requirement. Reuse its compact header, two-column card composition, and scroll-safe section shell pattern, but keep production behavior on the current CurrIA seams. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-header.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-section.tsx] [VERIFIED: 99-PRD.md]

**Primary recommendation:** Replace the preview/KPI shell with CRM read-only cards, keep `UserDataPage` as the stateful orchestrator, keep `VisualResumeEditor` mounted as the only editor, and add a minimal external section-focus API to the editor instead of building any new edit or generation flows. [VERIFIED: 99-CONTEXT.md] [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | Repo-pinned `14.2.3`, published 2024-04-24; registry latest `16.2.4`, modified 2026-04-18. [VERIFIED: package.json] [VERIFIED: npm registry] | The profile page is served from App Router files under `src/app/(auth)/dashboard/resumes/new/page.tsx` and its alias. [VERIFIED: src/app/(auth)/dashboard/resumes/new/page.tsx] [VERIFIED: src/app/(auth)/dashboard/resume/new/page.tsx] | Do not upgrade framework runtime in this phase; the safe path is a shell-only brownfield change. [VERIFIED: 99-CONTEXT.md] [VERIFIED: 99-PRD.md] |
| React | Repo-pinned `18.3.1`, published 2024-04-26; registry latest `19.2.5`, modified 2026-04-22. [VERIFIED: package.json] [VERIFIED: npm registry] | `UserDataPage` and `VisualResumeEditor` are client components built with local state, effects, and memoized derived display data. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx] | Keep the current React version and patterns; no new rendering model is needed to implement the CRM shell. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx] |
| Tailwind CSS | Repo-pinned `3.4.19`, published 2025-12-10; registry latest `4.2.4`, modified 2026-04-23. [VERIFIED: package.json] [VERIFIED: npm registry] | The current page, editor, modal, and zip reference all use Tailwind utility layouts for cards, flex constraints, and overflow behavior. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] | The required CRM shell can be implemented entirely with existing utilities; no layout library addition is justified. [VERIFIED: 99-PRD.md] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-section.tsx] |
| lucide-react | Repo-pinned `0.577.0`, published 2026-03-04; registry latest `1.9.0`, modified 2026-04-23. [VERIFIED: package.json] [VERIFIED: npm registry] | The current page already imports `PenLine`, `Upload`, `Target`, `Loader2`, and related icons. [VERIFIED: src/components/resume/user-data-page.tsx] | Reuse existing icon inventory for the CRM edit buttons and header actions. [VERIFIED: 99-PRD.md] [VERIFIED: src/components/resume/user-data-page.tsx] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `VisualResumeEditor` | Local component, current repo seam. [VERIFIED: src/components/resume/visual-resume-editor.tsx] | Canonical manual editor, open-section state, normalization defaults, and import progress visualization. [VERIFIED: src/components/resume/visual-resume-editor.tsx] | Use for every real edit action; extend it with a section-focus request instead of building another editor. [VERIFIED: 99-CONTEXT.md] [VERIFIED: src/components/resume/visual-resume-editor.tsx] |
| `ImportResumeModal` | Local component, current repo seam. [VERIFIED: src/components/resume/resume-builder.tsx] | Handles LinkedIn and PDF import flows, background polling, replacement confirmation, and success callbacks into the page. [VERIFIED: src/components/resume/resume-builder.tsx] | Keep it mounted from `UserDataPage` and preserve the current open/close + import-start/import-finish wiring. [VERIFIED: src/components/resume/user-data-page.tsx] |
| `GenerationLoading` | Local component, current repo seam. [VERIFIED: src/components/resume/generation-loading.tsx] | Blocking overlay while ATS or job-targeting generation is in flight. [VERIFIED: src/components/resume/generation-loading.tsx] | Keep it unchanged and continue driving it from `isRunningAtsEnhancement`. [VERIFIED: src/components/resume/user-data-page.tsx] |
| `cvStateToTemplateData` + `sanitizeResumeData` | Local helper seam. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] | Produces display-safe contact, summary, period, grouped skill, education, and certification data from canonical state. [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] | Use it for the CRM read-only cards so the display shell stays aligned with the canonical page state. [VERIFIED: 99-CONTEXT.md] [VERIFIED: src/components/resume/user-data-page.tsx] |
| Vitest + Testing Library | Repo-pinned `1.6.0` and `16.3.2`, published 2024-05-03 and 2026-01-19; installed Vitest CLI reports `1.6.1`. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: local CLI] | Existing focused regression harness for page behavior and editor seams. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: src/components/resume/visual-resume-editor.test.tsx] | Use for the primary phase gate. [VERIFIED: .planning/config.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mounted existing editor with section-focus request. [VERIFIED: src/components/resume/visual-resume-editor.tsx] | A hidden drawer/modal editor. [ASSUMED] | A hidden editor would materially change existing direct-input and test contracts and would add new visibility state with no business gain in this phase. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts] |
| Existing inline generation card, restyled in the new shell. [VERIFIED: src/components/resume/user-data-page.tsx] | The zip reference's separate enhancement view mode. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] | The zip view mode duplicates generation state and uses mock handlers, while the current page already has working ATS and target-job contracts. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] [VERIFIED: src/components/resume/user-data-page.tsx] |
| CRM cards rendered from real sanitized/template data. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] | Preserving the current preview sidebar and collapse toggle. [VERIFIED: src/components/resume/user-data-page.tsx] | The preview sidebar is presentation-only today and has only one direct unit assertion; keeping it would fight the approved layout for little value. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: 99-CONTEXT.md] |

**Installation:**
```bash
# No new packages for Phase 99.
npm install
```

**Version verification:** The repo should stay on its pinned runtime versions for this phase even though newer registry versions exist; verified current registry metadata is recorded above so the planner does not confuse "safe for this phase" with "latest available". [VERIFIED: package.json] [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure
```text
src/components/resume/
├── user-data-page.tsx          # Keep state, fetches, dialogs, toasts, routing, and layout composition here.
├── visual-resume-editor.tsx    # Keep canonical editor ownership here; add section reveal/focus support here.
├── resume-builder.tsx          # Keep import modal and import lifecycle here.
├── generation-loading.tsx      # Keep generation overlay here.
└── (optional) crm-profile-cards.tsx  # Only extract stateless presentational cards if user-data-page.tsx becomes unreadable.
```
The optional extraction should stay presentation-only; no network calls, route pushes, or dialog state should leave `user-data-page.tsx` in this phase. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-CONTEXT.md]

### Pattern 1: Stateful Page, Stateless CRM Cards
**What:** Keep `UserDataPage` as the single owner of `resumeData`, profile source metadata, import state, save state, generation state, dialogs, and navigation, and render the new CRM shell from existing derived state only. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-CONTEXT.md]

**When to use:** Use for the whole phase. This is the safest way to change layout without touching endpoint contracts or generation behavior. [VERIFIED: 99-PRD.md] [VERIFIED: src/components/resume/user-data-page.tsx]

**Example:**
```tsx
// Source: existing derivation seam in user-data-page.tsx and cv-state-to-template-data.ts
const sanitizedResumeData = useMemo(() => sanitizeResumeData(resumeData), [resumeData])
const template = useMemo(() => cvStateToTemplateData(sanitizedResumeData), [sanitizedResumeData])

<ProfileSectionCard
  title="Resumo profissional"
  onEdit={() => requestEditorSection("summary")}
>
  {template.summary ? (
    <p>{template.summary}</p>
  ) : (
    <EmptySection message="Adicione um resumo profissional para exibir esta seção." />
  )}
</ProfileSectionCard>
```

### Pattern 2: External Section-Focus Request Into `VisualResumeEditor`
**What:** Add a narrow prop such as `editRequest?: { section: EditableSectionId; nonce: number }` to `VisualResumeEditor`, consume it in an effect, open the requested section in `openSections`, scroll the editor anchor into view, and focus the first real field for that section. [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: 99-CONTEXT.md]

**When to use:** Use for the new black edit buttons on summary, experience, skills, education, and certifications cards. [VERIFIED: 99-PRD.md]

**Example:**
```tsx
// Source: based on the current openSections seam in visual-resume-editor.tsx
useEffect(() => {
  if (!editRequest) return

  setOpenSections((current) => ({
    ...current,
    [editRequest.section]: true,
  }))

  sectionRefs[editRequest.section]?.current?.scrollIntoView?.({
    block: "start",
    behavior: "smooth",
  })
  firstFieldRefs[editRequest.section]?.current?.focus?.()
}, [editRequest])
```

### Pattern 3: Desktop Internal Scroll, Mobile Natural Scroll
**What:** Constrain height only on large screens, and make each long-content card internally scrollable with `min-h-0`, `overflow-hidden`, and an inner `overflow-y-auto` region. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-section.tsx]

**When to use:** Use for the main CRM cards, especially experience and skills, so long real data stays visible without reintroducing the old page-level sidebar behavior. [VERIFIED: 99-CONTEXT.md] [VERIFIED: 99-PRD.md]

**Example:**
```tsx
// Source: adapted from the reference zip section shell and the current page flex constraints
<div className="min-h-screen bg-background lg:h-screen lg:overflow-hidden">
  <div className="flex h-full flex-col lg:min-h-0">
    <Header className="shrink-0" />
    <GenerationCard className="shrink-0" />

    <div className="flex flex-1 flex-col gap-4 lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 lg:min-h-0">
        <SectionCard className="lg:flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto" />
        </SectionCard>
      </div>
    </div>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Copying the zip logic:** The reference zip hardcodes `currentCredits = 3`, uses `setTimeout` for generation, and logs download to the console. Do not port any of that behavior. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx]
- **Building a second editor:** `VisualResumeEditor` already owns normalization defaults, section open state, add/remove item behavior, and import progress animation. A second editor would drift quickly. [VERIFIED: src/components/resume/visual-resume-editor.tsx]
- **Rendering cards from raw `resumeData` arrays:** `normalizeResumeData()` always keeps at least one empty experience, education, and certification row, so raw arrays produce ghost items. Render display cards from sanitized/template data instead. [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts]
- **Keeping preview slicing behavior:** The current preview sidebar slices skills, experience, education, and certifications and uses fake placeholder copy. That violates the new long-content and real-data requirements if reused unchanged. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-PRD.md]
- **Renaming or deleting stable test seams casually:** `profile-save-button`, `target-job-description-input`, `ats-panel-cta`, and the import modal entrypoint are used by existing RTL and E2E tests. Preserve them or update every dependent test in the same change. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section editing from CRM cards. [VERIFIED: 99-PRD.md] | A new card-local form, modal, or duplicated field tree. [VERIFIED: 99-PRD.md] | `VisualResumeEditor` plus a section-focus request API. [VERIFIED: src/components/resume/visual-resume-editor.tsx] | The existing editor already owns add/remove behavior, default rows, import animation, and disabled handling. [VERIFIED: src/components/resume/visual-resume-editor.tsx] |
| Read-only profile formatting. [VERIFIED: 99-CONTEXT.md] | New formatting helpers for periods, grouped skills, summary extraction, or empty-row filtering. [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] | `sanitizeResumeData` and `cvStateToTemplateData`. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] | Those helpers already normalize blank rows, summary structure, and display-oriented fields from canonical `cvState`. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/templates/cv-state-to-template-data.ts] |
| Import flows. [VERIFIED: 99-CONTEXT.md] | A new LinkedIn/PDF modal or custom polling loop inside the page. [VERIFIED: src/components/resume/resume-builder.tsx] | `ImportResumeModal` with current `onImportStarted`, `onImportFinished`, and `onImportSuccess` hooks. [VERIFIED: src/components/resume/resume-builder.tsx] [VERIFIED: src/components/resume/user-data-page.tsx] | The modal already handles busy state, replacement confirmation, toast lifecycle, and background polling. [VERIFIED: src/components/resume/resume-builder.tsx] |
| ATS readiness and blocking validation. [VERIFIED: src/components/resume/user-data-page.tsx] | Ad hoc client-side checks embedded in new card components. [VERIFIED: 99-PRD.md] | `assessAtsEnhancementReadiness(...)` and `getAtsEnhancementBlockingItems(...)`. [VERIFIED: src/lib/profile/ats-enhancement.ts] | Reusing the existing helpers preserves incomplete-profile messages, disabled-state reasoning, and dialog content. [VERIFIED: src/lib/profile/ats-enhancement.ts] [VERIFIED: src/components/resume/user-data-page.tsx] |
| Setup-page download action. [VERIFIED: 99-PRD.md] | A fake button or new ad hoc download pipeline inside `UserDataPage`. [VERIFIED: 99-PRD.md] | The existing compare/download flow, or an explicit follow-up decision if product insists on setup-page download. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/resume-comparison-view.tsx] | I did not find a real download seam in `UserDataPage` or its tests, so adding a setup-page download button now would otherwise be speculative. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx] |

**Key insight:** The safest Phase 99 implementation is composition, not replacement: reuse the current stateful seams and swap only the read-only presentation shell around them. [VERIFIED: 99-CONTEXT.md] [VERIFIED: src/components/resume/user-data-page.tsx]

## Common Pitfalls

### Pitfall 1: Porting Mock Behaviors From The Zip
**What goes wrong:** The team copies the zip's local `viewMode`, fake credits, fake generation timeout, or `console.log` download action into production code. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx]
**Why it happens:** The visual reference looks close to the target layout, so it is easy to forget that it is a mock shell. [VERIFIED: 99-PRD.md] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx]
**How to avoid:** Treat the zip as a visual token source only and keep all production behavior on the existing CurrIA page handlers. [VERIFIED: 99-PRD.md] [VERIFIED: src/components/resume/user-data-page.tsx]
**Warning signs:** New local state such as `viewMode`, fake `currentCredits`, or button handlers that no longer call the current page functions is a red flag. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] [VERIFIED: src/components/resume/user-data-page.tsx]

### Pitfall 2: Creating Decorative Edit Buttons
**What goes wrong:** The new CRM cards show edit icons, but clicking them only toggles local UI or does nothing. [VERIFIED: 99-PRD.md]
**Why it happens:** `VisualResumeEditor` currently has no external section-focus API, so a superficial shell-only change is tempting. [VERIFIED: src/components/resume/visual-resume-editor.tsx]
**How to avoid:** Add a real section-focus request prop to `VisualResumeEditor` and test both the page wire-up and the editor response. [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: src/components/resume/visual-resume-editor.test.tsx]
**Warning signs:** Tests only assert that the icon exists, not that the corresponding section opens or receives focus. [VERIFIED: src/components/resume/user-data-page.test.tsx]

### Pitfall 3: Reusing Preview Placeholders And Slices
**What goes wrong:** Long experience or skills content disappears because the new cards still slice to 4 experiences or 12 skills, or empty states show fake sample text. [VERIFIED: src/components/resume/user-data-page.tsx]
**Why it happens:** The current preview sidebar is optimized for a narrow summary preview, not for the new CRM cards. [VERIFIED: src/components/resume/user-data-page.tsx]
**How to avoid:** Render full arrays in scrollable card bodies and replace sample placeholders with explicit empty-state copy. [VERIFIED: 99-CONTEXT.md] [VERIFIED: 99-PRD.md]
**Warning signs:** Any retained `.slice(...)`, `line-clamp-*`, or placeholder copy such as "Sua formação aparece aqui" in the new CRM shell is a regression risk. [VERIFIED: src/components/resume/user-data-page.tsx]

### Pitfall 4: Breaking Stable Test And E2E Selectors
**What goes wrong:** The visual refactor passes locally by inspection but breaks focused RTL or Playwright coverage because stable selectors or accessible names disappear. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts]
**Why it happens:** The current page tests mock the editor and assert against specific button names and test IDs. [VERIFIED: src/components/resume/user-data-page.test.tsx]
**How to avoid:** Preserve `profile-save-button`, `target-job-description-input`, `ats-panel-cta`, and the import button behavior, and replace only the one preview-specific test that truly no longer matches the new shell. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts]
**Warning signs:** A diff that changes labels or `data-testid`s without an accompanying test update is not safe. [VERIFIED: src/components/resume/user-data-page.test.tsx]

### Pitfall 5: Hiding The Editor By Default
**What goes wrong:** The page becomes visually cleaner, but existing manual editing, import follow-through, and current tests now require extra clicks or can no longer find the real fields. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts]
**Why it happens:** A strict interpretation of the CRM reference can push the implementation toward a read-only shell with a hidden editor. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx]
**How to avoid:** Keep `VisualResumeEditor` mounted in the page DOM for Phase 99 and let the new read-only cards act as a shell above it rather than as a replacement for it. [VERIFIED: src/components/resume/visual-resume-editor.tsx] [VERIFIED: 99-CONTEXT.md]
**Warning signs:** If the first edit-related RTL or E2E assertion now needs a modal open or route change that did not exist before, the phase is expanding scope. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts]

## Code Examples

Verified patterns from current sources and safe brownfield extension points:

### Derive Read-Only CRM Cards From Canonical Page State
```tsx
// Source: src/components/resume/user-data-page.tsx and src/lib/templates/cv-state-to-template-data.ts
const sanitizedResumeData = useMemo(() => sanitizeResumeData(resumeData), [resumeData])
const template = useMemo(() => cvStateToTemplateData(sanitizedResumeData), [sanitizedResumeData])

const summaryText = template.summary.trim()
const experienceItems = template.experiences
const educationItems = template.education
const certificationItems = template.certifications
```

### Wire Card Edit Buttons To The Real Editor
```tsx
// Source: safe extension of src/components/resume/user-data-page.tsx
const [editRequest, setEditRequest] = useState<{
  section: "summary" | "experience" | "skills" | "education" | "certifications"
  nonce: number
} | null>(null)

function handleEditSection(section: "summary" | "experience" | "skills" | "education" | "certifications") {
  setEditRequest({ section, nonce: Date.now() })
  editorAnchorRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })
}

<VisualResumeEditor
  value={resumeData}
  onChange={setResumeData}
  disabled={isSaving || isRunningAtsEnhancement}
  importProgressSource={activeImportSource}
  editRequest={editRequest}
/>
```

### Preserve The Existing Generation Contract In A Restyled Card
```tsx
// Source: src/components/resume/user-data-page.tsx
<Textarea
  id="target-job-description"
  data-testid="target-job-description-input"
  value={targetJobDescription}
  onChange={(event) => setTargetJobDescription(event.target.value)}
  disabled={isBusy}
/>

<Button
  data-testid="ats-panel-cta"
  disabled={isBusy || currentCredits < 1}
  onClick={() => void handleSetupGeneration()}
>
  {generationCopy.buttonIdle}
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reference zip uses local mock behaviors for generation, credits, and download. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] | Safe production approach is to reuse the current `UserDataPage` handlers and endpoints while borrowing only the zip's shell direction. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-PRD.md] | Phase 99 research recommendation dated 2026-04-24. [VERIFIED: 99-CONTEXT.md] | Prevents logic drift while still achieving the approved CRM look. [VERIFIED: 99-CONTEXT.md] |
| Current page uses a preview sidebar with fake placeholders and sliced arrays. [VERIFIED: src/components/resume/user-data-page.tsx] | Recommended Phase 99 shell uses full real-data CRM cards with internal scroll and explicit empty states. [VERIFIED: 99-CONTEXT.md] [VERIFIED: 99-PRD.md] | Phase 99 research recommendation dated 2026-04-24. [VERIFIED: 99-CONTEXT.md] | Removes the main layout mismatch and satisfies the long-content requirement without inventing new logic. [VERIFIED: 99-CONTEXT.md] |

**Deprecated/outdated:**
- The current KPI/stat strip is presentation-only and conflicts with the approved CRM shell, so it should be retired unless a hidden dependency is discovered during implementation. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-CONTEXT.md]
- The current preview sidebar collapse behavior is presentation-only today and should not be preserved just to satisfy an obsolete unit assertion. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The setup page should not add a new download button in Phase 99 unless the user confirms a real existing download contract for this screen, because no such contract was found in the current page or its tests. [ASSUMED] | Summary, Don't Hand-Roll, Open Questions | Medium. If product explicitly expects setup-page download parity, the planner will need a separate scoped task instead of silently omitting it. |

## Open Questions

1. **What is the intended setup-page download contract?**
   - What we know: The PRD and context mention preserving or placing `Download PDF` in the header, but `src/components/resume/user-data-page.tsx` and `src/components/resume/user-data-page.test.tsx` do not currently expose any download action on this page. [VERIFIED: 99-PRD.md] [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx]
   - What's unclear: Whether Phase 99 should omit the button, show a disabled placeholder, or wire into an existing setup-page artifact contract that lives outside the current page. [ASSUMED]
   - Recommendation: Treat download as out of scope for this phase unless the user points to the exact current setup-page download seam; otherwise the safe path is to keep compare-page download behavior unchanged and not invent a fake header action. [VERIFIED: src/components/resume/resume-comparison-view.tsx] [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next/Vitest/Playwright execution for local validation. [VERIFIED: package.json] | ✓ [VERIFIED: local CLI] | `24.14.0`. [VERIFIED: local CLI] | — |
| npm | Project scripts and package metadata validation. [VERIFIED: package.json] | ✓ [VERIFIED: local CLI] | `11.9.0`. [VERIFIED: local CLI] | — |
| Next CLI | Smoke-checking the pinned app runtime if needed. [VERIFIED: package.json] | ✓ [VERIFIED: local CLI] | `14.2.3`. [VERIFIED: local CLI] | Use `npm run dev` if direct `npx next --version` is not desired. [VERIFIED: package.json] |
| Vitest CLI | Focused component/page regression runs. [VERIFIED: vitest.config.ts] | ✓ [VERIFIED: local CLI] | `1.6.1`. [VERIFIED: local CLI] | Use `npm test` or `npx vitest run ...`. [VERIFIED: package.json] |
| Playwright CLI | Optional targeted E2E smoke for the profile setup flow. [VERIFIED: tests/e2e/profile-setup.spec.ts] | ✓ [VERIFIED: local CLI] | `1.59.1`. [VERIFIED: local CLI] | Fallback to RTL if a quick unit-only gate is needed, but Playwright is available here. [VERIFIED: local CLI] |

**Missing dependencies with no fallback:**
- None. [VERIFIED: local CLI]

**Missing dependencies with fallback:**
- None. [VERIFIED: local CLI]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `1.6.1` for component/unit regressions plus Playwright `1.59.1` for optional profile-flow smoke coverage. [VERIFIED: local CLI] [VERIFIED: tests/e2e/profile-setup.spec.ts] |
| Config file | `vitest.config.ts`, `vitest.setup.ts`, and `playwright.config.ts`. [VERIFIED: vitest.config.ts] [VERIFIED: vitest.setup.ts] [VERIFIED: codebase grep] |
| Quick run command | `npx vitest run src/components/resume/user-data-page.test.tsx src/components/resume/visual-resume-editor.test.tsx` [VERIFIED: vitest.config.ts] |
| Full suite command | `npm test && npx playwright test tests/e2e/profile-setup.spec.ts --project=chromium` [VERIFIED: package.json] [VERIFIED: tests/e2e/profile-setup.spec.ts] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESUME-PROFILE-CRM-01 | CRM shell preserves load/save/import/generation/dialog contracts while removing preview/KPI presentation. [VERIFIED: .planning/REQUIREMENTS.md] | unit + smoke [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts] | `npx vitest run src/components/resume/user-data-page.test.tsx` [VERIFIED: vitest.config.ts] | `src/components/resume/user-data-page.test.tsx` exists. [VERIFIED: src/components/resume/user-data-page.test.tsx] |
| RESUME-PROFILE-EDIT-01 | Card edit buttons open, reveal, and focus the real editor section. [VERIFIED: .planning/REQUIREMENTS.md] | component + page integration [VERIFIED: src/components/resume/visual-resume-editor.test.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx] | `npx vitest run src/components/resume/visual-resume-editor.test.tsx src/components/resume/user-data-page.test.tsx` [VERIFIED: vitest.config.ts] | Both files exist, but they need new assertions for the section-focus seam. [VERIFIED: src/components/resume/visual-resume-editor.test.tsx] [VERIFIED: src/components/resume/user-data-page.test.tsx] |
| RESUME-PROFILE-TEST-01 | Empty certifications card, overflow-safe long content, import modal access, missing-requirements dialog, and rewrite-validation dialog stay covered without snapshots. [VERIFIED: .planning/REQUIREMENTS.md] | unit + targeted smoke [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts] | `npx vitest run src/components/resume/user-data-page.test.tsx && npx playwright test tests/e2e/profile-setup.spec.ts --project=chromium` [VERIFIED: vitest.config.ts] [VERIFIED: tests/e2e/profile-setup.spec.ts] | Existing files exist, but targeted cases must be expanded. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: tests/e2e/profile-setup.spec.ts] |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/resume/user-data-page.test.tsx src/components/resume/visual-resume-editor.test.tsx` [VERIFIED: vitest.config.ts]
- **Per wave merge:** `npx playwright test tests/e2e/profile-setup.spec.ts --project=chromium` after the focused RTL suite is green. [VERIFIED: tests/e2e/profile-setup.spec.ts]
- **Phase gate:** `npm test && npx playwright test tests/e2e/profile-setup.spec.ts --project=chromium` before `/gsd-verify-work`. [VERIFIED: package.json] [VERIFIED: tests/e2e/profile-setup.spec.ts]

### Wave 0 Gaps
- [ ] Replace the preview-order assertion in `src/components/resume/user-data-page.test.tsx` with CRM-card assertions, because the current preview sidebar is the one shell explicitly approved for retirement. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: 99-CONTEXT.md]
- [ ] Add focused unit coverage in `src/components/resume/visual-resume-editor.test.tsx` for the new section-focus request prop opening the correct section and focusing the first input. [VERIFIED: src/components/resume/visual-resume-editor.test.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx]
- [ ] Add focused unit coverage in `src/components/resume/user-data-page.test.tsx` for each CRM edit button, empty certifications rendering, and scroll-safe long-content containers. [VERIFIED: src/components/resume/user-data-page.test.tsx] [VERIFIED: 99-PRD.md]
- [ ] Add one targeted Playwright smoke in `tests/e2e/profile-setup.spec.ts` for clicking a section edit button and landing on the corresponding real field, if the planner wants end-to-end confidence on the new seam. [ASSUMED]

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes. The page lives under the authenticated dashboard route and is rendered with `getCurrentAppUser()` plus Clerk user context. [VERIFIED: src/app/(auth)/dashboard/resumes/new/page.tsx] [VERIFIED: CLAUDE.md] | Clerk plus the app-user boundary already used by the route. [VERIFIED: CLAUDE.md] [VERIFIED: src/app/(auth)/dashboard/resumes/new/page.tsx] |
| V3 Session Management | yes. The page is inside the authenticated dashboard surface and continues to rely on existing session/auth handling rather than introducing new stateful auth flows. [VERIFIED: src/app/(auth)/dashboard/resumes/new/page.tsx] [VERIFIED: CLAUDE.md] | Preserve Clerk/dashboard session usage exactly as-is. [VERIFIED: CLAUDE.md] |
| V4 Access Control | yes. The page triggers protected profile and generation endpoints and must not add new routes or bypass the current route contract. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-CONTEXT.md] | Reuse `/api/profile`, `/api/profile/ats-enhancement`, and `/api/profile/smart-generation` through existing handlers only. [VERIFIED: src/components/resume/user-data-page.tsx] |
| V5 Input Validation | yes. The phase continues to submit user-controlled profile fields and target-job text, and the project convention requires thin routes with `zod` validation. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: package.json] [VERIFIED: CLAUDE.md] | Preserve existing server-side validation flows and do not replace them with client-only checks. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/lib/profile/ats-enhancement.ts] |
| V6 Cryptography | no direct change. This phase is UI shell work, not crypto work. [VERIFIED: 99-CONTEXT.md] | Do not introduce any new crypto or token-handling behavior in this phase. [VERIFIED: 99-CONTEXT.md] |

### Known Threat Patterns for This Stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS through resume text rendered in the new cards. [VERIFIED: src/components/resume/user-data-page.tsx] | Tampering / Information Disclosure | Keep rendering through normal React text nodes and do not introduce `dangerouslySetInnerHTML` for summary, bullets, or contact content. [VERIFIED: src/components/resume/user-data-page.tsx] |
| Unauthorized behavior drift via new ad hoc endpoints or routes. [VERIFIED: 99-CONTEXT.md] | Elevation of Privilege | Do not add new routes; keep all actions on the existing protected endpoints already called by `UserDataPage`. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: 99-CONTEXT.md] |
| Client-side data drift between read-only cards and the real editor. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx] | Tampering | Derive display cards from the same canonical `resumeData` state and use the existing editor as the only mutation surface. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx] |

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` - project invariants, brownfield constraints, stack, conventions, and architecture rules. [VERIFIED: CLAUDE.md]
- `.planning/REQUIREMENTS.md` - Phase 99 requirement IDs and acceptance scope. [VERIFIED: .planning/REQUIREMENTS.md]
- `.planning/phases/CURRIA-99-adaptar-a-ui-de-profile-do-curr-culo-para-layout-crm-preserv/99-CONTEXT.md` - locked decisions and out-of-scope constraints. [VERIFIED: 99-CONTEXT.md]
- `.planning/phases/CURRIA-99-adaptar-a-ui-de-profile-do-curr-culo-para-layout-crm-preserv/99-PRD.md` - detailed UI and behavior preservation requirements. [VERIFIED: 99-PRD.md]
- `src/components/resume/user-data-page.tsx` - current page state ownership, preview shell, generation flow, dialogs, and route pushes. [VERIFIED: src/components/resume/user-data-page.tsx]
- `src/components/resume/user-data-page.test.tsx` - current focused regression contracts and the one preview-order test that should be retired. [VERIFIED: src/components/resume/user-data-page.test.tsx]
- `src/components/resume/visual-resume-editor.tsx` - canonical edit surface, default row behavior, and section state seam. [VERIFIED: src/components/resume/visual-resume-editor.tsx]
- `src/components/resume/visual-resume-editor.test.tsx` - current editor seam tests. [VERIFIED: src/components/resume/visual-resume-editor.test.tsx]
- `src/components/resume/resume-builder.tsx` - import modal lifecycle and PDF/LinkedIn behavior. [VERIFIED: src/components/resume/resume-builder.tsx]
- `src/components/resume/generation-loading.tsx` - generation overlay seam. [VERIFIED: src/components/resume/generation-loading.tsx]
- `src/lib/templates/cv-state-to-template-data.ts` - display derivation seam. [VERIFIED: src/lib/templates/cv-state-to-template-data.ts]
- `src/lib/profile/ats-enhancement.ts` - readiness and blocking-item validation seam. [VERIFIED: src/lib/profile/ats-enhancement.ts]
- `src/types/cv.ts` - canonical CV state shape. [VERIFIED: src/types/cv.ts]
- `tests/e2e/profile-setup.spec.ts` - end-to-end profile setup coverage. [VERIFIED: tests/e2e/profile-setup.spec.ts]
- `b_Wj12d9cRyft.zip/components/resume/*` - visual shell reference and mock behaviors to avoid porting. [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-header.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-section.tsx]
- npm registry metadata for `next`, `react`, `tailwindcss`, `lucide-react`, `vitest`, and `@testing-library/react`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- None. All material claims above were verified directly against repo code, local runtime, or npm registry metadata in this session. [VERIFIED: local CLI]

### Tertiary (LOW confidence)
- None beyond the explicit assumptions listed in the Assumptions Log. [VERIFIED: 99-CONTEXT.md]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions, local runtime availability, and the no-new-dependency recommendation were all verified directly. [VERIFIED: package.json] [VERIFIED: npm registry] [VERIFIED: local CLI]
- Architecture: HIGH - the state owner, editor seam, import seam, generation seam, and preview shell are explicit in local code. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: src/components/resume/visual-resume-editor.tsx]
- Pitfalls: HIGH - each major risk maps to a verified local seam or to verified mock behavior in the zip reference. [VERIFIED: src/components/resume/user-data-page.tsx] [VERIFIED: b_Wj12d9cRyft.zip/components/resume/resume-profile-page.tsx]

**Research date:** 2026-04-24. [VERIFIED: 99-CONTEXT.md]
**Valid until:** 2026-05-24 for planning purposes, unless the user clarifies the setup-page download contract sooner. [ASSUMED]
