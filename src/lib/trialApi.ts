const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function configured() { return Boolean(supabaseUrl && anonKey); }

async function request(path: string, body: unknown, edge = false) {
  if (!configured()) throw new Error('この環境では回答機能がまだ接続されていません。');
  const base = edge ? `${supabaseUrl}/functions/v1` : `${supabaseUrl}/rest/v1/rpc`;
  const response = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey!, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? data.message ?? '通信に失敗しました。時間をおいて再度お試しください。');
  return data;
}

export const trialApi = {
  getProblemResults: (problemSlug: string) => request('get_problem_results', { problem_slug: problemSlug }),
  getMethodResults: (methodSlug: string) => request('get_method_results', { method_slug: methodSlug }),
  submit: (body: unknown) => request('submit-trial-response', body, true),
  getEditable: (id: string, token: string) => request('get-editable-response', { id, token }, true),
  update: (id: string, token: string, version: number, payload: unknown) => request('update-trial-response', { id, token, version, payload }, true),
  delete: (id: string, token: string) => request('delete-trial-response', { id, token }, true),
};

export function randomCredential(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function getSessionId() {
  const key = 'parenting-trial-session';
  let value = localStorage.getItem(key);
  if (!value) { value = randomCredential(24); localStorage.setItem(key, value); }
  return value;
}

export function campaignSource() {
  const query = new URLSearchParams(location.search).get('source');
  if (query && /^[a-z0-9_]{1,80}$/.test(query)) sessionStorage.setItem('campaign-source', query);
  return sessionStorage.getItem('campaign-source') ?? 'direct_vaccine_initial';
}
