export function cleanCredential(value: unknown, min = 32, max = 512) {
  if (typeof value !== 'string' || value.length < min || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('invalid_credential');
  }
  return value;
}

export function cleanUuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('invalid_id');
  }
  return value;
}

export function errorStatus(message: string) {
  if (message.includes('rate_limit')) return 429;
  if (message.includes('invalid') || message.includes('payload') || message.includes('method') || message.includes('spam')) return 400;
  if (message.includes('answer_not_open')) return 409;
  if (message.includes('duplicate')) return 409;
  if (message.includes('conflict')) return 409;
  if (message.includes('token') || message.includes('not_found')) return 404;
  return 500;
}

const publicErrorCodes = [
  'rate_limit_exceeded', 'invalid_submission_speed', 'invalid_turnstile',
  'invalid_credential', 'invalid_id', 'invalid_payload', 'invalid_has_action',
  'invalid_edit_token', 'invalid_rate_limit_key', 'spam_rejected',
  'answer_not_open', 'method_not_available', 'edit_conflict',
  'duplicate_response',
  'invalid_token_or_deleted', 'not_found_or_invalid_token',
] as const;

export function publicErrorCode(message: string) {
  return publicErrorCodes.find((code) => message.includes(code)) ?? 'unexpected_error';
}
