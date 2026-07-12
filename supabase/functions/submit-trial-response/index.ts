import { json, preflight } from '../_shared/cors.ts';
import { hmacHex, requiredSecret } from '../_shared/hmac.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { cleanCredential, errorStatus, publicErrorCode } from '../_shared/validation.ts';

async function verifyTurnstile(token: unknown, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.set('secret', secret); form.set('response', token); if (ip) form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const result = await response.json();
  return result.success === true;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight(request);
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  try {
    const body = await request.json();
    const payload = body.payload ?? {};
    const rawToken = cleanCredential(body.edit_token, 43);
    const sessionId = cleanCredential(body.session_id, 20);
    if (typeof body.started_at !== 'number' || Date.now() - body.started_at < 800) throw new Error('invalid_submission_speed');
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    if (!(await verifyTurnstile(body.turnstile_token, ip))) throw new Error('invalid_turnstile');

    const admin = adminClient();
    const tokenHmac = await hmacHex(requiredSecret('EDIT_TOKEN_HMAC_SECRET'), rawToken);
    const sessionHmac = await hmacHex(requiredSecret('SESSION_HMAC_SECRET'), sessionId);
    const day = new Date().toISOString().slice(0, 10);
    const rateSubject = ip || `session:${sessionHmac}`;
    const rateHmac = await hmacHex(requiredSecret('RATE_LIMIT_HMAC_SECRET'), `${rateSubject}|${day}`);
    const result = await admin.rpc('submit_trial_response_rate_limited_internal', {
      payload, token_hmac: tokenHmac, session_hmac_value: sessionHmac, rate_limit_hmac_value: rateHmac,
    });
    if (result.error) throw new Error(result.error.message);

    if (typeof body.campaign_source === 'string' && body.campaign_source) {
      const campaign = await admin.from('campaigns').select('id,problem_id').eq('code', body.campaign_source).maybeSingle();
      if (campaign.data) await admin.from('responses').update({ campaign_id: campaign.data.id }).eq('id', result.data.id).eq('problem_id', campaign.data.problem_id);
    }
    return json(request, result.data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error';
    const code = publicErrorCode(message);
    return json(request, { error: code }, errorStatus(code));
  }
});
