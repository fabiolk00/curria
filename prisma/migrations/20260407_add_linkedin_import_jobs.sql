-- linkedin_import_jobs: DB-backed job state machine for LinkedIn profile extraction.
-- Replaces BullMQ queue (incompatible with Vercel serverless).
--
-- Flow:
--   POST /api/profile/extract     → INSERT (status = 'pending')
--   GET  /api/profile/status/:id  → atomic claim (pending → processing), extract, then completed/failed
--
-- The status column acts as a simple state machine:
--   pending → processing → completed
--                        → failed

CREATE TABLE IF NOT EXISTS linkedin_import_jobs (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_url    TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  claimed_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_import_jobs_user_id ON linkedin_import_jobs (user_id);
CREATE INDEX idx_linkedin_import_jobs_status  ON linkedin_import_jobs (status);
