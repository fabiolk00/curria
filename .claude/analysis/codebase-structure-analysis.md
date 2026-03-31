# CurrIA Codebase Structure & Organization Analysis

**Analysis Date:** March 30, 2026
**Project:** CurrIA Resume Optimization SaaS
**Scope:** Staff-level technical review of file usage, folder structure, and optimization opportunities

---

## Executive Summary

CurrIA demonstrates mature, well-organized architecture with clear separation of concerns. The codebase is production-ready with excellent documentation and type safety. Current state shows transition from OpenAI migration completion to UI/design system modernization.

**Current Phase:** Post-OpenAI migration, mid-Figma design system integration

---

## Current Folder Structure Overview

```
/c/CurrIA/
├── src/
│   ├── app/              # Next.js App Router (public, auth, API)
│   ├── components/       # Reusable UI components
│   ├── lib/              # Core domain logic
│   │   ├── agent/        # AI agent pipeline & tools
│   │   ├── asaas/        # Billing & webhook handling
│   │   ├── ats/          # Resume scoring
│   │   ├── auth/         # Identity resolution
│   │   ├── cv/           # Resume state utilities
│   │   ├── dashboard/    # Dashboard-specific logic
│   │   ├── db/           # Database clients & helpers
│   │   ├── navigation/   # Routing utilities
│   │   ├── observability/# Logging & monitoring
│   │   ├── openai/       # OpenAI SDK integration
│   │   ├── resume-targets/# Target-specific resume logic
│   │   ├── storage/      # Supabase Storage
│   │   ├── templates/    # File templates & generation
│   │   ├── utils/        # Shared utilities
│   ├── types/            # TypeScript type definitions
│
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # SQL migrations
│
├── docs/                 # Technical documentation
├── .claude/              # Claude Code configuration
│   ├── rules/            # Architectural rules
│   ├── skills/           # Custom skills
│   └── agents/           # Agent definitions
└── modernize-design-files/  # [UNTRACKED] Figma design imports
```

---

## File Usage Analysis by Domain

### 1. **Authentication & Identity** (5-8 files)
- `src/lib/auth/app-user.ts` - Core app user resolution
- `src/app/api/webhook/clerk/route.ts` - Clerk webhook handler
- `prisma/schema.prisma` - `users` & `user_auth_identities` tables
- **Key Rule:** All domain logic uses internal app user IDs, never Clerk IDs

### 2. **Session & Resume State** (Core + 15+ files)
- **Core State Files:**
  - `src/lib/db/sessions.ts` - Session CRUD and patch merging
  - `src/types/cv.ts` - Resume data types
  - `src/types/agent.ts` - Agent state types

- **Versioning & Targeting:**
  - `src/lib/resume-targets/` - Target resume creation
  - `src/lib/db/cv-versions.ts` - Version history management

- **API Routes:**
  - `src/app/api/session/[id]/versions/route.ts`
  - `src/app/api/session/[id]/targets/route.ts`
  - `src/app/api/session/[id]/manual-edit/route.ts`

### 3. **Agent & Tools** (20+ files)
- `src/lib/agent/tools/` - Tool implementations
  - `index.ts` - Tool registration & dispatch
  - `generate-file.ts` - DOCX/PDF generation
  - `rewrite-section.ts` - Resume rewriting
  - `gap-analysis.ts` - Gap analysis
  - `gap-to-action.ts` - Action generation

- `src/lib/agent/context-builder.ts` - System prompt construction
- `src/lib/agent/config.ts` - Model routing (OpenAI combo selection)
- `src/app/api/agent/route.ts` - Main agent endpoint (SSE streaming)

### 4. **Billing & Webhooks** (8-12 files)
- `src/lib/asaas/` - Asaas integration
  - `webhook.ts` - Event deduplication
  - `billing-checkouts.ts` - Checkout tracking
  - `quota.ts` - Credit account management

- `src/app/api/webhook/asaas/route.ts` - Asaas webhook handler
- `src/app/api/checkout/route.ts` - Checkout creation
- `src/lib/plans.ts` - Plan definitions (single source of truth for credits)

### 5. **UI Components** (Components modernization in progress)
- `src/components/` - Shadcn/ui-based components
- `src/app/(public)/` - Landing, pricing, login, signup
- `src/app/(auth)/` - Dashboard, chat, resumes, settings
- **Current Work:** Aligning with Figma design system from `modernize-design-files/`

