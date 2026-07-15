begin;

create table public.checklist_templates (
  checklist_key text primary key,
  title text not null,
  status text not null default 'draft',
  active_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_templates_key_format
    check (checklist_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint checklist_templates_status
    check (status in ('draft', 'published')),
  constraint checklist_templates_active_version
    check (active_version > 0)
);

create table public.checklist_template_versions (
  checklist_key text not null references public.checklist_templates(checklist_key) on delete cascade,
  version integer not null,
  content_hash text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (checklist_key, version),
  constraint checklist_template_versions_version check (version > 0)
);

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null,
  template_version integer not null,
  item_key text not null,
  label text not null,
  group_key text not null,
  group_label text not null,
  default_phase text,
  display_order integer not null,
  created_at timestamptz not null default now(),
  unique (checklist_key, template_version, item_key),
  foreign key (checklist_key, template_version)
    references public.checklist_template_versions(checklist_key, version)
    on delete cascade,
  constraint checklist_template_items_item_key
    check (item_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint checklist_template_items_group_key
    check (group_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint checklist_template_items_label_length
    check (char_length(btrim(label)) between 1 and 160),
  constraint checklist_template_items_group_label_length
    check (char_length(btrim(group_label)) between 1 and 80),
  constraint checklist_template_items_phase
    check (default_phase is null or default_phase in ('have', 'prepare', 'pack_day')),
  constraint checklist_template_items_order check (display_order >= 0)
);

create table public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_run_id uuid not null,
  checklist_key text not null,
  template_version integer not null,
  status text not null default 'in_progress',
  started_at timestamptz not null,
  prepared_at timestamptz,
  review_started_at timestamptz,
  completed_at timestamptz,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_run_id),
  foreign key (checklist_key, template_version)
    references public.checklist_template_versions(checklist_key, version),
  constraint checklist_runs_status
    check (status in ('in_progress', 'prepared', 'review_pending', 'completed'))
);

create table public.checklist_run_items (
  id uuid primary key,
  run_id uuid not null references public.checklist_runs(id) on delete cascade,
  item_key text not null,
  group_key text not null,
  group_label text not null,
  label text not null,
  origin text not null,
  phase text not null,
  display_order integer not null,
  is_checked boolean not null default false,
  checked_at timestamptz,
  is_hidden boolean not null default false,
  personal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, run_id),
  constraint checklist_run_items_origin check (origin in ('template', 'custom')),
  constraint checklist_run_items_phase check (phase in ('have', 'prepare', 'pack_day')),
  constraint checklist_run_items_label_length
    check (char_length(btrim(label)) between 1 and 160),
  constraint checklist_run_items_group_label_length
    check (char_length(btrim(group_label)) between 1 and 80),
  constraint checklist_run_items_note_length
    check (personal_note is null or char_length(personal_note) <= 300),
  constraint checklist_run_items_order check (display_order >= 0)
);

create table public.checklist_item_feedback (
  run_item_id uuid primary key,
  run_id uuid not null,
  outcome text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_item_id, run_id)
    references public.checklist_run_items(id, run_id)
    on delete cascade,
  constraint checklist_item_feedback_outcome
    check (outcome in ('used', 'unused', 'missed', 'remove_next'))
);

create index checklist_runs_user_updated_idx
  on public.checklist_runs(user_id, updated_at desc);
create index checklist_runs_checklist_key_idx
  on public.checklist_runs(checklist_key);
create index checklist_run_items_run_order_idx
  on public.checklist_run_items(run_id, display_order);
create index checklist_item_feedback_run_idx
  on public.checklist_item_feedback(run_id);

create trigger checklist_templates_set_updated_at
before update on public.checklist_templates
for each row execute function private.set_updated_at();

create trigger checklist_runs_set_updated_at
before update on public.checklist_runs
for each row execute function private.set_updated_at();

create trigger checklist_run_items_set_updated_at
before update on public.checklist_run_items
for each row execute function private.set_updated_at();

create trigger checklist_item_feedback_set_updated_at
before update on public.checklist_item_feedback
for each row execute function private.set_updated_at();

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_versions enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.checklist_runs enable row level security;
alter table public.checklist_run_items enable row level security;
alter table public.checklist_item_feedback enable row level security;

create policy "Published checklist templates are readable"
on public.checklist_templates for select
to anon, authenticated
using (status = 'published');

