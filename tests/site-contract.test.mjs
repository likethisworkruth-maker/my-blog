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
	const detail = read('src/components/KnowhowDetailPage.astro');
	const actionBar = read('src/components/ActionBar.astro');
	assert.match(detail, /data-public-tab[^>]*>みんなのコメント</);
	assert.match(detail, /data-private-tab[^>]*>進捗</);
	assert.match(detail, /data-private-tab[^>]*>メモ</);
	assert.match(detail, /role="tablist"/);
	assert.match(detail, /aria-selected=/);
	assert.match(detail, /my\/progress\//);
	assert.match(detail, /readDetailRoute/);
	assert.doesNotMatch(detail, /searchParams|location\.hash|#progress|#memo/);
	assert.match(actionBar, /data-panel-trigger[\s\S]*toggleDescPanel/);
	assert.match(actionBar, />info</);
	assert.match(actionBar, />説明</);
	assert.match(actionBar, /data-private-action-trigger/);
	assert.match(actionBar, /マイリストから削除/);
	assert.match(detail, /deletePrivateChecklistRunsByChecklistId/);
	assert.match(detail, /このチェックリストをマイリストから削除しますか？/);
	assert.match(detail, /navigate\('\/knowhow\/my\/'\)/);
	assert.ok(existsSync(new URL('../src/pages/knowhow/[id]/comments.astro', import.meta.url)));
	assert.ok(existsSync(new URL('../src/pages/knowhow/[id]/my/[tab].astro', import.meta.url)));
});

