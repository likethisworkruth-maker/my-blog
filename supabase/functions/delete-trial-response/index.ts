import { json, preflight } from '../_shared/cors.ts';
import { hmacHex, requiredSecret } from '../_shared/hmac.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { cleanCredential, cleanUuid, errorStatus, publicErrorCode } from '../_shared/validation.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight(request);
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  try {
    const body = await request.json(); const id = cleanUuid(body.id); const token = cleanCredential(body.token, 43);
    const tokenHmac = await hmacHex(requiredSecret('EDIT_TOKEN_HMAC_SECRET'), token);
    const result = await adminClient().rpc('delete_trial_response_internal', { response_id_value: id, token_hmac: tokenHmac });
    if (result.error || result.data !== true) throw new Error('not_found_or_invalid_token');
    return json(request, { deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error';
    const code = publicErrorCode(message);
    return json(request, { error: code }, errorStatus(code));
  }
});
