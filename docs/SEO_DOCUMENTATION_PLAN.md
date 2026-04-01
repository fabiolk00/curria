---
title: SEO Documentation Restructuring Plan
audience: [product-managers, developers, operations]
status: current
created: 2026-03-31
---

# CurrIA Documentation SEO Restructuring Plan

## Executive Overview

This plan restructures 50+ markdown files across the CurrIA project to improve discoverability, navigation, and SEO. The restructuring maintains all existing documentation while adding strategic organization and navigation layers.

**Estimated effort:** 4-6 weeks (1-2 hours/day)
**Risk:** Low (documentation-only changes, non-breaking)
**Value:** High (enables faster onboarding, better knowledge discovery)

---

## Phase 1: Quick Wins (Week 1-2)

### 1.1 Create GETTING_STARTED.md

**File:** `docs/GETTING_STARTED.md`

**Purpose:** Single entry point with audience-based routing

**Structure:**
```markdown
---
title: Getting Started with CurrIA
audience: [developers, operations, product-managers]
related: [README.md, CONCEPTS.md, INDEX.md]
---

# Getting Started with CurrIA

## 👨‍💻 For Developers

Typical path: Setup → Architecture → Tool Development → Testing

1. **Clone and set up locally**
   - See README.md "Quick Start"
   - Use `npm run dev` to start
   - Set OPENAI_API_KEY from `.env.example`

2. **Understand the core architecture** (30 minutes)
   - Read: CONCEPTS.md → "Session & State Model"
   - Read: docs/architecture-overview.md
   - Read: docs/state-model.md

3. **Make your first contribution**
   - Read: docs/tool-development.md (how tools work)
   - Read: .claude/rules/code-style.md
   - Read: .claude/rules/testing.md
   - Pick a tool from src/lib/agent/tools/index.ts

4. **Debug production issues**
   - Read: docs/error-codes.md (error classification)
   - Read: docs/logging.md (query patterns)
   - Read: .claude/rules/error-handling.md

---

## 👨‍💼 For Operations

Typical path: Billing → Monitoring → Error Handling → Runbooks

1. **Understand the billing system** (20 minutes)
   - See: CONCEPTS.md → "Billing Model"
   - See: docs/billing/IMPLEMENTATION.md (5-minute overview)

2. **Monitor production** (10 minutes)
   - See: docs/logging.md (which queries to run)
   - See: docs/billing/MONITORING.md (billing-specific alerts)

3. **Respond to incidents**
   - See: docs/error-codes.md (classify the error)
   - See: docs/billing/OPS_RUNBOOK.md (billing fixes)
   - See: PRODUCTION_READINESS_CHECKLIST.md

4. **Understand the data model**
   - See: docs/state-model.md → "Session State Contracts"
   - See: CLAUDE.md → "Core Architecture"

---

## 📊 For Product Managers

Typical path: Features → Billing → Architecture Overview

1. **Understand CurrIA's capabilities** (20 minutes)
   - Read: FEATURES.md (product capabilities)
   - Read: docs/state-model.md → "Resume Features"

2. **Understand the billing model** (10 minutes)
   - Read: CONCEPTS.md → "Billing Model"
   - Read: docs/billing/IMPLEMENTATION.md (overview section)

3. **Plan feature requirements**
   - Read: CLAUDE.md → "Session State Contracts"
   - Read: docs/tool-development.md → "How to Add a Tool"

---

## Next Steps

- **Developers:** Go to [Architecture Overview](docs/architecture-overview.md)
- **Operations:** Go to [Billing Operations](docs/billing/OPS_RUNBOOK.md)
- **Product:** Go to [Features](FEATURES.md)
- **Anyone:** Jump to [Full Index](INDEX.md)
```

**Acceptance Criteria:**
- Links to all key docs are verified and correct
- Read-time estimates are accurate (test with sample readers)
- Each path takes recommended audience from 0 → productive in < 1 hour

---

### 1.2 Create CONCEPTS.md

**File:** `docs/CONCEPTS.md`

**Purpose:** Mental models before deep dives

