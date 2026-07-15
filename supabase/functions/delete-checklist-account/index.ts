import { corsHeaders, json, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight(request);
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return json(request, { error: 'unauthorized' }, 401);
  }

  const token = authorization.slice('Bearer '.length);
  const supabase = adminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return json(request, { error: 'unauthorized' }, 401);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error('delete-checklist-account failed', deleteError);
    return json(request, { error: 'delete_failed' }, 500);
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
