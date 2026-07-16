import {
	clearCapturedGoogleProviderAccess,
	getCapturedGoogleProviderAccess,
	getSupabaseClient,
	rememberGoogleProviderAccess,
} from './supabase-client.ts';

export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export interface GoogleDriveAuthorization {
	accessToken: string;
	accountEmail: string;
}

let verifiedAccess: GoogleDriveAuthorization | undefined;

function normalizeEmail(email: string) {
	return email.trim().toLocaleLowerCase('en-US');
}

export async function assertDriveAccountMatches(
	accessToken: string,
	expectedEmail: string,
	request: typeof fetch = fetch,
) {
	const normalizedExpectedEmail = normalizeEmail(expectedEmail);
	if (!normalizedExpectedEmail) throw new Error('Googleログイン中のメールアドレスを確認できません。');
	const url = new URL('https://www.googleapis.com/drive/v3/about');
	url.searchParams.set('fields', 'user(emailAddress)');
	const response = await request(url, {
		headers: { Authorization: 'Bearer ' + accessToken },
	});
	if (!response.ok) throw new Error('Googleへ再ログインしてDriveバックアップを再開してください。');
	const body = await response.json() as { user?: { emailAddress?: string } };
	const driveEmail = body.user?.emailAddress;
	if (!driveEmail || normalizeEmail(driveEmail) !== normalizedExpectedEmail) {
		throw new Error('Googleログイン中のアカウントとDriveのアカウントが一致しません。');
	}
	return driveEmail;
}

export async function getGoogleDriveAuthorization(): Promise<GoogleDriveAuthorization> {
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('Googleログインは現在利用できません。');
	const { data, error } = await supabase.auth.getSession();
	if (error) throw error;
	const session = data.session;
	const accountEmail = session?.user.email;
	if (!session || !accountEmail) throw new Error('先にヘッダーからGoogleへログインしてください。');

	if (session.provider_token) rememberGoogleProviderAccess(session);
	const captured = getCapturedGoogleProviderAccess(accountEmail);
	if (!captured) {
		throw new Error('Googleへ再ログインしてDriveバックアップを有効にしてください。');
	}

	const normalizedEmail = normalizeEmail(accountEmail);
	if (
		verifiedAccess?.accessToken === captured.accessToken
		&& verifiedAccess.accountEmail === normalizedEmail
	) return verifiedAccess;

	await assertDriveAccountMatches(captured.accessToken, normalizedEmail);
	verifiedAccess = {
		accessToken: captured.accessToken,
		accountEmail: normalizedEmail,
	};
	return verifiedAccess;
}

export function forgetGoogleDriveAuthorization() {
	verifiedAccess = undefined;
	clearCapturedGoogleProviderAccess();
}
