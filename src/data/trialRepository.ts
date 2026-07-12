import { initialProblem, trialMethods, type MethodType, type TrialMethod } from './trialCatalog';

export interface TrialProblem {
  id: string; slug: string; title: string; questionText: string; description: string;
}

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function iconFor(type: MethodType, name: string) {
  if (type === 'item') return 'toys_and_games';
  if (type === 'household_rule') return name.includes('紙') ? 'calendar_month' : 'lightbulb';
  return name.includes('LINE') ? 'chat' : 'event';
}

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Supabase catalog fetch failed: ${response.status}`);
  return response.json();
}

export async function loadInitialTrialCatalog(): Promise<{ problem: TrialProblem; methods: TrialMethod[]; source: 'supabase' | 'fallback' }> {
  if (!url || !key) return { problem: initialProblem, methods: trialMethods, source: 'fallback' };
  try {
    const problems = await rest<any[]>('problems?select=id,slug,title,question_text,description&status=eq.published&order=display_order.asc&limit=1');
    if (!problems[0]) throw new Error('No published problem');
    const p = problems[0];
    const links = await rest<any[]>(`problem_methods?select=display_order,methods(id,slug,method_type,name,description,official_url,pricing_model_note,purchase_price_note,status)&problem_id=eq.${encodeURIComponent(p.id)}&order=display_order.asc`);
    const methods = links.map(({ methods: method }) => method).filter((method) => method?.status === 'published').map((method): TrialMethod => ({
      id: method.id, slug: method.slug, methodType: method.method_type, name: method.name,
      description: method.description, officialUrl: method.official_url ?? undefined,
      pricingNote: method.pricing_model_note ?? method.purchase_price_note ?? undefined,
      icon: iconFor(method.method_type, method.name),
    }));
    if (!methods.length) throw new Error('No published methods');
    return { problem: { id: p.id, slug: p.slug, title: p.title, questionText: p.question_text, description: p.description }, methods, source: 'supabase' };
  } catch {
    console.warn('[trial catalog] Supabase未適用のため初期データを使用します。');
    return { problem: initialProblem, methods: trialMethods, source: 'fallback' };
  }
}
