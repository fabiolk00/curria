create table if not exists jobs (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  session_id text references sessions(id) on delete cascade,
  resume_target_id text references resume_targets(id) on delete set null,
  idempotency_key text not null,
  type text not null,
  status text not null default 'queued',
  stage text,
  progress jsonb,
  dispatch_input_ref jsonb not null,
  terminal_result_ref jsonb,
  terminal_error_ref jsonb,
  metadata jsonb,
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_type_check check (type in ('ats_enhancement', 'job_targeting', 'artifact_generation')),
  constraint jobs_status_check check (status in ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

create unique index if not exists jobs_user_type_idempotency_key_idx
  on jobs(user_id, type, idempotency_key);

create index if not exists jobs_user_created_idx
  on jobs(user_id, created_at desc);

create index if not exists jobs_status_created_idx
  on jobs(status, created_at desc);

create index if not exists jobs_type_status_idx
  on jobs(type, status);

create index if not exists jobs_session_created_idx
  on jobs(session_id, created_at desc);

create index if not exists jobs_resume_target_created_idx
  on jobs(resume_target_id, created_at desc);
