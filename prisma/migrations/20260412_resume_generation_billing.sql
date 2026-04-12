do $$
begin
  create type resume_generation_type as enum ('ATS_ENHANCEMENT', 'JOB_TARGETING');
exception
  when duplicate_object then null;
end
$$;

create table if not exists resume_generations (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  session_id text references sessions(id) on delete cascade,
  resume_target_id text references resume_targets(id) on delete set null,
  type resume_generation_type not null,
  status text not null default 'pending',
  idempotency_key text unique,
  source_cv_snapshot jsonb not null,
  generated_cv_state jsonb,
  output_pdf_path text,
  output_docx_path text,
  failure_reason text,
  version_number integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists resume_generations_user_created_idx
  on resume_generations(user_id, created_at desc);

create index if not exists resume_generations_session_created_idx
  on resume_generations(session_id, created_at desc);

create index if not exists resume_generations_target_created_idx
  on resume_generations(resume_target_id, created_at desc);

create table if not exists credit_consumptions (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  resume_generation_id text not null unique references resume_generations(id) on delete cascade,
  type resume_generation_type not null,
  credits_used integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists credit_consumptions_user_created_idx
  on credit_consumptions(user_id, created_at desc);

create or replace function consume_credit_for_generation(
  p_user_id text,
  p_resume_generation_id text,
  p_generation_type resume_generation_type
) returns boolean
language plpgsql
as $$
begin
  if exists (
    select 1
    from credit_consumptions
    where resume_generation_id = p_resume_generation_id
  ) then
    return true;
  end if;

  update credit_accounts
  set credits_remaining = credits_remaining - 1,
      updated_at = timezone('utc', now())
  where user_id = p_user_id
    and credits_remaining > 0;

  if not found then
    return false;
  end if;

  insert into credit_consumptions (
    user_id,
    resume_generation_id,
    type
  ) values (
    p_user_id,
    p_resume_generation_id,
    p_generation_type
  );

  update resume_generations
  set updated_at = timezone('utc', now())
  where id = p_resume_generation_id;

  return true;
exception
  when unique_violation then
    return true;
end;
$$;
