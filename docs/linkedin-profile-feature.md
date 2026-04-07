# LinkedIn Profile Feature

## Overview

CurrIA now supports a saved user profile that seeds new sessions automatically.

The canonical user flow is:

1. Open `/dashboard/resumes/new`
2. Import from LinkedIn or fill the profile manually
3. Review and edit the structured `cvState`
4. Save the result to `UserProfile` via `PUT /api/profile`
5. Start future sessions with `cvState` already preloaded

`/profile` is now a compatibility redirect to `/dashboard/resumes/new`.

PDF upload is not implemented yet. The UI keeps that option visible but disabled.

## Data Model

`UserProfile` stores a user-scoped resume seed.

Important fields:

- `user_id`: one profile per user
- `cv_state`: canonical saved profile in the same shape as session `cvState`
- `source`: `linkedin`, `pdf`, or `manual`
- `linkedin_url`: optional stored LinkedIn URL
- `extracted_at`: timestamp of the import that created the saved profile

Invariants:

- `UserProfile.cvState` is seed-only state, not active session truth
- session `cvState` remains the runtime source of truth
- tools do not write to `UserProfile`
- manual profile saves do not create `cv_versions`

## Current API Surface

### `POST /api/profile/extract`

Starts LinkedIn extraction.

Request:

```json
{
  "linkedinUrl": "https://www.linkedin.com/in/username/"
}
```

Response:

```json
{
  "success": true,
  "jobId": "abc123",
  "position": 5,
  "message": "Profile extraction started"
}
```

### `GET /api/profile/status/[jobId]`

Polls import job state. If the job is still pending, the status endpoint atomically claims and processes it on-demand.

Response:

```json
{
  "jobId": "abc123",
  "status": "waiting"
}
```

### `GET /api/profile`

Returns the saved user profile or `null`.

Response:

```json
{
  "profile": {
    "id": "prof_123",
    "source": "linkedin",
    "cvState": {},
    "linkedinUrl": "https://www.linkedin.com/in/username/",
    "extractedAt": "2026-04-07T00:00:00.000Z",
    "createdAt": "2026-04-07T00:00:00.000Z",
    "updatedAt": "2026-04-07T00:00:00.000Z"
  }
}
```

### `PUT /api/profile`

Saves the reviewed profile back to `UserProfile`.

Request body is the canonical `CVState` payload.

Behavior:

- creates a manual profile for first-time users
- preserves `source` and `linkedinUrl` when editing an imported profile
- updates the saved `cvState`
- does not create session versions

### `POST /api/profile/upload`

Not implemented yet.

## Canonical Front-End Flow

### Route

- Canonical: `src/app/(auth)/dashboard/resumes/new/page.tsx`
- Compatibility redirect: `src/app/(auth)/profile/page.tsx`

### Components

- `src/components/resume/user-data-page.tsx`
  - loads the saved profile with `GET /api/profile`
  - owns the local editable draft
  - saves with `PUT /api/profile`
- `src/components/resume/resume-builder.tsx`
  - LinkedIn import modal
  - submits extraction jobs
  - polls status and reloads the saved profile on completion
- `src/components/resume/visual-resume-editor.tsx`
  - controlled structured editor for `CVState`

### UX States

- loading saved profile
- empty profile editor
- LinkedIn import in progress
- saved profile ready for future sessions

## Session Seeding

Session creation behavior did not change conceptually.

`src/lib/db/sessions.ts` still:

- checks for an existing `UserProfile`
- clones `UserProfile.cvState` into the new session
- falls back to the empty `cvState` shape when no profile exists

The session then owns its own `cvState` independently.

## Agent Behavior

`src/lib/agent/context-builder.ts` injects preloaded resume context when:

- the session already has meaningful `cvState`
- the data did not come from a file parsed in the current session

This tells the agent to skip `parse_file` and start helping immediately.

## Current Scope And Pending Work

Implemented now:

- LinkedIn extraction via LinkdAPI
- DB-backed import jobs with on-demand processing
- saved profile retrieval
- manual review and save
- canonical profile screen at `/dashboard/resumes/new`
- compatibility redirect from `/profile`
- session seeding
- agent preloaded context

Still pending:

- `POST /api/profile/upload`
- real PDF parsing path for profile setup
- any advanced review/diff flow before save
