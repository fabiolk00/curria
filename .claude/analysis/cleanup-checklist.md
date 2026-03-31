# CurrIA Folder Structure Cleanup Checklist

**Last Updated:** March 30, 2026
**Status:** 🔴 2 Issues Found | Ready to Fix

---

## 🔴 CRITICAL: Do This Week

### Issue #1: Untracked Directory - `modernize-design-files/`

**Current Status:**
```
?? modernize-design-files/
Size: ~400KB (7 files)
Contains: Figma components, design tokens, reference materials
Tracked: NO ❌
```

**Decision Required:** Choose ONE option below

#### Option A: Commit to Git ✅ RECOMMENDED
```bash
# Use if: This is the canonical design system for the team
git add modernize-design-files/
git commit -m "chore: add Figma design system components

- Design tokens and component references from Figma export
- Used as reference for UI component modernization
- Team-wide standard for design consistency"

git status  # Should show: working tree clean
```

**Pros:**
- ✅ Entire team has same design files
- ✅ Version controlled with code changes
- ✅ No sync issues across devices

**Cons:**
- ❌ Design files may become stale
- ❌ Large binary files in git

---

#### Option B: Add to .gitignore
```bash
# Use if: Developers each have their own copy from Figma
echo "modernize-design-files/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore local Figma design workspace

Design files should be pulled from Figma directly.
Link: [INSERT FIGMA FILE URL]"

git status  # Should show: working tree clean
```

**Pros:**
- ✅ Keep repo lightweight
- ✅ Always latest from Figma
- ✅ No merge conflicts on design files

**Cons:**
- ❌ Each dev needs Figma access
- ❌ Need shared documentation of link

---

#### Option C: Move to Separate Branch
```bash
# Use if: Still importing/organizing design files
git checkout -b feat/figma-design-integration
git add modernize-design-files/
git commit -m "feat: import Figma design system files"
git push origin feat/figma-design-integration

# Later, when ready:
# git checkout main
# git pull origin main
# git merge feat/figma-design-integration
# git push
```

**Pros:**
- ✅ Keep main branch clean
- ✅ Team can review before merging
- ✅ Isolates design work

**Cons:**
- ❌ Extra merge step
- ❌ Design work separate from code

---

**🎯 RECOMMENDATION: Option A** (commit to git)
- Design system is stable
- Team needs consistency
- Will be referenced in multiple PRs

**⏰ Deadline: Friday March 30** (Today)

**Assigned to:** ________________

```bash
✅ DONE: git status shows working tree clean
```

---

### Issue #2: Deleted File - `FIGMA_LAYOUT_MIGRATION_PROMPT.md`

**Current Status:**
```
D FIGMA_LAYOUT_MIGRATION_PROMPT.md
Type: Deletion (not committed)
Impact: Confuses git status
```

**Solution:**

#### Step 1: Check What Was Deleted
```bash
# See the deleted file's content
git log -p FIGMA_LAYOUT_MIGRATION_PROMPT.md | head -100

# Or restore to check:
git checkout FIGMA_LAYOUT_MIGRATION_PROMPT.md
```

#### Step 2: Commit the Deletion
```bash
# If file is no longer needed:
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
git commit -m "chore: remove design migration reference file

This file was used for tracking the Figma design migration process.
Migration progress is now tracked through:
- Git commit history
- docs/design-system-migration.md (to be created)
- GitHub PR descriptions"

git status  # Should show: working tree clean
```

**Or Step 2 Alternative: Restore & Move Content**
```bash
# If file had useful content:
git checkout FIGMA_LAYOUT_MIGRATION_PROMPT.md

# Copy important content to:
cat FIGMA_LAYOUT_MIGRATION_PROMPT.md >> docs/design-system-migration.md

# Then delete and commit:
rm FIGMA_LAYOUT_MIGRATION_PROMPT.md
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
git commit -m "chore: archive design migration reference in docs"
```

**⏰ Deadline: Today**

**Assigned to:** ________________

```bash
✅ DONE: git status shows working tree clean
```

---

## 🟠 HIGH PRIORITY: This Sprint (Next 2 Weeks)

### Task #3: Create `docs/design-system-migration.md`

**Purpose:** Track Figma design system integration progress

**Template:**
```markdown
# Figma Design System Migration

## Overview
- Status: IN PROGRESS
- Pages completed: 2/10
- Components modernized: X/Y
- Target completion: [DATE]

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
| [more...] |

## Testing Checklist Per Page
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Cross-browser (Chrome, Firefox, Safari)
- [ ] Performance (Lighthouse >90)
- [ ] Visual comparison with Figma

## PRs & Links
- PR #123: Dashboard resumes with Figma design
- PR #124: ATS Guide modernization
- [more...]
```

**Action Items:**
```
[ ] Create the file
[ ] Link from README.md
[ ] Link from CLAUDE.md
[ ] Share with team for tracking
```

**⏰ Deadline: April 4 (Friday)**

**Assigned to:** ________________

---

### Task #4: Update `.gitignore`

**Current:** Check if modernize-design-files is ignored

```bash
# View current .gitignore
cat .gitignore | grep -i "figma\|design\|modernize"

# If not present (and you chose Option B above):
echo "" >> .gitignore
echo "# Design system workspace" >> .gitignore
echo "modernize-design-files/" >> .gitignore
echo "temp-figma-import/" >> .gitignore
echo "Modernize Design Files.zip" >> .gitignore

# Verify
git check-ignore -v modernize-design-files/
# Should output: modernize-design-files/  (matching pattern from .gitignore)
```

**Action:**
```
[ ] Review .gitignore
[ ] Add entries if needed
[ ] Commit if changed
```

