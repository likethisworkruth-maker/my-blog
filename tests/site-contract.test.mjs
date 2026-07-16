import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PC・モバイルナビを3項目に統一し、既存カテゴリを理屈さんち扱いにする', () => {
	const header = read('src/components/Header.astro');
	const footer = read('src/components/Footer.astro');
	for (const source of [header, footer]) {
		assert.match(source, /href="\/rikutsu\/"/);
		assert.match(source, /"apps", "items", "logs"/);
		assert.doesNotMatch(source, /href="\/(apps|items|logs)\/"/);
	}
});

test('公開詳細とprivate詳細のタブを構造的に分離する', () => {
	const detail = read('src/pages/knowhow/[id].astro');
	assert.match(detail, /data-public-tab[^>]*>みんなのコメント</);
	assert.match(detail, /data-private-tab[^>]*>進捗</);
	assert.match(detail, /data-private-tab[^>]*>メモ</);
	assert.match(detail, /role="tablist"/);
	assert.match(detail, /aria-selected=/);
	assert.match(detail, /searchParams\.set\('mode', 'my'\)/);
	assert.match(detail, /destination\.hash = 'progress'/);
});

test('private保存からSupabase同期コードを除外する', () => {
	assert.equal(existsSync(new URL('../src/scripts/checklist-sync.ts', import.meta.url)), false);
	const privateSources = [
		read('src/scripts/private-db.ts'),
		read('src/components/ChecklistRunner.astro'),
		read('src/components/ChecklistPrivateNote.astro'),
	].join('\n');
	assert.doesNotMatch(privateSources, /supabase|checklist_runs|checklist_run_items|personal_note/i);
});

test('GoogleログインとDrive許可を同じSupabase OAuthへ統合する', () => {
	const googleAuth = read('src/scripts/google-auth.ts');
	const authorization = read('src/scripts/drive-authorization.ts');
	const controls = read('src/components/DriveBackupControls.astro');
	const envExample = read('.env.example');
	assert.match(googleAuth, /scopes: DRIVE_APPDATA_SCOPE/);
	assert.match(googleAuth, /include_granted_scopes: 'true'/);
	assert.match(googleAuth, /prompt: 'consent'/);
	assert.doesNotMatch(googleAuth, /access_type|provider_refresh_token/);
	assert.match(authorization, /session\.provider_token/);
	assert.match(authorization, /getCapturedGoogleProviderAccess/);
	assert.match(authorization, /drive\/v3\/about/);
	assert.match(authorization, /Googleログイン中のアカウントとDriveのアカウントが一致しません/);
	assert.match(controls, /getGoogleDriveAuthorization/);
	assert.doesNotMatch(controls, /requestDriveAccessToken|data-drive-connect/);
	assert.doesNotMatch(authorization, /accounts\.google\.com\/gsi|initTokenClient|login_hint/);
	assert.doesNotMatch(envExample, /PUBLIC_GOOGLE_DRIVE_CLIENT_ID|PUBLIC_ENABLE_GOOGLE_DRIVE_BACKUP/);
});

test('PWAショートカットを最終3導線へ更新する', () => {
	const manifest = JSON.parse(read('public/manifest.webmanifest'));
	assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), [
		'/knowhow/',
		'/knowhow/?view=my',
		'/rikutsu/',
	]);
});

test('テスト用アイテムを非公開にする', () => {
	assert.match(read('src/content/items/003-item-sample.md'), /published: false/);
	assert.match(read('src/pages/items/[id].astro'), /filter\(\(item\) => item\.data\.published\)/);
});
