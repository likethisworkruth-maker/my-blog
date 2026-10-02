import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PC・モバイルナビにCDCチェックを加え、検索と既存カテゴリの状態を保つ', () => {
	const header = read('src/components/Header.astro');
	const footer = read('src/components/Footer.astro');
	for (const source of [header, footer]) {
		assert.match(source, /href="\/cdc\/"/);
		assert.match(source, /href="\/my-knowhow\/"/);
		assert.match(source, /href="\/recommend\/"/);
		assert.match(source, /"recommend", "apps", "items", "logs"/);
		assert.doesNotMatch(source, /href="\/(apps|items|logs)\/"/);
	}
	assert.ok(header.includes('UI.headerNav.knowhow'));
	assert.ok(header.includes('UI.headerNav.myList'));
	assert.ok(header.includes('UI.headerNav.cdc'));
	assert.ok(header.indexOf('href="/recommend/"') < header.indexOf('href="/cdc/"'));
	assert.match(header, /const isChecklistPath = \(pathname === "\/" \|\| pathSegments\[0\] === "knowhow"\)/);
	assert.match(header, /const isCdcPath = pathSegments\[0\] === "cdc"/);
	assert.equal(header.includes('UI.headerNav.home'), false);
	assert.match(header, /<header[\s\S]*class="hidden[^\"]*lg:block/);
	assert.ok(footer.includes('UI.footerNav.knowhow'));
	assert.ok(footer.includes('UI.footerNav.myList'));
	assert.ok(footer.includes('UI.footerNav.cdc'));
	assert.ok(footer.indexOf('href="/recommend/"') < footer.indexOf('href="/cdc/"'));
	assert.match(footer, /const isChecklistPath = \(pathname === "\/" \|\| pathSegments\[0\] === "knowhow"\)/);
	assert.match(footer, /const isCdcPath = pathSegments\[0\] === "cdc"/);
	assert.equal(footer.includes('UI.footerNav.home'), false);
});

