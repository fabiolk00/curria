alter table public.resume_generations
  add column if not exists history_kind text,
  add column if not exists history_title text,
  add column if not exists history_description text,
  add column if not exists target_role text,
  add column if not exists target_job_snippet text,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists error_message text;

update public.resume_generations
set history_kind = case
  when idempotency_key like 'generation:%:chat:%' then 'chat'
  when type = 'JOB_TARGETING' or resume_target_id is not null or idempotency_key like 'profile-target:%' then 'target_job'
  else 'ats_enhancement'
end
where history_kind is null;

update public.resume_generations
set history_title = case
  when history_kind = 'chat' then 'Currículo gerado no chat'
  when history_kind = 'target_job' then 'Currículo adaptado para vaga'
  else 'Currículo ATS otimizado'
end
where history_title is null;

update public.resume_generations
set history_description = case
  when history_kind = 'chat' then 'Versão criada a partir da conversa com a IA.'
  when history_kind = 'target_job' then 'Versão adaptada com base na descrição da vaga informada.'
  else 'Melhoria geral para compatibilidade ATS, clareza e estrutura.'
end
where history_description is null;

update public.resume_generations
set completed_at = case
      when completed_at is not null then completed_at
      when status = 'completed' then updated_at
      else null
    end,
    failed_at = case
      when failed_at is not null then failed_at
      when status = 'failed' then updated_at
      else null
    end,
    error_message = coalesce(error_message, failure_reason)
where completed_at is null
   or failed_at is null
   or error_message is null;

alter table public.resume_generations
  alter column history_kind set not null;

alter table public.resume_generations
  alter column history_title set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resume_generations_history_kind_check'
  ) then
    alter table public.resume_generations
      add constraint resume_generations_history_kind_check
      check (history_kind in ('chat', 'ats_enhancement', 'target_job'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resume_generations_status_check'
  ) then
    alter table public.resume_generations
      add constraint resume_generations_status_check
      check (status in ('pending', 'completed', 'failed'));
  end if;
end
$$;

create index if not exists resume_generations_user_history_kind_created_idx
  on public.resume_generations(user_id, history_kind, created_at desc);

create index if not exists resume_generations_user_status_created_idx
  on public.resume_generations(user_id, status, created_at desc);
