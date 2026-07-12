begin;

create extension if not exists pgcrypto;

alter table public.naraibase_responses
  add column if not exists edit_token_hash text,
  add column if not exists selection_status text,
  add column if not exists reason_status text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

update public.naraibase_responses
set selection_status = case when moderation_status = 'rejected' then 'rejected' else 'approved' end,
    reason_status = case
      when moderation_status = 'approved' then 'approved'
      when moderation_status = 'rejected' then 'rejected'
      else 'pending'
    end
where selection_status is null or reason_status is null;

alter table public.naraibase_responses
  alter column selection_status set default 'approved',
  alter column selection_status set not null,
  alter column reason_status set default 'pending',
  alter column reason_status set not null;

alter table public.naraibase_responses
  drop constraint if exists naraibase_responses_selection_status_check,
  drop constraint if exists naraibase_responses_reason_status_check;

alter table public.naraibase_responses
  add constraint naraibase_responses_selection_status_check
    check (selection_status in ('pending', 'approved', 'rejected')),
  add constraint naraibase_responses_reason_status_check
    check (reason_status in ('pending', 'approved', 'rejected')),
  add constraint naraibase_responses_reason_lengths_check
    check (
      char_length(coalesce(useful_reason, '')) <= 500
      and char_length(coalesce(recommended_reason, '')) <= 500
    );

create unique index if not exists uq_naraibase_site_response_per_session_lesson
  on public.naraibase_responses (session_id, lesson_slug)
  where deleted_at is null and source = 'site';

create index if not exists idx_naraibase_public_stats
  on public.naraibase_responses (lesson_slug, selection_status)
  where deleted_at is null and source <> 'internal_test';

create table if not exists public.naraibase_rate_limits (
  rate_limit_hash text primary key,
  submission_count integer not null default 0,
  last_submitted_at timestamptz not null default now()
);
alter table public.naraibase_rate_limits enable row level security;
revoke all on table public.naraibase_rate_limits from public, anon, authenticated;

drop policy if exists "Allow insert for anon" on public.naraibase_responses;
drop policy if exists "Allow read access for owner" on public.naraibase_responses;
revoke insert, update, delete, select on table public.naraibase_responses from anon, authenticated;
revoke execute on function public.submit_naraibase_response(text, text, text, boolean, boolean, text, text, text) from public, anon, authenticated;

