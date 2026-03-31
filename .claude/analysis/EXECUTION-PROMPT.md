# CurrIA Cleanup Execution Prompt

**Purpose:** Complete execution guide for cleaning up folder structure and implementing documentation improvements
**Time:** ~2 hours total (45 min cleanup + 1 hour documentation)
**Audience:** Tech leads, engineers, team members, or agents
**Status:** Ready to execute immediately

---

## 🎯 SYSTEM CONTEXT

### What You're Doing
Executing cleanup of CurrIA project folder structure by:
1. **Phase 1 (15 min):** Fix 2 git status issues
2. **Phase 2 (1 hour):** Create/update documentation
3. **Phase 3 (15 min):** Verify and signoff

### Why It Matters
- Project has 2 untracked/deleted files causing git confusion
- Design system location unclear to team
- Design migration progress not formally tracked
- Clean git state improves team workflow

### What Success Looks Like
```
✅ git status shows: working tree clean
✅ No more 🔴 issues
✅ Design system clearly documented
✅ Migration progress trackable
✅ Team aligned on next steps
```

### Key Reference Documents
- `CLEANUP-SUMMARY.md` - Visual guide (read before starting)
- `codebase-structure-analysis.md` - Full analysis with cleanup section
- `cleanup-checklist.md` - Detailed step-by-step (reference during work)
- `current-work-status.md` - Project context

---

## ✅ PREREQUISITES CHECKLIST

Before starting, verify:

```
[ ] You have git access to the CurrIA repository
[ ] You're on the main branch: git status shows "On branch main"
[ ] Working directory is currently clean: git status shows no pending changes
[ ] You have a terminal/shell available
[ ] You've read CLEANUP-SUMMARY.md (5 minute overview)
[ ] You understand the 2 issues and 3 design file options
```

**Safety Notes:**
- All operations are reversible (git reset --hard HEAD~1 can undo)
- No code changes, only git operations and documentation
- Can be paused between phases without issues
- Multiple people can work on different tasks in parallel

---

## 🔴 PHASE 1: GIT CLEANUP (15 minutes)

**Objective:** Fix 2 untracked/deleted files, get clean git status

### Issue #1: Decide on `modernize-design-files/`

**Current State:**
```
git status shows: ?? modernize-design-files/
```

**Decision Point: Choose ONE option**

#### OPTION A: Commit Design Files to Git ⭐ RECOMMENDED
**Use when:** Design system is stable, team needs canonical version

```bash
# Step 1: Add and commit
git add modernize-design-files/
git commit -m "chore: add Figma design system components

- Design tokens and component references from Figma export
- Reference for UI component modernization
- Team-wide standard for design consistency"

# Step 2: Verify
git status  # Should show: working tree clean

# Step 3: View your commit
git log --oneline -2
# Should show: your commit + previous commits
```

**Verification:**
- ✅ git status shows "working tree clean"
- ✅ modernize-design-files/ appears in git log
- ✅ Team members can pull and see files

---

#### OPTION B: Ignore Design Files (Add to .gitignore)
**Use when:** Each developer has own copy from Figma

```bash
# Step 1: Add to .gitignore
echo "modernize-design-files/" >> .gitignore

# Step 2: Verify it was added
tail .gitignore  # Should show the new entry

# Step 3: Stage and commit
git add .gitignore
git commit -m "chore: ignore local Figma design workspace

Design files should be pulled from Figma directly.
Team Figma link: [INSERT URL IF YOU HAVE IT]"

# Step 4: Verify
git status  # Should show: working tree clean
```

**Verification:**
- ✅ git status shows "working tree clean"
- ✅ modernize-design-files/ doesn't appear in git
- ✅ .gitignore has the new entry

---

#### OPTION C: Move to Separate Branch (Work-in-Progress)
**Use when:** Still importing/organizing files, not ready to merge

```bash
# Step 1: Create new branch
git checkout -b feat/figma-design-integration

# Step 2: Add and commit
git add modernize-design-files/
git commit -m "feat: import Figma design system components

Work in progress: organizing design system import.
Ready to merge when: [SPECIFY CONDITION]"

# Step 3: Push to remote
git push origin feat/figma-design-integration

# Step 4: Return to main
git checkout main

# Step 5: Verify
git status  # Should show: On branch main, working tree clean
git branch  # Should show: main + feat/figma-design-integration
```

