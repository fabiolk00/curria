# Phase 15 Context

## Why This Phase Exists

`sessions.ts` has become a dense operational center that mixes session creation, normalization, patching, quota logic, message appends, and transactional fallback behavior. It works, but it increases maintenance risk and makes narrower verification harder.

## Problems To Solve

- One large file owns too many persistence responsibilities.
- Smaller behavioral seams are hard to test in isolation.
- Future pipeline work will keep reopening the same dense module unless responsibilities are extracted.

## Acceptance Lens

This phase is done when session persistence concerns are split into narrower modules with stable contracts and no user-visible regressions.

## Requirements

- ARCH-01