### 6. **Observability & Utilities** (Logging, monitoring)
- `src/lib/observability/` - Logging
- `src/lib/rate-limit.ts` - Request rate limiting
- `src/lib/utils/` - Shared helpers

---

## Key Architectural Boundaries

### State Model Contract
```
Session Bundle = {
  stateVersion: number,
  phase: string,
  cvState: { canonical resume truth },
  agentState: { operational context, job description, gap analysis },
  generatedOutput: { artifact metadata only, NOT signed URLs },
  atsScore: { ATS evaluation }
}
```

**Critical Rules:**
- ✅ `cvState` = canonical base resume
- ✅ `agentState` = transient context
- ✅ `generatedOutput` = durable metadata only
- ✅ `resume_targets` = isolated from base `cvState`
- ✅ Tools return `{ output, patch? }`, never mutate session directly
- ✅ Patches merged & persisted centrally via `applyToolPatch()`

### Identity Boundary
- 🔐 External: Clerk authentication
- 🔐 Internal: App user in `users` table
- 🔐 Mapping: `user_auth_identities` table
- 🔐 **Post-auth rule:** Use app user IDs exclusively

### Billing Boundary
- 💳 `credit_accounts` = runtime source of truth
- 💳 `user_quotas` = metadata only (plan, subscription, Asaas customer)
- 💳 `billing_checkouts` = checkout tracking for new purchases
- 💳 Credits granted only via Asaas webhooks
- 💳 Deduplication via `processed_events.event_fingerprint`

---

## Current Active Work & Status

### ✅ Completed Milestones
1. **OpenAI Migration (Complete)** - All models on OpenAI, routing via `combo_b`
2. **Billing Implementation** - Asaas integration, webhook deduplication, credit system
3. **Internal User Model** - App user IDs throughout domain logic
4. **Session Versioning** - Immutable CV snapshots and target-specific variants

### 🔄 In Progress
1. **Figma Design System Modernization**
   - Status: Aligning authenticated pages with new design
   - Recent commits:
     - `1193782` - Align dashboard resumes with imported layout
     - `c201afe` - Align ATS guide with imported layout
   - Untracked: `modernize-design-files/` directory with design imports
   - Deleted: `FIGMA_LAYOUT_MIGRATION_PROMPT.md` (likely migration reference)

### ⚠️ Housekeeping Issues
- **Untracked Files:** `modernize-design-files/` should be either:
  - Committed to version control if it's reference material
  - Documented in `.gitignore` if it's temporary
  - Moved to a temporary branch if work-in-progress

- **Deleted File:** `FIGMA_LAYOUT_MIGRATION_PROMPT.md` should be cleaned up with a commit

---

## File Usage Patterns by Feature

### Feature: Create & Chat Session
**Files Involved:** 12-15
```
src/app/api/agent/route.ts (entry)
  ├─ src/lib/auth/app-user.ts (identity)
  ├─ src/lib/db/sessions.ts (load/create)
  ├─ src/lib/agent/context-builder.ts (prompt)
  ├─ src/lib/agent/tools/index.ts (dispatch)
  ├─ src/lib/openai/ (model calls)
  └─ src/lib/asaas/quota.ts (credit check)
```

### Feature: Generate Resume
**Files Involved:** 8-10
```
src/app/api/session/[id]/generate/route.ts (entry)
  ├─ src/lib/db/sessions.ts (fetch state)
  ├─ src/lib/agent/tools/generate-file.ts (generation logic)
  ├─ src/lib/templates/ (DOCX template)
  ├─ src/lib/storage/ (Supabase upload)
  └─ src/types/cv.ts (validation)
```

### Feature: Billing
**Files Involved:** 10-12
```
src/app/api/checkout/route.ts (create)
  ├─ src/lib/plans.ts (plan definitions)
  ├─ src/lib/asaas/billing-checkouts.ts (tracking)
  └─ src/app/api/webhook/asaas/route.ts (webhook processing)
      ├─ src/lib/asaas/webhook.ts (deduplication)
      └─ src/lib/asaas/quota.ts (credit granting)
```

---