**Verification:**
- ✅ git status on main shows "working tree clean"
- ✅ New branch exists and has the files
- ✅ main branch is clean

---

### Issue #2: Commit Deleted File Reference

**Current State:**
```
git status shows: D FIGMA_LAYOUT_MIGRATION_PROMPT.md
```

**Action: Commit the deletion**

```bash
# Step 1: Add the deleted file to staging
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md

# Step 2: Commit with clear message
git commit -m "chore: remove design migration reference file

This file tracked the Figma design migration process.
Progress is now tracked via:
- Git commit history
- docs/design-system-migration.md (to be created)
- GitHub PR descriptions
- Team tracking spreadsheet"

# Step 3: Verify deletion is committed
git status  # Should show: working tree clean
git log --oneline -2  # Should show your cleanup commit
```

**Verification:**
- ✅ git status shows "working tree clean"
- ✅ No more 🔴 items showing
- ✅ Commit message clearly explains why

---

### Phase 1 Verification Checkpoint

**Run these commands to verify Phase 1 is complete:**

```bash
# 1. Check status is clean
git status
# Expected: On branch main ... nothing to commit, working tree clean

# 2. Check your commits
git log --oneline -3
# Expected: Shows cleanup commits at top

# 3. Verify design files handling
git ls-files | grep modernize-design-files
# If Option A: Should show files
# If Option B: Should show nothing (they're ignored)
# If Option C: Should show nothing (they're on other branch)

# 4. Check git ignore
git check-ignore -v modernize-design-files/
# If Option B: Should match a pattern
# If Option A/C: Should show no match
```

**✅ Phase 1 Complete when:**
- git status shows "working tree clean"
- No more 🔴 untracked/deleted files
- Last 2 commits are your cleanup commits

**⏰ Time taken: ~15 minutes**

---

## 📄 PHASE 2: DOCUMENTATION (1 hour)

**Objective:** Create/update 3 documentation files

### Task 1: Create `docs/design-system-migration.md` (30 minutes)

**Purpose:** Track Figma design system integration progress

**Location:** `docs/design-system-migration.md`

**Template to use:**

```markdown
# Figma Design System Migration

**Status:** IN PROGRESS
**Started:** [DATE]
**Target Completion:** [DATE]
**Owner:** [NAME]

## Overview

Migration of UI components from old design to Figma design system.
- Pages completed: 2/10
- Components modernized: [X]/[Y]
- Design system source: modernize-design-files/ (or Figma link)

## Completed Pages

- [x] Dashboard - Resumes View
- [x] ATS Guide
- [ ] Landing Page
- [ ] Pricing Page
- [ ] Chat Interface
- [ ] Settings Page
- [ ] Login/Signup
- [ ] Results Page
- [ ] Resume Comparison
- [ ] [Other pages]

## Component Mapping

| Component | Figma File | Implementation | Tests | Status |
|-----------|-----------|-----------------|-------|--------|
| Button | [link] | src/components/Button.tsx | ✅ | ✅ |
| Card | [link] | src/components/Card.tsx | ✅ | ✅ |
| [More components...] |

## Testing Checklist Per Page

Before PR merge, each page must have:
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Accessibility (WCAG 2.1 AA standard)
- [ ] Cross-browser (Chrome, Firefox, Safari)
- [ ] Performance (Lighthouse >90)
- [ ] Visual comparison with Figma mockup

## PRs & Links

- PR #123: Dashboard resumes with Figma design
- PR #124: ATS Guide modernization
- [Link to Figma file]
- [Link to design tokens]

## Next Steps

1. [Task 1]
2. [Task 2]
3. [Task 3]

---

**Last Updated:** [DATE]
**Owner:** [NAME]
```

**How to create it:**

