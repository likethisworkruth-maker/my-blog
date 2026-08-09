import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

declare global {
	interface Window {
		__supabaseClient?: SupabaseClient;
		__E2E_AUTH_STUB__?: boolean;
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

type E2EAuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT';
type E2EAuthListener = (event: E2EAuthEvent, session: Session | null) => void | Promise<void>;

function isE2EAuthStubEnabled() {
	if (typeof window === 'undefined') return false;
	return window.__E2E_AUTH_STUB__ === true
		&& (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
}

function getStoredAuthKey() {
	if (typeof window === 'undefined') return null;
	return Object.keys(window.localStorage).find((key) => /^sb-.+-auth-token$/.test(key)) ?? null;
}

function readE2EAuthSession(): Session | null {
	const key = getStoredAuthKey();
	if (!key) return null;
	try {
		const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Partial<Session> | null;
		if (!stored?.access_token || !stored.user) return null;
		return stored as Session;
	} catch {
		return null;
	}
}

function createE2EAuthClient(client: SupabaseClient) {
	let session = readE2EAuthSession();
	const listeners = new Set<E2EAuthListener>();
	const notify = (event: E2EAuthEvent, nextSession: Session | null) => {
		session = nextSession;
		listeners.forEach((listener) => {
			void listener(event, session);
		});
	};
	const auth = {
		getSession: async () => ({ data: { session }, error: null }),
		getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
		onAuthStateChange: (listener: E2EAuthListener) => {
			listeners.add(listener);
			queueMicrotask(() => void listener('INITIAL_SESSION', session));
			return {
				data: {
					subscription: {
						unsubscribe: () => listeners.delete(listener),
					},
				},
				error: null,
			};
		},
		signInWithOAuth: async () => {
			const nextSession = readE2EAuthSession();
			if (nextSession) notify('SIGNED_IN', nextSession);
			return { data: { provider: 'google', url: null }, error: null };
		},
		signOut: async () => {
			const key = getStoredAuthKey();
			if (key) window.localStorage.removeItem(key);
			notify('SIGNED_OUT', null);
			return { error: null };
		},
	};

	return new Proxy(client, {
		get(target, property, receiver) {
			if (property === 'auth') return auth;
			return Reflect.get(target, property, receiver);
		},
	}) as SupabaseClient;
}

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
	// Auth UI regression tests must not require a running Supabase or Google OAuth server.
	// Data/RLS behavior remains covered by the real client outside this local-only flag.
	if (isE2EAuthStubEnabled()) return false;
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
	const e2eAuthStub = isE2EAuthStubEnabled();
	if (isSupabaseDisabled && !e2eAuthStub) return null;
	const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || (e2eAuthStub ? 'http://127.0.0.1:54321' : '');
	const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || (e2eAuthStub ? 'e2e-test-anon-key' : '');
	if (!supabaseUrl || !supabaseAnonKey || typeof window === 'undefined') return null;

	if (!window.__supabaseClient) {
		const client = createClient(supabaseUrl, supabaseAnonKey, e2eAuthStub ? {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
				detectSessionInUrl: false,
			},
		} : undefined);
		const resolvedClient = e2eAuthStub ? createE2EAuthClient(client) : client;
		resolvedClient.auth.onAuthStateChange((event, session) => {
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
		window.__supabaseClient = resolvedClient;
	}
	return window.__supabaseClient;
}
