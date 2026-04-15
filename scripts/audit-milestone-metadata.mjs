import { readFileSync } from 'node:fs'
import path from 'node:path'

function read(relativePath) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message)
  }
}

function assertExcludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    throw new Error(message)
  }
}

const milestones = read('.planning/MILESTONES.md')
const project = read('.planning/PROJECT.md')
const roadmap = read('.planning/ROADMAP.md')
const requirements = read('.planning/REQUIREMENTS.md')
const state = read('.planning/STATE.md')
const v14Roadmap = read('.planning/milestones/v1.4-ROADMAP.md')
const v14Audit = read('.planning/milestones/v1.4-MILESTONE-AUDIT.md')

assertIncludes(v14Roadmap, '**Phases:** 28-31.1', 'v1.4 roadmap must keep decimal phase 31.1 in scope.')
assertIncludes(v14Audit, 'status: passed_with_accepted_debt', 'v1.4 audit must reflect the post-backfill archive posture.')

assertIncludes(milestones, '5 phases, 13 plans', 'MILESTONES.md must report the correct v1.4 shipped counts.')
assertIncludes(
  milestones,
  'archived `VERIFICATION.md` artifacts',
  'MILESTONES.md must acknowledge the backfilled verification layer for v1.4.'
)
assertIncludes(
  milestones,
  'accepted runtime debt',
  'MILESTONES.md must keep the accepted runtime debt visible for v1.4.'
)
assertExcludes(
  milestones,
  'do not yet have formal `VERIFICATION.md` artifacts',
  'MILESTONES.md still reports the resolved pre-backfill verification gap.'
)

assertIncludes(
  project,
  'keep the archived phase verification layer durable',
  'PROJECT.md must describe verification closure as shipped and durable, not still missing.'
)
assertExcludes(
  project,
  'backfill or replace the missing verification layer',
  'PROJECT.md still frames the resolved verification backfill as pending next work.'
)
assertIncludes(
  project,
  '[x] Phase 33: Milestone closeout metadata',
  'PROJECT.md must reflect Phase 33 as validated once archive-integrity work lands.'
)
assertIncludes(
  project,
  '[ ] The remaining non-E2E runtime outliers',
  'PROJECT.md must keep the residual runtime work active after Phase 33.'
)

assertIncludes(
  roadmap,
  '| 33. Milestone Archive and Traceability Integrity | 2/2 | Complete |',
  'ROADMAP.md must mark Phase 33 complete.'
)
assertIncludes(roadmap, '`/gsd-plan-phase 34`', 'ROADMAP.md must point to the next logical phase entrypoint.')
assertIncludes(requirements, '| DOC-01 | Phase 33 | Complete |', 'REQUIREMENTS.md must mark DOC-01 complete after Phase 33.')
assertIncludes(requirements, '| DOC-02 | Phase 33 | Complete |', 'REQUIREMENTS.md must mark DOC-02 complete after Phase 33.')
assertIncludes(state, 'current_phase: 34', 'STATE.md must advance to Phase 34 after Phase 33 completion.')
assertIncludes(state, 'milestone: v1.5', 'STATE.md must stay pointed at active milestone v1.5.')
assertIncludes(state, 'Status: Ready to plan', 'STATE.md must leave the next phase in a plannable state.')

console.log('Milestone metadata audit passed.')
