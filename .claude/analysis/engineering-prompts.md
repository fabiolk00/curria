# Engineering Prompts for CurrIA Development

These are staff-level prompts structured for different types of work on CurrIA. Use these as templates when delegating work to Claude Code or other engineers.

---

## Template 1: Add a New Agent Tool

**Use this when:** Adding new AI-powered resume analysis or transformation feature

```markdown
# Add [Tool Name] Agent Tool

## Context
- This tool will [describe purpose]
- It affects the following session state: [cvState/agentState/generatedOutput]
- Integration point: src/lib/agent/tools/index.ts

## Requirements
1. **Input validation:** [describe expected input schema]
2. **Output format:** [describe expected output]
3. **State mutation:** [describe what changes in cvState/agentState/patch]
4. **Error handling:** Must return structured ToolFailure for [list failure scenarios]
5. **Testing:** Success + failure paths, patch merge validation

## Implementation Steps
1. Define types in `src/types/agent.ts` (ToolInput, ToolOutput, ToolPatch)
2. Implement logic in `src/lib/agent/tools/[name].ts`
3. Register in `src/lib/agent/tools/index.ts` (executeTool switch)
4. Add unit tests with Vitest (success, failure, patch shape)
5. Validate against CLAUDE.md Tool Invariants section

## Acceptance Criteria
- [ ] Tool validates input and returns VALIDATION_ERROR on invalid input
- [ ] Tool never mutates session directly; returns ToolPatch only
- [ ] Malformed model output rejected before persistence
- [ ] Tests cover success + all failure paths
- [ ] Error messages are user-facing and specific
- [ ] Patch merge preserves unrelated state
- [ ] TypeScript strict mode passes
- [ ] All tests pass: npm test

## Key References
- docs/tool-development.md
- docs/error-codes.md
- src/lib/agent/tool-errors.ts
- src/types/agent.ts
```

---

## Template 2: Add a New API Route

**Use this when:** Adding authenticated JSON endpoint or webhook handler

```markdown
# Add [Route Name] API Endpoint

## Route
`[METHOD] /api/[path]`

## Context
- Purpose: [describe endpoint responsibility]
- Authentication: [public/authenticated/webhook with token X]
- Rate limiting: [yes/no - if yes, which tier]

## Implementation
1. Create `src/app/api/[path]/route.ts` following pattern in `.claude/rules/api-conventions.md`
2. Define request body schema with Zod
3. Implement auth check: `getCurrentAppUser()`
4. Validate input: `BodySchema.safeParse()`
5. Return structured JSON with proper status codes

## Response Format
```ts
Success: { data: {...}, meta?: {...} }
Error (400): { error: "message" }
Error (401): { error: "Unauthorized" }
Error (404): { error: "Not found" }
Error (500): { error: "Internal server error" }
```

## Testing
- [ ] Auth required routes reject unauthenticated requests
- [ ] Validation errors return 400 with Zod shape
- [ ] Success path returns 200 with correct data
- [ ] Error paths return appropriate status codes

## References
- .claude/rules/api-conventions.md
- src/app/api/checkout/route.ts (example: authenticated)
- src/app/api/webhook/asaas/route.ts (example: webhook)
```

---

## Template 3: Modify Session State Structure

**Use this when:** Adding/changing cvState, agentState, or generatedOutput fields

```markdown
# Modify Session State: Add [Field Name]

## Change
- Type: [cvState/agentState/generatedOutput]
- Field: [fieldName]
- Purpose: [describe why this field is needed]

## Analysis
Before modifying:
1. Verify this is the right bucket (see docs/state-model.md)
   - `cvState` = canonical resume truth?
   - `agentState` = operational context?
   - `generatedOutput` = artifact metadata?
2. Check if any tools or routes already populate this field
3. Determine if `cv_versions` snapshot needed

## Changes Required
- [ ] Update type definition in src/types/cv.ts OR src/types/agent.ts
- [ ] Update ToolPatch interface if tool-writable
- [ ] Update session.ts merge logic if custom merge needed
- [ ] Add migration or data transformation if required
- [ ] Update tests: session merge, patch application
- [ ] Update CLAUDE.md state contract if architectural change
- [ ] Increment stateVersion if bundle interpretation changes

## Testing
- [ ] Partial patch merge preserves unrelated fields
- [ ] New field persists through session CRUD
- [ ] Existing tests still pass
- [ ] TypeScript strict mode passes

## References
- docs/state-model.md
- src/types/cv.ts
- src/types/agent.ts
- src/lib/db/sessions.ts
```

