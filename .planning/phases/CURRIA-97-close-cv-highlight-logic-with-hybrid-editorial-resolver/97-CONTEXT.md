## Phase 97 Context

### Goal

Close the remaining CV highlight span gap with a hybrid editorial resolver that first improves detector prompt quality and only then adds minimal local artifact-side arbitration when strictly necessary.

### Why This Phase Exists

The persisted highlight architecture is now correct end-to-end, but some rendered spans still:

- start on weak generic verbs
- stop before the natural semantic closure of a metric/result phrase
- depend too much on the detector's initial start offset

The product need is to make highlight behavior feel editorially final without reintroducing the aggressive candidate-scoring instability that was previously rolled back.

### Real Flow Seams

- ATS pipeline: `src/lib/agent/ats-enhancement-pipeline.ts`
- ATS job processor: `src/lib/jobs/processors/ats-enhancement.ts`
- Detector prompt + response parsing: `src/lib/agent/tools/detect-cv-highlights.ts`
- Highlight artifact + normalization: `src/lib/resume/cv-highlight-artifact.ts`
- Highlight observability: `src/lib/agent/highlight-observability.ts`
- Session comparison decision: `src/lib/routes/session-comparison/decision.ts`
- Preview renderer: `src/components/resume/resume-comparison-view.tsx`

### Current Architecture

After a final rewritten `optimizedCvState` exists, the system:

1. computes `shouldGenerateHighlights`
2. calls `generateCvHighlightState(cvState)`
3. flattens summary + experience bullets into stable highlight items
4. sends one detector request for all items
5. validates and resolves returned ranges locally
6. persists `highlightState`
7. renders the unchanged `optimizedCvState` plus the separate visual highlight layer

### Honest Gap Diagnosis

The architecture is solid. The remaining gap is local to span quality and comes from three places:

1. The detector prompt still allows semantically weak starts and incomplete closures.
2. `normalizeHighlightSpanBoundaries(...)` improves a span linearly but does not re-decide the best local nucleus.
3. The artifact has no conservative arbitration between a base span and a clearly stronger local alternative.

### Required Strategy Order

#### Front 1 - Detector prompt hardening first

Strengthen `buildHighlightSystemPrompt(...)` so the detector prefers semantically closed ranges and stops proposing machine-cut fragments.

Add explicit rules that:

- ranges must start and end on complete semantic units
- isolated metrics without their immediate measured context are invalid when the context exists in the same bullet
- generic lead verbs are invalid starts when a stronger later nucleus exists
- slightly longer natural spans are better than ultra-short machine-looking fragments

Add positive and negative examples for:

- metric + context closure
- complete migration/scale phrases
- avoiding starts like `Otimizei`, `Liderei`, `Desenvolvi` when a denser nucleus appears later

#### Front 2 - Minimal artifact-side resolver only if still needed

Only after validating Front 1 should the artifact gain conservative local arbitration.

Priority order:

1. Add left-trim editorial logic inside `normalizeHighlightSpanBoundaries(...)` to drop weak generic starts when a stronger local entry point exists.
2. Make the full-bullet-vs-nucleus decision rules more explicit around short measurable bullets and long bullets with premium nuclei.
3. If needed, add at most 3 local candidates:
   - `base_range`
   - `trim_left_range`
   - `metric_closure_range`

Promote an alternative only when it is clearly better on at least two of:

- metric with context
- technical specificity
- no generic lead
- no weak trailing tail

In doubt, keep `base_range`.

### Editorial Rule Hierarchy

All decisions must follow this order:

1. Complete and natural semantic unit
2. Dense signal: metric, scale, stack, business outcome
3. Proper closure
4. Brevity last

### Guardrails

- Do not start with artifact-side arbitration before validating prompt improvements.
- Do not reintroduce aggressive candidate scoring.
- Do not add more than 3 local candidates.
- Do not relax `isEditoriallyAcceptableHighlightRange(...)`.
- Do not change renderer logic; rendering is not the problem.

### Acceptance Criteria

- Metric bullets include the metric and its natural immediate complement, not just the number.
- Short complete semantic bullets can be highlighted whole.
- Highlights do not start on generic verbs when a better nucleus exists locally.
- Behavior stays deterministic and predictable for the same bullet conditions.
- `isEditoriallyAcceptableHighlightRange(...)` remains the last defense, not a compensation mechanism.