create policy "Published checklist versions are readable"
on public.checklist_template_versions for select
to anon, authenticated
using (
  exists (
    select 1
    from public.checklist_templates template
    where template.checklist_key = checklist_template_versions.checklist_key
      and template.status = 'published'
  )
);

create policy "Published checklist items are readable"
on public.checklist_template_items for select
to anon, authenticated
using (
  exists (
    select 1
    from public.checklist_templates template
    where template.checklist_key = checklist_template_items.checklist_key
      and template.status = 'published'
  )
);

create policy "Users read their checklist runs"
on public.checklist_runs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert their checklist runs"
on public.checklist_runs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users update their checklist runs"
on public.checklist_runs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users delete their checklist runs"
on public.checklist_runs for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users read their checklist items"
on public.checklist_run_items for select
to authenticated
using (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_run_items.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users insert their checklist items"
on public.checklist_run_items for insert
to authenticated
with check (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_run_items.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users update their checklist items"
on public.checklist_run_items for update
to authenticated
using (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_run_items.run_id
      and run.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_run_items.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users delete their checklist items"
on public.checklist_run_items for delete
to authenticated
using (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_run_items.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users read their checklist feedback"
on public.checklist_item_feedback for select
to authenticated
using (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_item_feedback.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users insert their checklist feedback"
on public.checklist_item_feedback for insert
to authenticated
with check (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_item_feedback.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users update their checklist feedback"
on public.checklist_item_feedback for update
to authenticated
using (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_item_feedback.run_id
      and run.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_item_feedback.run_id
      and run.user_id = auth.uid()
  )
);

create policy "Users delete their checklist feedback"
on public.checklist_item_feedback for delete
to authenticated
using (
  exists (
    select 1 from public.checklist_runs run
    where run.id = checklist_item_feedback.run_id
      and run.user_id = auth.uid()
  )
);

grant select on public.checklist_templates to anon, authenticated;
grant select on public.checklist_template_versions to anon, authenticated;
grant select on public.checklist_template_items to anon, authenticated;
grant select, insert, update, delete on public.checklist_runs to authenticated;
grant select, insert, update, delete on public.checklist_run_items to authenticated;
grant select, insert, update, delete on public.checklist_item_feedback to authenticated;

insert into public.checklist_templates (checklist_key, title, status, active_version)
values
  ('night-memo', '夜泣き対応メモ', 'published', 1),
  ('family-log', '夫婦共有ログ', 'published', 1);

insert into public.checklist_template_versions (checklist_key, version, content_hash, published_at)
values
  ('night-memo', 1, 'night-memo-v1', now()),
  ('family-log', 1, 'family-log-v1', now());

insert into public.checklist_template_items
  (checklist_key, template_version, item_key, label, group_key, group_label, default_phase, display_order)
values
  ('night-memo', 1, 'choose-device', '記録に使うスマートフォンを決める', 'setup', '事前準備', 'prepare', 0),
  ('night-memo', 1, 'add-shortcut', '記録画面をホーム画面へ追加する', 'setup', '事前準備', 'prepare', 1),
  ('night-memo', 1, 'share-method', 'パートナーと記録の共有方法を確認する', 'setup', '事前準備', 'prepare', 2),
  ('night-memo', 1, 'milk-time', 'ミルクや授乳の時刻を記録できるようにする', 'recording', '記録する内容', 'have', 3),
  ('night-memo', 1, 'diaper-time', 'おむつ替えの時刻を記録できるようにする', 'recording', '記録する内容', 'have', 4),
  ('night-memo', 1, 'sleep-time', '寝かしつけと再入眠の時刻を記録できるようにする', 'recording', '記録する内容', 'have', 5),
  ('family-log', 1, 'choose-app', '共有に使うメモアプリを決める', 'setup', '共有の準備', 'prepare', 0),
  ('family-log', 1, 'invite-partner', 'パートナーを共有先へ招待する', 'setup', '共有の準備', 'prepare', 1),
  ('family-log', 1, 'check-permission', 'お互いに閲覧・編集できることを確認する', 'setup', '共有の準備', 'prepare', 2),
  ('family-log', 1, 'decide-sections', '連絡・買い物・対応中の項目を分ける', 'rules', '運用ルール', 'have', 3),
  ('family-log', 1, 'decide-check-time', '毎日確認する時間を決める', 'rules', '運用ルール', 'have', 4),
  ('family-log', 1, 'write-first-entry', '最初の共有事項を1件入力する', 'rules', '運用ルール', 'have', 5);

commit;
