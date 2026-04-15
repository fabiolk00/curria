# Phase 14 Context

## Why This Phase Exists

The repo already has Vitest and Playwright, but coverage expectations are not obvious to contributors, and linting remains too minimal for a growing TypeScript codebase. That makes it easier for quality drift to accumulate even when good testing primitives already exist.

## Problems To Solve

- ESLint is minimal and does not yet reflect a TypeScript-first brownfield enforcement strategy.
- Formatting expectations are implicit and prone to churn.
- Testing layers exist, but contributors cannot easily see the intended responsibilities and commands.

## Acceptance Lens

This phase is done when the repo has an enforceable quality baseline and the testing story is visible enough that new work can follow it consistently.

## Requirements

- ENG-01
- QA-06