test('チェックリスト一覧は時期・場面・マイリストをURLとIndexedDB設定で統合する', () => {
	const index = read('src/components/KnowhowIndexPage.astro');
	const runner = read('src/components/ChecklistRunner.astro');
	const actionBar = read('src/components/ActionBar.astro');
	const schema = read('src/content.config.ts');
	const content = [
		read('src/content/knowhow/001-night-memo.md'),
		read('src/content/knowhow/002-family-log.md'),
	].join(String.fromCharCode(10));
	for (const phase of ['all', 'pregnancy', '0-3', '4-6', '7-11', '1-plus']) {
		assert.ok(index.includes('id: "' + phase + '"'));
	}
	for (const scene of ['おでかけ', '病院・健診', '毎日の準備', '帰省・旅行', '保育園', '防災']) {
		assert.ok(index.includes(scene));
	}
	assert.ok(index.includes("segments.push('my')"));
	assert.ok(index.includes("segments.push('phase', currentPhase)"));
	assert.ok(index.includes("segments.push('scene', sceneSlugByLabel[currentScene])"));
	assert.doesNotMatch(index, /searchParams|\?mode|\?tab|#progress|#memo/);
	assert.ok(index.includes('knowhow-selected-phase'));
	assert.ok(index.includes('getPrivateSetting<PhaseFilter>'));
	assert.ok(index.includes('setPrivateSetting(PHASE_SETTING_KEY'));
	assert.ok(index.includes('data-timeline-order'));
	assert.ok(index.includes('overflow-x-auto'));
	assert.ok(index.includes('whitespace-nowrap rounded-full'));
	assert.ok(index.includes('id="scene-navigation"'));
	assert.ok(index.includes('grid-rows-2'));
	assert.equal(index.includes('今の時期から探す'), false);
	assert.equal(index.includes('<details id="scene-filter"'), false);
	assert.equal(index.includes('data-scene-summary'), false);
	assert.equal(index.includes('data-checklist-progress'), false);
	assert.equal(index.includes('checklist-timeline-heading'), false);
	assert.equal(index.includes('phase.icon'), false);
	assert.equal(index.includes('id="age-filter"'), false);
	assert.equal(index.includes('id="sort-order"'), false);
	assert.equal(index.includes('category-btn'), false);
	assert.ok(schema.includes('timelineOrder: z.number().int().nonnegative()'));
	assert.ok(schema.includes('phases: z.array'));
	assert.ok(schema.includes('scenes: z.array'));
	assert.ok(content.includes('timelineOrder:'));
	assert.ok(content.includes('phases:'));
	assert.ok(content.includes('scenes:'));
	for (const label of ['準備完了にする', '振り返る', '結果を保存', '次回用に複製']) {
		assert.ok(read('src/scripts/checklist-state.ts').includes(label));
	}
	assert.ok(runner.includes('data-review-guidance'));
	assert.ok(runner.includes('data-edit-checklist'));
	assert.ok(runner.includes('編集中'));
	assert.ok(runner.includes('data-cancel-edit'));
	assert.ok(runner.includes('data-save-edit'));
	assert.ok(runner.includes('変更を保存'));
	assert.ok(runner.includes('data-delete-list'));
	assert.ok(runner.includes('このリストを削除'));
	assert.ok(runner.includes('editSnapshot = cloneRun(run)'));
	assert.ok(runner.includes('run = cloneRun(editSnapshot)'));
	assert.ok(runner.includes('removeChecklistFromMyList'));
	assert.ok(runner.includes('if (editing) label.append(text)'));
	assert.ok(runner.includes('scrollbar-width: none'));
	assert.ok(runner.includes('.checklist-runner::-webkit-scrollbar'));
	assert.ok(runner.includes("symbol.textContent = 'drag_indicator'"));
	assert.ok(runner.includes("window.addEventListener('pointermove'"));
	assert.ok(runner.includes('dragListeners?.abort()'));
	assert.ok(runner.includes('new AbortController()'));
	assert.equal(runner.includes("button.addEventListener('pointermove'"), false);
	assert.ok(runner.includes('syncItemOrderFromDom'));
	assert.ok(runner.includes('requestAnimationFrame(updateDragPosition)'));
	assert.ok(runner.includes('animateItemReorder'));
	assert.ok(runner.includes('candidateRows.find'));
	assert.equal(runner.includes('document.elementFromPoint'), false);
	assert.ok(runner.includes('followPointer(pointY)'));
	assert.ok(runner.includes('row.style.translate'));
	assert.equal(runner.includes("symbol.textContent = 'back_hand'"), false);
	assert.ok(runner.includes('.checklist-item-dragging'));
	assert.equal(runner.includes('@keyframes drag-handle-grip'), false);
	assert.ok(runner.includes("document.createElement('textarea')"));
	assert.ok(runner.includes("editor.addEventListener('input'"));
	assert.ok(runner.includes('を削除しますか？'));
	assert.ok(
		runner.indexOf("createIconButton('delete'") < runner.indexOf('createDragHandle(item, row)'),
	);
	assert.equal(runner.includes("createIconButton('arrow_upward'"), false);
	assert.equal(runner.includes("createIconButton('arrow_downward'"), false);
	assert.equal(runner.includes('visibility_off'), false);
	assert.ok(runner.includes('実際に使った'));
	assert.ok(runner.includes('持っていったが使わなかった'));
	assert.ok(runner.includes('持たずに困った'));
	assert.ok(runner.includes('次回はいらない'));
	assert.equal(index.includes('data-delete-device-data'), false);
	assert.equal(runner.includes('data-progress-count'), false);
	assert.equal(runner.includes('data-complete-run'), false);
	assert.equal(runner.includes('端末に保存済み'), false);
	assert.ok(actionBar.includes("const showShare = !slug.startsWith('knowhow/')"));
	assert.ok(existsSync(new URL('../src/pages/knowhow/my/index.astro', import.meta.url)));
	assert.ok(existsSync(new URL('../src/pages/knowhow/phase/[...filters].astro', import.meta.url)));
	assert.ok(existsSync(new URL('../src/pages/knowhow/scene/[scene].astro', import.meta.url)));
	assert.equal(index.includes('<Comments slug="dummy"'), false);
});

test('private保存からSupabase同期コードを除外する', () => {
	assert.equal(existsSync(new URL('../src/scripts/checklist-sync.ts', import.meta.url)), false);
	const privateSources = [
		read('src/scripts/private-db.ts'),
		read('src/components/ChecklistRunner.astro'),
		read('src/components/ChecklistPrivateNote.astro'),
	].join('\n');
	assert.doesNotMatch(privateSources, /supabase|checklist_runs|checklist_run_items|personal_note/i);
	assert.doesNotMatch(read('src/components/ChecklistPrivateNote.astro'), /氏名、住所、病院名、病歴|このチェックリストのメモ</);
	assert.doesNotMatch(read('src/components/DriveBackupControls.astro'), /通常のDriveファイルは読み取りません/);
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
	assert.match(comments, /公開コメントです。個人情報は入力しないでください/);
	assert.match(comments, /data-anonymous-comment-info/);
	assert.match(comments, /data-comment-confirm/);
	assert.match(comments, /コメントを送信しますか？/);
	assert.match(comments, /入力に戻る/);
	assert.match(comments, /確認して送信/);
	assert.match(comments, /if \(!loggedIn && confirmDialog\)/);
	assert.match(comments, /pendingContent = content/);
	assert.match(comments, /comments:activate/);
	assert.ok(comments.includes("panel.hidden || panel.classList.contains('hidden')"));
	assert.ok(
		read('src/components/KnowhowDetailPage.astro').includes("new CustomEvent('comments:activate')"),
	);
	assert.match(comments, /コメントを受け付けました。\\n運営による確認後に掲載されます。/);
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
	assert.match(read('src/components/BaseHead.astro'), /name="mobile-web-app-capable"/);
	assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), [
		'/knowhow/',
		'/knowhow/my/',
		'/rikutsu/',
	]);
});

test('テスト用アイテムを非公開にする', () => {
	assert.match(read('src/content/items/003-item-sample.md'), /published: false/);
	assert.match(read('src/pages/items/[id].astro'), /filter\(\(item\) => item\.data\.published\)/);
});
