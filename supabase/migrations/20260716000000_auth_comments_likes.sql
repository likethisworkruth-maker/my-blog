begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

alter table public.comments
  add column if not exists user_id uuid null
  references auth.users(id)
  on delete set null;

create index if not exists comments_user_id_idx
  on public.comments(user_id);

create index if not exists comments_slug_status_created_at_idx
  on public.comments(slug, status, created_at desc);

alter table public.comments enable row level security;
alter table public.likes enable row level security;

create table if not exists public.like_records (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  user_id uuid null references auth.users(id) on delete cascade,
  anonymous_token_hash text null,
  created_at timestamp with time zone not null default now(),
  constraint like_records_identity_check
    check (num_nonnulls(user_id, anonymous_token_hash) = 1),
  constraint like_records_slug_format
    check (
      char_length(slug) between 1 and 200
      and slug ~ '^[a-zA-Z0-9/_-]+$'
    ),
  constraint like_records_anonymous_hash_check
    check (
      anonymous_token_hash is null
      or anonymous_token_hash ~ '^[a-f0-9]{64}$'
    )
);

alter table public.like_records enable row level security;

create unique index if not exists like_records_user_unique
  on public.like_records(slug, user_id)
  where user_id is not null;

create unique index if not exists like_records_anonymous_unique
  on public.like_records(slug, anonymous_token_hash)
  where anonymous_token_hash is not null;

create index if not exists like_records_slug_idx
  on public.like_records(slug);

create index if not exists like_records_user_id_idx
  on public.like_records(user_id)
  where user_id is not null;

drop policy if exists "Anyone can submit pending comments" on public.comments;
drop policy if exists "Approved comments are readable by everyone" on public.comments;

revoke all on table public.comments from anon, authenticated;
revoke all on table public.like_records from anon, authenticated;
revoke all on table public.likes from anon, authenticated;

grant select, insert, update, delete on table public.comments to service_role;
grant select, insert, update, delete on table public.like_records to service_role;
grant select, insert, update, delete on table public.likes to service_role;
grant select on table public.likes to anon, authenticated;

drop trigger if exists comments_before_insert on public.comments;
drop function if exists public.normalize_comment_before_insert();

create or replace function private.apply_like_record_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.likes (slug, like_count, updated_at)
    values (new.slug, 1, now())
    on conflict (slug)
    do update set
      like_count = public.likes.like_count + 1,
      updated_at = now();
    return new;
  end if;

  update public.likes
  set
    like_count = greatest(like_count - 1, 0),
    updated_at = now()
  where slug = old.slug;
  return old;
end;
$$;

revoke execute on function private.apply_like_record_count() from public, anon, authenticated;

drop trigger if exists like_records_after_insert on public.like_records;
create trigger like_records_after_insert
after insert on public.like_records
for each row execute function private.apply_like_record_count();

drop trigger if exists like_records_after_delete on public.like_records;
create trigger like_records_after_delete
after delete on public.like_records
for each row execute function private.apply_like_record_count();

