begin;

create table public.cdc_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  storage jsonb not null,
  updated_at timestamptz not null default now(),
  constraint cdc_user_settings_storage_object
    check (jsonb_typeof(storage) = 'object'),
  constraint cdc_user_settings_storage_size
    check (octet_length(storage::text) <= 1048576)
);

create trigger cdc_user_settings_set_updated_at
before update on public.cdc_user_settings
for each row execute function private.set_updated_at();

alter table public.cdc_user_settings enable row level security;

create policy "Users read their CDC settings"
on public.cdc_user_settings for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert their CDC settings"
on public.cdc_user_settings for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users update their CDC settings"
on public.cdc_user_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on table public.cdc_user_settings from public, anon, authenticated;
grant select, insert, update on table public.cdc_user_settings to authenticated;

commit;
