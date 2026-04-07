-- Fix: add missing DEFAULT on user_profiles.updated_at so the schema
-- guardrail audit passes.  The original migration omitted it because
-- Prisma relies on the application layer for updated_at, but CurrIA's
-- convention is that every mutable table has a database-level default.

ALTER TABLE "user_profiles"
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