```bash
# Step 1: Navigate to docs directory
cd docs

# Step 2: Create the file with template above
cat > design-system-migration.md << 'EOF'
[PASTE TEMPLATE ABOVE, FILL IN YOUR VALUES]
EOF

# Step 3: Verify file exists
ls -la design-system-migration.md

# Step 4: Go back to root
cd ..

# Step 5: Stage and commit
git add docs/design-system-migration.md
git commit -m "docs: add Figma design system migration tracker

- Tracks page-by-page modernization progress
- Includes testing checklist per page
- References component mapping and PRs
- Owner: [YOUR NAME]"
```

**Verification:**
```bash
# Check file exists and has content
wc -l docs/design-system-migration.md  # Should be >20 lines
git status  # Should show the new file staged
```

---

### Task 2: Update `.gitignore` (5 minutes)

**Purpose:** Ensure design files are properly handled

**Only do this if you chose OPTION B in Phase 1**

```bash
# Step 1: Check current .gitignore
cat .gitignore | grep -i "design\|figma\|modernize"

# Step 2: If NOT present, add entries
echo "" >> .gitignore
echo "# Design system workspace" >> .gitignore
echo "modernize-design-files/" >> .gitignore
echo "temp-figma-import/" >> .gitignore

# Step 3: Verify additions
tail -5 .gitignore  # Should show new entries

# Step 4: Stage and commit
git add .gitignore
git commit -m "chore: ignore local Figma design workspace

Design files are sourced directly from Figma.
Team access: [FIGMA LINK]"
```

**Verification:**
```bash
git check-ignore -v modernize-design-files/
# Should match pattern from .gitignore
```

**Skip this task if:** You chose Option A (commit files) or Option C (separate branch)

---

### Task 3: Update `README.md` (10 minutes)

**Purpose:** Link to design system migration tracker

**Edit:** Root `README.md`

**Find this section:**
```markdown
## Current status

The project already includes:
...
```

**Add this line after existing text:**
```markdown
## Design System

We are modernizing UI components to match our Figma design system. See [Design System Migration](./docs/design-system-migration.md) for progress tracking.
```

**How to do it:**

```bash
# Step 1: Open README.md in your editor
# Look for "## Current status" section

# Step 2: Add the design system section nearby (after current status)
# OR update existing design-related section

# Step 3: Stage and commit
git add README.md
git commit -m "docs: link to Figma design system migration tracker

- Added section referencing design-system-migration.md
- Helps team understand design modernization progress"
```

**Verification:**
```bash
# Check the link works
grep -n "design-system-migration" README.md
# Should show 1 or more matches with line numbers
```

---

### Phase 2 Verification Checkpoint

**Run these commands to verify Phase 2 is complete:**

```bash
# 1. Check files exist
ls -la docs/design-system-migration.md  # Should exist
grep "design-system-migration" README.md  # Should find reference

# 2. Check git status
git status  # Should show files staged/committed

# 3. View last commits
git log --oneline -5  # Should show your documentation commits

# 4. Verify content
wc -l docs/design-system-migration.md  # Should be >20 lines
cat README.md | grep -A2 -B2 "Design System"  # Should show your addition
```

**✅ Phase 2 Complete when:**
- docs/design-system-migration.md exists with content
- README.md links to it
- All files are committed
- git status shows "working tree clean"

**⏰ Time taken: ~1 hour**

---

## ✅ PHASE 3: COMPLETION & SIGNOFF (15 minutes)

**Objective:** Final verification and team communication

### Verification Checklist

**Run all these commands to verify everything:**

```bash
# 1. Final git status
git status
# Expected: On branch main ... nothing to commit, working tree clean

# 2. View all your commits
git log --oneline -5
# Should show: Phase 2 docs commits, Phase 1 cleanup commits

# 3. Verify no orphaned files
git ls-files -o --exclude-standard
# Should show: nothing (no untracked files)

# 4. Check design files handling
git check-ignore -v modernize-design-files/
# If Option B: Should match pattern
# If Option A/C: May show no match (but files handled)

# 5. Verify documentation
ls -la docs/design-system-migration.md  # Should exist
grep "design-system-migration" README.md  # Should find link

# 6. Test build (optional but recommended)
npm run typecheck  # Should pass
npm run lint       # Should pass
npm test           # Should pass
```

