create schema if not exists "private";

CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create type "public"."duplicate_status" as enum ('unchecked', 'unique', 'suspected', 'merged');

create type "public"."free_text_status" as enum ('none', 'pending', 'approved', 'rejected');

create type "public"."method_status" as enum ('draft', 'published', 'retired');

create type "public"."method_type" as enum ('household_rule', 'app', 'item');

create type "public"."moderation_status" as enum ('pending', 'auto_approved', 'approved', 'rejected', 'deleted');

create type "public"."problem_status" as enum ('draft', 'published', 'closed');

create type "public"."response_change_type" as enum ('update', 'delete', 'restore');

create type "public"."response_outcome" as enum ('easier', 'no_change', 'harder');

create type "public"."spam_status" as enum ('pending', 'passed', 'suspected', 'blocked');


  create table "public"."campaigns" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "problem_id" uuid not null,
    "channel" text not null,
    "label" text not null,
    "started_at" timestamp with time zone not null default now(),
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."campaigns" enable row level security;


  create table "public"."comments" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "author_name" text not null default '名無しさん'::text,
    "content" text not null,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."comments" enable row level security;


  create table "public"."likes" (
    "slug" text not null,
    "like_count" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."likes" enable row level security;


  create table "public"."methods" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "method_type" public.method_type not null,
    "name" text not null,
    "description" text not null default ''::text,
    "official_url" text,
    "platforms" text[],
    "pricing_model_note" text,
    "purchase_price_note" text,
    "verified_at" date,
    "status" public.method_status not null default 'draft'::public.method_status,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."methods" enable row level security;


  create table "public"."moderation_logs" (
    "id" uuid not null default gen_random_uuid(),
    "response_id" uuid not null,
    "from_status" public.moderation_status,
    "to_status" public.moderation_status not null,
    "reason_code" text not null,
    "note" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."moderation_logs" enable row level security;


  create table "public"."problem_methods" (
    "problem_id" uuid not null,
    "method_id" uuid not null,
    "display_order" integer not null default 0,
    "is_featured" boolean not null default false
      );


alter table "public"."problem_methods" enable row level security;


  create table "public"."problems" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "title" text not null,
    "question_text" text not null,
    "description" text not null default ''::text,
    "status" public.problem_status not null default 'draft'::public.problem_status,
    "display_order" integer not null default 0,
    "answer_opened_at" timestamp with time zone,
    "answer_closed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."problems" enable row level security;


  create table "public"."rate_limit_events" (
    "id" bigint generated always as identity not null,
    "rate_limit_hmac" text not null,
    "problem_id" uuid not null,
    "submitted_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null default (now() + '7 days'::interval)
      );


alter table "public"."rate_limit_events" enable row level security;


  create table "public"."response_revisions" (
    "id" uuid not null default gen_random_uuid(),
    "response_id" uuid not null,
    "changed_field_names" text[] not null,
    "change_type" public.response_change_type not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."response_revisions" enable row level security;


  create table "public"."responses" (
    "id" uuid not null default gen_random_uuid(),
    "problem_id" uuid not null,
    "has_action" boolean not null,
    "method_id" uuid,
    "method_type_raw" public.method_type,
    "method_name_raw" text,
    "outcome" public.response_outcome,
    "age_band" text,
    "continuation_status" text,
    "usage_period" text,
    "difficulty_text" text,
    "situation_text" text,
    "usage_text" text,
    "good_points_text" text,
    "fit_household_text" text,
    "next_step_text" text,
    "moderation_status" public.moderation_status not null default 'pending'::public.moderation_status,
    "free_text_status" public.free_text_status not null default 'none'::public.free_text_status,
    "spam_status" public.spam_status not null default 'pending'::public.spam_status,
    "duplicate_status" public.duplicate_status not null default 'unchecked'::public.duplicate_status,
    "session_hmac" text,
    "edit_token_hmac" text not null,
    "submitted_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone,
    "version" integer not null default 1,
    "campaign_id" uuid
      );


alter table "public"."responses" enable row level security;

CREATE UNIQUE INDEX campaigns_code_key ON public.campaigns USING btree (code);

CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id);

CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);

CREATE INDEX comments_slug_created_at_idx ON public.comments USING btree (slug, created_at DESC);

CREATE UNIQUE INDEX likes_pkey ON public.likes USING btree (slug);

CREATE UNIQUE INDEX methods_pkey ON public.methods USING btree (id);

CREATE UNIQUE INDEX methods_slug_key ON public.methods USING btree (slug);

CREATE UNIQUE INDEX moderation_logs_pkey ON public.moderation_logs USING btree (id);

CREATE UNIQUE INDEX problem_methods_pkey ON public.problem_methods USING btree (problem_id, method_id);

CREATE UNIQUE INDEX problems_pkey ON public.problems USING btree (id);

CREATE UNIQUE INDEX problems_slug_key ON public.problems USING btree (slug);

CREATE UNIQUE INDEX rate_limit_events_pkey ON public.rate_limit_events USING btree (id);

CREATE INDEX rate_limit_expiry_idx ON public.rate_limit_events USING btree (expires_at);

CREATE INDEX rate_limit_lookup_idx ON public.rate_limit_events USING btree (rate_limit_hmac, submitted_at);

CREATE UNIQUE INDEX response_revisions_pkey ON public.response_revisions USING btree (id);

CREATE UNIQUE INDEX responses_edit_token_hmac_key ON public.responses USING btree (edit_token_hmac);

CREATE INDEX responses_free_text_queue_idx ON public.responses USING btree (free_text_status, submitted_at);

CREATE INDEX responses_method_aggregate_idx ON public.responses USING btree (method_id, moderation_status, spam_status);

CREATE UNIQUE INDEX responses_pkey ON public.responses USING btree (id);

CREATE INDEX responses_problem_aggregate_idx ON public.responses USING btree (problem_id, moderation_status, spam_status);

CREATE INDEX responses_session_duplicate_idx ON public.responses USING btree (session_hmac, problem_id, submitted_at);

alter table "public"."campaigns" add constraint "campaigns_pkey" PRIMARY KEY using index "campaigns_pkey";

alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY using index "comments_pkey";

alter table "public"."likes" add constraint "likes_pkey" PRIMARY KEY using index "likes_pkey";

alter table "public"."methods" add constraint "methods_pkey" PRIMARY KEY using index "methods_pkey";

alter table "public"."moderation_logs" add constraint "moderation_logs_pkey" PRIMARY KEY using index "moderation_logs_pkey";

alter table "public"."problem_methods" add constraint "problem_methods_pkey" PRIMARY KEY using index "problem_methods_pkey";

alter table "public"."problems" add constraint "problems_pkey" PRIMARY KEY using index "problems_pkey";

alter table "public"."rate_limit_events" add constraint "rate_limit_events_pkey" PRIMARY KEY using index "rate_limit_events_pkey";

alter table "public"."response_revisions" add constraint "response_revisions_pkey" PRIMARY KEY using index "response_revisions_pkey";

alter table "public"."responses" add constraint "responses_pkey" PRIMARY KEY using index "responses_pkey";

alter table "public"."campaigns" add constraint "campaigns_channel_check" CHECK ((channel = ANY (ARRAY['threads'::text, 'instagram'::text, 'direct'::text, 'other'::text]))) not valid;

alter table "public"."campaigns" validate constraint "campaigns_channel_check";

alter table "public"."campaigns" add constraint "campaigns_code_check" CHECK ((code ~ '^[a-z0-9_]+$'::text)) not valid;

alter table "public"."campaigns" validate constraint "campaigns_code_check";

alter table "public"."campaigns" add constraint "campaigns_code_key" UNIQUE using index "campaigns_code_key";

alter table "public"."campaigns" add constraint "campaigns_label_check" CHECK (((char_length(label) >= 1) AND (char_length(label) <= 120))) not valid;

alter table "public"."campaigns" validate constraint "campaigns_label_check";

alter table "public"."campaigns" add constraint "campaigns_problem_id_fkey" FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE RESTRICT not valid;

alter table "public"."campaigns" validate constraint "campaigns_problem_id_fkey";

alter table "public"."comments" add constraint "comments_author_name_length" CHECK (((char_length(btrim(author_name)) >= 1) AND (char_length(btrim(author_name)) <= 30))) not valid;

alter table "public"."comments" validate constraint "comments_author_name_length";

alter table "public"."comments" add constraint "comments_content_length" CHECK (((char_length(btrim(content)) >= 1) AND (char_length(btrim(content)) <= 1000))) not valid;

alter table "public"."comments" validate constraint "comments_content_length";

alter table "public"."comments" add constraint "comments_slug_format" CHECK ((((char_length(slug) >= 1) AND (char_length(slug) <= 200)) AND (slug ~ '^[a-zA-Z0-9/_-]+$'::text))) not valid;

alter table "public"."comments" validate constraint "comments_slug_format";

alter table "public"."comments" add constraint "comments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'deleted'::text]))) not valid;

alter table "public"."comments" validate constraint "comments_status_check";

alter table "public"."likes" add constraint "likes_like_count_check" CHECK ((like_count >= 0)) not valid;

alter table "public"."likes" validate constraint "likes_like_count_check";

alter table "public"."likes" add constraint "likes_slug_format" CHECK ((((char_length(slug) >= 1) AND (char_length(slug) <= 200)) AND (slug ~ '^[a-zA-Z0-9/_-]+$'::text))) not valid;

alter table "public"."likes" validate constraint "likes_slug_format";

alter table "public"."methods" add constraint "methods_check" CHECK (((method_type = 'app'::public.method_type) OR (pricing_model_note IS NULL))) not valid;

alter table "public"."methods" validate constraint "methods_check";

alter table "public"."methods" add constraint "methods_check1" CHECK (((method_type = 'item'::public.method_type) OR (purchase_price_note IS NULL))) not valid;

alter table "public"."methods" validate constraint "methods_check1";

alter table "public"."methods" add constraint "methods_description_check" CHECK ((char_length(description) <= 1500)) not valid;

alter table "public"."methods" validate constraint "methods_description_check";

alter table "public"."methods" add constraint "methods_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))) not valid;

alter table "public"."methods" validate constraint "methods_name_check";

alter table "public"."methods" add constraint "methods_official_url_check" CHECK (((official_url IS NULL) OR (official_url ~ '^https://'::text))) not valid;

alter table "public"."methods" validate constraint "methods_official_url_check";

alter table "public"."methods" add constraint "methods_pricing_model_note_check" CHECK ((char_length(pricing_model_note) <= 300)) not valid;

alter table "public"."methods" validate constraint "methods_pricing_model_note_check";

alter table "public"."methods" add constraint "methods_purchase_price_note_check" CHECK ((char_length(purchase_price_note) <= 300)) not valid;

alter table "public"."methods" validate constraint "methods_purchase_price_note_check";

alter table "public"."methods" add constraint "methods_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)) not valid;

alter table "public"."methods" validate constraint "methods_slug_check";

alter table "public"."methods" add constraint "methods_slug_key" UNIQUE using index "methods_slug_key";

alter table "public"."moderation_logs" add constraint "moderation_logs_note_check" CHECK ((char_length(note) <= 300)) not valid;

alter table "public"."moderation_logs" validate constraint "moderation_logs_note_check";

alter table "public"."moderation_logs" add constraint "moderation_logs_reason_code_check" CHECK (((char_length(reason_code) >= 1) AND (char_length(reason_code) <= 50))) not valid;

alter table "public"."moderation_logs" validate constraint "moderation_logs_reason_code_check";

alter table "public"."moderation_logs" add constraint "moderation_logs_response_id_fkey" FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE not valid;

alter table "public"."moderation_logs" validate constraint "moderation_logs_response_id_fkey";

alter table "public"."problem_methods" add constraint "problem_methods_method_id_fkey" FOREIGN KEY (method_id) REFERENCES public.methods(id) ON DELETE RESTRICT not valid;

alter table "public"."problem_methods" validate constraint "problem_methods_method_id_fkey";

alter table "public"."problem_methods" add constraint "problem_methods_problem_id_fkey" FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE RESTRICT not valid;

alter table "public"."problem_methods" validate constraint "problem_methods_problem_id_fkey";

alter table "public"."problems" add constraint "problems_check" CHECK (((answer_closed_at IS NULL) OR (answer_opened_at IS NULL) OR (answer_closed_at > answer_opened_at))) not valid;

alter table "public"."problems" validate constraint "problems_check";

alter table "public"."problems" add constraint "problems_description_check" CHECK ((char_length(description) <= 1000)) not valid;

alter table "public"."problems" validate constraint "problems_description_check";

alter table "public"."problems" add constraint "problems_question_text_check" CHECK (((char_length(question_text) >= 1) AND (char_length(question_text) <= 200))) not valid;

alter table "public"."problems" validate constraint "problems_question_text_check";

alter table "public"."problems" add constraint "problems_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)) not valid;

alter table "public"."problems" validate constraint "problems_slug_check";

alter table "public"."problems" add constraint "problems_slug_key" UNIQUE using index "problems_slug_key";

alter table "public"."problems" add constraint "problems_title_check" CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120))) not valid;

