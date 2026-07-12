declare global { interface Window { gtag?: (...args: unknown[]) => void } }

export function trackTrialEvent(name: string, params: { problem_slug?: string; campaign_source?: string; method_type?: string } = {}) {
  const safe = Object.fromEntries(Object.entries(params).filter(([, value]) => typeof value === 'string' && value.length <= 100));
  window.gtag?.('event', name, safe);
}
