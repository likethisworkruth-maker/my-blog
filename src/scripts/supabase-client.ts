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

let isSupabaseDisabled = false;
let connectionCheckPromise: Promise<boolean> | null = null;

export function isConnectionError(error: unknown): boolean {
	if (!error) return false;
	const msg = String(error instanceof Error ? error.message : error).toLowerCase();
	return (
		msg.includes('failed to fetch') ||
		msg.includes('connection refused') ||
		msg.includes('networkerror') ||
		msg.includes('err_connection_refused') ||
		error instanceof TypeError
	);
}

export function markSupabaseUnavailable() {
	isSupabaseDisabled = true;
}

export function isSupabaseAvailable(): boolean {
	return !isSupabaseDisabled;
}

export async function checkSupabaseHealth(): Promise<boolean> {
	if (isSupabaseDisabled) return false;
	const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey || typeof window === 'undefined') {
		markSupabaseUnavailable();
		return false;
	}

	if (!connectionCheckPromise) {
		const checkPromise = new Promise<boolean>((resolve) => {
			let settled = false;
			const finish = (available: boolean) => {
				if (settled) return;
				settled = true;
				resolve(available);
			};

			try {
				const request = new XMLHttpRequest();
				request.open('HEAD', `${supabaseUrl}/rest/v1/`, true);
				request.timeout = 2000;
				request.setRequestHeader('apikey', supabaseAnonKey);
				request.onload = () => finish(request.status > 0 && request.status < 500);
				request.onerror = () => {
					markSupabaseUnavailable();
					finish(false);
				};
				request.ontimeout = () => {
					markSupabaseUnavailable();
					finish(false);
				};
				request.onabort = () => {
					markSupabaseUnavailable();
					finish(false);
				};
				request.send();
			} catch {
				markSupabaseUnavailable();
				finish(false);
			}
		});
		connectionCheckPromise = checkPromise.catch(() => {
			markSupabaseUnavailable();
			return false;
		});
	}
	return connectionCheckPromise;
}

export function getSupabaseClient(): SupabaseClient | null {
	if (isSupabaseDisabled) return null;
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