alter table "public"."problems" validate constraint "problems_title_check";

alter table "public"."rate_limit_events" add constraint "rate_limit_events_problem_id_fkey" FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE not valid;

alter table "public"."rate_limit_events" validate constraint "rate_limit_events_problem_id_fkey";

alter table "public"."response_revisions" add constraint "response_revisions_response_id_fkey" FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE not valid;

alter table "public"."response_revisions" validate constraint "response_revisions_response_id_fkey";

alter table "public"."responses" add constraint "responses_age_band_check" CHECK (((age_band IS NULL) OR (age_band = ANY (ARRAY['pregnancy'::text, '0_5m'::text, '6_11m'::text, '1y'::text, '2y'::text, '3_5y'::text, '6y_plus'::text])))) not valid;

alter table "public"."responses" validate constraint "responses_age_band_check";

alter table "public"."responses" add constraint "responses_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL not valid;

alter table "public"."responses" validate constraint "responses_campaign_id_fkey";

alter table "public"."responses" add constraint "responses_check" CHECK ((((NOT has_action) AND (method_id IS NULL) AND (method_type_raw IS NULL) AND (method_name_raw IS NULL) AND (outcome IS NULL)) OR (has_action AND (outcome IS NOT NULL) AND (((method_id IS NOT NULL) AND (method_type_raw IS NULL) AND (method_name_raw IS NULL)) OR ((method_id IS NULL) AND (method_type_raw IS NOT NULL) AND (method_name_raw IS NOT NULL)))))) not valid;

