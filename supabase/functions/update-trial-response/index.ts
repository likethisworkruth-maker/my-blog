import { json, preflight } from '../_shared/cors.ts';
import { hmacHex, requiredSecret } from '../_shared/hmac.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { cleanCredential, cleanUuid, errorStatus, publicErrorCode } from '../_shared/validation.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight(request);
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  try {
    const body = await request.json(); const id = cleanUuid(body.id); const token = cleanCredential(body.token, 43);
    if (!Number.isInteger(body.version) || body.version < 1 || typeof body.payload !== 'object') throw new Error('invalid_payload');
    const tokenHmac = await hmacHex(requiredSecret('EDIT_TOKEN_HMAC_SECRET'), token);
    const result = await adminClient().rpc('update_trial_response_internal', {
      response_id_value: id, token_hmac: tokenHmac, expected_version: body.version, payload: body.payload,
    });
    if (result.error) throw new Error(result.error.message);
    return json(request, result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error';
    const code = publicErrorCode(message);
    return json(request, { error: code }, errorStatus(code));
  }
});