**Structure:**
```markdown
---
title: CurrIA Core Concepts
audience: [developers, operations, product-managers]
related: [docs/architecture-overview.md, docs/state-model.md, FEATURES.md]
---

# CurrIA Core Concepts

This document explains the key ideas behind CurrIA in plain English, before diving into code or implementation details.

## 1. The Session Bundle

**In one sentence:** A session is a conversation between the user and the AI assistant that maintains their resume state throughout the chat.

**What lives in a session:**
- `cvState` - The canonical resume (structured, clean, ready to generate from)
- `agentState` - Operational context (parsed files, job descriptions, chat history)
- `generatedOutput` - Metadata about PDFs/DOCXs created
- `atsScore` - Last-known ATS score for the resume
- `phase` - Where the user is in their optimization journey

**Why separate them?**
- `cvState` is the source of truth for generation (never corrupted)
- `agentState` is temporary context (job descriptions, parsed text)
- `generatedOutput` is artifact metadata, not resume truth

**Diagram:**
```
┌─ Session ─────────────────────────┐
│ ┌─ cvState ─────────────────────┐ │
│ │ fullName, email, phone, etc   │ │  ← Resume truth
│ │ (canonical, clean, ready)     │ │
│ └───────────────────────────────┘ │
│ ┌─ agentState ──────────────────┐ │
│ │ parsed resume text, job desc  │ │  ← Operational context
│ │ gap analysis, rewrite history │ │
│ └───────────────────────────────┘ │
│ ┌─ generatedOutput ─────────────┐ │
│ │ docx path, pdf path, status   │ │  ← Artifact metadata
│ └───────────────────────────────┘ │
│ ┌─ atsScore ────────────────────┐ │
│ │ score, keywords matched       │ │  ← Last known score
│ └───────────────────────────────┘ │
└────────────────────────────────────┘
```

## 2. The Tool Architecture

**In one sentence:** Tools are actions the AI can take (rewrite, score, parse, generate) that update the session safely.

**How tools work:**
1. User sends a message
2. AI decides which tool to use
3. Tool validates input and runs
4. Tool returns output + optional state changes (patch)
5. Dispatcher merges the patch centrally
6. Response sent back to user

**Why not let tools mutate directly?**
- Prevents race conditions
- Keeps all state changes in one place (dispatcher)
- Enables rollback and audit trails
- Makes testing predictable

**What tools exist:**
- `parse_file` - Extract text from resume PDF/DOCX
- `score_ats` - Score resume against a job description
- `analyze_gap` - Find missing keywords/experience
- `rewrite_section` - AI-rewrites a resume section
- `generate_file` - Create DOCX and PDF from canonical resume
- `create_target_resume` - Generate a variant for a specific job
- `set_phase` - Move user through journey phases

[Full tool guide →](docs/tool-development.md)

## 3. The Billing Model

**In one sentence:** Users get monthly credits; using the AI agent consumes one credit per session.

**How credits work:**
- Free plan: 1 credit/month (1 session)
- Starter plan: 5 credits/month (5 sessions)
- Pro plan: 20 credits/month (20 sessions)
- Credits carry over on plan change
- Credits reset (not accumulate) on monthly renewal

**The data model:**
- `credit_accounts` - Live credit count (source of truth)
- `user_quotas` - Plan info + Asaas subscription data
- `billing_checkouts` - Post-cutover paid purchase records
- Asaas webhook → Credit grant/renewal

**Why separate credit_accounts and user_quotas?**
- `credit_accounts` is the runtime source of truth
- `user_quotas` is metadata for billing state
- This prevents off-by-one errors and double-grants

[Full billing guide →](docs/billing/IMPLEMENTATION.md)

## 4. The Rewrite & Versioning System

**In one sentence:** Users can rewrite their resume many times; each change creates an immutable snapshot.

**What gets versioned:**
- `cv_versions` - Immutable snapshots of cvState at key moments
- When data is trusted (ingestion, rewrite, manual edit) → snapshot created
- Source tags: `ingestion`, `rewrite`, `manual`, `target-derived`

**What's not versioned:**
- Raw parsed text (too large, not resume truth)
- Job descriptions (not part of resume)
- Generated PDFs/DOCXs (artifacts, not truth)

**Resume variants:**
- Base canonical resume (single, in session)
- Target-derived variants (multiple, isolated in resume_targets table)
- Each variant can be generated independently

[Full versioning guide →](docs/state-model.md#versioning)

## 5. The Error Code System

**In one sentence:** All tool failures use 8 standardized codes so logs, monitors, and users speak the same language.

**The 8 codes:**
- `VALIDATION_ERROR` (400) - Bad input data
- `PARSE_ERROR` (400) - File parsing failed
- `LLM_INVALID_OUTPUT` (500) - Model output didn't match schema
- `NOT_FOUND` (404) - Required entity missing
- `UNAUTHORIZED` (401) - Auth/ownership problem
- `RATE_LIMITED` (429) - Upstream rate limit
- `GENERATION_ERROR` (500) - Generation failed after validation
- `INTERNAL_ERROR` (500) - Unexpected fallback

**Why standardized codes?**
- Ops engineers can grep logs: `errorCode:VALIDATION_ERROR`
- Monitoring can alert on `RATE_LIMITED` vs `INTERNAL_ERROR` differently
- Users see consistent error messages
- Trending shows which codes are common

[Full error guide →](docs/error-codes.md)

## 6. The Identity Model

**In one sentence:** Clerk authenticates users; internally we track them with app user IDs to stay independent of Clerk.

**How it works:**
1. User logs in with Clerk
2. Request hits a route
3. Route calls getCurrentAppUser()
4. That function resolves: Clerk ID → user_auth_identities → app user ID
5. All domain logic uses app user IDs

**Why the indirection?**
- If we switched identity providers, we wouldn't rewrite the whole app
- Clerk IDs are not guaranteed stable or portable
- Multi-identity support (Clerk + SAML + SSO) becomes easier

[Full identity guide →](src/lib/auth/app-user.ts)

---

## Quick Reference Matrix

| Concept | Source of Truth | Related Docs | Key File |
|---------|---|---|---|
| Session State | session table + JSON | state-model.md | src/types/agent.ts |
| Tools | Tool execution | tool-development.md | src/lib/agent/tools/ |
| Billing | credit_accounts table | billing/IMPLEMENTATION.md | src/lib/asaas/ |
| Versions | cv_versions table | state-model.md | src/lib/db/cv-versions.ts |
| Errors | Error codes enum | error-codes.md | src/lib/agent/tool-errors.ts |
| Identity | user_auth_identities | app-user.ts | src/lib/auth/app-user.ts |

---

## FAQ

**Q: Why does cvState not include raw resume text?**
A: Raw text is huge, lossy (formatting lost), and not resume truth. We extract it to agentState temporarily, validate it, then structure it into cvState. This prevents corrupting the resume truth.

**Q: When does a new version get created?**
A: Only when cvState changes through a trusted operation (parse_file ingestion, rewrite_section tool, manual edit, or target creation). Unchanged edits don't create noisy versions.

**Q: Can users edit their resume in the UI without the AI?**
A: Yes. Manual edits update cvState directly and create a version with source `manual`. They don't consume credits.

**Q: What happens to credits when a user cancels their subscription?**
A: The subscription is cancelled (billing metadata updated) but credits already earned are kept. They don't get revoked.

**Q: How does Asaas webhook idempotency work?**
A: Each webhook is fingerprinted (stable hash of event data). If the same event is delivered twice, the fingerprint is the same, and we skip re-processing.

---

## Next Steps

- **Developers:** Read [Architecture Overview](docs/architecture-overview.md) next
- **Operations:** Read [Billing Operations](docs/billing/OPS_RUNBOOK.md) next
- **Product:** Read [Features](FEATURES.md) next
```

