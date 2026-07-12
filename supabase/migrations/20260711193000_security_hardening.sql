begin;

revoke all on table public.problems, public.methods, public.problem_methods from anon, authenticated;
grant select on table public.problems, public.methods, public.problem_methods to anon, authenticated;

revoke all on table public.responses, public.response_revisions, public.moderation_logs,
  public.campaigns, public.rate_limit_events from anon, authenticated;

revoke execute on function public.submit_trial_response_internal(jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.submit_trial_response_rate_limited_internal(jsonb, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_editable_response_internal(uuid, text) from public, anon, authenticated;
revoke execute on function public.update_trial_response_internal(uuid, text, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_trial_response_internal(uuid, text) from public, anon, authenticated;
revoke execute on function public.register_rate_limit_internal(text, text) from public, anon, authenticated;
revoke execute on function public.purge_deleted_trial_responses() from public, anon, authenticated;

grant execute on function public.submit_trial_response_internal(jsonb, text, text) to service_role;
grant execute on function public.submit_trial_response_rate_limited_internal(jsonb, text, text, text) to service_role;
grant execute on function public.get_editable_response_internal(uuid, text) to service_role;
grant execute on function public.update_trial_response_internal(uuid, text, integer, jsonb) to service_role;
grant execute on function public.delete_trial_response_internal(uuid, text) to service_role;
grant execute on function public.register_rate_limit_internal(text, text) to service_role;
grant execute on function public.purge_deleted_trial_responses() to service_role;

revoke execute on function public.get_problem_results(text), public.get_method_results(text) from public;
grant execute on function public.get_problem_results(text), public.get_method_results(text) to anon, authenticated;

commit;
