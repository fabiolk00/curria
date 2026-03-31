# CurrIA Current Work Status & Handoff Guide

**Last Updated:** March 30, 2026
**Current Phase:** Figma Design System Modernization (Post-OpenAI Migration)
**Status:** Active Development

---

## High-Level Project State

### ✅ Completed Work
1. **OpenAI Migration** (Complete)
   - All models using OpenAI
   - Default routing: `combo_a` (gpt-4o-mini for agent, structured, and vision)
   - Portuguese quality gate passed
   - Configuration: `src/lib/agent/config.ts`

2. **Internal User Model** (Complete)
   - All domain logic uses internal app user IDs
   - Auth identity mapping through `user_auth_identities`
   - Clerk webhook sync working
   - No remaining Clerk ID references in domain code

3. **Billing System** (Complete & Audited)
   - Asaas integration: checkout, webhook processing, credit accounting
   - Webhook deduplication with `processed_events`
   - Credit account source of truth in `credit_accounts`
   - All billing rules documented in CLAUDE.md

4. **Session State & Versioning** (Complete)
   - Session bundle with `cvState`, `agentState`, `generatedOutput`, `atsScore`
   - Immutable CV history in `cv_versions`
   - Target-specific resume variants in `resume_targets`
   - Tool patch system for safe state mutations

### 🔄 In Progress: Figma Design System Modernization
**Owner:** Design + Frontend Team
**Timeline:** ~2-3 weeks estimated
**Status:** Mid-phase (aligned dashboard & ATS guide pages)

#### Completed Pages
- ✅ Dashboard - Resumes view
- ✅ ATS Guide (public page)

#### Remaining Work
```
Pages to modernize:
- [ ] Dashboard - Main layout
- [ ] Chat interface
- [ ] Pricing page
- [ ] Landing page
- [ ] Login/signup pages
- [ ] Settings page
- [ ] Results/history views
- [ ] Resume comparison view
```

#### Design System Source
- **Location:** `modernize-design-files/` (untracked)
- **Contents:** Figma components, design tokens, reference materials
- **Status:** Ready for integration

#### Recent Commits
```
1193782 feat: align dashboard resumes with imported layout
c201afe feat: align ats guide with imported layout
ebcf232 fix: allow public access to ats guide
```

---

## Current Files & Status

### 🟢 Stable Domains (No Changes Planned)
| Domain | Status | Files | Notes |
|--------|--------|-------|-------|
| Authentication | ✅ Stable | 3-5 | Clerk sync + app user resolution working |
| Session State | ✅ Stable | 8-12 | Session CRUD, patch merging working |
| Agent Tools | ✅ Stable | 20+ | All tools implemented, tested |
| Billing | ✅ Stable | 10-12 | Webhook dedup, credit system audited |
| Database | ✅ Stable | Schema + migrations | All migrations applied |

### 🟡 Active Development
| Area | Status | Current Work | Next Steps |
|------|--------|--------------|-----------|
| UI Components | 🔄 Modernizing | Figma design system integration | Continue page-by-page migration |
| Design Files | 📦 Untracked | `modernize-design-files/` directory | Clean up (commit/ignore) |
| Documentation | ✅ Current | All technical docs up-to-date | Add design-system-migration.md |

### 🔵 Housekeeping Issues
1. **Untracked File:** `FIGMA_LAYOUT_MIGRATION_PROMPT.md` (deleted)
   - Status: Needs cleanup commit
   - Action: `git add FIGMA_LAYOUT_MIGRATION_PROMPT.md && git commit -m "chore: remove migration reference"`

2. **Untracked Directory:** `modernize-design-files/`
   - Status: Needs decision
   - Options:
     - A) Commit if permanent reference
     - B) Gitignore if temporary
     - C) Move to separate branch if WIP

3. **Git Status:**
   ```
   D FIGMA_LAYOUT_MIGRATION_PROMPT.md
   ?? modernize-design-files/
   ```

---

## What Needs Attention: Priority Matrix

### 🔴 Blockers (Do Immediately)
None identified. System is stable.