**Acceptance Criteria:**
- Each concept is explained in plain English (no jargon without definition)
- ASCII diagrams render correctly in markdown
- Links to deeper docs are all verified
- FAQ answers real questions new readers have

---

### 1.3 Create INDEX.md

**File:** `docs/INDEX.md`

**Purpose:** Comprehensive directory of all documentation

**Structure:**
```markdown
---
title: CurrIA Documentation Index
audience: [everyone]
status: current
---

# CurrIA Documentation Index

Complete list of all CurrIA documentation, organized by topic.

**Quick navigation:** [Getting Started](#getting-started) | [Architecture](#architecture) | [Features](#features) | [Operations](#operations) | [Developer Rules](#developer-rules) | [Reference](#reference)

---

## Getting Started

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [README.md](README.md) | everyone | 5 min | Product overview & quick start |
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | developers, ops, product | 10 min | Personalized entry points |
| [CONCEPTS.md](docs/CONCEPTS.md) | everyone | 15 min | Mental models & key ideas |

---

## Architecture & Design

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [CLAUDE.md](CLAUDE.md) | developers, architects | 20 min | Comprehensive system architecture (source of truth) |
| [docs/architecture-overview.md](docs/architecture-overview.md) | developers, architects | 15 min | System design overview |
| [docs/state-model.md](docs/state-model.md) | developers | 20 min | Session state contracts & data model |
| [docs/tool-development.md](docs/tool-development.md) | developers | 15 min | How to build and test tools |
| [src/lib/auth/app-user.ts](src/lib/auth/app-user.ts) | developers | 5 min | Identity resolution implementation |

---

## Features

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [FEATURES.md](FEATURES.md) | product, developers | 10 min | Product capabilities overview |
| [docs/state-model.md](docs/state-model.md) | developers | 20 min | Feature data model (resume state) |

**Feature-specific tools:**
- Resume Rewriting: `src/lib/agent/tools/rewrite-section.ts`
- ATS Scoring: `src/lib/ats/score.ts`
- Job Gap Analysis: `src/lib/agent/tools/gap-analysis.ts`
- File Generation: `src/lib/agent/tools/generate-file.ts`
- Target Resume Creation: `src/lib/resume-targets/create-target-resume.ts`

---

## Billing & Revenue

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [docs/billing/IMPLEMENTATION.md](docs/billing/IMPLEMENTATION.md) | developers, operations | 25 min | Billing system architecture |
| [docs/billing/MIGRATION_GUIDE.md](docs/billing/MIGRATION_GUIDE.md) | operations, developers | 15 min | Historical: Cutover from old → new system |
| [docs/billing/MONITORING.md](docs/billing/MONITORING.md) | operations | 10 min | Alerts, dashboards, debugging |
| [docs/billing/OPS_RUNBOOK.md](docs/billing/OPS_RUNBOOK.md) | operations | 15 min | Common billing issues & fixes |
| [src/lib/plans.ts](src/lib/plans.ts) | developers, product | 5 min | Plan definitions & credit amounts |

---

## OpenAI & LLM Configuration

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [docs/openai/MODEL_SELECTION_MATRIX.md](docs/openai/MODEL_SELECTION_MATRIX.md) | developers, architects | 10 min | Model performance comparison (historical reference) |
| [docs/openai/PORTUGUESE_QUALITY_GATE.md](docs/openai/PORTUGUESE_QUALITY_GATE.md) | developers | 10 min | Portuguese language validation & quality standards |
| [docs/openai/PORTUGUESE_TEST_RESULTS.md](docs/openai/PORTUGUESE_TEST_RESULTS.md) | developers | 10 min | Language quality test results & benchmarks |
| [src/lib/agent/config.ts](src/lib/agent/config.ts) | developers | 5 min | Current model routing & defaults |

**Current defaults:** All combos pinned to `gpt-5-nano` for cost optimization.

---

## Operations & Monitoring

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [docs/logging.md](docs/logging.md) | operations, developers | 15 min | Log querying patterns & structured logs |
| [docs/error-codes.md](docs/error-codes.md) | developers, operations | 15 min | Error classification & decision tree |
| [.claude/rules/error-handling.md](.claude/rules/error-handling.md) | developers | 10 min | Error handling best practices |
| [PRODUCTION_READINESS_CHECKLIST.md](PRODUCTION_READINESS_CHECKLIST.md) | operations | 10 min | Pre-deployment verification |

---

## Testing & Quality

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [.claude/rules/testing.md](.claude/rules/testing.md) | developers | 10 min | Testing strategy & expectations |
| [docs/staging/SETUP_GUIDE.md](docs/staging/SETUP_GUIDE.md) | developers, operations | 10 min | Setting up staging environment |
| [docs/staging/VALIDATION_PLAN.md](docs/staging/VALIDATION_PLAN.md) | developers, operations | 10 min | Staging validation checklist |

---

## Developer Conventions

| Document | Audience | Size | Purpose |
|----------|----------|------|---------|
| [.claude/rules/code-style.md](.claude/rules/code-style.md) | developers | 5 min | TypeScript & React conventions |
| [.claude/rules/api-conventions.md](.claude/rules/api-conventions.md) | developers | 10 min | REST API patterns & route examples |
| [docs/tool-development.md](docs/tool-development.md) | developers | 15 min | Tool architecture & patterns |
| [.claude/rules/error-handling.md](.claude/rules/error-handling.md) | developers | 10 min | Error handling rules & checklist |

---

## API Reference

| Endpoint | Method | Purpose | Docs |
|----------|--------|---------|------|
| `/api/agent` | POST | Chat with AI, create sessions | [api-conventions.md](.claude/rules/api-conventions.md#apiagent) |
| `/api/session` | GET | List user's sessions | [api-conventions.md](.claude/rules/api-conventions.md#apisession) |
| `/api/session/[id]/messages` | GET | Get session message history | [api-conventions.md](.claude/rules/api-conventions.md#apisessionidmessages) |
| `/api/session/[id]/versions` | GET | Get CV version history | [api-conventions.md](.claude/rules/api-conventions.md#apisessionidversions) |
| `/api/session/[id]/targets` | GET, POST | Manage target-derived resumes | [api-conventions.md](.claude/rules/api-conventions.md#apisessionidtargets) |
| `/api/checkout` | POST | Create Asaas payment link | [api-conventions.md](.claude/rules/api-conventions.md#apicheckout) |
| `/api/webhook/asaas` | POST | Asaas billing events | [api-conventions.md](.claude/rules/api-conventions.md#apiwebhookasaas) |
| `/api/webhook/clerk` | POST | Clerk identity events | [api-conventions.md](.claude/rules/api-conventions.md#apiwebhookclerk) |
| `/api/cron/cleanup` | GET | Cleanup old processed events | [api-conventions.md](.claude/rules/api-conventions.md#apicroncle anup) |

---

## Reference & Glossary

| Document | Audience | Purpose |
|----------|----------|---------|
| [GLOSSARY.md](GLOSSARY.md) | everyone | Key terms & definitions |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | developers, database engineers | Schema overview |

---

## Status Guide

- **CURRENT** - Active documentation, keep up-to-date
- **HISTORICAL** - Valid information about past decisions, useful for context
- **REFERENCE** - Static reference material (API definitions, plan details)
- **DEPRECATED** - Outdated, kept for historical context only

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| CLAUDE.md | CURRENT | Active |
| docs/architecture-overview.md | CURRENT | Active |
| docs/billing/IMPLEMENTATION.md | CURRENT | Active |
| docs/billing/MIGRATION_GUIDE.md | HISTORICAL | Pre-cutover system |
| docs/openai/MODEL_SELECTION_MATRIX.md | REFERENCE | Model bakeoff archive |
| docs/staging/VALIDATION_AGENT_PROMPT.md | REFERENCE | Internal tool prompt |

---

## How to Use This Index

**I'm new to CurrIA:**
1. Read [GETTING_STARTED.md](docs/GETTING_STARTED.md) (pick your role)
2. Read [CONCEPTS.md](docs/CONCEPTS.md)
3. Then follow the personalized path in Getting Started

**I need to fix a bug:**
1. Find the relevant section above
2. Read the listed docs in order
3. Use [docs/logging.md](docs/logging.md) to query logs

**I need to add a feature:**
1. Read [docs/tool-development.md](docs/tool-development.md)
2. Read [.claude/rules/error-handling.md](.claude/rules/error-handling.md)
3. Read [.claude/rules/testing.md](.claude/rules/testing.md)
4. Follow the checklist in tool-development.md

**I'm building a dashboard/integration:**
1. Read [API Reference](#api-reference) above
2. Read [.claude/rules/api-conventions.md](.claude/rules/api-conventions.md)
3. Check [docs/logging.md](docs/logging.md) for monitoring queries
```

