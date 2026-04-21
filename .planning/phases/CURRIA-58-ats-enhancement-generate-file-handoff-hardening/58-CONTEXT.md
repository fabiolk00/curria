# Phase 58 Context - ATS Enhancement Generate File Handoff Hardening

## Goal

Eliminate the recurring failure where ATS enhancement completes and persists a new version, but the subsequent `generate_file` execution fails during intake or preflight with a generic internal error.

## Scope

- smart-generation decision to `generate_file` dispatch handoff
- authoritative export-source selection in the `generate_file` tool seam
- typed failure classification for intake and handoff coherence problems
- regression coverage for the hardened seam

## Non-Goals

- ATS rewrite behavior redesign
- billing, preview-lock, or export-product redesign
- broad agent runtime rewrites
- public workflow changes beyond clearer failure classification