alter table "public"."responses" validate constraint "responses_check";

alter table "public"."responses" add constraint "responses_check1" CHECK (((deleted_at IS NULL) = (moderation_status <> 'deleted'::public.moderation_status))) not valid;

alter table "public"."responses" validate constraint "responses_check1";

alter table "public"."responses" add constraint "responses_continuation_status_check" CHECK (((continuation_status IS NULL) OR (continuation_status = ANY (ARRAY['continuing'::text, 'stopped'::text, 'sometimes'::text, 'not_started'::text])))) not valid;

alter table "public"."responses" validate constraint "responses_continuation_status_check";

alter table "public"."responses" add constraint "responses_difficulty_text_check" CHECK (((difficulty_text IS NULL) OR (char_length(difficulty_text) <= 500))) not valid;

alter table "public"."responses" validate constraint "responses_difficulty_text_check";

alter table "public"."responses" add constraint "responses_edit_token_hmac_key" UNIQUE using index "responses_edit_token_hmac_key";

alter table "public"."responses" add constraint "responses_fit_household_text_check" CHECK (((fit_household_text IS NULL) OR (char_length(fit_household_text) <= 700))) not valid;

alter table "public"."responses" validate constraint "responses_fit_household_text_check";

alter table "public"."responses" add constraint "responses_good_points_text_check" CHECK (((good_points_text IS NULL) OR (char_length(good_points_text) <= 1000))) not valid;