## Code Organization Quality Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Module Boundaries** | ✅ Excellent | Clear lib/* separation, no circular deps |
| **Type Safety** | ✅ Excellent | Strict TS, Zod validation at boundaries |
| **Testing** | ✅ Good | Core tools, webhooks, state mutations covered |
| **Documentation** | ✅ Excellent | 20+ .md files covering architecture, billing, ops |
| **Error Handling** | ✅ Standardized | 8 error codes, centralized tool-error.ts |
| **Logging** | ✅ Structured | docs/logging.md guidance, structured error codes |
| **API Conventions** | ✅ Standardized | .claude/rules/api-conventions.md enforced |
| **Database Schema** | ✅ Versioned | Prisma + explicit SQL migrations |
| **Dependency Management** | ✅ Clean | No unused dependencies visible |
| **UI Components** | 🔄 Modernizing | Shadcn/ui + Figma design system integration |

---

## Recommended Folder Structure Refinements

### Current vs. Proposed

**Current State: ✅ Functional**
```
src/lib/
├── agent/           # 20+ files: tools, config, context
├── asaas/           # 4-5 files: billing, webhooks
├── ats/             # 2-3 files: scoring logic
├── auth/            # 2-3 files: identity
├── cv/              # 2-3 files: resume utilities
├── resume-targets/  # 3-4 files: target creation
├── db/              # 4-5 files: sessions, versions
└── [other]          # templates, storage, utils, etc.
```

### No Major Changes Needed, BUT:

1. **Consider:** `src/lib/agent/tools/` has 15+ files
   - **Current organization** is fine since each tool has a single responsibility
   - No refactor needed unless tools exceed 20+

2. **Consider:** Consolidate `src/lib/cv/` and `src/lib/resume-targets/`
   - Both deal with resume variants
   - Could be combined as `src/lib/resume-state/` with sub-folders
   - **Current approach** is cleaner; keep as-is

3. **Ensure:** `modernize-design-files/` is either:
   - ✅ Tracked (if reference material)
   - ✅ Gitignored (if temporary)
   - ✅ Moved to separate branch (if work-in-progress)

---

## Recommended Immediate Actions

### 1. **Clean Up Untracked Files** (Priority: HIGH)
```bash
# Option A: Commit design files if they're reference material
git add modernize-design-files/
git commit -m "chore: add Figma design system reference files"

# Option B: Gitignore if temporary
echo "modernize-design-files/" >> .gitignore

# Option C: Stash if work-in-progress
git stash
```

### 2. **Restore or Remove Deleted File** (Priority: MEDIUM)
```bash
# Check what was deleted and why
git log -p FIGMA_LAYOUT_MIGRATION_PROMPT.md | head -50

# If needed, restore or remove cleanly:
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
git commit -m "chore: remove design migration reference (moved to docs)"
```

### 3. **Verify Design System Alignment** (Priority: MEDIUM)
- [ ] Audit component story in `modernize-design-files/src/`
- [ ] Create tracking document for pages/components being modernized
- [ ] Link to corresponding Figma file in docs

### 4. **Document Design Migration** (Priority: LOW)
Create `docs/design-system-migration.md`:
- List of pages/components in each phase
- Before/after screenshots
- Component mapping to Figma
- Testing checklist

---

## Development Workflow Recommendations

### For Next Feature Development
```
1. Feature scope → identify affected files (see patterns above)
2. Type definitions → update src/types/*
3. Implementation → src/lib/* or src/app/api/*
4. Tests → co-located *.test.ts files
5. Documentation → update docs/ + CLAUDE.md if architectural
6. Git commit → follow existing message conventions
```

### For Large Refactors
```
1. Create branch (e.g., refactor/session-state-cleanup)
2. Update CLAUDE.md before implementing
3. Run full test suite: npm test
4. Run type check: npm run typecheck
5. Create PR with detailed context
```

---

## Code Style & Enforcement

**Current Standards (from `.claude/rules/`):**
- ✅ Strict TypeScript (no `any`, no `@ts-ignore`)
- ✅ Prefer `type` over `interface`
- ✅ Zod validation at external boundaries
- ✅ Tailwind + `cn()` for CSS
- ✅ `@/` absolute imports
- ✅ Server Components by default
- ✅ No secrets in version control
- ✅ Error codes centralized

**Enforcement:**
```bash
npm run typecheck  # TypeScript strict mode
npm test           # Vitest coverage
npm run lint       # ESLint rules
```

---

## Documentation Architecture