### 🟠 High Priority (This Week)
1. **Clean up git status**
   ```bash
   # Option A: Commit design files
   git add modernize-design-files/
   git commit -m "chore: add Figma design system reference files"

   # Option B: Gitignore if working directory
   echo "modernize-design-files/" >> .gitignore
   git add .gitignore
   git commit -m "chore: ignore temporary Figma design files"

   # Option C: Remove deleted file reference
   git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
   git commit -m "chore: clean up migration reference file"
   ```

2. **Decide on design migration tracking**
   - Create shared tracking document (spreadsheet or GitHub issue)
   - Link to Figma components for each page
   - Assign owners per page

3. **Create design migration doc**
   - File: `docs/design-system-migration.md`
   - Contents:
     - Current vs. target component list
     - Completed pages with PR links
     - In-progress assignments
     - Testing checklist (responsive, accessibility, UX)

### 🟡 Medium Priority (Next 2 Weeks)
1. Continue page-by-page Figma migration
2. Testing for new design system:
   - Mobile/tablet/desktop responsive
   - Cross-browser compatibility
   - Accessibility (WCAG 2.1 AA)
   - Component consistency

3. Performance audit for new components
   - Bundle size impact
   - Rendering performance
   - Network requests

### 🟢 Low Priority (Post-Design-System)
1. Refactor for code reuse opportunities
2. Performance optimizations
3. Accessibility improvements
4. Documentation updates

---

## Deployment Readiness

### Current State: ✅ Production Ready
- Core features stable
- Billing system audited
- Authentication working
- Error handling complete

### What Can Deploy Now
- Any bug fixes
- Performance improvements
- Documentation updates
- Any completed Figma pages

### What Needs QA Before Deploying
- Figma-migrated pages (responsive testing, UX verification)
- Any styling changes affecting existing functionality

---

## For New Team Members / Engineers

### 5-Minute Context
1. CurrIA = resume optimization SaaS for Brazilian job seekers
2. Stack: Next.js 14, Clerk auth, Supabase Postgres, OpenAI, Asaas billing
3. Currently: Migrating UI components to new Figma design system
4. You can work on: New features, bug fixes, or design pages

### 1-Hour Onboarding
1. Read README.md (5 min)
2. Read CLAUDE.md (10 min)
3. Read codebase-structure-analysis.md (20 min)
4. Run `npm run dev` locally (10 min)
5. Explore 2-3 key files relevant to your work (15 min)

### Quick File Navigation
- **Auth stuff:** `src/lib/auth/app-user.ts`
- **Sessions:** `src/lib/db/sessions.ts`
- **Agent tools:** `src/lib/agent/tools/index.ts`
- **Billing:** `src/lib/asaas/quota.ts`
- **API routes:** `src/app/api/[path]/route.ts`
- **Components:** `src/components/`

---

## Decision Points for Next Sprint

### Question 1: Design Files Management
**Current:** `modernize-design-files/` is untracked
**Options:**
- A) Commit to git (if permanent reference)
- B) Add to .gitignore (if temporary workspace)
- C) Move to separate branch or external repo (if work-in-progress)

**Recommendation:** Option A if this is the canonical design system, Option B if it's a working directory.

**Decision:** __________________ (to be made)

### Question 2: Design Migration Tracking
**Current:** Progress tracked in commit messages only
**Options:**
- A) Create GitHub issue with checklist (lightweight)
- B) Create shared spreadsheet (easier for cross-team visibility)
- C) Create docs/design-system-migration.md (keeps docs together)

**Recommendation:** Option C + link to it from README.md

**Decision:** __________________ (to be made)

### Question 3: Component Library vs. Ad-hoc
**Current:** Importing components from `modernize-design-files/`
**Questions:**
- Should we create a formal design system package? (not yet)
- Should we document component props? (yes, JSDoc)
- Should we require Storybook? (not required, but helpful)

**Recommendation:** Document with JSDoc for now, revisit when 10+ components are migrated.

### Question 4: Timeline & Pacing
**Current Work:** 2 pages done (dashboard, ATS guide), ~8 remaining
**Estimated Pace:** 1-2 pages/week
**Options:**
- A) Continue current pace (gradual)
- B) Accelerate (parallel teams on different pages)
- C) Freeze new features until design migration complete