create or replace function public.get_naraibase_stats(p_lesson_slug text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with approved as (
    select *
    from public.naraibase_responses
    where lesson_slug = p_lesson_slug
      and selection_status = 'approved'
      and deleted_at is null
      and source <> 'internal_test'
  )
  select jsonb_build_object(
    'total_approved', count(*),
    'useful_yes', count(*) filter (where is_useful),
    'useful_no', count(*) filter (where not is_useful),
    'recommended_yes', count(*) filter (where is_recommended),
    'recommended_no', count(*) filter (where not is_recommended),
    'male_total', count(*) filter (where gender = 'male'),
    'male_useful_yes', count(*) filter (where gender = 'male' and is_useful),
    'female_total', count(*) filter (where gender = 'female'),
    'female_useful_yes', count(*) filter (where gender = 'female' and is_useful),
    'research_panel', count(*) filter (where source = 'research_panel'),
    'site', count(*) filter (where source = 'site'),
    'campaign', count(*) filter (where source = 'campaign'),
    'last_updated_at', max(updated_at)
  )
  from approved;
$$;

create or replace function public.get_naraibase_reasons(
  p_lesson_slug text,
  p_client_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_has_answered boolean;
  v_reasons jsonb;
begin
  if p_client_session_id is null
     or char_length(p_client_session_id) < 20
     or char_length(p_client_session_id) > 512
     or p_client_session_id !~ '^[A-Za-z0-9_-]+$' then
    v_has_answered := false;
  else
    select exists (
      select 1
      from public.naraibase_responses
      where session_id = p_client_session_id
        and source = 'site'
        and deleted_at is null
    ) into v_has_answered;
  end if;

  if v_has_answered then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
    into v_reasons
    from (
      select gender, useful_reason, recommended_reason, created_at
      from public.naraibase_responses
      where lesson_slug = p_lesson_slug
        and reason_status = 'approved'
        and deleted_at is null
        and source <> 'internal_test'
        and (useful_reason is not null or recommended_reason is not null)
      order by created_at desc
      limit 100
    ) r;
  else
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
    into v_reasons
    from (
      select
        gender,
        case when useful_reason is null then null else left(useful_reason, 6) || '…' end as useful_reason,
        case when recommended_reason is null then null else left(recommended_reason, 6) || '…' end as recommended_reason,
        created_at
      from public.naraibase_responses
      where lesson_slug = p_lesson_slug
        and reason_status = 'approved'
        and deleted_at is null
        and source <> 'internal_test'
        and (useful_reason is not null or recommended_reason is not null)
      order by created_at desc
      limit 2
    ) r;
  end if;

  return jsonb_build_object('has_answered', v_has_answered, 'reasons', v_reasons);
end;
$$;

create or replace function public.submit_naraibase_response_internal(
  p_session_id text,
  p_edit_token text,
  p_rate_limit_hash text,
  p_gender text,
  p_lesson_slug text,
  p_is_useful boolean,
  p_is_recommended boolean,
  p_useful_reason text,
  p_recommended_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_count integer;
begin
  if p_session_id is null or char_length(p_session_id) < 20 or char_length(p_session_id) > 512
     or p_session_id !~ '^[A-Za-z0-9_-]+$'
     or p_edit_token is null or char_length(p_edit_token) < 32 or char_length(p_edit_token) > 512
     or p_edit_token !~ '^[A-Za-z0-9_-]+$'
     or p_rate_limit_hash is null or char_length(p_rate_limit_hash) <> 64
     or p_gender not in ('male', 'female')
     or p_is_useful is null or p_is_recommended is null
     or not exists (select 1 from public.naraibase_lessons where slug = p_lesson_slug)
     or char_length(coalesce(p_useful_reason, '')) > 500
     or char_length(coalesce(p_recommended_reason, '')) > 500 then
    raise exception 'invalid_payload';
  end if;

  delete from public.naraibase_rate_limits
  where last_submitted_at < now() - interval '7 days';


  insert into public.naraibase_rate_limits (rate_limit_hash, submission_count, last_submitted_at)
  values (p_rate_limit_hash, 1, now())
  on conflict (rate_limit_hash) do update
    set submission_count = public.naraibase_rate_limits.submission_count + 1,
        last_submitted_at = now()
  returning submission_count into v_count;

  if v_count > 10 then
    raise exception 'rate_limit_exceeded';
  end if;

  insert into public.naraibase_responses (
    session_id, edit_token_hash, gender, lesson_slug,
    is_useful, is_recommended, useful_reason, recommended_reason,
    moderation_status, selection_status, reason_status, source
  ) values (
    p_session_id,
    encode(extensions.digest(p_edit_token, 'sha256'), 'hex'),
    p_gender,
    p_lesson_slug,
    p_is_useful,
    p_is_recommended,
    nullif(btrim(p_useful_reason), ''),
    nullif(btrim(p_recommended_reason), ''),
    'pending',
    'approved',
    'pending',
    'site'
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
exception
  when unique_violation then
    raise exception 'duplicate_response';
end;
$$;

create or replace function public.get_editable_naraibase_response(
  p_response_id bigint,
  p_edit_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_response jsonb;
begin
  select jsonb_build_object(
    'gender', gender,
    'lesson_slug', lesson_slug,
    'is_useful', is_useful,
    'is_recommended', is_recommended,
    'useful_reason', coalesce(useful_reason, ''),
    'recommended_reason', coalesce(recommended_reason, '')
  )
  into v_response
  from public.naraibase_responses
  where id = p_response_id
    and source = 'site'
    and deleted_at is null
    and edit_token_hash = encode(extensions.digest(coalesce(p_edit_token, ''), 'sha256'), 'hex');

  if v_response is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token_or_deleted');
  end if;
  return jsonb_build_object('success', true, 'response', v_response);
end;
$$;

create or replace function public.update_naraibase_response(
  p_response_id bigint,
  p_edit_token text,
  p_gender text,
  p_lesson_slug text,
  p_is_useful boolean,
  p_is_recommended boolean,
  p_useful_reason text,
  p_recommended_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed integer;
begin
  if p_gender not in ('male', 'female')
     or p_is_useful is null or p_is_recommended is null
     or not exists (select 1 from public.naraibase_lessons where slug = p_lesson_slug)
     or char_length(coalesce(p_useful_reason, '')) > 500
     or char_length(coalesce(p_recommended_reason, '')) > 500 then
    return jsonb_build_object('success', false, 'error', 'invalid_payload');
  end if;

  update public.naraibase_responses
  set gender = p_gender,
      lesson_slug = p_lesson_slug,
      is_useful = p_is_useful,
      is_recommended = p_is_recommended,
      useful_reason = nullif(btrim(p_useful_reason), ''),
      recommended_reason = nullif(btrim(p_recommended_reason), ''),
      moderation_status = 'pending',
      selection_status = 'approved',
      reason_status = 'pending',
      updated_at = now()
  where id = p_response_id
    and source = 'site'
    and deleted_at is null
    and edit_token_hash = encode(extensions.digest(coalesce(p_edit_token, ''), 'sha256'), 'hex');
  get diagnostics v_changed = row_count;

  if v_changed = 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_token_or_deleted');
  end if;
  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'duplicate_response');
end;
$$;

create or replace function public.delete_naraibase_response(
  p_response_id bigint,
  p_edit_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed integer;
begin
  update public.naraibase_responses
  set deleted_at = now(), updated_at = now()
  where id = p_response_id
    and source = 'site'
    and deleted_at is null
    and edit_token_hash = encode(extensions.digest(coalesce(p_edit_token, ''), 'sha256'), 'hex');
  get diagnostics v_changed = row_count;

  if v_changed = 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_token_or_deleted');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.submit_naraibase_response_internal(text, text, text, text, text, boolean, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_naraibase_response_internal(text, text, text, text, text, boolean, boolean, text, text) to service_role;

revoke all on function public.get_naraibase_stats(text) from public;
revoke all on function public.get_naraibase_reasons(text, text) from public;
revoke all on function public.get_editable_naraibase_response(bigint, text) from public;
revoke all on function public.update_naraibase_response(bigint, text, text, text, boolean, boolean, text, text) from public;
revoke all on function public.delete_naraibase_response(bigint, text) from public;

grant execute on function public.get_naraibase_stats(text) to anon, authenticated;
grant execute on function public.get_naraibase_reasons(text, text) to anon, authenticated;
grant execute on function public.get_editable_naraibase_response(bigint, text) to anon, authenticated;
grant execute on function public.update_naraibase_response(bigint, text, text, text, boolean, boolean, text, text) to anon, authenticated;
grant execute on function public.delete_naraibase_response(bigint, text) to anon, authenticated;

-- Retire the removed "困りごと" answer API while preserving historical tables.
revoke execute on function public.submit_trial_response_internal(jsonb, text, text) from service_role;
revoke execute on function public.submit_trial_response_rate_limited_internal(jsonb, text, text, text) from service_role;
revoke execute on function public.get_editable_response_internal(uuid, text) from service_role;
revoke execute on function public.update_trial_response_internal(uuid, text, integer, jsonb) from service_role;
revoke execute on function public.delete_trial_response_internal(uuid, text) from service_role;
revoke execute on function public.register_rate_limit_internal(text, text) from service_role;
revoke execute on function public.get_problem_results(text), public.get_method_results(text) from anon, authenticated;

commit;
