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

test('コメントは公開RPCだけを使用し、ログイン投稿だけ本人削除を提供する', () => {
	const comments = read('src/components/Comments.astro');
	assert.match(comments, /rpc\('get_approved_comments'/);
	assert.match(comments, /rpc\('submit_comment'/);
	assert.match(comments, /rpc\('delete_my_comment'/);
	assert.match(comments, /comment\.is_mine/);
	assert.match(comments, /author\.textContent = '匿名さん'/);
	assert.doesNotMatch(comments, /p_author_name/);
	assert.match(comments, /運営による確認後に掲載されます/);
	assert.doesNotMatch(comments, /\.from\(['"]comments['"]\)/);
});

test('いいねは認証ユーザーと匿名IndexedDB資格情報を分けて扱う', () => {
	const button = read('src/components/LikeButton.astro');
	const likes = read('src/scripts/article-likes.ts');
	const privateDb = read('src/scripts/private-db.ts');
	const listSources = [
		read('src/pages/apps/index.astro'),
		read('src/pages/items/index.astro'),
		read('src/pages/logs/index.astro'),
		read('src/components/LogCard.astro'),
	].join('\n');
	assert.match(privateDb, /PRIVATE_DB_VERSION = 2/);
	assert.match(privateDb, /article_likes/);
	assert.match(likes, /crypto|getRandomValues/);
	assert.match(likes, /rpc\('set_authenticated_like'/);
	assert.match(likes, /rpc\('add_anonymous_like'/);
	assert.match(likes, /rpc\('remove_anonymous_like'/);
	assert.match(likes, /rpc\('claim_anonymous_like'/);
	assert.match(button, /getCurrentArticleLikeState/);
	assert.match(listSources, /getLikedArticleSlugs/);
	assert.doesNotMatch([button, listSources].join('\n'), /localStorage|liked:|increment_likes|decrement_likes/);
});

test('公開操作migrationはテーブル直操作を閉じ、必要なRPCだけを公開する', () => {
	const migration = read('supabase/migrations/20260716000000_auth_comments_likes.sql');
	assert.match(migration, /create schema if not exists private/);
	assert.match(migration, /revoke all on schema private from public/);
	assert.match(migration, /add column if not exists user_id uuid null[\s\S]*on delete set null/);
	assert.match(migration, /create table if not exists public\.like_records/);
	assert.match(migration, /num_nonnulls\(user_id, anonymous_token_hash\) = 1/);
	assert.match(migration, /after insert on public\.like_records/);
	assert.match(migration, /after delete on public\.like_records/);
	assert.match(migration, /v_author_name constant text := '匿名さん'/);
	assert.match(migration, /v_status text := case when v_user_id is null then 'pending' else 'approved' end/);
	assert.match(migration, /'匿名さん'::text as author_name/);
	assert.match(migration, /and c\.status = 'approved'/);
	assert.match(migration, /revoke all on table public\.comments from anon, authenticated/);
	assert.match(migration, /revoke all on table public\.like_records from anon, authenticated/);
	assert.match(migration, /grant execute on function public\.delete_my_comment\(uuid\) to authenticated/);
	assert.match(migration, /grant execute on function public\.add_anonymous_like\(text, text\) to anon/);
	assert.match(migration, /revoke execute on function public\.increment_likes\(text\)/);
	assert.match(migration, /security definer\s+set search_path = ''/);
	const approvedCommentsFunction = migration.match(/create or replace function public\.get_approved_comments[\s\S]+?create or replace function public\.delete_my_comment/)?.[0] ?? '';
	assert.doesNotMatch(approvedCommentsFunction, /'user_id'/);
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
