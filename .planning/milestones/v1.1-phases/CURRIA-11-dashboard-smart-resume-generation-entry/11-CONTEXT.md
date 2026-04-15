# Phase 11 Context

## Title

Dashboard Smart Resume Generation Entry

## Problem

Today `/dashboard/resume/new` is still a fixed ATS-enhancement entry point. The page copy, CTA, and backend route all assume the user is only generating a general ATS version, even though the product now supports deterministic `job_targeting` in the dashboard chat/workspace flow.

This creates product inconsistency:
- the chat path already treats `resume + vaga` as `job_targeting`
- the setup page still forces `ats_enhancement`
- users can reach different outcomes from similar intent depending on where they started

## Goal

Make `/dashboard/resume/new` a smart generation entry point that:
- defaults to ATS enhancement when the user only has base resume data
- supports target-job adaptation when the user provides a vacancy
- clearly explains which mode will run before consuming a credit
- reuses the deterministic backend pipelines from Phases 8 and 10

## UX Principles

- The UI must make the active mode obvious.
- The target-job field should be optional, not blocking ATS-only flows.
- The CTA and support copy should reflect the selected mode.
- Validation and empty-state messages should stay friendly and actionable.
- The page should feel like a fast setup/generation surface, not a second chat.

## Acceptance Criteria

The task is only complete when:

1. `/dashboard/resume/new` can generate `ats_enhancement` without a target vacancy.
2. `/dashboard/resume/new` can generate `job_targeting` when a target vacancy is provided.
3. The user sees explicit UI text indicating whether the current action is “ATS geral” or “adaptacao para vaga”.
4. The setup-page backend uses a single smart generation entrypoint that branches to the correct deterministic pipeline.
5. Success redirects the user into `/dashboard?session=...` with the correct session state already prepared.
6. Failure and validation states remain understandable in both modes.

## Likely Files

- `src/components/resume/user-data-page.tsx`
- `src/components/resume/user-data-page.test.tsx`
- `src/app/api/profile/ats-enhancement/route.ts` or a new smart-generation route
- `src/app/api/profile/ats-enhancement/route.test.ts` or a new smart-generation route test
- `src/lib/profile/ats-enhancement.ts`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/types/agent.ts`

## Suggested Shape

- keep the existing page
- add an optional target-job textarea in the right panel
- switch panel badge/title/body/CTA copy based on whether target-job content exists
- add a smart backend route dedicated to setup-page generation
- reuse `runAtsEnhancementPipeline(...)` and `runJobTargetingPipeline(...)` instead of duplicating logic