alter table "public"."responses" validate constraint "responses_good_points_text_check";

alter table "public"."responses" add constraint "responses_method_id_fkey" FOREIGN KEY (method_id) REFERENCES public.methods(id) ON DELETE RESTRICT not valid;

alter table "public"."responses" validate constraint "responses_method_id_fkey";

alter table "public"."responses" add constraint "responses_method_name_raw_check" CHECK (((char_length(method_name_raw) >= 1) AND (char_length(method_name_raw) <= 80))) not valid;

alter table "public"."responses" validate constraint "responses_method_name_raw_check";

alter table "public"."responses" add constraint "responses_next_step_text_check" CHECK (((next_step_text IS NULL) OR (char_length(next_step_text) <= 700))) not valid;

alter table "public"."responses" validate constraint "responses_next_step_text_check";

alter table "public"."responses" add constraint "responses_problem_id_fkey" FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE RESTRICT not valid;

alter table "public"."responses" validate constraint "responses_problem_id_fkey";

alter table "public"."responses" add constraint "responses_situation_text_check" CHECK (((situation_text IS NULL) OR (char_length(situation_text) <= 1000))) not valid;

alter table "public"."responses" validate constraint "responses_situation_text_check";

alter table "public"."responses" add constraint "responses_usage_period_check" CHECK (((usage_period IS NULL) OR (char_length(usage_period) <= 80))) not valid;

alter table "public"."responses" validate constraint "responses_usage_period_check";

alter table "public"."responses" add constraint "responses_usage_text_check" CHECK (((usage_text IS NULL) OR (char_length(usage_text) <= 1000))) not valid;

alter table "public"."responses" validate constraint "responses_usage_text_check";

alter table "public"."responses" add constraint "responses_version_check" CHECK ((version > 0)) not valid;

alter table "public"."responses" validate constraint "responses_version_check";

set check_function_bodies = off;

create or replace view "private"."eligible_responses" as  SELECT id,
    problem_id,
    has_action,
    method_id,
    method_type_raw,
    method_name_raw,
    outcome,
    age_band,
    continuation_status,
    usage_period,
    difficulty_text,
    situation_text,
    usage_text,
    good_points_text,
    fit_household_text,
    next_step_text,
    moderation_status,
    free_text_status,
    spam_status,
    duplicate_status,
    session_hmac,
    edit_token_hmac,
    submitted_at,
    updated_at,
    deleted_at,
    version,
    campaign_id
   FROM public.responses r
  WHERE ((moderation_status = ANY (ARRAY['auto_approved'::public.moderation_status, 'approved'::public.moderation_status])) AND (spam_status = 'passed'::public.spam_status) AND (duplicate_status = ANY (ARRAY['unique'::public.duplicate_status, 'merged'::public.duplicate_status])) AND (deleted_at IS NULL));

