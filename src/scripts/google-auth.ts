import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isConnectionError, markSupabaseUnavailable } from './supabase-client';

export async function getGoogleUser(): Promise<User | null> {
	const supabase = getSupabaseClient();
	if (!supabase) return null;

	try {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			if (isConnectionError(error)) markSupabaseUnavailable();
			return null;
		}
		return data.session?.user ?? null;
	} catch (err) {
		if (isConnectionError(err)) markSupabaseUnavailable();
		return null;
	}
}

export async function signInWithGoogle(redirectTo = window.location.href) {
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('Supabaseの接続情報が設定されていません。');

	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo,
		},
	});
	if (error) throw error;
}

export async function signOutGoogleUser() {
	const supabase = getSupabaseClient();
	if (!supabase) return;

	const { error } = await supabase.auth.signOut({ scope: 'local' });
	if (error) throw error;
}
