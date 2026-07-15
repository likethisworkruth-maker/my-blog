import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
	interface Window {
		__supabaseClient?: SupabaseClient;
	}
}

export function getSupabaseClient(): SupabaseClient | null {
	const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey || typeof window === 'undefined') return null;

	if (!window.__supabaseClient) {
		window.__supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
	}
	return window.__supabaseClient;
}
