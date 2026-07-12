begin;

-- Supabase installs pgcrypto in the extensions schema. This migration also
-- repairs local or preview databases that already applied the prior function definitions.
alter function public.submit_naraibase_response_internal(text, text, text, text, text, boolean, boolean, text, text)
  set search_path = public, extensions, pg_temp;
alter function public.get_editable_naraibase_response(bigint, text)
  set search_path = public, extensions, pg_temp;
alter function public.update_naraibase_response(bigint, text, text, text, boolean, boolean, text, text)
  set search_path = public, extensions, pg_temp;
alter function public.delete_naraibase_response(bigint, text)
  set search_path = public, extensions, pg_temp;

commit;