---

## Template 4: Add Billing Feature

**Use this when:** Adding new payment plan, credit tier, or subscription logic

```markdown
# Add Billing Feature: [Name]

## Feature
- Type: [one-time purchase/recurring subscription/credit tier]
- Credits offered: [number]
- Price: [currency amount]

## Implementation
1. Define plan in src/lib/plans.ts (single source of truth)
2. If checkout needed:
   - Add to POST /api/checkout validation
   - Create billing_checkouts row with `curria:v1:u:<appUserId>:c:<reference>`
3. If webhook handling:
   - Update Asaas webhook handler
   - Add deduplication rule to processed_events
   - Ensure processed_events recorded only after side effects succeed
4. If credit granting:
   - Update credit_accounts (runtime source of truth)
   - Never write to user_quotas credits_remaining

## Critical Rules (from CLAUDE.md)
- ✅ credit_accounts = only source of truth
- ✅ Credits granted only from webhook events
- ✅ Webhook deduplication by event_fingerprint
- ✅ Processed events recorded only after success
- ✅ Subscription cancellation never revokes credits
- ✅ Plan definitions must not be duplicated

## Testing
- [ ] Credit consumption on session creation works
- [ ] Webhook processing is idempotent (run twice = same result)
- [ ] Duplicate events never grant credits twice
- [ ] Failed webhooks remain retryable
- [ ] Ownership checks prevent cross-user issues

## References
- docs/billing-implementation.md
- docs/billing-migration-guide.md
- src/lib/plans.ts
- src/lib/asaas/quota.ts
- src/app/api/webhook/asaas/route.ts
```

---

## Template 5: Add New UI Page or Component

**Use this when:** Creating new frontend page or component during Figma modernization

```markdown
# Add UI: [Page/Component Name]

## Scope
- Type: [page/component]
- Location: [src/app/(auth|public)/[path] OR src/components/]
- Design reference: [Figma link or file]

## Implementation
1. Create component with `"use client"` if needed
2. Use Tailwind + cn() for styling (no inline CSS)
3. Use shadcn/ui primitives where applicable
4. Follow design system from modernize-design-files/
5. Add TypeScript props with strict types

## Responsive Design
- Mobile-first approach
- Test breakpoints: sm (640), md (768), lg (1024), xl (1280)
- Tailwind breakpoint prefixes: sm:, md:, lg:, xl:

## Integration Points
- Data fetching: Server Components + async components
- State management: useState only if client-side interaction required
- Forms: react-hook-form + Zod validation
- Navigation: next/link for internal, <a> for external

## Testing
- [ ] Component renders without error
- [ ] Props validation with TypeScript
- [ ] Mobile/tablet/desktop responsive
- [ ] Accessibility: semantic HTML, ARIA labels where needed

## References
- docs/design-system-migration.md (when created)
- modernize-design-files/ (reference components)
- shadcn/ui components in src/components/
```

---

## Template 6: Debug or Fix Production Issue

**Use this when:** Responding to bug reports or production incidents

```markdown
# Fix: [Issue Description]

## Symptoms
- [What users/monitoring reports]
- Affected version/commit: [if known]

## Investigation Steps
1. Identify which domain is affected:
   - [ ] Authentication/Identity
   - [ ] Session state
   - [ ] Agent tool execution
   - [ ] Billing/credits
   - [ ] File generation
   - [ ] UI/Frontend

2. Find relevant code files (see codebase-structure-analysis.md)
3. Check error logs: docs/logging.md + errorCode filters
4. Review recent commits: git log --oneline -20
5. Run locally: npm run dev + reproduce

## Root Cause Analysis
- [ ] Is this code logic or data corruption?
- [ ] Does it affect existing sessions or new ones only?
- [ ] Is the issue deterministic or intermittent?

## Fix Implementation
1. Write test that reproduces the issue
2. Implement fix with minimal changes
3. Verify test now passes
4. Run full suite: npm run typecheck && npm test && npm run lint
5. Add regression test if complex

## Validation
- [ ] Issue reproducible before fix
- [ ] Issue gone after fix
- [ ] No new test failures
- [ ] No TypeScript errors
- [ ] Existing functionality unaffected

## References
- .claude/rules/error-handling.md
- docs/logging.md
- src/lib/agent/tool-errors.ts (if tool error)
```