**✅ All checks passed?** Continue to signoff.

---

### Completion Checklist

```
✅ PHASE 1: Git Cleanup
   ✅ modernize-design-files/ handled (A/B/C chosen)
   ✅ FIGMA_LAYOUT_MIGRATION_PROMPT.md deletion committed
   ✅ git status shows: working tree clean

✅ PHASE 2: Documentation
   ✅ docs/design-system-migration.md created
   ✅ README.md updated with link
   ✅ .gitignore updated (if needed)
   ✅ All documentation files committed

✅ PHASE 3: Verification
   ✅ All git status clean
   ✅ All commits visible in git log
   ✅ No orphaned files
   ✅ Code tests pass (npm test)

✅ Team Communication
   ✅ Team notified of cleanup
   ✅ Design system migration tracking shared
   ✅ Next steps communicated
```

---

### Team Communication Template

**Share this message with your team:**

```markdown
## CurrIA Cleanup Complete ✅

I've completed the folder structure cleanup and documentation updates:

### What Changed
- ✅ Fixed git status issues (modernize-design-files/, deleted file)
- ✅ Created design system migration tracker (docs/design-system-migration.md)
- ✅ Updated README.md with design system link
- ✅ Updated .gitignore

### Key Documents
Team should review these analysis documents in `.claude/analysis/`:
- README.md - Index and quick-start by role
- CLEANUP-SUMMARY.md - Visual before/after
- codebase-structure-analysis.md - Full analysis
- engineering-prompts.md - Task templates for future work
- current-work-status.md - Project status & onboarding

### Design System
Design migration progress is now tracked in: `docs/design-system-migration.md`
Update this document as you complete each page.

### Next Steps
1. Team members: Read `.claude/analysis/README.md` for your role
2. Designers: Start using `docs/design-system-migration.md` to track progress
3. Tech leads: Use `engineering-prompts.md` templates for delegating work

Questions? See `.claude/analysis/README.md`
```

---

## 🔧 ERROR HANDLING & TROUBLESHOOTING

### Problem: git status still shows untracked files

**Solution:**
```bash
# Check what's untracked
git status

# If modernize-design-files/:
#   - Did you forget to add it? Run: git add modernize-design-files/
#   - Did you mean to ignore it? Add to .gitignore + git add .gitignore

# If FIGMA_LAYOUT_MIGRATION_PROMPT.md:
#   - Run: git add FIGMA_LAYOUT_MIGRATION_PROMPT.md

# Then commit again
git commit -m "[your message]"
```

---

### Problem: Deleted commit wrong file

**Solution:**
```bash
# Undo last commit (files come back as staged)
git reset --soft HEAD~1

# Check what's there
git status

# Remove wrong file
git reset [wrong-file]

# Stage correct file
git add [correct-file]

# Commit again
git commit -m "[new message]"
```

---

### Problem: Created design-system-migration.md in wrong place

**Solution:**
```bash
# Move file to correct location
mv design-system-migration.md docs/design-system-migration.md

# Or delete wrong copy and create in right place
rm design-system-migration.md
# Then follow Task 1 instructions
```

---

### Problem: npm test or lint fails

**Solution:**
```bash
# These are unrelated to cleanup
# Cleanup didn't change code, only git operations and docs
# Check what changed
git diff HEAD~5

# If no code changes, tests should still pass
# If they fail, run independently to debug:
npm test
npm run lint

# Cleanup files (docs, .gitignore) won't affect tests
```

---

### Need to Rollback?

**If something went wrong, undo the last commit:**

```bash
# Undo last 1 commit (files come back as staged)
git reset --soft HEAD~1

# Undo last 2 commits
git reset --soft HEAD~2

# Undo last N commits
git reset --soft HEAD~N

# Then verify state
git status
git log --oneline -5

# You can now modify and recommit
git add [files]
git commit -m "[new message]"

# Or start over completely
git reset --hard origin/main
```

---

### Stuck? Can't figure it out?

**Reference documents:**
- CLEANUP-SUMMARY.md (visual guide)
- cleanup-checklist.md (detailed steps)
- codebase-structure-analysis.md (full analysis)