**Acceptance Criteria:**
- Every document in the codebase is listed
- All links verify (no 404s)
- Status tags accurately reflect document currency
- Document sizes and read times are realistic

---

### 1.4 Update README.md

**File:** `README.md`

**Changes:**
1. Add keyword-rich intro (target: "resume optimization," "ATS," "Portuguese")
2. Add quick navigation table to key docs
3. Separate "What is CurrIA" from "How to set up locally"
4. Update model references (gpt-4o-mini → gpt-5-nano)
5. Add link to GETTING_STARTED.md as first entry point

**Before:**
```markdown
# CurrIA

AI-powered resume optimization...
```

**After:**
```markdown
# CurrIA: AI Resume Optimization Platform

Resume optimization SaaS for Brazilian job seekers. Get ATS-scored, AI-rewritten resumes tailored to specific job descriptions.

**Key Features:**
- 📊 ATS Scoring - See how your resume ranks against job postings
- 🎯 Job Targeting - Generate resume variants for specific positions
- ✨ AI Rewriting - Section-by-section resume optimization
- 📝 Resume Versioning - Track all your resume iterations
- 🇧🇷 Portuguese Optimized - Built for Brazilian job market

---

## Quick Links

| I'm a... | Start here | Time |
|----------|-----------|------|
| **New Developer** | [Developer Setup](docs/GETTING_STARTED.md#-for-developers) | 5 min |
| **Operations Engineer** | [Ops Setup](docs/GETTING_STARTED.md#-for-operations) | 5 min |
| **Product Manager** | [Feature Overview](FEATURES.md) | 5 min |
| **Exploring** | [All Docs](docs/INDEX.md) | Browse |

---

## Quick Start (Local Development)

[Rest of setup instructions...]
```

---

## Phase 2: Structure Consolidation (Week 2-3)

### 2.1 Create Billing Directory Structure

**Current State:** 4 separate billing docs at `docs/billing-*.md`