---

## Template 7: Refactor or Optimize Performance

**Use this when:** Improving code quality, reducing bundle size, or optimizing queries

```markdown
# Refactor: [Target Area]

## Objective
- [Describe improvement: reduce duplication/improve perf/increase maintainability]
- Expected impact: [describe metric or benefit]

## Scope
- Files affected: [list 3-5 key files]
- Risk level: [low/medium/high]

## Plan
1. Identify what's being refactored
2. Review current implementation
3. Design improved approach
4. Implement incrementally
5. Preserve test coverage
6. Avoid breaking API changes

## Validation
- [ ] All existing tests pass (npm test)
- [ ] No new TypeScript errors (npm run typecheck)
- [ ] No new ESLint violations (npm run lint)
- [ ] [Metric]: [baseline] → [target]
- [ ] Peer review if risk level = high

## References
- Relevant .md docs
- Current implementation files
- Any performance baselines
```

---

## Template 8: Audit or Security Review

**Use this when:** Reviewing code for security, compliance, or architectural adherence

```markdown
# Audit: [Scope]

## Audit Type
- [ ] Security (input validation, injection, auth)
- [ ] Compliance (billing, credits, user data)
- [ ] Architecture (invariants, state contracts)
- [ ] Performance (queries, rendering, bundle)

## Checklist
### Security
- [ ] All external input validated with Zod
- [ ] No secrets in version control (check .gitignore)
- [ ] SQL queries use parameterized statements
- [ ] Auth checks on all sensitive routes
- [ ] Rate limiting on public endpoints

### Compliance (if Billing)
- [ ] Credit accounts only source of truth
- [ ] Webhook deduplication working
- [ ] No double-charging possible
- [ ] Subscription cancellation tested
- [ ] Manual credit adjustments audited

### Architecture (from CLAUDE.md)
- [ ] `cvState` used only for canonical resume
- [ ] `agentState` used for operational context
- [ ] Tools return ToolPatch, never mutate directly
- [ ] Session patches merged centrally
- [ ] App user IDs used in domain logic

### Performance
- [ ] Database queries indexed appropriately
- [ ] N+1 queries identified and fixed
- [ ] Bundle size within acceptable range
- [ ] No memory leaks in loops/subscriptions

## Findings
[Report issues found with:
- Severity: [critical/high/medium/low]
- Location: file:line
- Fix recommendation]

## Remediation Plan
[Priority-order fixes with affected files]
```

---

## Template 9: Release/Deployment Preparation

**Use this when:** Preparing code for staging or production rollout

```markdown
# Release: [Feature/Version Name]

## Pre-Release Checklist
- [ ] All tests pass: npm test
- [ ] TypeScript strict: npm run typecheck
- [ ] Linting clean: npm run lint
- [ ] No console.logs (except observability)
- [ ] No hardcoded URLs or credentials
- [ ] Error messages user-facing and specific

## Database
- [ ] Migrations tested locally
- [ ] Schema version incremented if needed
- [ ] No destructive migrations
- [ ] Rollback plan documented

## Documentation
- [ ] CLAUDE.md updated if architectural change
- [ ] docs/ updated if new pattern/flow
- [ ] Error codes added if new error types
- [ ] Commented complex logic

## Testing
- [ ] Unit tests: npm test ✅
- [ ] Integration tests on staging ✅
- [ ] Manual testing checklist completed ✅
- [ ] Performance baselines acceptable ✅

## Monitoring
- [ ] Error codes to watch: [list if new]
- [ ] Metrics to track: [list important KPIs]
- [ ] Rollback trigger: [condition]

## Deployment
- [ ] Feature branch ready
- [ ] PR description links issue/design doc
- [ ] Review approval from tech lead
- [ ] Deploy to staging first
- [ ] Validate in staging
- [ ] Schedule production window
- [ ] Monitor post-deployment

## References
- docs/PRODUCTION-READINESS-CHECKLIST.md
- docs/billing-ops-runbook.md (if billing involved)
```

---

## Quick Reference: Common Workflows

### "I'm adding a new resume rewrite feature"
→ Use **Template 1: Add Agent Tool**
- Reference: docs/tool-development.md
- Key file: src/lib/agent/tools/index.ts
- State bucket: cvState + agentState.rewriteHistory

