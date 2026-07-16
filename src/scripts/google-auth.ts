import type { User } from '@supabase/supabase-js';
import { DRIVE_APPDATA_SCOPE } from './drive-authorization';
import { getSupabaseClient } from './supabase-client';

export async function getGoogleUser(): Promise<User | null> {
	const supabase = getSupabaseClient();
	if (!supabase) return null;

	const { data, error } = await supabase.auth.getSession();
	if (error) throw error;
	return data.session?.user ?? null;
}

export async function signInWithGoogle(redirectTo = window.location.href) {
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('Supabaseの接続情報が設定されていません。');

	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo,
			scopes: DRIVE_APPDATA_SCOPE,
			queryParams: {
				include_granted_scopes: 'true',
				prompt: 'consent',
			},
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
