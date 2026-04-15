# Quick Task 260414-u9d Summary

## Outcome

Updated `package.json` scripts to be package-manager-agnostic:

- `lint` now runs the underlying `next lint` and `eslint` commands directly
- `hygiene:inventory` now runs `ts-prune`, `depcheck`, and `madge` directly

This removes the implicit requirement that `pnpm` must exist on `PATH` when CI invokes `npm run ...`.

## Verification

- `npm run lint`

The command passed locally.
