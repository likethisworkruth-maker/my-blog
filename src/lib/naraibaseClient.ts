const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

type JsonRecord = Record<string, unknown>;

function configuration() {
  if (!supabaseUrl || !anonKey) {
    throw new Error('回答機能の接続設定がありません。時間をおいて再度お試しください。');
  }
  return { supabaseUrl, anonKey };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const { anonKey } = configuration();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as JsonRecord;
  if (!response.ok || data.success === false) {
    const code = String(data.error ?? data.message ?? 'request_failed');
    const messages: Record<string, string> = {
      duplicate_response: 'この習い事についてはすでに回答済みです。',
      rate_limit_exceeded: '短時間に多くの回答が送信されました。時間をおいて再度お試しください。',
      invalid_turnstile: '送信確認に失敗しました。もう一度お試しください。',
      invalid_payload: '入力内容を確認してください。',
      invalid_token_or_deleted: '編集URLが正しくないか、回答はすでに削除されています。',
      invalid_submission_speed: '送信確認に失敗しました。ページを再読み込みしてもう一度お試しください。',
      spam_rejected: 'URLやメールアドレスを含む自由記述は送信できません。',
    };
    throw new Error(messages[code] ?? '通信に失敗しました。時間をおいて再度お試しください。');
  }
  return data as T;
}

async function rpc<T>(name: string, body: unknown) {
  const { supabaseUrl } = configuration();
  return postJson<T>(`${supabaseUrl}/rest/v1/rpc/${name}`, body);
}

async function edge<T>(name: string, body: unknown) {
  const { supabaseUrl } = configuration();
  return postJson<T>(`${supabaseUrl}/functions/v1/${name}`, body);
}

export const naraibaseClient = {
  getStats: (lessonSlug: string) =>
    rpc<NaraibaseStats>('get_naraibase_stats', { p_lesson_slug: lessonSlug }),
  getReasons: (lessonSlug: string, sessionId: string) =>
    rpc<NaraibaseReasons>('get_naraibase_reasons', {
      p_lesson_slug: lessonSlug,
      p_client_session_id: sessionId,
    }),
  submit: (input: NaraibaseSubmission) =>
    edge<{ success: true; id: number }>('submit-naraibase-response', input),
  getEditable: (id: number, token: string) =>
    rpc<{ response: NaraibaseEditable }>('get_editable_naraibase_response', {
      p_response_id: id,
      p_edit_token: token,
    }),
  update: (id: number, token: string, input: NaraibaseEditable) =>
    rpc<{ success: true }>('update_naraibase_response', {
      p_response_id: id,
      p_edit_token: token,
      p_gender: input.gender,
      p_lesson_slug: input.lesson_slug,
      p_is_useful: input.is_useful,
      p_is_recommended: input.is_recommended,
      p_useful_reason: input.useful_reason,
      p_recommended_reason: input.recommended_reason,
    }),
  delete: (id: number, token: string) =>
    rpc<{ success: true }>('delete_naraibase_response', {
      p_response_id: id,
      p_edit_token: token,
    }),
};

export interface NaraibaseStats {
  total_approved: number;
  useful_yes: number;
  useful_no: number;
  recommended_yes: number;
  recommended_no: number;
  male_total: number;
  male_useful_yes: number;
  female_total: number;
  female_useful_yes: number;
  research_panel: number;
  site: number;
  campaign: number;
  last_updated_at: string | null;
}

export interface NaraibaseReason {
  gender: 'male' | 'female';
  useful_reason: string | null;
  recommended_reason: string | null;
  created_at: string;
}

export interface NaraibaseReasons {
  has_answered: boolean;
  reasons: NaraibaseReason[];
}

export interface NaraibaseEditable {
  gender: 'male' | 'female';
  lesson_slug: string;
  is_useful: boolean;
  is_recommended: boolean;
  useful_reason: string;
  recommended_reason: string;
}

export interface NaraibaseSubmission extends NaraibaseEditable {
  session_id: string;
  edit_token: string;
  started_at: number;
  turnstile_token: string | null;
}

export function randomCredential(bytesLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function getNaraibaseSessionId() {
  const key = 'naraibase-session-id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = randomCredential(24);
    localStorage.setItem(key, value);
  }
  return value;
}