CREATE OR REPLACE FUNCTION public.decrement_likes(slug_text text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    new_count integer;
BEGIN
    IF slug_text IS NULL OR char_length(slug_text) < 1 OR char_length(slug_text) > 200
       OR slug_text !~ '^[a-zA-Z0-9/_-]+$' THEN
        RAISE EXCEPTION 'invalid slug';
    END IF;
    UPDATE public.likes SET like_count = greatest(like_count - 1, 0), updated_at = now()
    WHERE slug = slug_text RETURNING like_count INTO new_count;
    RETURN coalesce(new_count, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_trial_response_internal(response_id_value uuid, token_hmac text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare changed_id uuid;
begin
  update public.responses set moderation_status = 'deleted', deleted_at = now(), version = version + 1
  where id = response_id_value and edit_token_hmac = token_hmac and deleted_at is null returning id into changed_id;
  if changed_id is null then return false; end if;
  insert into public.response_revisions(response_id, changed_field_names, change_type) values (changed_id, array['deleted_at'], 'delete');
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_editable_response_internal(response_id_value uuid, token_hmac text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
select jsonb_build_object(
  'id', r.id, 'problem_id', r.problem_id, 'has_action', r.has_action,
  'method_id', r.method_id, 'method_type_raw', r.method_type_raw, 'method_name_raw', r.method_name_raw,
  'outcome', r.outcome, 'age_band', r.age_band, 'continuation_status', r.continuation_status,
  'usage_period', r.usage_period, 'difficulty_text', r.difficulty_text,
  'situation_text', r.situation_text, 'usage_text', r.usage_text,
  'good_points_text', r.good_points_text, 'fit_household_text', r.fit_household_text,
  'next_step_text', r.next_step_text, 'version', r.version
)
from public.responses r where r.id = response_id_value and r.edit_token_hmac = token_hmac and r.deleted_at is null;
$function$
;

CREATE OR REPLACE FUNCTION public.get_method_results(method_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
with m as (select id, slug, name, method_type from public.methods where slug = method_slug and status = 'published'),
base as (select r.* from private.eligible_responses r where r.method_id = (select id from m)),
totals as (select count(*)::int total from base),
outcomes as (select outcome::text key, count(*)::int count from base where outcome is not null group by outcome having count(*) >= 5)
select case when exists(select 1 from m) then jsonb_build_object(
  'method', (select to_jsonb(m) from m), 'total', (select total from totals),
  'show_percentages', (select total >= 20 from totals),
  'outcomes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', count) order by key) from outcomes), '[]'::jsonb),
  'generated_at', now()
) else null end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_problem_results(problem_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
with p as (
  select id, slug, question_text from public.problems where slug = problem_slug and status in ('published', 'closed')
), base as (
  select r.*, coalesce(m.method_type, r.method_type_raw) resolved_type,
         coalesce(m.name, r.method_name_raw) resolved_name
  from private.eligible_responses r left join public.methods m on m.id = r.method_id
  where r.problem_id = (select id from p)
), totals as (
  select count(*)::int total, count(*) filter (where has_action)::int action_count,
         count(*) filter (where not has_action)::int no_action_count from base
), outcomes as (
  select outcome::text key, count(*)::int count from base where outcome is not null group by outcome having count(*) >= 5
), method_types as (
  select resolved_type::text key, count(*)::int count from base where resolved_type is not null group by resolved_type having count(*) >= 5
), methods as (
  select resolved_name name, ((array_agg(method_id))[1])::text method_id, count(*)::int count
  from base where resolved_name is not null group by resolved_name having count(*) >= 5 order by count(*) desc, resolved_name
)
select case when exists(select 1 from p) then jsonb_build_object(
  'problem', (select jsonb_build_object('slug', slug, 'question_text', question_text) from p),
  'total', (select total from totals),
  'show_percentages', (select total >= 20 from totals),
  'action', (select jsonb_strip_nulls(jsonb_build_object(
    'yes', case when action_count >= 5 then action_count end,
    'no', case when no_action_count >= 5 then no_action_count end
  )) from totals),
  'outcomes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', count) order by key) from outcomes), '[]'::jsonb),
  'method_types', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', count) order by key) from method_types), '[]'::jsonb),
  'methods', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'method_id', method_id, 'count', count)) from methods), '[]'::jsonb),
  'generated_at', now()
) else null end;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_likes(slug_text text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    new_count integer;
BEGIN
    IF slug_text IS NULL
       OR char_length(slug_text) < 1
       OR char_length(slug_text) > 200
       OR slug_text !~ '^[a-zA-Z0-9/_-]+$'
    THEN
        RAISE EXCEPTION 'invalid slug';
    END IF;

    INSERT INTO public.likes (slug, like_count, updated_at)
    VALUES (slug_text, 1, now())
    ON CONFLICT (slug)
    DO UPDATE SET
        like_count = public.likes.like_count + 1,
        updated_at = now()
    RETURNING like_count INTO new_count;

    RETURN new_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_comment_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.status := 'pending';
    NEW.created_at := now();
    NEW.author_name := COALESCE(NULLIF(btrim(NEW.author_name), ''), '名無しさん');
    NEW.content := btrim(NEW.content);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.purge_deleted_trial_responses()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare deleted_count integer;
begin
  delete from public.responses where deleted_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_rate_limit_internal(problem_slug text, rate_limit_hmac_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare target_id uuid; recent_count integer;
begin
  select id into target_id from public.problems where slug = problem_slug and status = 'published';
  if target_id is null then return false; end if;
  delete from public.rate_limit_events where expires_at <= now();
  select count(*) into recent_count from public.rate_limit_events
    where rate_limit_hmac = rate_limit_hmac_value and problem_id = target_id and submitted_at > now() - interval '10 minutes';
  if recent_count >= 5 then return false; end if;
  insert into public.rate_limit_events(rate_limit_hmac, problem_id) values (rate_limit_hmac_value, target_id);
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_trial_response_internal(payload jsonb, token_hmac text, session_hmac_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  target_problem public.problems%rowtype;
  target_method public.methods%rowtype;
  new_id uuid;
  has_action_value boolean;
  method_id_value uuid;
  method_type_value public.method_type;
  method_name_value text;
  outcome_value public.response_outcome;
  duplicate_value public.duplicate_status := 'unique';
begin
  if token_hmac is null or char_length(token_hmac) < 32 then raise exception 'invalid_edit_token'; end if;
  if not payload ? 'has_action' or jsonb_typeof(payload->'has_action') <> 'boolean' then raise exception 'invalid_has_action'; end if;
  if payload ? 'honeypot' and nullif(btrim(payload->>'honeypot'), '') is not null then raise exception 'spam_rejected'; end if;

  select * into target_problem from public.problems where slug = payload->>'problem_slug' for share;
  if not found or target_problem.status <> 'published'
    or (target_problem.answer_opened_at is not null and target_problem.answer_opened_at > now())
    or (target_problem.answer_closed_at is not null and target_problem.answer_closed_at <= now())
  then raise exception 'answer_not_open'; end if;

  has_action_value := (payload->>'has_action')::boolean;
  method_id_value := nullif(payload->>'method_id', '')::uuid;
  method_type_value := nullif(payload->>'method_type_raw', '')::public.method_type;
  method_name_value := nullif(btrim(payload->>'method_name_raw'), '');
  outcome_value := nullif(payload->>'outcome', '')::public.response_outcome;

  if has_action_value and method_id_value is not null then
    select m.* into target_method
    from public.methods m join public.problem_methods pm on pm.method_id = m.id
    where m.id = method_id_value and pm.problem_id = target_problem.id and m.status = 'published';
    if not found then raise exception 'method_not_available'; end if;
  end if;

  if session_hmac_value is not null and exists (
    select 1 from public.responses r where r.problem_id = target_problem.id
      and r.session_hmac = session_hmac_value and r.submitted_at > now() - interval '10 minutes'
      and r.deleted_at is null
      and (not has_action_value or coalesce(r.method_id::text, r.method_name_raw) = coalesce(method_id_value::text, method_name_value))
  ) then duplicate_value := 'suspected'; end if;

  insert into public.responses (
    problem_id, has_action, method_id, method_type_raw, method_name_raw, outcome,
    moderation_status, free_text_status, spam_status, duplicate_status,
    session_hmac, edit_token_hmac
  ) values (
    target_problem.id, has_action_value, method_id_value, method_type_value, method_name_value, outcome_value,
    (case when duplicate_value = 'unique' then 'auto_approved' else 'pending' end)::public.moderation_status,
    'none'::public.free_text_status, 'passed'::public.spam_status, duplicate_value, session_hmac_value, token_hmac
  ) returning id into new_id;

  return jsonb_build_object('id', new_id, 'status', case when duplicate_value = 'unique' then 'accepted' else 'needs_review' end);
exception when invalid_text_representation then
  raise exception 'invalid_payload';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_trial_response_rate_limited_internal(payload jsonb, token_hmac text, session_hmac_value text, rate_limit_hmac_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  target_problem_id uuid;
  recent_count integer;
  result jsonb;
begin
  if rate_limit_hmac_value is null or char_length(rate_limit_hmac_value) < 32 then raise exception 'invalid_rate_limit_key'; end if;
  select id into target_problem_id from public.problems where slug = payload->>'problem_slug' and status = 'published';
  if target_problem_id is null then raise exception 'answer_not_open'; end if;

  perform pg_advisory_xact_lock(hashtextextended(rate_limit_hmac_value || target_problem_id::text, 0));
  delete from public.rate_limit_events where expires_at <= now();
  select count(*) into recent_count from public.rate_limit_events
    where rate_limit_hmac = rate_limit_hmac_value
      and problem_id = target_problem_id
      and submitted_at > now() - interval '10 minutes';
  if recent_count >= 5 then raise exception 'rate_limit_exceeded'; end if;

  result := public.submit_trial_response_internal(payload, token_hmac, session_hmac_value);
  insert into public.rate_limit_events(rate_limit_hmac, problem_id)
  values (rate_limit_hmac_value, target_problem_id);
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_trial_response_internal(response_id_value uuid, token_hmac text, expected_version integer, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  current_response public.responses%rowtype;
  updated public.responses%rowtype;
  changed text[] := array[]::text[];
  has_free_text boolean;
begin
  select * into current_response from public.responses
  where id = response_id_value and edit_token_hmac = token_hmac and deleted_at is null
  for update;
  if not found then raise exception 'invalid_token_or_deleted'; end if;
  if current_response.version <> expected_version then raise exception 'edit_conflict'; end if;

  if payload ? 'age_band' and nullif(payload->>'age_band','') is distinct from current_response.age_band then changed := array_append(changed, 'age_band'); end if;
  if payload ? 'continuation_status' and nullif(payload->>'continuation_status','') is distinct from current_response.continuation_status then changed := array_append(changed, 'continuation_status'); end if;
  if payload ? 'usage_period' and nullif(btrim(payload->>'usage_period'),'') is distinct from current_response.usage_period then changed := array_append(changed, 'usage_period'); end if;
  if payload ? 'difficulty_text' and nullif(btrim(payload->>'difficulty_text'),'') is distinct from current_response.difficulty_text then changed := array_append(changed, 'difficulty_text'); end if;
  if payload ? 'situation_text' and nullif(btrim(payload->>'situation_text'),'') is distinct from current_response.situation_text then changed := array_append(changed, 'situation_text'); end if;
  if payload ? 'usage_text' and nullif(btrim(payload->>'usage_text'),'') is distinct from current_response.usage_text then changed := array_append(changed, 'usage_text'); end if;
  if payload ? 'good_points_text' and nullif(btrim(payload->>'good_points_text'),'') is distinct from current_response.good_points_text then changed := array_append(changed, 'good_points_text'); end if;
  if payload ? 'fit_household_text' and nullif(btrim(payload->>'fit_household_text'),'') is distinct from current_response.fit_household_text then changed := array_append(changed, 'fit_household_text'); end if;
  if payload ? 'next_step_text' and nullif(btrim(payload->>'next_step_text'),'') is distinct from current_response.next_step_text then changed := array_append(changed, 'next_step_text'); end if;

  if cardinality(changed) = 0 then
    return jsonb_build_object('id', current_response.id, 'version', current_response.version, 'status', 'unchanged');
  end if;
  has_free_text := changed && array['difficulty_text','situation_text','usage_text','good_points_text','fit_household_text','next_step_text'];

  update public.responses r set
    age_band = case when payload ? 'age_band' then nullif(payload->>'age_band','') else r.age_band end,
    continuation_status = case when payload ? 'continuation_status' then nullif(payload->>'continuation_status','') else r.continuation_status end,
    usage_period = case when payload ? 'usage_period' then nullif(btrim(payload->>'usage_period'),'') else r.usage_period end,
    difficulty_text = case when payload ? 'difficulty_text' then nullif(btrim(payload->>'difficulty_text'),'') else r.difficulty_text end,
    situation_text = case when payload ? 'situation_text' then nullif(btrim(payload->>'situation_text'),'') else r.situation_text end,
    usage_text = case when payload ? 'usage_text' then nullif(btrim(payload->>'usage_text'),'') else r.usage_text end,
    good_points_text = case when payload ? 'good_points_text' then nullif(btrim(payload->>'good_points_text'),'') else r.good_points_text end,
    fit_household_text = case when payload ? 'fit_household_text' then nullif(btrim(payload->>'fit_household_text'),'') else r.fit_household_text end,
    next_step_text = case when payload ? 'next_step_text' then nullif(btrim(payload->>'next_step_text'),'') else r.next_step_text end,
    free_text_status = case when has_free_text then 'pending' else r.free_text_status end,
    version = r.version + 1
  where r.id = current_response.id returning r.* into updated;

  if has_free_text and updated.difficulty_text is null and updated.situation_text is null
    and updated.usage_text is null and updated.good_points_text is null
    and updated.fit_household_text is null and updated.next_step_text is null
  then
    update public.responses set free_text_status = 'none' where id = updated.id returning * into updated;
  end if;

  insert into public.response_revisions(response_id, changed_field_names, change_type)
  values (updated.id, changed, 'update');
  return jsonb_build_object('id', updated.id, 'version', updated.version,
    'status', case when has_free_text and updated.free_text_status = 'pending' then 'free_text_needs_review' else 'saved' end);
end;
$function$
;

grant references on table "public"."campaigns" to "service_role";

grant trigger on table "public"."campaigns" to "service_role";

grant truncate on table "public"."campaigns" to "service_role";

grant insert on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant references on table "public"."comments" to "service_role";

grant trigger on table "public"."comments" to "service_role";

grant truncate on table "public"."comments" to "service_role";

grant select on table "public"."likes" to "anon";

grant select on table "public"."likes" to "authenticated";

grant references on table "public"."likes" to "service_role";

grant trigger on table "public"."likes" to "service_role";

grant truncate on table "public"."likes" to "service_role";

grant references on table "public"."methods" to "anon";

grant select on table "public"."methods" to "anon";

grant trigger on table "public"."methods" to "anon";

grant truncate on table "public"."methods" to "anon";

grant references on table "public"."methods" to "authenticated";

grant select on table "public"."methods" to "authenticated";

grant trigger on table "public"."methods" to "authenticated";

grant truncate on table "public"."methods" to "authenticated";

grant references on table "public"."methods" to "service_role";

grant trigger on table "public"."methods" to "service_role";

grant truncate on table "public"."methods" to "service_role";

grant references on table "public"."moderation_logs" to "service_role";

grant trigger on table "public"."moderation_logs" to "service_role";

grant truncate on table "public"."moderation_logs" to "service_role";

grant references on table "public"."problem_methods" to "anon";

grant select on table "public"."problem_methods" to "anon";

grant trigger on table "public"."problem_methods" to "anon";

grant truncate on table "public"."problem_methods" to "anon";

grant references on table "public"."problem_methods" to "authenticated";

grant select on table "public"."problem_methods" to "authenticated";

grant trigger on table "public"."problem_methods" to "authenticated";

grant truncate on table "public"."problem_methods" to "authenticated";

grant references on table "public"."problem_methods" to "service_role";

grant trigger on table "public"."problem_methods" to "service_role";

grant truncate on table "public"."problem_methods" to "service_role";

grant references on table "public"."problems" to "anon";

grant select on table "public"."problems" to "anon";

grant trigger on table "public"."problems" to "anon";

grant truncate on table "public"."problems" to "anon";

grant references on table "public"."problems" to "authenticated";

grant select on table "public"."problems" to "authenticated";

grant trigger on table "public"."problems" to "authenticated";

grant truncate on table "public"."problems" to "authenticated";

grant references on table "public"."problems" to "service_role";

grant trigger on table "public"."problems" to "service_role";

grant truncate on table "public"."problems" to "service_role";

grant references on table "public"."rate_limit_events" to "service_role";

grant trigger on table "public"."rate_limit_events" to "service_role";

grant truncate on table "public"."rate_limit_events" to "service_role";

grant references on table "public"."response_revisions" to "service_role";

grant trigger on table "public"."response_revisions" to "service_role";

grant truncate on table "public"."response_revisions" to "service_role";

grant references on table "public"."responses" to "service_role";

grant trigger on table "public"."responses" to "service_role";

grant truncate on table "public"."responses" to "service_role";


  create policy "Anyone can submit pending comments"
  on "public"."comments"
  as permissive
  for insert
  to anon, authenticated
with check ((status = 'pending'::text));



  create policy "Approved comments are readable by everyone"
  on "public"."comments"
  as permissive
  for select
  to anon, authenticated
using ((status = 'approved'::text));



  create policy "Likes are readable by everyone"
  on "public"."likes"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "methods_public_read"
  on "public"."methods"
  as permissive
  for select
  to anon, authenticated
using ((status = 'published'::public.method_status));



  create policy "problem_methods_public_read"
  on "public"."problem_methods"
  as permissive
  for select
  to anon, authenticated
using (((EXISTS ( SELECT 1
   FROM public.problems p
  WHERE ((p.id = problem_methods.problem_id) AND (p.status = ANY (ARRAY['published'::public.problem_status, 'closed'::public.problem_status]))))) AND (EXISTS ( SELECT 1
   FROM public.methods m
  WHERE ((m.id = problem_methods.method_id) AND (m.status = 'published'::public.method_status))))));



  create policy "problems_public_read"
  on "public"."problems"
  as permissive
  for select
  to anon, authenticated
using ((status = ANY (ARRAY['published'::public.problem_status, 'closed'::public.problem_status])));


CREATE TRIGGER comments_before_insert BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.normalize_comment_before_insert();

CREATE TRIGGER methods_set_updated_at BEFORE UPDATE ON public.methods FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER problems_set_updated_at BEFORE UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER responses_set_updated_at BEFORE UPDATE ON public.responses FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

create schema if not exists "private";

set check_function_bodies = off;

create or replace view "private"."eligible_responses" as  SELECT id,
    problem_id,
    has_action,
    method_id,
    method_type_raw,
    method_name_raw,
    outcome,
    age_band,
    continuation_status,
    usage_period,
    difficulty_text,
    situation_text,
    usage_text,
    good_points_text,
    fit_household_text,
    next_step_text,
    moderation_status,
    free_text_status,
    spam_status,
    duplicate_status,
    session_hmac,
    edit_token_hmac,
    submitted_at,
    updated_at,
    deleted_at,
    version,
    campaign_id
   FROM public.responses r
  WHERE ((moderation_status = ANY (ARRAY['auto_approved'::public.moderation_status, 'approved'::public.moderation_status])) AND (spam_status = 'passed'::public.spam_status) AND (duplicate_status = ANY (ARRAY['unique'::public.duplicate_status, 'merged'::public.duplicate_status])) AND (deleted_at IS NULL));


create or replace view "private"."moderation_queue" as  SELECT r.id,
    p.slug AS problem_slug,
    r.submitted_at,
    r.free_text_status,
    r.spam_status,
    r.duplicate_status,
    r.difficulty_text,
    r.situation_text,
    r.usage_text,
    r.good_points_text,
    r.fit_household_text,
    r.next_step_text
   FROM (public.responses r
     JOIN public.problems p ON ((p.id = r.problem_id)))
  WHERE ((r.deleted_at IS NULL) AND ((r.free_text_status = 'pending'::public.free_text_status) OR (r.moderation_status = 'pending'::public.moderation_status)));


CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
