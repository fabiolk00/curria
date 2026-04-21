# Component Boundaries

CurrIA is a brownfield monolith. The default is to keep UI close to the feature that owns it and promote components only when reuse is real, stable, and cheaper than duplication.

## Default Placement

- Put feature-specific UI in the feature folder that owns the behavior.
- Keep route-specific composition close to the page, layout, or feature entrypoint that uses it.
- Promote components to shared folders only after the contract is stable across more than one feature.

## Preferred Locations

- `src/components/ui/` for low-level reusable primitives with minimal product knowledge.
- `src/components/shared/` for cross-feature product components that still carry CurrIA-specific semantics.
- Feature folders such as `src/components/resume/`, `src/components/dashboard/`, `src/components/auth/`, or `src/app/**` colocation for UI that depends on one workflow or one route family.

## Promote To Shared When

- at least two features use the same component with the same behavioral contract
- the shared version does not need route-local state assumptions or one-off prop escape hatches
- the extraction reduces maintenance cost instead of creating a wrapper around one caller
- the naming still makes sense outside the original feature

## Keep Feature-Local When

- the component is tightly coupled to one page, route, or workflow
- props mirror one feature's domain objects directly
- copy, loading states, or actions are specific to one funnel step
- reuse is only speculative

## Anti-Patterns

- moving a component into `src/components/ui/` just to avoid a relative import
- creating a shared wrapper whose props are mostly pass-through flags for one feature
- mixing product workflow logic into low-level UI primitives
- promoting a component before its states, naming, and ownership have stabilized
- mass-moving existing brownfield UI without a concrete reuse or maintenance reason

## Practical Rule

- Duplicate a small unstable feature component before extracting it too early.
- Extract once the duplication proves the interface.
- When in doubt, keep the UI near the feature and link the cleanup to a real second consumer.
