import { json, preflight } from '../_shared/cors.ts';
import { hmacHex, requiredSecret } from '../_shared/hmac.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { cleanCredential, errorStatus, publicErrorCode } from '../_shared/validation.ts';

const lessonSlugs = new Set([
  'piano', 'swimming', 'soccer', 'baseball', 'calligraphy', 'abacus',
  'english', 'dance', 'ballet', 'gymnastics', 'martial_arts', 'cram_school', 'other',
]);

async function verifyTurnstile(token: unknown, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const result = await response.json();
  return result.success === true;
}

function cleanReason(value: unknown) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > 500) throw new Error('invalid_payload');
  const reason = value.trim();
  if (/https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(reason)) {
    throw new Error('spam_rejected');
  }
  return reason;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight(request);
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);

  try {
    const body = await request.json();
    const sessionId = cleanCredential(body.session_id, 20);
    const editToken = cleanCredential(body.edit_token, 32);
    if (
      typeof body.started_at !== 'number'
      || !Number.isFinite(body.started_at)
      || Date.now() - body.started_at < 800
    ) {
      throw new Error('invalid_submission_speed');
    }
    if (
      (body.gender !== 'male' && body.gender !== 'female')
      || !lessonSlugs.has(body.lesson_slug)
      || typeof body.is_useful !== 'boolean'
      || typeof body.is_recommended !== 'boolean'
    ) {
      throw new Error('invalid_payload');
    }

    const usefulReason = cleanReason(body.useful_reason);
    const recommendedReason = cleanReason(body.recommended_reason);
    const ip = request.headers.get('cf-connecting-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? '';
    if (!(await verifyTurnstile(body.turnstile_token, ip))) throw new Error('invalid_turnstile');

    const day = new Date().toISOString().slice(0, 10);
    const rateSubject = ip || `session:${sessionId}`;
    const rateLimitHash = await hmacHex(
      requiredSecret('RATE_LIMIT_HMAC_SECRET'),
      `naraibase|${rateSubject}|${day}`,
    );

    const result = await adminClient().rpc('submit_naraibase_response_internal', {
      p_session_id: sessionId,
      p_edit_token: editToken,
      p_rate_limit_hash: rateLimitHash,
      p_gender: body.gender,
      p_lesson_slug: body.lesson_slug,
      p_is_useful: body.is_useful,
      p_is_recommended: body.is_recommended,
      p_useful_reason: usefulReason,
      p_recommended_reason: recommendedReason,
    });
    if (result.error) throw new Error(result.error.message);
    return json(request, result.data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error';
    const code = publicErrorCode(message);
    return json(request, { error: code }, errorStatus(code));
  }
});