**Recommendation:** Option B if possible - parallelize across different pages

---

## Testing & Quality Checklist

### For Every Merged PR:
```
Code Quality:
- [ ] npm run typecheck passes
- [ ] npm test passes
- [ ] npm run lint passes
- [ ] No console.logs (except observability)
- [ ] No hardcoded secrets

Figma Migration Only:
- [ ] Responsive: tested on mobile/tablet/desktop
- [ ] Accessibility: semantic HTML, ARIA labels
- [ ] Performance: Lighthouse score acceptable
- [ ] Cross-browser: tested in Chrome, Firefox, Safari
- [ ] UX: matches design intent from Figma
```

---

## Monitoring & Observability

### Current Health
- ✅ API endpoints: all responding
- ✅ Database: no connection issues
- ✅ Auth: Clerk sync working
- ✅ Billing: webhook processing stable
- ✅ Agent: OpenAI calls stable

### Key Metrics to Watch (Post-Figma)
- Page load time (target: <3s)
- Component render time (target: <100ms)
- Bundle size (track changes)
- Error rate (should remain <0.1%)
- Webhook processing latency (target: <5s)

### Logs & Debugging
- Error code reference: `docs/error-codes.md`
- Logging guidance: `docs/logging.md`
- Search logs by `errorCode` field

---

## Useful Commands Reference

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build           # Production build
npm run start           # Run production build

# Code Quality
npm run typecheck       # TypeScript strict mode
npm test                # Vitest + coverage
npm run test:watch      # Watch mode
npm run lint            # ESLint

# Database
npm run db:push         # Apply schema changes (dev)
npm run db:migrate      # Run migrations
npm run db:studio       # Open Prisma Studio

# Clean Up
git status              # Check untracked files
git log --oneline -20   # Recent commits
git branch              # List branches
```

---

## Next Steps Summary

### For Design/Frontend Team
1. [ ] Decide on `modernize-design-files/` handling (commit/ignore/branch)
2. [ ] Create/update design migration tracking
3. [ ] Continue page-by-page Figma integration
4. [ ] Ensure responsive design on each page
5. [ ] Test accessibility before PR

### For Backend/Infra Team
1. [ ] No blocking work (system stable)
2. [ ] Monitor OpenAI API usage
3. [ ] Monitor Asaas webhook processing
4. [ ] On-call: respond to production issues

### For Tech Lead
1. [ ] Review design files management decision
2. [ ] Unblock any design page PRs
3. [ ] Schedule cross-team design review
4. [ ] Plan post-design-system refactoring

---

## Key Contacts / Ownership

| Component | Owner | Backup |
|-----------|-------|--------|
| OpenAI Integration | [Team] | [Lead] |
| Billing/Asaas | [Team] | [Lead] |
| Auth/Identity | [Team] | [Lead] |
| Session State | [Team] | [Lead] |
| UI/Design System | [Team] | [Lead] |
| DevOps/Deployment | [Team] | [Lead] |

---

## Appendix: Recent Changes Summary

### Last 10 Commits
1. `1193782` - feat: align dashboard resumes with imported layout
2. `c201afe` - feat: align ats guide with imported layout
3. `ebcf232` - fix: allow public access to ats guide
4. `1a49f21` - fix: make ats guide public
5. `b6d29a6` - feat: link landing cta to ats guide
6. `e3f6439` - feat: add remaining authenticated frontend pages
7. `dcdf35f` - fix: mark ats explainer as client component
8. `1c85f07` - feat: apply modernize frontend components
9. `58aeb8d` - feat: continue figma frontend migration
10. `0a7cf04` - figma

### Pattern
- Focus on design system integration
- Public page accessibility improvements
- Component modernization

---

## Final Notes

**System Stability:** ✅ High
- Core features battle-tested
- Billing thoroughly audited
- Error handling comprehensive
- Documentation excellent

**Recommended Next Focus:** Complete Figma design migration with good engineering practices (testing, accessibility, performance).

**No Technical Debt Blockers:** Safe to add new features in parallel with design work.

**Post-Design-System Opportunities:**
- Component library formalization
- Performance optimization
- Analytics integration
- Advanced resume features