create or replace function public.submit_comment(
  p_slug text,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_author_name constant text := '匿名さん';
  v_content text := btrim(p_content);
  v_status text := case when v_user_id is null then 'pending' else 'approved' end;
  v_comment public.comments%rowtype;
begin
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;
  if v_content is null or char_length(v_content) not between 1 and 1000 then
    raise exception 'invalid comment content';
  end if;

  insert into public.comments (slug, author_name, content, status, user_id, created_at)
  values (p_slug, v_author_name, v_content, v_status, v_user_id, now())
  returning * into v_comment;

  return jsonb_build_object(
    'id', v_comment.id,
    'slug', v_comment.slug,
    'author_name', v_comment.author_name,
    'content', v_comment.content,
    'status', v_comment.status,
    'created_at', v_comment.created_at,
    'is_mine', v_user_id is not null
  );
end;
$$;

create or replace function public.get_approved_comments(
  p_slug text,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;

  with page as (
    select
      c.id,
      c.slug,
      '匿名さん'::text as author_name,
      c.content,
      c.created_at,
      (v_user_id is not null and c.user_id = v_user_id) as is_mine
    from public.comments as c
    where c.slug = p_slug
      and c.status = 'approved'
    order by c.created_at desc
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'comments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'slug', p.slug,
            'author_name', p.author_name,
            'content', p.content,
            'created_at', p.created_at,
            'is_mine', p.is_mine
          ) order by p.created_at desc
        )
        from page as p
      ),
      '[]'::jsonb
    ),
    'total_count', (
      select count(*)
      from public.comments as c
      where c.slug = p_slug
        and c.status = 'approved'
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.delete_my_comment(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_id uuid;
begin
  if v_user_id is null then
    return false;
  end if;

  delete from public.comments
  where id = p_comment_id
    and user_id = v_user_id
  returning id into v_deleted_id;

  return v_deleted_id is not null;
end;
$$;

create or replace function public.set_authenticated_like(
  p_slug text,
  p_liked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_liked boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;

  if coalesce(p_liked, false) then
    insert into public.like_records (slug, user_id)
    values (p_slug, v_user_id)
    on conflict (slug, user_id) where user_id is not null do nothing;
  else
    delete from public.like_records
    where slug = p_slug
      and user_id = v_user_id;
  end if;

  select exists(
    select 1 from public.like_records
    where slug = p_slug and user_id = v_user_id
  ) into v_liked;
  select coalesce((select like_count from public.likes where slug = p_slug), 0)
  into v_count;

  return jsonb_build_object('slug', p_slug, 'like_count', v_count, 'liked', v_liked);
end;
$$;

create or replace function public.get_authenticated_like_state(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_liked boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;

  select exists(
    select 1 from public.like_records
    where slug = p_slug and user_id = v_user_id
  ) into v_liked;
  select coalesce((select like_count from public.likes where slug = p_slug), 0)
  into v_count;

  return jsonb_build_object('slug', p_slug, 'like_count', v_count, 'liked', v_liked);
end;
$$;

create or replace function public.get_authenticated_like_slugs(p_slugs text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_slugs), 0) > 200 then
    raise exception 'too many slugs';
  end if;

  select coalesce(jsonb_agg(r.slug order by r.slug), '[]'::jsonb)
  into v_result
  from public.like_records as r
  where r.user_id = v_user_id
    and r.slug = any(coalesce(p_slugs, array[]::text[]));

  return v_result;
end;
$$;

create or replace function public.add_anonymous_like(
  p_slug text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_count integer;
begin
  if auth.uid() is not null then
    raise exception 'anonymous request required' using errcode = '42501';
  end if;
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;
  if p_token is null
    or char_length(p_token) not between 32 and 200
    or p_token !~ '^[a-zA-Z0-9_-]+$'
  then
    raise exception 'invalid anonymous token';
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  insert into public.like_records (slug, anonymous_token_hash)
  values (p_slug, v_token_hash)
  on conflict (slug, anonymous_token_hash)
    where anonymous_token_hash is not null
    do nothing;

  select coalesce((select like_count from public.likes where slug = p_slug), 0)
  into v_count;
  return jsonb_build_object('slug', p_slug, 'like_count', v_count, 'liked', true);
end;
$$;

create or replace function public.remove_anonymous_like(
  p_slug text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_count integer;
begin
  if auth.uid() is not null then
    raise exception 'anonymous request required' using errcode = '42501';
  end if;
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;
  if p_token is null
    or char_length(p_token) not between 32 and 200
    or p_token !~ '^[a-zA-Z0-9_-]+$'
  then
    raise exception 'invalid anonymous token';
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  delete from public.like_records
  where slug = p_slug
    and user_id is null
    and anonymous_token_hash = v_token_hash;

  select coalesce((select like_count from public.likes where slug = p_slug), 0)
  into v_count;
  return jsonb_build_object('slug', p_slug, 'like_count', v_count, 'liked', false);
end;
$$;

create or replace function public.claim_anonymous_like(
  p_slug text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token_hash text;
  v_anonymous_id uuid;
  v_count integer;
  v_liked boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_slug is null
    or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-zA-Z0-9/_-]+$'
  then
    raise exception 'invalid slug';
  end if;
  if p_token is null
    or char_length(p_token) not between 32 and 200
    or p_token !~ '^[a-zA-Z0-9_-]+$'
  then
    raise exception 'invalid anonymous token';
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select id into v_anonymous_id
  from public.like_records
  where slug = p_slug
    and user_id is null
    and anonymous_token_hash = v_token_hash
  for update;

  if v_anonymous_id is not null then
    if exists(
      select 1 from public.like_records
      where slug = p_slug and user_id = v_user_id
    ) then
      delete from public.like_records where id = v_anonymous_id;
    else
      begin
        update public.like_records
        set user_id = v_user_id, anonymous_token_hash = null
        where id = v_anonymous_id;
      exception when unique_violation then
        delete from public.like_records where id = v_anonymous_id;
      end;
    end if;
  end if;

  select exists(
    select 1 from public.like_records
    where slug = p_slug and user_id = v_user_id
  ) into v_liked;
  select coalesce((select like_count from public.likes where slug = p_slug), 0)
  into v_count;

  return jsonb_build_object('slug', p_slug, 'like_count', v_count, 'liked', v_liked);
end;
$$;

revoke execute on function public.submit_comment(text, text) from public, anon, authenticated;
revoke execute on function public.get_approved_comments(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.delete_my_comment(uuid) from public, anon, authenticated;
revoke execute on function public.set_authenticated_like(text, boolean) from public, anon, authenticated;
revoke execute on function public.get_authenticated_like_state(text) from public, anon, authenticated;
revoke execute on function public.get_authenticated_like_slugs(text[]) from public, anon, authenticated;
revoke execute on function public.add_anonymous_like(text, text) from public, anon, authenticated;
revoke execute on function public.remove_anonymous_like(text, text) from public, anon, authenticated;
revoke execute on function public.claim_anonymous_like(text, text) from public, anon, authenticated;

grant execute on function public.submit_comment(text, text) to anon, authenticated;
grant execute on function public.get_approved_comments(text, integer, integer) to anon, authenticated;
grant execute on function public.delete_my_comment(uuid) to authenticated;
grant execute on function public.set_authenticated_like(text, boolean) to authenticated;
grant execute on function public.get_authenticated_like_state(text) to authenticated;
grant execute on function public.get_authenticated_like_slugs(text[]) to authenticated;
grant execute on function public.add_anonymous_like(text, text) to anon;
grant execute on function public.remove_anonymous_like(text, text) to anon;
grant execute on function public.claim_anonymous_like(text, text) to authenticated;

revoke execute on function public.increment_likes(text) from public, anon, authenticated;
revoke execute on function public.decrement_likes(text) from public, anon, authenticated;

commit;