**Ask for help:**
- Tech lead: Ask about Phase 1 or Phase 2 step
- Team: Check `.claude/analysis/README.md` for context

---

## 📚 APPENDIX: Supporting Documentation

### All 8 Analysis Documents in `.claude/analysis/`

1. **README.md** - Index, quick-start by role, maintenance guide
2. **CLEANUP-SUMMARY.md** - Visual before/after, 2 issues, 3 solutions
3. **codebase-structure-analysis.md** - Deep-dive analysis, full cleanup section
4. **cleanup-checklist.md** - Step-by-step checklist, priority matrix
5. **engineering-prompts.md** - 9 reusable task templates
6. **current-work-status.md** - Project phase, priorities, onboarding
7. **FOLDER-STRUCTURE-VISUAL.txt** - ASCII diagrams, quick reference
8. **DELIVERY-SUMMARY.md** - What was delivered, impact, next steps
9. **EXECUTION-PROMPT.md** - This file (execution guide)

### Key Files in Repository

- **CLAUDE.md** - Architectural invariants (source of truth)
- **.claude/rules/** - Code style & API conventions
- **docs/** - Technical documentation
- **README.md** - Project quick start

### Decision Matrix for Design Files

**Choose Option A if:**
- ✅ Design system is stable and final
- ✅ Whole team needs same version
- ✅ Want version control for designs
- ✅ Can't/don't want Figma access requirement

**Choose Option B if:**
- ✅ Designs change frequently
- ✅ Each dev has Figma access
- ✅ Want lighter git repo
- ✅ Using Figma as source of truth

**Choose Option C if:**
- ✅ Still importing/organizing files
- ✅ Want team review before merging
- ✅ Not ready to commit yet

---

## 🎯 SUCCESS SUMMARY

**After completing all 3 phases, you will have:**

✅ **Clean Git State**
- git status shows "working tree clean"
- No more 🔴 untracked/deleted files
- Clean commit history

✅ **Clear Design System**
- Design files properly tracked (committed or ignored)
- Team knows where design system lives
- Design migration progress trackable

✅ **Complete Documentation**
- Design system migration tracked formally
- README.md links to design progress
- Team can onboard in 1-2 hours

✅ **Reusable Processes**
- 9 task templates for future work
- Clear patterns for adding features
- Documented architectural invariants

✅ **Team Alignment**
- Everyone understands folder structure
- Clear next steps for design modernization
- Safe foundation for parallel development

---

## ⏰ Timeline

```
PHASE 1: Git Cleanup          15 minutes
PHASE 2: Documentation        1 hour
PHASE 3: Verification         15 minutes
─────────────────────────────────────────
TOTAL                         ~2 hours
```

Can be split across multiple days if needed.

---

## ✍️ Sign-Off Template

**When complete, fill out and share:**

```
COMPLETION SIGN-OFF
═══════════════════════════════════════════

Phase 1: Git Cleanup
  Status: ✅ COMPLETE
  Date: [DATE]
  Commits: [NUMBER]
  Issues Fixed: 2/2

Phase 2: Documentation
  Status: ✅ COMPLETE
  Date: [DATE]
  Files Created: design-system-migration.md
  Files Updated: README.md, .gitignore

Phase 3: Verification
  Status: ✅ COMPLETE
  Date: [DATE]
  Test Results: PASS
  Team Notified: YES

Overall Status: ✅ SUCCESS
Executed by: [NAME]
Final Commit: [HASH]
Total Time: ~2 hours

Next Steps:
  [ ] Team reviews analysis documents
  [ ] Design team starts tracking progress
  [ ] Tech lead uses engineering prompts for next tasks
  [ ] Monitor quarterly & update docs as needed

═══════════════════════════════════════════
```

---

## 🚀 Ready to Begin?

**Next Action:**
1. ✅ Read this entire document (10 min)
2. ✅ Decide on design file option (A/B/C) (2 min)
3. ✅ Start Phase 1 (15 min)
4. ✅ Continue to Phase 2 (1 hour)
5. ✅ Complete Phase 3 (15 min)

**Total: ~2 hours of focused work**

You've got this! 🎯
