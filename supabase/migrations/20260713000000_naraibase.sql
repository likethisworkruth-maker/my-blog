begin;

-- Create naraibase_lessons table
create table if not exists public.naraibase_lessons (
  slug text primary key,
  name text not null,
  order_index integer not null default 0
);

-- Insert initial lessons
insert into public.naraibase_lessons (slug, name, order_index)
values
  ('piano', 'ピアノ', 10),
  ('swimming', '水泳', 20),
  ('soccer', 'サッカー', 30),
  ('baseball', '野球', 40),
  ('calligraphy', '習字', 50),
  ('abacus', 'そろばん', 60),
  ('english', '英会話', 70),
  ('dance', 'ダンス', 80),
  ('ballet', 'バレエ', 90),
  ('gymnastics', '体操', 100),
  ('martial_arts', '武道', 110),
  ('cram_school', '学習塾', 120),
  ('other', 'その他', 130)
on conflict (slug) do update set name = excluded.name, order_index = excluded.order_index;

-- Create public.naraibase_responses table
create table if not exists public.naraibase_responses (
  id bigserial primary key,
  session_id text not null,
  gender text not null check (gender in ('male', 'female')),
  lesson_slug text not null references public.naraibase_lessons(slug) on delete cascade,
  is_useful boolean not null,
  is_recommended boolean not null,
  useful_reason text,
  recommended_reason text,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  source text not null default 'site' check (source in ('site', 'research_panel', 'internal_test', 'campaign')),
  created_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_naraibase_responses_lesson_slug on public.naraibase_responses(lesson_slug);
create index if not exists idx_naraibase_responses_moderation_status on public.naraibase_responses(moderation_status);
create index if not exists idx_naraibase_responses_session_id on public.naraibase_responses(session_id);

-- Enable RLS
alter table public.naraibase_lessons enable row level security;
alter table public.naraibase_responses enable row level security;

-- Drop existing policies if any
drop policy if exists "Allow read access to all" on public.naraibase_lessons;
drop policy if exists "Allow read access for owner" on public.naraibase_responses;
drop policy if exists "Allow insert for anon" on public.naraibase_responses;

-- RLS policies
create policy "Allow read access to all" on public.naraibase_lessons for select using (true);
create policy "Allow insert for anon" on public.naraibase_responses for insert with check (true);
create policy "Allow read access for owner" on public.naraibase_responses for select using (session_id = current_setting('request.jwt.claims', true)::jsonb->>'session_id');

-- Grant permissions to anon and authenticated
grant select on table public.naraibase_lessons to anon, authenticated;
grant insert on table public.naraibase_responses to anon, authenticated;

-- Function: submit_naraibase_response
create or replace function public.submit_naraibase_response(
  p_session_id text,
  p_gender text,
  p_lesson_slug text,
  p_is_useful boolean,
  p_is_recommended boolean,
  p_useful_reason text,
  p_recommended_reason text,
  p_source text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_new_id bigint;
begin
  -- Basic validation
  if p_session_id is null or p_session_id = '' then
    return jsonb_build_object('success', false, 'error', 'session_id is required');
  end if;
  if p_gender not in ('male', 'female') then
    return jsonb_build_object('success', false, 'error', 'Invalid gender');
  end if;
  if not exists (select 1 from public.naraibase_lessons where slug = p_lesson_slug) then
    return jsonb_build_object('success', false, 'error', 'Invalid lesson slug');
  end if;

  insert into public.naraibase_responses (
    session_id, gender, lesson_slug, is_useful, is_recommended,
    useful_reason, recommended_reason, source, moderation_status
  )
  values (
    p_session_id, p_gender, p_lesson_slug, p_is_useful, p_is_recommended,
    nullif(trim(p_useful_reason), ''), nullif(trim(p_recommended_reason), ''),
    coalesce(p_source, 'site'),
    case when p_source = 'internal_test' then 'approved' else 'pending' end -- Auto-approve internal tests, others pending
  )
  returning id into v_new_id;

  return jsonb_build_object('success', true, 'id', v_new_id);
end;
$$;

grant execute on function public.submit_naraibase_response(text, text, text, boolean, boolean, text, text, text) to anon, authenticated;

-- Function: get_naraibase_stats
create or replace function public.get_naraibase_stats(p_lesson_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total_approved bigint;
  v_useful_yes bigint;
  v_useful_no bigint;
  v_recommended_yes bigint;
  v_recommended_no bigint;
  v_male_total bigint;
  v_male_useful_yes bigint;
  v_male_recommended_yes bigint;
  v_female_total bigint;
  v_female_useful_yes bigint;
  v_female_recommended_yes bigint;
  v_research_panel bigint;
  v_site bigint;
begin
  -- Get counts excluding internal_test
  select count(*) into v_total_approved from public.naraibase_responses
    where lesson_slug = p_lesson_slug and moderation_status = 'approved' and source != 'internal_test';

  select count(*) filter (where is_useful = true),
         count(*) filter (where is_useful = false),
         count(*) filter (where is_recommended = true),
         count(*) filter (where is_recommended = false),
         count(*) filter (where gender = 'male'),
         count(*) filter (where gender = 'male' and is_useful = true),
         count(*) filter (where gender = 'male' and is_recommended = true),
         count(*) filter (where gender = 'female'),
         count(*) filter (where gender = 'female' and is_useful = true),
         count(*) filter (where gender = 'female' and is_recommended = true),
         count(*) filter (where source = 'research_panel'),
         count(*) filter (where source in ('site', 'campaign'))
  into
    v_useful_yes, v_useful_no,
    v_recommended_yes, v_recommended_no,
    v_male_total, v_male_useful_yes, v_male_recommended_yes,
    v_female_total, v_female_useful_yes, v_female_recommended_yes,
    v_research_panel, v_site
  from public.naraibase_responses
  where lesson_slug = p_lesson_slug and moderation_status = 'approved' and source != 'internal_test';

  return jsonb_build_object(
    'total_approved', v_total_approved,
    'useful_yes', v_useful_yes,
    'useful_no', v_useful_no,
    'recommended_yes', v_recommended_yes,
    'recommended_no', v_recommended_no,
    'male_total', v_male_total,
    'male_useful_yes', v_male_useful_yes,
    'male_recommended_yes', v_male_recommended_yes,
    'female_total', v_female_total,
    'female_useful_yes', v_female_useful_yes,
    'female_recommended_yes', v_female_recommended_yes,
    'research_panel', v_research_panel,
    'site', v_site
  );
end;
$$;

grant execute on function public.get_naraibase_stats(text) to anon, authenticated;

-- Function: get_naraibase_reasons
create or replace function public.get_naraibase_reasons(
  p_lesson_slug text,
  p_client_session_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_has_answered boolean;
  v_reasons jsonb;
begin
  -- Check if client session has submitted ANY response (even pending/rejected/approved, research panel or site)
  v_has_answered := exists(
    select 1 from public.naraibase_responses
    where session_id = p_client_session_id and source != 'internal_test'
  );

  if v_has_answered then
    -- Return full approved reasons
    select coalesce(jsonb_agg(r), '[]'::jsonb) into v_reasons
    from (
      select
        gender,
        useful_reason,
        recommended_reason,
        created_at
      from public.naraibase_responses
      where lesson_slug = p_lesson_slug
        and moderation_status = 'approved'
        and source != 'internal_test'
        and (useful_reason is not null or recommended_reason is not null)
      order by created_at desc
    ) r;
  else
    -- Return first 2 reasons masked or empty
    select coalesce(jsonb_agg(r), '[]'::jsonb) into v_reasons
    from (
      select
        gender,
        substring(useful_reason from 1 for 6) || '... (回答して理由を見る)' as useful_reason,
        substring(recommended_reason from 1 for 6) || '... (回答して理由を見る)' as recommended_reason,
        created_at
      from public.naraibase_responses
      where lesson_slug = p_lesson_slug
        and moderation_status = 'approved'
        and source != 'internal_test'
        and (useful_reason is not null or recommended_reason is not null)
      order by created_at desc
      limit 2
    ) r;
  end if;

  return jsonb_build_object(
    'has_answered', v_has_answered,
    'reasons', v_reasons
  );
end;
$$;

grant execute on function public.get_naraibase_reasons(text, text) to anon, authenticated;

commit;
