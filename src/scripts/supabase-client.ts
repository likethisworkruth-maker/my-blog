import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

declare global {
	interface Window {
		__supabaseClient?: SupabaseClient;
	}
}

export interface CapturedGoogleProviderAccess {
	accessToken: string;
	accountEmail: string;
}

let capturedGoogleProviderAccess: CapturedGoogleProviderAccess | undefined;

function normalizeEmail(email: string) {
	return email.trim().toLocaleLowerCase('en-US');
}

export function rememberGoogleProviderAccess(session: Session) {
	const accessToken = session.provider_token;
	const accountEmail = session.user.email;
	if (!accessToken || !accountEmail) return;
	capturedGoogleProviderAccess = {
		accessToken,
		accountEmail: normalizeEmail(accountEmail),
	};
}

export function getCapturedGoogleProviderAccess(expectedEmail: string) {
	if (capturedGoogleProviderAccess?.accountEmail !== normalizeEmail(expectedEmail)) return null;
	return capturedGoogleProviderAccess;
}

export function clearCapturedGoogleProviderAccess() {
	capturedGoogleProviderAccess = undefined;
}

export function getSupabaseClient(): SupabaseClient | null {
	const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey || typeof window === 'undefined') return null;

	if (!window.__supabaseClient) {
		const client = createClient(supabaseUrl, supabaseAnonKey);
		client.auth.onAuthStateChange((event, session) => {
			if (session?.provider_token) {
				rememberGoogleProviderAccess(session);
				return;
			}
			if (event === 'SIGNED_OUT') {
				clearCapturedGoogleProviderAccess();
				return;
			}
			const sessionEmail = session?.user.email;
			if (
				event === 'SIGNED_IN'
				&& capturedGoogleProviderAccess
				&& (!sessionEmail || capturedGoogleProviderAccess.accountEmail !== normalizeEmail(sessionEmail))
			) {
				clearCapturedGoogleProviderAccess();
			}
		});
		window.__supabaseClient = client;
	}
	return window.__supabaseClient;
}