**⏰ Deadline: April 4 (Friday)**

**Assigned to:** ________________

---

## 🟡 MEDIUM PRIORITY: When Needed (Preventive)

### Task #5: Monitor Directory Growth

**Trigger:** When one of these directories exceeds limits

| Directory | Limit | Action When Exceeded |
|-----------|-------|---------------------|
| `src/components/` | 30 files | Organize into categories (forms/, layout/, resume/, chat/, ui/) |
| `src/lib/agent/tools/` | 20 files | Organize into subcategories (core/, writing/, analysis/, generation/) |
| `src/app/api/` | 40 files | Create shared utils for common patterns |
| `src/types/` | 10 files | Extract common validators to `src/lib/validators/` |

**Current Status:**
- src/components/: ~20 files ✅ OK
- src/lib/agent/tools/: ~12 files ✅ OK
- src/app/api/: ~30 files ✅ OK
- src/types/: ~3 files ✅ OK

**Action:** No action needed now, monitor during PRs

---

### Task #6: Code Review Hygiene

**During code review, ensure:**

```
[ ] No console.logs (except in observability files)
[ ] No commented-out code blocks (>3 lines)
[ ] No unused imports
[ ] No unused variables
[ ] No temporary/debug code
[ ] File has single responsibility
[ ] Tests colocated with implementation
```

**Commands to run before committing:**
```bash
npm run lint     # Catch style issues
npm run typecheck # Catch type errors
npm test         # Catch logic errors
```

---

## 🟢 LOW PRIORITY: Monitoring (Ongoing)

### Task #7: Verify Critical Directories

**These are fine, just verify periodically:**

```bash
# Check for unused imports
npm run lint

# Check for stale branches
git branch -a | grep "old\|stale\|wip" | wc -l

# Check for large files in git
git ls-tree -r -t -S HEAD | head -20

# Verify test coverage
npm test -- --coverage
```

---

## Summary Table: What to Do

| Item | Issue | Action | Priority | Deadline | Owner |
|------|-------|--------|----------|----------|-------|
| `modernize-design-files/` | Untracked | Commit or Ignore | 🔴 CRITICAL | Today | ??? |
| `FIGMA_LAYOUT_MIGRATION_PROMPT.md` | Deleted (not committed) | Commit deletion | 🔴 CRITICAL | Today | ??? |
| `docs/design-system-migration.md` | Missing | Create tracking doc | 🟠 HIGH | April 4 | ??? |
| `.gitignore` | May need update | Add design entries if needed | 🟠 HIGH | April 4 | ??? |
| Directory limits | Monitor growth | Reorganize when limits hit | 🟡 MEDIUM | N/A | All |
| Code hygiene | Ongoing | Review & lint in PRs | 🟢 LOW | Ongoing | All |

---

## Quick Fix (Run This Today)

```bash
# Step 1: Understand current state
git status
git log --oneline -5

# Step 2: Choose design files approach (A, B, or C above)
# Then run appropriate commands

# Step 3: Clean up deleted file
git add FIGMA_LAYOUT_MIGRATION_PROMPT.md
git commit -m "chore: clean up deleted design migration reference"

# Step 4: Verify
git status
# Output should be: On branch main ... nothing to commit, working tree clean

# Step 5: Push
git push origin main
```

**Time required:** 5-10 minutes

---

## Files After Cleanup

**Before:**
```
git status:
  D FIGMA_LAYOUT_MIGRATION_PROMPT.md
  ?? modernize-design-files/
```

**After (Option A):**
```
git status:
  On branch main
  nothing to commit, working tree clean

git log --oneline:
  abc1234 chore: add Figma design system components
  def5678 chore: clean up deleted design migration reference
  [rest of history]
```

**After (Option B):**
```
git status:
  On branch main
  nothing to commit, working tree clean

git log --oneline:
  abc1234 chore: ignore local Figma design workspace
  def5678 chore: clean up deleted design migration reference
  [rest of history]
```

---

## Rollback Instructions (If Needed)

```bash
# If you mess up, undo last commit:
git reset --soft HEAD~1
git status  # Files come back as staged
# Or undo completely:
git reset --hard HEAD~1
```

---

## Questions to Answer

Before proceeding, answer these:

1. **Are the Figma design files the canonical source?**
   - YES → Use Option A (Commit)
   - NO → Use Option B (Gitignore)
   - MAYBE → Use Option C (Branch)

2. **Who needs access to design files?**
   - Whole team → Commit (Option A)
   - Only designers → Gitignore (Option B)
   - Unclear → Discuss with team

3. **Will design files change frequently?**
   - YES (actively importing) → Option C (Branch)
   - NO (stable) → Option A (Commit)

4. **Do we have Figma URL to share?**
   - YES → Option B (Gitignore + shared link)
   - NO → Option A (Commit files)

---

## Sign Off

```
Cleanup Status: ⬜ IN PROGRESS

Tasks Completed:
- [ ] Issue #1: modernize-design-files/ decision made & committed
- [ ] Issue #2: FIGMA_LAYOUT_MIGRATION_PROMPT.md cleanup committed
- [ ] Task #3: docs/design-system-migration.md created
- [ ] Task #4: .gitignore updated (if needed)

Next Review: April 4, 2026
Verified by: ________________
Date: ________________
```

---

## Contact & Questions

**For questions about this cleanup:**
- Reference: `.claude/analysis/codebase-structure-analysis.md` (detailed section)
- Contact: Your tech lead or DevOps team

**For design system questions:**
- Reference: `docs/design-system-migration.md` (to be created)
- Contact: Design/Frontend team lead