test('ルートをチェックリスト一覧にし、旧案内ページを廃止する', () => {
	const home = read('src/pages/index.astro');
	const index = read('src/components/KnowhowIndexPage.astro');
	const layout = read('src/layouts/Layout.astro');
	const about = read('src/pages/about.astro');
	const globalCss = read('src/styles/global.css');
	const recommend = read('src/pages/recommend/index.astro');
	assert.match(home, /<KnowhowIndexPage \/>/);
	assert.doesNotMatch(home, /チェックリストを探す|続きから使う|運営のおうちを見る/);
	assert.ok(index.includes('const isRootPage = Astro.url.pathname === "/"'));
	assert.doesNotMatch(recommend, />実体験の記録<|<h1[^>]*>運営のおうち<\/h1>|おすすめだけでなく/);
	assert.equal((recommend.match(/class="flex items-center gap-2"/g) ?? []).length, 3);
	assert.match(recommend, /<span class="material-symbols-outlined text-2xl text-mint-500"[^>]*>apps<\/span>[\s\S]*<h2[^>]*>アプリ<\/h2>/);
	assert.match(recommend, /<span class="material-symbols-outlined text-2xl text-mint-500"[^>]*>inventory_2<\/span>[\s\S]*<h2[^>]*>アイテム<\/h2>/);
	assert.doesNotMatch(recommend, />toys_and_games<\/span>/);
	assert.match(recommend, /<span class="material-symbols-outlined text-2xl text-mint-500"[^>]*>auto_stories<\/span>[\s\S]*<h2[^>]*>育児ログ<\/h2>/);
	assert.doesNotMatch(about, /サイトの構成/);
	assert.ok(layout.includes("initialDisplayMode?: 'headline_view' | 'grid_view'"));
	assert.ok(layout.includes('data-knowhow-initial-display-mode={initialDisplayMode}'));
	assert.equal(index.includes('<script is:inline>'), false);
	assert.match(globalCss, /html\[data-knowhow-initial-display-mode="grid_view"\] #knowhow-container \{[\s\S]*display: grid !important/);
	assert.match(globalCss, /html\[data-knowhow-initial-display-mode="grid_view"\] #knowhow-container \.knowhow-list-view \{[\s\S]*display: none !important/);
	assert.match(globalCss, /html\[data-knowhow-initial-display-mode="grid_view"\] #knowhow-container \.knowhow-gallery-view \{[\s\S]*display: block !important/);
	assert.match(globalCss, /html\[data-knowhow-initial-display-mode="grid_view"\][\s\S]*border-radius:\s*0\.375rem\s*!important/);
	assert.match(globalCss, /#knowhow-container\[data-list-view="my"\]:not\(\[data-private-state-loaded="true"\]\) \.knowhow-card/);
});

test('公開詳細とprivate詳細のタブを構造的に分離する', () => {
	const detail = read('src/components/KnowhowDetailPage.astro');
	const baseMedia = read('src/components/KnowhowBaseMedia.astro');
	const privateIndex = read('src/pages/my-knowhow/[id]/index.astro');
	const privateDescription = read('src/pages/my-knowhow/[id]/description.astro');
	const privateProgress = read('src/pages/my-knowhow/[id]/progress.astro');
	const privateMemo = read('src/pages/my-knowhow/[id]/memo.astro');
	const actionBar = read('src/components/ActionBar.astro');
	const runner = read('src/components/ChecklistRunner.astro');
	const privateNote = read('src/components/ChecklistPrivateNote.astro');
	const deleteModule = read('src/scripts/private-list-delete.ts');
	assert.doesNotMatch(detail, /tab-content-comments|tab-btn-comments/);
	assert.match(detail, /id="info-panel"[\s\S]*h-\[100dvh\]/);
	assert.doesNotMatch(detail, /h-\[65dvh\]|rounded-t-3xl/);
	assert.doesNotMatch(detail, /<img|id="knowhow-media-area"|relative flex h-full w-full shrink-0 flex-row items-end/);
	assert.match(detail, /activeTab === 'base' && <KnowhowBaseMedia/);
	assert.match(baseMedia, /id="knowhow-media-area"/);
	assert.match(baseMedia, /<img src={knowhow\.data\.coverImage}/);
	assert.match(detail, /data-media-ui/);
	assert.match(detail, /mediaChromeHidden/);
	assert.match(detail, /data-media-chrome-hidden="true"/);
	assert.match(detail, /activeTab === 'base'[\s\S]*data-go-back[\s\S]*text-\[2rem\][\s\S]*drop-shadow-\[0_2px_5px_rgba\(0,0,0,0\.8\)\]/);
	assert.match(detail, /data-go-back class="absolute[^\n]*hidden[^\n]*lg:flex/);
	assert.match(detail, /data-private-tab[^>]*>進捗</);
	assert.match(detail, /data-private-tab[^>]*>メモ</);
	assert.match(detail, /role="tablist"/);
	assert.match(detail, /aria-selected=/);
	assert.match(detail, /detailTab\?: DetailTab/);
	assert.match(detail, /activeTab === 'desc'/);
	assert.match(detail, /activeTab === 'progress'/);
	assert.match(detail, /activeTab === 'memo'/);
	assert.match(detail, /href=\{tabUrls\.desc\}/);
	assert.match(detail, /href=\{tabUrls\.progress\}/);
	assert.match(detail, /href=\{tabUrls\.memo\}/);
	assert.ok(privateIndex.includes('detailTab="base"'));
	assert.ok(privateDescription.includes('detailTab="desc"'));
	assert.ok(privateProgress.includes('detailTab="progress"'));
	assert.ok(privateMemo.includes('detailTab="memo"'));
	assert.doesNotMatch(detail, /readDetailRoute|window\.switchTab|window\.toggleTab/);
	assert.match(detail, /getPrivateChecklistRunsByChecklistId/);
	assert.match(detail, /privateStateLoaded/);
	assert.match(detail, /data-private-navigation/);
	assert.match(detail, /data-private-state-loaded=\{isPrivateDetail \? 'false' : 'true'\}/);
	assert.match(detail, /getPrivateChecklistRuns\(\)/);
	assert.match(detail, /syncPrivateNavigation/);
	assert.match(detail, /isPrivateDetailPath && container\.dataset\.privateStateLoaded !== 'true'/);
	assert.doesNotMatch(detail, /searchParams|location\.hash|#progress|#memo/);
	assert.match(actionBar, /data-panel-trigger[\s\S]*data-panel-tab="desc"/);
	assert.match(actionBar, />info</);
	assert.match(actionBar, />説明</);
	assert.match(actionBar, /privateProgressUrl/);
	assert.match(actionBar, /privateMemoUrl/);
	assert.match(actionBar, /href=\{privateProgressUrl\}/);
	assert.match(actionBar, /data-private-memo-route=\{privateMemoUrl\}/);
	assert.match(actionBar, /data-private-action-trigger data-private-list-delete/);
	assert.doesNotMatch(runner, /data-edit-checklist|data-cancel-edit|data-save-edit|data-delete-list|drag_indicator|pointermove|createDragHandle|textarea/);
	assert.match(detail, /deletePrivateListByChecklistId/);
	assert.match(deleteModule, /PRIVATE_LIST_DELETE_CONFIRM_MESSAGE/);
	assert.match(detail, /navigate\('\/my-knowhow\/'\)/);
	assert.match(privateNote, /data-note-editor/);
	assert.match(privateNote, /contenteditable=\"false\"/);
	assert.match(privateNote, /readEditorText/);
	assert.doesNotMatch(privateNote, /<textarea|maxlength=\"3000\"|data-note-count|保存中/);
	assert.ok(!existsSync(new URL('../src/pages/knowhow/[id]/comments.astro', import.meta.url)));
	assert.ok(existsSync(new URL('../src/pages/my-knowhow/[id]/description.astro', import.meta.url)));
	assert.ok(existsSync(new URL('../src/pages/my-knowhow/[id]/progress.astro', import.meta.url)));
	assert.ok(existsSync(new URL('../src/pages/my-knowhow/[id]/memo.astro', import.meta.url)));
	assert.equal(existsSync(new URL('../src/pages/my-knowhow/[id]/[tab].astro', import.meta.url)), false);
});

test('チェックリスト一覧は時期・場面・マイリストをURLとIndexedDB設定で統合する', () => {
	const index = read('src/components/KnowhowIndexPage.astro');
	const listPage = read('src/scripts/list-page.ts');
	const privateListDelete = read('src/scripts/private-list-delete.ts');
	const runner = read('src/components/ChecklistRunner.astro');
	const actionBar = read('src/components/ActionBar.astro');
	const schema = read('src/content.config.ts');
	const content = [
		read('src/content/knowhow/001-night-memo.md'),
		read('src/content/knowhow/002-family-log.md'),
	].join(String.fromCharCode(10));
	assert.match(index, /const phaseIds = Array\.from\(new Set\(knowhow\.flatMap/);
	assert.match(index, /const sceneLabels = Array\.from\(new Set\(knowhow\.flatMap/);
	assert.match(index, /const filterOptions = \{ phases, scenes \}/);
	assert.match(index, /data-filter-options=\{JSON\.stringify\(filterOptions\)\}/);
	assert.match(index, /<dialog data-list-sheet id="filter-sheet-modal"/);
	assert.match(index, /<dialog data-list-sheet id="sort-sheet-modal"/);
	assert.match(index, /<dialog data-list-sheet id="filter-sheet-modal"[^>]*items-end/);
	assert.match(index, /id="filter-sheet-content"[^>]*rounded-t-3xl/);
	assert.doesNotMatch(index, /\btranslate-y-full\b/);
	assert.match(index, /id="filter-sheet-content"/);
	assert.match(index, /id="sort-sheet-content"[^>]*rounded-t-3xl/);
	assert.match(index, /createListSheetController\(filterSheetModal/);
	assert.match(index, /createListSheetController\(sortSheetModal/);
	assert.match(listPage, /export const createListSheetController/);
	assert.ok(index.includes('const readListRoute = () =>'));
	assert.ok(index.includes('const isPrivateListItem = currentListView === \'my\''));
	assert.ok(index.includes('saveKnowhowListCache'));
	assert.ok(index.includes('readKnowhowListCache'));
	assert.ok(index.includes('data-my-list-swipe-row'));
	assert.ok(index.includes('my-list-delete-action'));
	assert.doesNotMatch(index, /data-my-list-grid-delete|my-list-grid-delete-close|gridHoldStates|data-grid-edit-mode|my-list-card-shake/);
	assert.match(index, /data-my-list-delete[\s\S]*material-symbols-outlined text-2xl[\s\S]*delete[\s\S]*削除/);
	assert.match(index, /const canDeleteRow = \(row: HTMLElement\)/);
	assert.match(index, /startedChecklistIds\.has\(checklistId\)/);
	assert.match(privateListDelete, /if \(!canDelete\(row\)/);
	const forbiddenDeleteColor = ['#dc', '2626'].join('');
	assert.doesNotMatch(index, new RegExp(forbiddenDeleteColor, 'i'));
	assert.match(privateListDelete, /deleteButton\) deleteButton\.hidden = !enabled/);
	assert.doesNotMatch(index, /bg-red-600/);
	assert.ok(privateListDelete.includes('deletePrivateListByChecklistId'));
	assert.ok(index.includes('完了済み表示'));
	assert.ok(index.includes('completedOnly'));
	assert.ok(index.includes('data-grid-completed'));
	assert.ok(index.includes('data-panel-like'));
	assert.ok(index.includes('data-panel-completed'));
	assert.match(index, /data-grid-completed[\s\S]*check_circle/);
	assert.match(index, /data-panel-completed[\s\S]*check_circle/);
	assert.match(index, /data-grid-like[\s\S]*\.like-btn \.icon-empty[\s\S]*color: #fff !important/);
	assert.match(index, /data-grid-like[\s\S]*\.like-btn \.like-count[\s\S]*color: #fff !important/);
	assert.match(index, /data-grid-completed[\s\S]*color: var\(--color-mint-500\) !important/);
	assert.ok(index.includes('completedChecklistIds'));
	assert.ok(index.includes('card.dataset.started = String(started)'));
	assert.match(index, /data-started="true"[\s\S]*\.like-btn \.icon-filled/);
	assert.doesNotMatch(index, /削除済み表示|deletedOnly|deletedChecklistIds/);
	assert.ok(privateListDelete.includes('clearChecklistSessionState'));
	assert.ok(index.includes("params.delete('phase')"));
	assert.ok(index.includes('currentPhases.forEach((phase) => params.append(\'phase\', phase))'));
	assert.ok(index.includes("if (currentScene !== 'all') params.set('scene', currentScene)"));
	assert.doesNotMatch(index, /\?tab|#progress|#memo/);
	assert.equal(index.includes('data-knowhow-view'), false);
	assert.equal(index.includes('チェックリストの表示切り替え'), false);
	assert.ok(index.includes('data-display-mode-option="headline_view"'));
	assert.ok(index.includes('data-display-mode-option="grid_view"'));
	assert.ok(index.includes('data-list-view={isMyListPage ? "my" : "discover"}'));
	assert.ok(index.includes('data-private-state-loaded={isMyListPage ? "false" : "true"}'));
	assert.ok(index.includes('knowhow-list-view'));
	assert.ok(index.includes('knowhow-summary'));
	assert.ok(index.includes('knowhow-display-mode'));
	assert.ok(index.includes('setPrivateSetting(DISPLAY_MODE_SETTING_KEY'));
	assert.ok(index.includes('knowhow-selected-phase'));
	assert.ok(index.includes('getPrivateSetting<PhaseFilter | PhaseFilter[]>'));
	assert.ok(index.includes('setPrivateSetting(PHASE_SETTING_KEY'));
	assert.ok(index.includes('data-timeline-order'));
	assert.ok(index.includes('data-sheet-phase'));
	assert.ok(index.includes('data-sheet-scene'));
	assert.match(index, /viewMatch = activeMatch[\s\S]*&& \(!isFavOnly \|\| favoriteMatch\)[\s\S]*&& \(isCompletedOnly \? completedMatch : !completedMatch\)/);
	assert.ok(index.includes('未完了のチェックリストはありません。'));
	assert.match(index, /const phaseMatch = currentPhases\.size === 0 \|\| cardPhases\.some/);
	assert.doesNotMatch(index, /data-sheet-phase=["']all["']/);
	assert.equal(index.includes('id="phase-navigation"'), false);
	assert.equal(index.includes('id="scene-navigation"'), false);
	assert.equal(index.includes('data-phase='), false);
	assert.equal(index.includes('data-scene='), false);
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
	assert.ok(schema.includes('phases: z.array(z.string().min(1))'));
	assert.ok(schema.includes('scenes: z.array(z.string().min(1))'));
	assert.ok(content.includes('timelineOrder:'));
	assert.ok(content.includes('phases:'));
	assert.ok(content.includes('scenes:'));
	for (const label of ['準備完了にする', '振り返る', '結果を保存', '次回用に複製']) {
		assert.ok(read('src/scripts/checklist-state.ts').includes(label));
	}
	assert.ok(runner.includes('data-review-guidance'));
	assert.ok(runner.includes('data-item-editor'));
	assert.ok(runner.includes('contentEditable = \'true\''));
	assert.ok(runner.includes('data-add-item-area'));
	assert.ok(runner.includes('syncChecklistRunCompletion(run)'));
	assert.equal(runner.includes('data-add-item-button'), false);
	assert.equal(runner.includes('data-add-item-editor'), false);
	assert.ok(runner.includes('schedulePersist'));
	assert.ok(runner.includes('checklist-edit-cancel'));
	assert.ok(runner.includes('scrollbar-width: none'));
	assert.ok(runner.includes('.checklist-runner::-webkit-scrollbar'));
	assert.ok(runner.includes("editor.addEventListener('input'"));
	assert.ok(runner.includes("checkbox.type = 'checkbox'"));
	assert.ok(runner.includes("text?.classList.toggle('line-through'"));
	assert.match(runner, /row\.className = 'checklist-item-row bg-transparent px-4'/);
	assert.doesNotMatch(runner, /row\.className = '[^']*rounded/);
	assert.doesNotMatch(runner, /data-add-item-row/);
	assert.ok(runner.includes("event.key === 'Enter'"));
	assert.ok(runner.includes("event.key === 'Backspace' || event.key === 'Delete'"));
	assert.ok(runner.includes("editor.addEventListener('blur'"));
	assert.ok(runner.includes('void removeItem(item.id)'));
	assert.ok(runner.includes("checkbox.className = 'reminder-checkbox"));
	assert.equal(runner.includes('保存中'), false);
	assert.equal(runner.includes('編集ボタン'), false);
	assert.ok(runner.includes('実際に使った'));
	assert.ok(runner.includes('持っていったが使わなかった'));
	assert.ok(runner.includes('持たずに困った'));
	assert.ok(runner.includes('次回はいらない'));
	assert.equal(index.includes('data-delete-device-data'), false);
	assert.equal(runner.includes('data-progress-count'), false);
	assert.equal(runner.includes('data-complete-run'), false);
	assert.equal(runner.includes('端末に保存済み'), false);
	assert.ok(actionBar.includes("const showShare = !slug.startsWith('knowhow/')"));
	assert.ok(existsSync(new URL('../src/pages/my-knowhow/index.astro', import.meta.url)));
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
	assert.doesNotMatch(read('src/components/ChecklistPrivateNote.astro'), /DriveBackupControls|data-drive-backup|Google Driveバックアップ|今すぐバックアップ/);
});

test('GoogleログインはDrive権限とバックアップUIを持たない', () => {
	const googleAuth = read('src/scripts/google-auth.ts');
	const privateNote = read('src/components/ChecklistPrivateNote.astro');
	const detail = read('src/components/KnowhowDetailPage.astro');
	const runner = read('src/components/ChecklistRunner.astro');
	assert.doesNotMatch(googleAuth, /DRIVE_APPDATA_SCOPE|drive\.appdata|include_granted_scopes|prompt: 'consent'/);
	assert.doesNotMatch(privateNote, /Drive|data-drive-backup|今すぐバックアップ/);
	assert.doesNotMatch(detail, /Drive|google-login-backup-notice|checklist-usage-notice/);
	assert.doesNotMatch(runner, /Driveバックアップ/);
	assert.equal(existsSync(new URL('../src/components/DriveBackupControls.astro', import.meta.url)), false);
	assert.equal(existsSync(new URL('../src/scripts/drive-authorization.ts', import.meta.url)), false);
	assert.equal(existsSync(new URL('../src/scripts/drive-backup.ts', import.meta.url)), false);
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
	assert.doesNotMatch(read('src/components/KnowhowDetailPage.astro'), /comments:activate/);
	assert.match(comments, /コメントを受け付けました。\\n運営による確認後に掲載されます。/);
	assert.doesNotMatch(comments, /\.from\(['"]comments['"]\)/);
});

test('いいねは認証ユーザーと匿名IndexedDB資格情報を分けて扱う', () => {
	const button = read('src/components/LikeButton.astro');
	const likes = read('src/scripts/article-likes.ts');
	const privateDb = read('src/scripts/private-db.ts');
	const listSources = [
		read('src/components/KnowhowIndexPage.astro'),
		read('src/components/LogCard.astro'),
	].join('\n');
	assert.match(privateDb, /PRIVATE_DB_VERSION = 2/);
	assert.match(privateDb, /article_likes/);
	assert.match(likes, /crypto|getRandomValues/);
	assert.match(likes, /rpc\('set_authenticated_like'/);
	assert.match(likes, /rpc\('add_anonymous_like'/);
	assert.match(likes, /rpc\('remove_anonymous_like'/);
	assert.match(likes, /rpc\('claim_anonymous_like'/);
	assert.match(button, /getBatchArticleLikeStates|getCurrentArticleLikeState/);
	assert.match(button, /startOnLike/);
	assert.match(button, /checklist-start-requested/);
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
	assert.match(read('src/consts.ts'), /SITE_TITLE = 'すくリス'/);
	assert.equal(manifest.name, 'すくリス');
	assert.match(read('src/components/BaseHead.astro'), /name="mobile-web-app-capable"/);
	assert.equal(manifest.start_url, '/my-knowhow/');
	assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), [
		'/',
		'/my-knowhow/',
		'/recommend/',
	]);
});

test('テスト用アイテムを非公開にする', () => {
	assert.match(read('src/content/items/003-item-sample.md'), /published: false/);
	assert.match(read('src/pages/items/[id].astro'), /filter\(\(item\) => item\.data\.published\)/);
});

test('アプリ・アイテム・ログの検索UIをボトムシートに統一し、SP用パンくずを非表示にする', () => {
	const apps = read('src/pages/apps/index.astro');
	const items = read('src/pages/items/index.astro');
	const logs = read('src/pages/logs/index.astro');
	const controls = read('src/components/ContentListControls.astro');
	const sheet = read('src/components/ContentListSheet.astro');
	const listPage = read('src/scripts/list-page.ts');
	const listSheetCss = read('src/styles/list-sheet.css');
	const backLink = read('src/components/RecommendBackLink.astro');

	for (const page of [apps, items, logs]) {
		assert.doesNotMatch(page, /<select id="age-filter"/);
		assert.doesNotMatch(page, /<select id="sort-order"/);
		assert.match(page, /<ContentListControls/);
		assert.match(page, /<ContentListSheet/);
		assert.doesNotMatch(page, /<dialog|id="open-filter-sheet-btn"|id="open-sort-sheet-btn"/);
	}
	assert.match(controls, /id="open-filter-sheet-btn"/);
	assert.match(controls, /id="open-sort-sheet-btn"/);
	assert.match(sheet, /<dialog[\s\S]*data-list-sheet[\s\S]*id="filter-sheet-modal"/);
	assert.match(sheet, /data-list-sheet-content/);
	assert.match(listPage, /destroy: \(\) => void/);
	assert.match(listPage, /new AbortController\(\)/);
	assert.match(listPage, /astro:before-swap/);
	assert.match(listPage, /const isMobileSheet = \(\) => window\.innerWidth < 1024/);
	assert.match(listPage, /if \(!isMobileSheet\(\)\) return/);
	assert.match(listPage, /void content\.offsetHeight/);
	assert.match(listPage, /requestAnimationFrame\([\s\S]*modal\.classList\.add\('is-open'\)/);
	assert.doesNotMatch([sheet, listPage].join('\n'), /\btranslate-y-full\b/);
	assert.match(listSheetCss, /\[data-list-sheet\][\s\S]*display:\s*none/);
	assert.match(listSheetCss, /\[data-list-sheet\]\[open\][\s\S]*display:\s*flex/);
	assert.match(listSheetCss, /transform:\s*translate3d\(0,\s*100%,\s*0\)/);
	assert.match(listSheetCss, /\.is-motion-ready \[data-list-sheet-content\][\s\S]*transition:\s*transform 250ms/);
	assert.match(listSheetCss, /\.is-open \[data-list-sheet-content\][\s\S]*transform:\s*translate3d\(0,\s*0,\s*0\)/);
	assert.match(listSheetCss, /\[data-list-sheet-handle\][\s\S]*cursor:\s*default/);
	assert.doesNotMatch(sheet, /cursor-grab|cursor-grabbing/);
	assert.match(backLink, /class="[^"]*hidden sm:flex[^"]*"/);
});

test('共有UIからインラインJavaScriptを除去し、画面遷移時に解除する', () => {
	const actionBar = read('src/components/ActionBar.astro');
	const shareModal = read('src/components/ShareModal.astro');
	assert.doesNotMatch(actionBar, /onclick=/);
	assert.doesNotMatch(shareModal, /onclick=/);
	assert.match(shareModal, /data-copy-share-link/);
	assert.match(shareModal, /data-share-platform="x"/);
	assert.match(shareModal, /new AbortController\(\)/);
	assert.match(shareModal, /astro:before-swap/);
});
