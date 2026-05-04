# Quick Task Plan

Task: Add UI-only display score and grouped critical gap presentation for JobCompatibilityAssessment.

Constraints:
- Do not change the technical compatibility score.
- Do not let claimPolicy consume displayScore.
- Keep forbidden claim validation as a hard block.
- Do not run LLM or activate source-of-truth.

Steps:
1. Add presentation types/helpers for displayScore and grouped gaps.
2. Wire assessment-derived UI score breakdowns to use presentation fields.
3. Update the score card UI to render grouped/limited critical gaps and very-low label.
4. Add focused tests and run local validation.