**Target State:**
```
docs/billing/
├── README.md (index)
├── IMPLEMENTATION.md (technical deep dive)
├── MIGRATION_GUIDE.md (historical: pre-cutover)
├── MONITORING.md (ops dashboards & alerts)
└── OPS_RUNBOOK.md (common issues & fixes)
```

**Action:**
1. Create `docs/billing/` directory
2. Move `docs/billing-*.md` files into directory
3. Create `docs/billing/README.md` with section overview and routing
4. Update cross-references throughout codebase

---

### 2.2 Create OpenAI Directory Structure

**Current State:** 5 separate OpenAI docs at `docs/openai-*.md`

**Target State:**
```
docs/openai/
├── README.md (index)
├── MODEL_SELECTION_MATRIX.md (historical bakeoff)
├── PORTUGUESE_QUALITY_GATE.md (current validation standards)
├── PORTUGUESE_TEST_RESULTS.md (latest test data)
└── CURRENT_CONFIG.md (what's deployed right now)
```

**Action:**
1. Create `docs/openai/` directory
2. Move files into directory
3. Create `docs/openai/CURRENT_CONFIG.md` with current defaults (gpt-5-nano)
4. Update cross-references

---

### 2.3 Create Staging Directory Structure

**Current State:** 3 separate staging docs

**Target State:**
```
docs/staging/
├── README.md (index)
├── SETUP_GUIDE.md
├── VALIDATION_PLAN.md
└── VALIDATION_AGENT_PROMPT.md (reference)
```

**Action:**
1. Create `docs/staging/` directory
2. Move files into directory
3. Create index with clear separation between "setup" and "validation"
4. Update cross-references

---

### 2.4 Create Developer Rules Directory (Move from .claude/)

**Current State:** Rules hidden in `.claude/rules/`

**Target State:**
```
docs/developer-rules/
├── README.md (why these rules exist)
├── CODE_STYLE.md
├── API_CONVENTIONS.md
├── ERROR_HANDLING.md
├── TESTING.md
└── TOOL_DEVELOPMENT.md
```