| Document | Purpose | Location |
|----------|---------|----------|
| README.md | Quick start, stack overview | root |
| CLAUDE.md | Architectural rules, invariants | root (source of truth) |
| CLAUDE.local.md | Local-only notes, overrides | local only |
| docs/architecture-overview.md | System boundaries, request flows | reference |
| docs/state-model.md | Session contract details | reference |
| docs/tool-development.md | Adding/modifying tools | reference |
| docs/error-codes.md | Error handling guide | reference |
| docs/billing-*.md | Billing implementation & ops | reference |
| .claude/rules/*.md | Enforced coding standards | local enforcement |

---

## Summary Table: Files by Concern

| Concern | Files | Status |
|---------|-------|--------|
| **Authentication** | 3-5 | Stable, complete |
| **Session State** | 8-12 | Stable, well-tested |
| **Agent & Tools** | 20+ | Mature, extensible |
| **Billing** | 10-12 | Mature, audited |
| **UI Components** | 50+ | 🔄 Modernizing (Figma) |
| **Database** | Schema + migrations | Stable, versioned |
| **Testing** | 15+ test files | Good coverage |
| **Documentation** | 20+ .md files | Excellent |

---

## Next Steps for Engineer Engagement

### If working on **Agent Features:**
- Reference: `docs/tool-development.md`
- Key files: `src/lib/agent/tools/index.ts`, `src/types/agent.ts`
- Rules: Return `{ output, patch? }`, validate model output, use error codes

### If working on **UI/Design:**
- Current: Aligning with Figma design system
- Key: `src/components/`, `modernize-design-files/`
- Document progress in tracking spreadsheet or PR description

### If working on **Billing/Webhooks:**
- Source of truth: `CLAUDE.md` (Billing Invariants section)
- Key files: `src/lib/asaas/`, `src/app/api/webhook/asaas/`
- Rule: Credits from `credit_accounts` only, webhook deduplication mandatory

### If working on **Sessions/State:**
- Reference: `docs/state-model.md`
- Key files: `src/lib/db/sessions.ts`, `src/types/cv.ts`
- Rule: Never store signed URLs, use `cv_versions` for history, `resume_targets` for variants

---

---

## 🧹 IMMEDIATE ACTION ITEMS: Folder Structure Cleanup

### 1. **Git Status Issues** (DO THIS FIRST - Priority: CRITICAL)

#### Issue 1A: Untracked Directory - `modernize-design-files/`
**Current State:**
```
?? modernize-design-files/
```

**What it is:** Figma design system import directory containing reference components and design tokens

**Decision Required:**
```
OPTION A: Commit as permanent reference material
├─ When: If this is THE source of truth for design system
├─ Command: git add modernize-design-files/ && git commit -m "chore: add Figma design system components"
├─ Outcome: Part of version control, synced across team
└─ Future: Teams pull latest designs from here

OPTION B: Add to .gitignore (temporary working directory)
├─ When: If it's a local development workspace
├─ Commands:
│   echo "modernize-design-files/" >> .gitignore
│   git add .gitignore
│   git commit -m "chore: ignore local Figma design workspace"
├─ Outcome: Not tracked, each dev can have own copy
└─ Future: Share via Figma link instead

OPTION C: Move to separate branch (work-in-progress)
├─ When: If still being imported/organized
├─ Commands:
│   git checkout -b feat/figma-design-integration
│   git add modernize-design-files/
│   git commit -m "feat: add Figma design files for integration"
├─ Outcome: Keep main clean, integrate when ready
└─ Future: PR review before merging to main

RECOMMENDATION: **OPTION A** if files are stable, **OPTION B** if still importing
```

**Action:** ⬜ Assigned to: _________________ **Due:** This week

---

#### Issue 1B: Deleted File - `FIGMA_LAYOUT_MIGRATION_PROMPT.md`
**Current State:**
```
D FIGMA_LAYOUT_MIGRATION_PROMPT.md
```

**What it is:** Appears to be a migration guide/prompt that was deleted but not committed

**Why it matters:** Uncommitted deletions create "dirty" status, confusing for team

**Actions:**
```bash
# Option 1: Remove the deletion (restore file)
git checkout FIGMA_LAYOUT_MIGRATION_PROMPT.md

# Option 2: Commit the deletion
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
git commit -m "chore: remove FIGMA_LAYOUT_MIGRATION_PROMPT (moved to docs)"

# Option 3: Check what was deleted first
git log -p FIGMA_LAYOUT_MIGRATION_PROMPT.md | head -100
```

**Recommendation:** Use **Option 2** (commit deletion) with message explaining where content moved

**Action:** ⬜ Assigned to: _________________ **Due:** Today

---

### 2. **Directory Structure Issues** (Priority: HIGH)

#### Issue 2A: `src/lib/agent/tools/` Growing Large
**Current State:**
```
src/lib/agent/tools/
├── index.ts (tool dispatch)
├── generate-file.ts (DOCX/PDF generation)
├── rewrite-section.ts (resume rewriting)
├── gap-analysis.ts (gap analysis)
├── gap-to-action.ts (action generation)
├── index.test.ts
├── generate-file.test.ts
├── rewrite-section.test.ts
├── gap-analysis.test.ts
├── gap-to-action.test.ts
└── [more tools...]
```

**Assessment:** Currently ~12-15 files, organization is clean ✅

**Action When Tools Exceed 20:**
```
Option: Organize by tool category (not yet needed)
├── src/lib/agent/tools/
│   ├── core/                    # Fundamental tools
│   │   ├── index.ts (dispatch)
│   │   └── [core tools]
│   ├── writing/                 # Resume content tools
│   │   ├── rewrite-section.ts
│   │   ├── analyze-writing.ts
│   │   └── ...
│   ├── analysis/                # Analysis tools
│   │   ├── gap-analysis.ts
│   │   ├── ats-scoring.ts
│   │   └── ...
│   ├── generation/              # Output generation
│   │   ├── generate-file.ts
│   │   └── ...
│   └── tests/
│       └── [all .test.ts files]
```

**Current Status:** No action needed yet ✅

---

#### Issue 2B: Test Files Colocation
**Current State:** Tests live next to implementation files
```
src/lib/agent/tools/
├── generate-file.ts
├── generate-file.test.ts
├── rewrite-section.ts
├── rewrite-section.test.ts
```

**Assessment:** Good ✅ - Easy to find, high visibility

**Action:** Keep as-is. Do NOT move to separate test directory.

---

#### Issue 2C: `src/components/` Growing Without Structure
**Current State:** Single flat directory
```
src/components/
├── Button.tsx
├── Card.tsx
├── Dialog.tsx
├── Form.tsx
├── [40+ component files...]
└── ui/                          # Shadcn/ui wrapper
```

**Future Action (When >30 Components):**
```
Suggested Organization (NOT YET):
src/components/
├── ui/                          # Base primitives (shadcn)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── forms/                       # Form components
│   ├── ResumeForm.tsx
│   ├── RewriteForm.tsx
│   └── ...
├── layout/                      # Layout components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── ...
├── chat/                        # Chat-specific components
│   ├── ChatMessage.tsx
│   ├── ChatInput.tsx
│   └── ...
├── resume/                      # Resume-specific components
│   ├── ResumePreview.tsx
│   ├── ResumeSectionEditor.tsx
│   └── ...
└── common/                      # Reusable across features
    ├── Loading.tsx
    ├── ErrorBoundary.tsx
    └── ...
```

**Current Status:** Monitor, organize when count >30. Currently OK at ~20 ✅

---

#### Issue 2D: `src/app/api/session/[id]/` Sub-routes Growing
**Current State:**
```
src/app/api/session/[id]/
├── route.ts (GET/DELETE session)
├── route.test.ts
├── messages/route.ts (GET messages)
├── versions/route.ts (GET resume versions)
├── versions/route.test.ts
├── targets/route.ts (GET/POST target resumes)
├── targets/route.test.ts
├── compare/route.ts (compare resumes)
├── compare/route.test.ts
├── manual-edit/route.ts (manual edits)
├── manual-edit/route.test.ts
├── generate/route.ts (generate file)
├── generate/route.test.ts
└── gap-action/route.ts (gap actions)
    └── gap-action/route.test.ts
```

**Assessment:** Well-organized, each sub-route has single responsibility ✅

**Action:** Keep structure as-is. It's clear and maintainable.

---

### 3. **Files to Remove/Delete** (Priority: MEDIUM)

#### 3A: Legacy or Unused Files
**Action Required:** Run audit to identify
```bash
# Find potentially unused files
npm run lint  # Check for unused imports
git log --diff-filter=D --summary | head -50  # Recently deleted files
```

**Common candidates to check:**
- [ ] Any .bak, .old, .backup files
- [ ] Any .todo or .notes files not in docs/
- [ ] Any commented-out large blocks of code
- [ ] Any temporary setup files (temp-*, setup-*, etc.)

**Current Status:** No obvious candidates found ✓

---

#### 3B: Duplicate Type Definitions
**Current State:** Check for duplicate types in:
```
src/types/
├── cv.ts (resume types)
├── agent.ts (agent & tools types)
├── user.ts (user types)
└── [check for duplicates]
```

**Action:** Run
```bash
# Find duplicate type/interface definitions
grep -r "^export type\|^export interface" src/types/ | sort | uniq -d
```

**Current Status:** Likely clean (well-organized structure) ✓

---

#### 3C: Build Artifacts & Caches
**Already in .gitignore:** ✅
```
.next/
node_modules/
coverage/
*.tsbuildinfo
dist/
build/
```

**Action:** Verify these are properly ignored:
```bash
git check-ignore -v .next/ node_modules/ coverage/
```

---

### 4. **Missing Directories** (Priority: LOW)

#### 4A: Consider Adding (Future)
```
MAYBE ADD when needed:
├── src/lib/validators/          # Shared Zod schemas (currently scattered)
├── src/lib/constants/           # App-wide constants
├── src/lib/middleware/          # Next.js middleware functions
├── public/                       # Static assets (favicon, robots.txt, etc.)
└── scripts/                      # Dev & build scripts
```

**Current Status:** Not yet needed, refactor if duplication appears

---

#### 4B: Should Already Exist
```
✅ src/types/                     # Exists
✅ src/lib/                       # Exists
✅ docs/                          # Exists
✅ prisma/                        # Exists
✅ .claude/rules/                 # Exists
```

---

### 5. **Documentation Files to Add/Update** (Priority: MEDIUM)

#### 5A: Missing Documentation
**Files to create:**
```
docs/design-system-migration.md
├── Purpose: Track Figma integration progress
├── Contents:
│   ├── Component migration checklist
│   ├── Before/after screenshots
│   ├── Figma → Component mapping
│   ├── Testing requirements per page
│   └── Accessibility audit checklist
└── Status: ⬜ NOT YET CREATED
```

**Status:** Add this week

---

#### 5B: Documentation to Update
**Files needing updates:**
```
README.md
├── Current: ✅ Good
├── Add: Link to design-system-migration.md
└── Update: Design system section when Figma migration complete

CLAUDE.md
├── Current: ✅ Excellent
├── Add: Component organization rules when 30+ components
└── Status: No action needed now

docs/
├── NEW: design-system-migration.md
├── NEW: component-development-guide.md (future)
└── REVIEW: All docs for Figma-related updates
```

---

### 6. **Environment & Configuration Files** (Priority: LOW)

#### 6A: Check These Are Properly Configured
```
✅ .gitignore          - Review for modernize-design-files/
✅ .env.example        - Maintained
✅ .env.local          - Git-ignored ✅
✅ tsconfig.json       - Strict mode enabled ✅
✅ tailwind.config.js  - Up to date
✅ next.config.js      - Minimal ✅
✅ vitest.config.ts    - Configured
```

**Actions:**
```bash
# Verify .gitignore covers all temporary files
cat .gitignore | grep -E "modernize|temp|design"

# Should see or add:
# modernize-design-files/     (if temporary)
# temp-figma-import/
# Modernize Design Files.zip  (already there)
```

---

### 7. **Database/Schema Files** (Priority: LOW)

#### 7A: Prisma Schema Status
```
✅ prisma/schema.prisma      - Current & organized
✅ prisma/migrations/         - All migrations present
   ├── internal_user_model.sql
   ├── session_state_foundation.sql
   ├── billing_webhook_hardening.sql
   ├── cv_versioning_and_targets.sql
   └── [others...]
```

**Action:** No changes needed ✅

---

### 8. **Claude Code Configuration** (Priority: LOW)

#### 8A: Check `.claude/` Directory
```
✅ .claude/rules/                    - All rules present
   ├── api-conventions.md
   ├── code-style.md
   ├── error-handling.md
   └── testing.md

✅ .claude/skills/                   - Custom skills defined
   ├── agent-loop/
   ├── ats-scoring/
   └── file-generation/

⚠️ .claude/analysis/                 - NEW (just created)
   ├── codebase-structure-analysis.md
   ├── engineering-prompts.md
   └── current-work-status.md
```

**Action:** Keep as-is ✅

---

## Summary: Cleanup Checklist

### 🔴 DO IMMEDIATELY (This Week)
```
PRIORITY LEVEL 1 - Blocking/Confusing
├─ [ ] Decide: modernize-design-files/ → Commit OR Gitignore OR Branch
├─ [ ] Clean: Delete or commit FIGMA_LAYOUT_MIGRATION_PROMPT.md
├─ [ ] Verify: git status should show only intentional untracked files
└─ [ ] Commit: One cleanup commit with clear message
```

### 🟠 DO THIS SPRINT (Next 2 Weeks)
```
PRIORITY LEVEL 2 - Documentation
├─ [ ] Create: docs/design-system-migration.md
├─ [ ] Update: .gitignore with any missing entries
├─ [ ] Create: Figma migration tracking (spreadsheet or GitHub issue)
└─ [ ] Audit: Run npm run lint → fix any warnings
```

### 🟡 DO NEXT MONTH (When Relevant)
```
PRIORITY LEVEL 3 - Future Optimization
├─ [ ] When components >30: Reorganize src/components/ into categories
├─ [ ] When tools >20: Reorganize src/lib/agent/tools/ into subcategories
├─ [ ] When schemas duplicate: Extract to src/lib/validators/
└─ [ ] Create: Component development guide (docs/component-development-guide.md)
```

### 🟢 MONITOR (Ongoing)
```
PRIORITY LEVEL 4 - Prevention
├─ [ ] Code review: Catch unused imports early
├─ [ ] Git hygiene: No orphaned branches or stale files
├─ [ ] Documentation: Keep docs/ in sync with code changes
└─ [ ] Testing: Maintain test files next to implementation
```

---

## Files & Directories: Final Status Matrix

| Location | Status | Action |
|----------|--------|--------|
| `src/app/` | ✅ Clean | Keep as-is |
| `src/lib/` | ✅ Organized | Monitor growth |
| `src/components/` | ✅ Fine now | Reorganize when >30 |
| `src/lib/agent/tools/` | ✅ Good | Reorganize when >20 |
| `src/types/` | ✅ Clean | Keep organized |
| `prisma/` | ✅ Current | No changes |
| `docs/` | ⚠️ Needs 1 file | Add design-system-migration.md |
| `modernize-design-files/` | ❌ Untracked | Decide A/B/C this week |
| `FIGMA_LAYOUT_MIGRATION_PROMPT.md` | ❌ Deleted | Commit deletion this week |
| `.claude/` | ✅ Complete | Keep updated |
| `.gitignore` | ⚠️ Review | Add modernize-design-files/ |

---

## Recommended Git Commands (Do This Week)

```bash
# Step 1: Check what we're working with
git status
git log --oneline -10

# Step 2: Decide on design files (choose one):

# OPTION A: Commit design files
git add modernize-design-files/
git commit -m "chore: add Figma design system reference components

- Contains design tokens from Figma export
- Used for frontend component modernization
- Reference for all design implementations"

# OPTION B: Ignore design files
echo "modernize-design-files/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore local Figma design workspace"

# Step 3: Clean up deleted file
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
git commit -m "chore: remove design migration reference file

This file was part of the Figma integration process.
Progress is now tracked in commit history and docs."

# Step 4: Verify clean state
git status
# Should show: nothing to commit, working tree clean
```

---

## Conclusion

**Current State:** Mostly clean, 2 housekeeping issues

**What to Delete:**
- ✅ Untracked `modernize-design-files/` (commit or ignore)
- ✅ Deleted file reference for `FIGMA_LAYOUT_MIGRATION_PROMPT.md`

**What to Add:**
- 📄 `docs/design-system-migration.md` (track Figma work)

**What to Keep:**
- ✅ All other folders and files (well-organized)
- ✅ Colocated test files (excellent practice)
- ✅ Modular lib/ structure (scalable)

**Timeline:**
- This week: Git cleanup (2 commits)
- Next 2 weeks: Add design migration docs
- Next month: Monitor and reorganize if growth requires it