### "I need to fix a bug in session state persistence"
→ Use **Template 6: Debug Issue** + **Template 3: Modify State**
- Reference: src/lib/db/sessions.ts + tests
- Key: Patch merge validation

### "I'm building the new pricing page"
→ Use **Template 5: Add UI** + **Template 4: Billing** (if plan changes)
- Reference: modernize-design-files/ + docs/design-system-migration.md
- Key: Tailwind + shadcn/ui

### "I'm reviewing code before production"
→ Use **Template 8: Audit** + **Template 9: Release**
- Reference: CLAUDE.md (all invariants)
- Key: Security + compliance + architecture checks

### "I need to understand the codebase first"
→ Read:
1. README.md (5 min)
2. CLAUDE.md (10 min)
3. docs/architecture-overview.md (15 min)
4. codebase-structure-analysis.md (this file, 20 min)
5. Relevant domain doc (15 min)

**Total onboarding: ~60 minutes**

---

## Prompt Engineering Tips for Claude Code

### ✅ DO:
- Reference specific files by path: `src/lib/agent/tools/index.ts:45`
- Link to docs: "Follow the pattern in docs/tool-development.md"
- Quote from CLAUDE.md when architectural rules matter
- Include acceptance criteria checklist
- Ask for specific test coverage

### ❌ DON'T:
- Ask for features without knowing the state model
- Skip error handling ("handle errors later")
- Ignore the tool invariants (return ToolPatch)
- Break billing audit trail (never mutate credit_accounts directly outside quota.ts)
- Store signed URLs in generatedOutput

### 📋 Include in Every Prompt:
1. **Context:** What & why (2-3 sentences)
2. **Scope:** Which files/domains affected
3. **Requirements:** What must be true
4. **Testing:** What must pass
5. **References:** Which docs apply

---

## Example: Complete Prompt (Ready to Use)

```markdown
# Add `analyze_writing_quality` Tool to Agent

## Context
We need to analyze resume writing quality before rewriting. This tool will evaluate clarity, conciseness, and ATS keyword usage. It affects `agentState.gapAnalysis` and guides the rewrite agent.

## Requirements
1. **Input:**
   - `section`: "summary" | "experience" | "skills"
   - `text`: string (resume content)

2. **Output on success:**
   ```json
   {
     "success": true,
     "quality_score": 0-100,
     "issues": ["too verbose", "weak action verbs"],
     "suggestions": ["Start with strong action verb", "Reduce by 30%"]
   }
   ```

3. **Output on failure:**
   - VALIDATION_ERROR if section not in enum
   - LLM_INVALID_OUTPUT if model fails to parse
   - INTERNAL_ERROR as fallback

4. **State mutation:**
   - Patch adds to `agentState.gapAnalysis.writingQuality`
   - Never modifies `cvState`

5. **Error cases:**
   - Invalid section → VALIDATION_ERROR
   - Empty text → VALIDATION_ERROR
   - Model fails → LLM_INVALID_OUTPUT (use `toolFailureFromUnknown`)

## Implementation Steps
1. Add `AnalyzeWritingQualityInput` type to `src/types/agent.ts`
2. Implement tool in `src/lib/agent/tools/analyze-writing-quality.ts`
   - Validate input with Zod schema
   - Call OpenAI with appropriate prompt
   - Parse and validate model output
   - Return `{ output, patch }` or `{ output: toolFailure(...) }`
3. Register in `src/lib/agent/tools/index.ts` (executeTool switch case)
4. Add tests: success, validation error, LLM output error
5. Verify patch merge preserves other gapAnalysis fields

## Acceptance Criteria
- [ ] Tool validates section enum
- [ ] Success case returns correct output shape
- [ ] All error cases return structured failures
- [ ] Tests cover success + 3 error paths
- [ ] Patch merge test verifies unrelated gapAnalysis fields preserved
- [ ] npm test passes
- [ ] npm run typecheck passes
- [ ] Error messages are user-facing

## Key References
- docs/tool-development.md
- docs/error-codes.md
- src/lib/agent/tool-errors.ts
- src/lib/agent/tools/gap-analysis.ts (similar pattern)
```

---

## Closing Notes

These templates are **staff-level guidance**, designed to:
- ✅ Reduce back-and-forth on scope/requirements
- ✅ Ensure consistency with architectural invariants
- ✅ Provide checklist-driven validation
- ✅ Link to relevant documentation
- ✅ Standardize across different engineers

**Customize for your team's needs.** Update this file as new patterns emerge.