**Action:**
1. Create `docs/developer-rules/` directory
2. Copy (don't move yet) `.claude/rules/` files here
3. Create `docs/developer-rules/README.md` explaining purpose
4. Add cross-references from `.claude/rules/` for backwards compatibility
5. Update docs to link to new location

**Rationale:** Developer rules are essential documentation but hidden in `.claude/` directory. Bringing them to `docs/` makes them discoverable by doc crawlers and search.

---

### 2.5 Archive Work Artifacts

**Current State:** Various work files in docs and `.claude/analysis/`

**Target State:**
```
.claude/archive/
├── CLEANUP_SUMMARY.md
├── DELIVERY_SUMMARY.md
├── EXECUTION_PROMPT.md
├── analysis/
└── ... (other artifacts)
```

**Action:**
1. Create `.claude/archive/` directory
2. Move work artifacts (CLEANUP-SUMMARY.md, DELIVERY-SUMMARY.md, etc.) to archive
3. Create `.claude/archive/README.md` explaining what's in archive
4. Remove from main docs/

**Rationale:** Keep system documentation clean; preserve history without cluttering discoverability.

---

## Phase 3: Content Creation (Week 3-4)

### 3.1 Create FEATURES.md

**File:** `docs/FEATURES.md`

**Purpose:** Product-oriented feature overview (for product, marketing, developers)

**Structure:**
```markdown
---
title: CurrIA Features
audience: [product-managers, developers, marketing]
related: [CONCEPTS.md, docs/state-model.md, docs/tool-development.md]
---

# CurrIA Features

Complete overview of CurrIA's capabilities and how they work.

## Resume AI Rewriting

**What it does:** Users paste in weak resume sections; AI rewrites them to be more impactful while keeping the truth.

**How it works:**
- User selects a resume section (summary, experience, education, skills)
- User provides context (job description, desired position, etc.)
- AI reads the current text and rewrites it
- User reviews changes and accepts/rejects
- Accepted rewrites update the canonical resume

**Technical implementation:** [rewrite_section tool](src/lib/agent/tools/rewrite-section.ts)

**Use cases:**
- Weak summary → Strong value proposition
- Vague experience bullets → Quantified achievements
- Generic skills → ATS-optimized keywords

---

## ATS Scoring System

**What it does:** Scores your resume against a job posting to predict ATS compatibility.

**How it works:**
- User pastes in a job description
- System extracts keywords and requirements
- Scores your current resume against those keywords
- Returns: overall score, matched keywords, missing keywords

**Technical implementation:** [score_ats tool](src/lib/ats/score.ts)

**Use cases:**
- Quick screening: "Will my resume make it past the ATS?"
- Gap identification: "What keywords am I missing?"
- Performance tracking: "How does my resume score on similar positions?"

---

## Job Targeting (Resume Variants)

**What it does:** Create multiple versions of your resume, each optimized for a different job posting.

**How it works:**
- Start with a base canonical resume
- Create a target variant: "Target variant for Company X, Position Y"
- System creates an isolated copy of your resume
- You can rewrite sections specifically for that target
- Generate a DOCX/PDF specific to that job posting

**Technical implementation:** [create_target_resume tool](src/lib/resume-targets/create-target-resume.ts)

**Why variants, not overwrites?**
- Your base resume stays clean
- You can create variants for 10+ different job postings
- Each variant is independent

**Use cases:**
- Tailor your resume for each job application
- Keep a "generic" base for quick applications
- A/B test different resume versions

---

## Resume Versioning

**What it does:** Automatically track every change to your resume so you can see history or revert.

**How it works:**
- Every time you change your resume (rewrite, edit, create target), a snapshot is created
- Snapshots are immutable (can't be changed)
- You can view the history of changes
- You can revert to an older version if needed

**Technical implementation:** [cv_versions table](src/lib/db/cv-versions.ts)

**What gets versioned:**
- After parsing a resume file (source: `ingestion`)
- After AI rewriting a section (source: `rewrite`)
- After manual editing (source: `manual`)
- After creating a job target variant (source: `target-derived`)

**Use cases:**
- "What did I have in my summary 3 versions ago?"
- "I liked the old version better, let me revert"
- "Track my improvement over time"

---

## File Generation

**What it does:** Turn your optimized resume into professional DOCX and PDF files.

**How it works:**
- System reads your canonical resume (cvState)
- Generates a DOCX with professional formatting
- Converts DOCX to PDF
- Uploads both to cloud storage
- Provides download links

**Technical implementation:** [generate_file tool](src/lib/agent/tools/generate-file.ts)

**What's included:**
- Professional ATS-safe formatting
- All resume sections (summary, experience, education, skills, certifications)
- Supports Portuguese special characters
- Optimized for both human and ATS readers

---

## Credit System

**What it does:** Users get monthly credits; each new conversation consumes one credit.

**How it works:**
- Free plan: 1 credit/month
- Starter plan: 5 credits/month
- Pro plan: 20 credits/month
- Each credit = one session (conversation)
- Multiple messages in a session don't consume extra credits
- Credits carry over when switching plans
- Credits reset (don't accumulate) on monthly renewal

**Technical implementation:** [billing system](docs/billing/IMPLEMENTATION.md)

**Rationale:**
- Prevents abuse (limits concurrent conversations)
- Predictable monthly cost
- Fair: pay for sessions, not messages

---

## Identity & Authentication

**What it does:** Users log in with Clerk; system tracks them internally with app user IDs.

**How it works:**
- User logs in via Clerk (email, Google, GitHub, etc.)
- System creates internal app user ID
- All domain logic uses app user IDs
- Clerk ID never stored in resume/session data

**Why?**
- Independence from Clerk (easier provider migration)
- Multi-identity support (same user, multiple auth methods)
- Better data hygiene (Clerk data isolated from domain)

**Technical implementation:** [app-user.ts](src/lib/auth/app-user.ts)

---

## API & Integrations

**Public APIs:**
- `/api/agent` - Chat with AI and manage sessions
- `/api/session` - List and retrieve sessions
- `/api/checkout` - Create payment links
- `/api/webhook/asaas` - Billing webhooks
- `/api/webhook/clerk` - Identity webhooks

[Full API reference →](.claude/rules/api-conventions.md)

---

## Roadmap Considerations

**Features that would be natural extensions:**
- Resume recommendations based on industry trends
- Interview prep tools (mock Q&A, feedback)
- Job market analytics (salary insights, location trends)
- Template system (industry-specific resume formats)
- Batch processing (upload 10 job postings, generate 10 variants)
```

**Acceptance Criteria:**
- Each feature has a 1-2 sentence "What it does"
- Technical links are verified
- Use cases are realistic and buyer-focused
- No jargon without explanation

---

### 3.2 Create GLOSSARY.md

**File:** `docs/GLOSSARY.md`

**Purpose:** Single reference for key terms

**Format:**
```markdown
---
title: CurrIA Glossary
audience: [everyone]
---

# CurrIA Glossary

Key terms used throughout CurrIA documentation.

## Session & State

**Session**
The bundle of data representing a user's conversation with the AI assistant. Contains cvState, agentState, generatedOutput, atsScore, and phase.

**cvState**
Canonical resume truth. Structured, clean data ready for generation. Never contains raw text or AI artifacts.

**agentState**
Operational context for the agent. Includes parsed resume text, job descriptions, chat history, gap analysis. Temporary, not resume truth.

**generatedOutput**
Artifact metadata: paths to generated DOCX/PDF files, status, error messages. Not resume truth.

**stateVersion**
Version number of the session bundle format. Defaults to 1. Only increment when the bundle shape changes.

**ToolPatch**
State changes returned by a tool. Merged centrally by the dispatcher. Pattern: { cvState?, agentState?, generatedOutput? }

## Tools & Agent

**Tool**
An action the AI assistant can take (parse_file, score_ats, rewrite_section, etc.). Returns output + optional patch.

**Tool Loop**
The execution pattern: AI decides which tool → tool runs → dispatcher merges patch → response to user → repeat.

**parse_file**
Tool that extracts text from a resume PDF/DOCX. Updates agentState.sourceResumeText and optionally cvState.

**score_ats**
Tool that scores a resume against a job posting for ATS compatibility. Returns matching/missing keywords.

**rewrite_section**
Tool that rewrites a single resume section. Updates cvState field and creates version snapshot.

**generate_file**
Tool that renders the resume as DOCX and PDF. Reads cvState, uploads to storage, returns signed URLs.

**create_target_resume**
Tool that creates a job-specific resume variant. Creates row in resume_targets table, isolates from base cvState.

**Dispatcher**
Component that runs the tool loop. Validates tool output, merges patches, persists state.

## Identity & Auth

**Clerk**
External identity provider. Handles authentication (email, OAuth, SAML, etc.).

**App User**
Internal user ID (usr_<hash>). Used throughout domain logic instead of Clerk ID for independence.

**User Auth Identity**
Mapping from Clerk ID to app user ID. Stored in user_auth_identities table.

## Billing & Credits

**Credit**
Unit of consumption. One credit = one session. Used from credit_accounts table.

**Credit Account**
Source of truth for remaining credits. Updated when credits are granted, consumed, or renewed.

**User Quota**
Metadata for billing state: plan, Asaas customer ID, subscription ID, renewal date.

**Asaas**
Payment processor. Handles subscriptions, payment webhooks, customer management.

**Checkout**
One-time payment transaction. Stored in billing_checkouts table with external reference format curria:v1:u:<appUserId>:c:<checkoutRef>.

**Subscription**
Monthly recurring billing. Managed through Asaas. Renewal updates user_quotas.renews_at.

**Credit Grant**
Adding credits to an account. Triggered by PAYMENT_RECEIVED (checkout) or SUBSCRIPTION_CREATED/RENEWED (subscriptions).

**Webhook Deduplication**
Using event fingerprint (hash of event data) to prevent processing the same event twice. Stored in processed_events table.

## Versioning & Targeting

**CV Version**
Immutable snapshot of cvState at a point in time. Includes source tag: ingestion, rewrite, manual, or target-derived.

**Resume Target**
Job-specific resume variant. Isolated in resume_targets table. Can be generated to DOCX/PDF independently.

**Source Tags**
- `ingestion` - Created when resume was first parsed/imported
- `rewrite` - Created when section was AI-rewritten
- `manual` - Created when user manually edited
- `target-derived` - Created when variant was generated for specific job

## Error Codes

**VALIDATION_ERROR** (400)
Input validation failed or structured state is invalid. User should fix their input.

**PARSE_ERROR** (400)
File parsing or text extraction failed. Resume might be corrupted or unsupported format.

**LLM_INVALID_OUTPUT** (500)
AI model output failed schema validation. Model hallucinated or didn't follow instructions.

**NOT_FOUND** (404)
Required entity (session, target resume, version) doesn't exist or was deleted.

**UNAUTHORIZED** (401)
Auth failed, user not logged in, or ownership check failed. User doesn't have access.

**RATE_LIMITED** (429)
Upstream service (OpenAI, Asaas) returned rate limit. Client should retry later.

**GENERATION_ERROR** (500)
File generation failed after validation passed. Could be storage, PDF rendering, or signing failure.

**INTERNAL_ERROR** (500)
Unexpected error. Catch-all for unhandled exceptions.

## Technical Terms

**Structured Output**
AI model output validated against a JSON schema. Opposite of free-form text.

**Webhook**
HTTP POST callback from external service (Asaas, Clerk) to notify of events.

**Idempotent**
Operation can be run multiple times without additional side effects. Webhook processing is idempotent.

**RPC**
Remote Procedure Call. In CurrIA context, usually refers to Postgres stored procedures (get_or_create_app_user).

**Rate Limiting**
Restricting number of requests per time period. Uses Upstash Redis.

**Supabase**
Postgres database and file storage (Storage bucket) provider.

**Prisma**
ORM for Postgres. Used for schema definition and local migrations.

## Data Models

**users**
Core user record. Contains id, status, created_at, updated_at.

**user_auth_identities**
Maps Clerk ID (provider + provider_subject) to app user ID. Supports multiple identities per user.

**credit_accounts**
Source of truth for remaining credits. Contains id, user_id, credits_remaining, created_at, updated_at.

**user_quotas**
Billing metadata: plan, Asaas customer/subscription IDs, renewal date.

**sessions**
Session bundle: cvState, agentState, phase, generatedOutput, atsScore, stateVersion.

**cv_versions**
Immutable snapshots of cvState. Contains source tag and original session ID.

**resume_targets**
Job-specific resume variants. Links to session, contains target description, isolated cvState.

**billing_checkouts**
Payment records for one-time purchases. Contains plan, price, status, external reference.

**processed_events**
Deduplication cache for webhooks. Contains event_fingerprint, provider (asaas/clerk), processed_at.

## Abbreviations

- **AI** - Artificial Intelligence
- **API** - Application Programming Interface
- **ATS** - Applicant Tracking System
- **DOCX** - Word document format
- **PDF** - Portable Document Format
- **RPC** - Remote Procedure Call
- **SMS** - Short Message Service (not used in CurrIA currently)
- **SSE** - Server-Sent Events (used for streaming responses)
- **JWT** - JSON Web Token (not used; using Clerk sessions instead)
```

---

## Phase 4: Navigation & SEO (Week 4-5)

### 4.1 Add Frontmatter to Key Docs

**Template:**
```markdown
---
title: [Document Title]
audience: [developers, operations, product-managers, architects]
related: [doc1.md, doc2.md]
status: current|historical|reference|deprecated
updated: YYYY-MM-DD
---
```

**Apply to (priority order):**
1. CLAUDE.md
2. docs/architecture-overview.md
3. docs/state-model.md
4. docs/tool-development.md
5. docs/error-codes.md
6. docs/logging.md
7. docs/billing/IMPLEMENTATION.md
8. All `.claude/rules/*.md` files

---

### 4.2 Add "Related Documentation" Sections

**Pattern:**
```markdown
## Related Documentation

- **[Concept Overview](CONCEPTS.md)** - Mental models before deep dives
- **[Architecture Overview](docs/architecture-overview.md)** - System design
- **[Error Handling Guide](.claude/rules/error-handling.md)** - Tool error patterns
```

**Add to:**
- docs/architecture-overview.md
- docs/tool-development.md
- docs/state-model.md
- docs/billing/IMPLEMENTATION.md

---

### 4.3 Add Breadcrumb Navigation

**Pattern:**
```markdown
← [Back to Developer Rules](docs/developer-rules/README.md) | [All Docs](docs/INDEX.md)
```

**Add to:**
- All `.claude/rules/` files (moved to `docs/developer-rules/`)
- All `docs/billing/*.md` files
- All `docs/openai/*.md` files
- All `docs/staging/*.md` files

---

### 4.4 Improve Heading Hierarchy

**Audit:** Check that all docs follow h1 → h2 → h3 → h4 (no skipping levels)

**Tools:**
```bash
# Find docs with skipped heading levels
grep -r "^##" docs/ | grep -v "^###"
grep -r "^#### " docs/ | awk -F: '{print $1}' | sort -u
```

**Fix** any docs that skip levels. Common issues:
- h1 title, then h3 sections (skip h2)
- h2 sections, then h4 content (skip h3)

---

## Phase 5: Link Verification & Cleanup (Week 5-6)

### 5.1 Fix Broken Links

**Issue:** Many docs have paths like `/c:/CurrIA/docs/...` instead of relative links

**Audit:**
```bash
grep -r "c:/CurrIA" docs/ CLAUDE.md README.md
```

**Fix:** Replace with relative paths
- `/c:/CurrIA/docs/billing/IMPLEMENTATION.md` → `docs/billing/IMPLEMENTATION.md`
- `/c:/CurrIA/src/lib/` → `src/lib/`

---

### 5.2 Update Outdated References

**Audit:** Search for outdated content

```bash
# Find old model references
grep -r "gpt-4o-mini" docs/ src/

# Find old user ID format references
grep -r "usr_<id>" docs/ | grep -v "current state"

# Find broken Clerk references
grep -r "Clerk user ID" docs/ | grep -v "avoid"
```

**Fix:**
- `gpt-4o-mini` → `gpt-5-nano`
- Update model references in openai docs
- Update examples with current user ID format (`curria:v1:u:...`)

---

### 5.3 Verify All Internal Links

**Tool:**
```bash
# Check that all .md files exist that are linked
cd docs/
grep -r "\.md)" . | grep -oP '\([^)]+\.md\)' | sed 's/[()]//g' | sort -u
# Manually verify each exists
```

---

## Success Metrics

**Before:**
- New developer gets lost in 50+ docs
- No clear entry point beyond README
- Operations engineer has to find 4 billing docs
- SEO keywords not targeted

**After:**
- New developer follows GETTING_STARTED.md → productive in < 1 hour
- Operations engineer finds billing runbook in < 30 seconds
- Documentation discoverable through search (INDEX.md, keywords in headers)
- Reduced support load for "where do I find X" questions

---

## Implementation Checklist

### Phase 1 (Week 1-2)
- [ ] Create docs/GETTING_STARTED.md
- [ ] Create docs/CONCEPTS.md
- [ ] Create docs/INDEX.md
- [ ] Update README.md
- [ ] Test all links in new docs

### Phase 2 (Week 2-3)
- [ ] Create docs/billing/ directory structure
- [ ] Create docs/openai/ directory structure
- [ ] Create docs/staging/ directory structure
- [ ] Create docs/developer-rules/ directory structure
- [ ] Move .claude/rules/ to docs/developer-rules/ (copy for backwards compat)
- [ ] Create .claude/archive/ for work artifacts
- [ ] Update cross-references (PR, review, merge)

### Phase 3 (Week 3-4)
- [ ] Create docs/FEATURES.md
- [ ] Create docs/GLOSSARY.md
- [ ] Test links in new docs
- [ ] Get product/ops review

### Phase 4 (Week 4-5)
- [ ] Add frontmatter to 10+ key docs
- [ ] Add "Related Documentation" sections
- [ ] Add breadcrumb navigation
- [ ] Fix heading hierarchy issues

### Phase 5 (Week 5-6)
- [ ] Audit and fix broken links
- [ ] Update outdated references (models, formats, examples)
- [ ] Verify all internal links
- [ ] Final QA pass

### Post-Launch (Ongoing)
- [ ] Monitor documentation access logs (if available)
- [ ] Track search queries within docs
- [ ] Collect feedback from developers/ops
- [ ] Update docs quarterly based on feedback

---

## Notes for Implementation

1. **Make PRs per phase**, not all at once. Easier to review and discuss.
2. **Get product review** on FEATURES.md and CONCEPTS.md (these are user-facing).
3. **Get ops review** on billing consolidation (they'll use it most).
4. **Maintain .claude/rules/ for backwards compatibility** (don't break internal tools that reference old paths).
5. **Update git history notes** in CLAUDE.md if major structure changes.
6. **Consider adding docs/ to CI/CD** to validate links on every commit (optional).

---

## Success Timeline

| Week | Deliverable | Owner | QA |
|------|-------------|-------|-----|
| 1-2  | GETTING_STARTED, CONCEPTS, INDEX, README | Developer | Peer review |
| 2-3  | Directory restructuring, consolidation | Developer | Ops/Dev review |
| 3-4  | FEATURES, GLOSSARY | Developer + Product | Product review |
| 4-5  | Frontmatter, navigation, hierarchy | Developer | Automated checks |
| 5-6  | Link verification, cleanup | Developer | Full audit |
| 6+   | Launch & monitor | Team | Analytics, feedback |
```

**Acceptance Criteria:**
- Checklist is detailed enough to follow without much interpretation
- Timeline is realistic (4-6 weeks, ~1-2 hours/day)
- Deliverables are clear and measurable
- Success metrics show impact

---

## Summary

This implementation plan provides:

✅ **Clear phasing** - 5 phases, each 1-2 weeks
✅ **Specific deliverables** - Named files, exact structures
✅ **Acceptance criteria** - How to know each task is done
✅ **Risk mitigation** - Low-risk documentation changes, backwards compatibility
✅ **Success metrics** - Before/after comparison

Would you like me to:
1. **Start implementing Phase 1 now** (GETTING_STARTED, CONCEPTS, INDEX)?
2. **Adjust the timeline** based on your team's capacity?
3. **Focus on specific phases** (e.g., just billing consolidation)?
4. **Create sample files** showing what Phase 1 deliverables look like?