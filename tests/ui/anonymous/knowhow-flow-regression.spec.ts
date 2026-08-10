import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
	clearPrivateRuns,
	collectPageErrors,
	expectListState,
	expectNoPageErrors,
	makeDeletedRegressionRun,
	makeRegressionRun,
	openPrivateDetailFromList,
	readPrivateRuns,
	seedPrivateRuns,
	swipeMyListRow,
	visibleCardTitles,
	visiblePrivateAction,
} from '../helpers';

test.use({ storageState: path.resolve('tests/fixtures/auth/anonymous.storageState.json') });

const ids = [
	{ id: '001-night-memo', title: '夜泣き対応メモ', checklistId: 'night-memo' },
	{ id: '002-family-log', title: '夫婦共有ログ', checklistId: 'family-log' },
] as const;

async function expectTab(page: import('@playwright/test').Page, tab: 'desc' | 'progress' | 'memo') {
	await expect(page.locator(`#tab-btn-${tab}`)).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator(`#tab-content-${tab}`)).toBeVisible();
}

async function waitForSheetToSettle(page: import('@playwright/test').Page, contentSelector: string) {
	await expect.poll(() => page.locator(contentSelector).evaluate((element) => {
		const dialog = element.closest('dialog');
		const transform = getComputedStyle(element).transform;
		if (!dialog?.open) return false;
		if (transform === 'none') return true;
		const matrix = new DOMMatrixReadOnly(transform);
		return Math.abs(matrix.m41) < 0.5 && Math.abs(matrix.m42) < 0.5;
	}), { timeout: 3000 }).toBe(true);
}

async function openFilterSheet(page: import('@playwright/test').Page) {
	await page.locator('#open-filter-sheet-btn').click();
	await expect(page.locator('#filter-sheet-modal')).toBeVisible();
	await waitForSheetToSettle(page, '#filter-sheet-content');
}
async function mockAnonymousLikeApi(page: import('@playwright/test').Page, addLikeRequests: string[]) {
	const jsonHeaders = {
		'access-control-allow-origin': '*',
		'access-control-allow-headers': '*',
		'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
	};
	await page.route('**/auth/v1/**', async (route) => {
		await route.fulfill({
			status: 200,
			headers: { ...jsonHeaders, 'content-type': 'application/json' },
			body: JSON.stringify({
				access_token: '',
				refresh_token: '',
				token_type: 'bearer',
				expires_in: 0,
				user: null,
			}),
		});
	});
	await page.route('**/rest/v1/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (request.method() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: jsonHeaders });
			return;
		}
		if (request.method() === 'HEAD') {
			await route.fulfill({ status: 200, headers: jsonHeaders });
			return;
		}
		if (url.pathname.endsWith('/rpc/add_anonymous_like')) {
			addLikeRequests.push(url.pathname);
			await route.fulfill({
				status: 200,
				headers: { ...jsonHeaders, 'content-type': 'application/json' },
				body: JSON.stringify({ slug: 'knowhow/001-night-memo', like_count: 1, liked: true }),
			});
			return;
		}
		if (url.pathname.endsWith('/rpc/get_authenticated_like_state') || url.pathname.endsWith('/rpc/get_authenticated_like_slugs')) {
			await route.fulfill({
				status: 200,
				headers: { ...jsonHeaders, 'content-type': 'application/json' },
				body: JSON.stringify({ slug: 'knowhow/001-night-memo', like_count: 1, liked: true }),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			headers: { ...jsonHeaders, 'content-type': 'application/json' },
			body: JSON.stringify([]),
		});
	});
}

for (const scenario of [
	{ id: 'H-010', label: 'タイトルの一部', keyword: '夜泣き', expected: ['夜泣き対応メモ'] },
	{ id: 'H-011', label: 'Markdown説明だけに含まれる語', keyword: '子育て', expected: ['夫婦共有ログ'] },
]) {
	test(`${scenario.id} ${scenario.label}の検索結果が正しい`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		await page.locator('#search-keyword-input').fill(scenario.keyword);
		await expect.poll(() => visibleCardTitles(page)).toEqual(scenario.expected);
		await expectNoPageErrors(errors);
	});
}

test('H-012 未知の検索語は空状態になり、H-013 clearで一覧へ戻る', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await page.locator('#search-keyword-input').fill('存在しない回帰テスト語');
	await expectListState(page, 0);
	await page.locator('#search-keyword-input').fill('');
	await expectListState(page, 2);
	await expectNoPageErrors(errors);
});

test('H-008/H-009 表示形式をheadlineとgridの間で往復できる', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'headline_view');
	await expect(page.locator('[data-display-mode-option="headline_view"]')).toHaveAttribute('aria-pressed', 'true');

	await page.locator('[data-display-mode-option="grid_view"]').click();
	await expect(page).toHaveURL(/\?mode=grid_view$/);
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'grid_view');
	await expect(page.locator('[data-display-mode-option="grid_view"]')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.knowhow-gallery-view:visible')).toHaveCount(2);

	await page.locator('[data-display-mode-option="headline_view"]').click();
	await expect(page).toHaveURL(/\?mode=headline_view$/);
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'headline_view');
	await expect(page.locator('.knowhow-list-view:visible')).toHaveCount(2);
	await expectNoPageErrors(errors);
});

test('H-016 URL指定のviewを初期表示から一致させる', async ({ page }) => {
	await page.goto('/my-knowhow/?mode=grid_view');
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'grid_view');
	await expect(page.locator('html')).toHaveAttribute('data-knowhow-initial-display-mode', 'grid_view');
	await expect(page.locator('[data-display-mode-option="grid_view"]')).toHaveAttribute('aria-pressed', 'true');

	await page.goto('/?mode=grid_view');
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'grid_view');
	await expect(page.locator('html')).toHaveAttribute('data-knowhow-initial-display-mode', 'grid_view');
	await expect(page.locator('.knowhow-gallery-view:visible')).toHaveCount(2);
	await expect(page.locator('.knowhow-list-view:visible')).toHaveCount(0);

	await page.goto('/?mode=headline_view');
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'headline_view');
	await expect(page.locator('html')).toHaveAttribute('data-knowhow-initial-display-mode', 'headline_view');
	await expect(page.locator('.knowhow-gallery-view:visible')).toHaveCount(0);
	await expect(page.locator('.knowhow-list-view:visible')).toHaveCount(2);
});

test('H-017 マイリストはIndexedDB確定前にカードを表示しない', async ({ page }) => {
	await page.goto('/my-knowhow/?mode=headline_view', { waitUntil: 'commit' });
	await page.locator('#knowhow-container').waitFor({ state: 'attached' });
	const initialState = await page.locator('#knowhow-container').evaluate((container) => ({
		privateStateLoaded: container.getAttribute('data-private-state-loaded'),
		visibleCards: Array.from(container.querySelectorAll<HTMLElement>('.knowhow-card'))
			.filter((card) => getComputedStyle(card).display !== 'none').length,
	}));
	expect(initialState.privateStateLoaded).toBe('false');
	expect(initialState.visibleCards).toBe(0);
	await expect(page.locator('#knowhow-container')).toHaveAttribute('data-private-state-loaded', 'true');
});

test('H-018 グリッドの初期角丸をJS適用後と一致させる', async ({ page }) => {
	await page.goto('/?mode=grid_view');
	const radius = await page.locator('.knowhow-card').first().evaluate((card) => ({
		card: getComputedStyle(card).borderRadius,
		gallery: getComputedStyle(card.querySelector<HTMLElement>('.knowhow-gallery-view')!).borderRadius,
	}));
	expect(radius).toEqual({ card: '6px', gallery: '6px' });
});

test('H-014 phaseフィルター選択が表示・URL・chipに同期する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	await page.locator('[data-sheet-phase="pregnancy"]').click();
	await page.locator('#sheet-apply-btn').click();
	await expect(page).toHaveURL(/phase=pregnancy/);
	await expectListState(page, 1);
	await expect(page.locator('#active-chips-container button')).toContainText('妊娠中');
	await expectNoPageErrors(errors);
});

test('H-014b 月齢は複数選択をORで表示し、すべてボタンを持たない', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	await expect(page.locator('[data-sheet-phase="all"]')).toHaveCount(0);
	await page.locator('[data-sheet-phase="pregnancy"]').click();
	await page.locator('[data-sheet-phase="0-3m"]').click();
	await page.locator('#sheet-apply-btn').click();
	await expect(page).toHaveURL(/phase=pregnancy&phase=0-3m/);
	await expectListState(page, 2);
	await expect(page.locator('#active-chips-container button')).toHaveCount(2);
	await expect(page.locator('#active-chips-container')).toContainText('妊娠中');
	await expect(page.locator('#active-chips-container')).toContainText('0〜3か月');
	await expectNoPageErrors(errors);
});

test('H-019 sceneフィルター選択が表示・URL・chipに同期する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	await page.locator('[data-sheet-scene="毎日の準備"]').click();
	await page.locator('#sheet-apply-btn').click();
	expect(page.url()).toContain('scene=');
	await expectListState(page, 2);
	await expect(page.locator('#active-chips-container button')).toContainText('毎日の準備');
	await expectNoPageErrors(errors);
});

test('H-020 phaseとsceneはAND条件で絞り込む', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	await page.locator('[data-sheet-phase="pregnancy"]').click();
	await page.locator('[data-sheet-scene="毎日の準備"]').click();
	await page.locator('#sheet-apply-btn').click();
	await expectListState(page, 1);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText('夫婦共有ログ');
	await expect(page.locator('#active-chips-container button')).toHaveCount(2);
	await expectNoPageErrors(errors);
});

test('H-021 filter resetで条件・URL・空状態を初期化する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view&phase=pregnancy&scene=daily');
	await expectListState(page, 1);
	await openFilterSheet(page);
	await page.locator('#sheet-reset-btn').click();
	await expectListState(page, 2);
	await expect(page).toHaveURL(/mode=headline_view$/);
	await expect(page.locator('#active-chips-container')).toBeHidden();
	await expectNoPageErrors(errors);
});

test('H-023 favorite onlyは未favorite時に明確な空状態を表示する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	await page.locator('#sheet-fav-only').check();
	await page.locator('#sheet-apply-btn').click();
	await expectListState(page, 0);
	await expect(page.locator('#active-chips-container button')).toContainText('お気に入りのみ');
	await expectNoPageErrors(errors);
});

test('H-025 filter sheetは開閉を繰り返しても二重表示しない', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	await page.locator('#close-sheet-handle').click();
	await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
	await openFilterSheet(page);
	await page.keyboard.press('Escape');
	await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
	await expectNoPageErrors(errors);
});

test('H-026 sort sheetは選択値を保持し、再表示時に同じ選択になる', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await page.locator('#open-sort-sheet-btn').click();
	await expect(page.locator('#sort-sheet-modal')).toBeVisible();
	await waitForSheetToSettle(page, '#sort-sheet-content');
	await expect(page.locator('#filter-sheet-modal input[name="sheet-sort"]')).toHaveCount(0);
	await expect(page.locator('#sort-sheet-modal #sheet-fav-only')).toHaveCount(0);
	await page.locator('#sort-sheet-modal input[name="sheet-sort"][value="newest"]').check();
	await page.locator('#sort-sheet-apply-btn').click();
	await expect(page.locator('#active-chips-container button')).toContainText('新着順');
	await page.locator('#open-sort-sheet-btn').click();
	await waitForSheetToSettle(page, '#sort-sheet-content');
	await expect(page.locator('#sort-sheet-modal input[name="sheet-sort"][value="newest"]')).toBeChecked();
	await page.locator('#sort-sheet-reset-btn').click();
	await expectNoPageErrors(errors);
});

test('H-027 SPのフィルターシートを下へスワイプすると閉じる', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);

	await page.evaluate(() => {
		const content = document.querySelector<HTMLElement>('#filter-sheet-content');
		if (!content) throw new Error('filter content not found');
		const dispatchTouch = (type: 'touchstart' | 'touchmove' | 'touchend', clientY: number) => {
			const event = new Event(type, { bubbles: true, cancelable: true });
			const touch = { clientX: 100, clientY };
			Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch] });
			Object.defineProperty(event, 'changedTouches', { value: [touch] });
			content.dispatchEvent(event);
		};
		dispatchTouch('touchstart', 100);
		dispatchTouch('touchmove', 210);
		dispatchTouch('touchend', 210);
	});

	await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
});

test('H-028 絞り込み・並び替えボタンは矩形で有効時は文字色だけ変わる', async ({ page }) => {
	await page.goto('/?mode=headline_view');
	const filterButton = page.locator('#open-filter-sheet-btn');
	const sortButton = page.locator('#open-sort-sheet-btn');
	await expect(filterButton).toHaveClass(/rounded-xl/);
	await expect(sortButton).toHaveClass(/rounded-xl/);
	await openFilterSheet(page);
	await page.locator('[data-sheet-phase="pregnancy"]').click();
	await expect(filterButton).toHaveClass(/text-mint-600/);
	await expect(filterButton).not.toHaveClass(/bg-mint-50/);
	await expect(sortButton).not.toHaveClass(/bg-mint-50/);
	await page.locator('#sheet-apply-btn').click();
});

test('H-029 絞り込みシートは画面下端から上へ表示される', async ({ page }) => {
	await page.goto('/?mode=headline_view');
	await openFilterSheet(page);
	const sheet = page.locator('#filter-sheet-content');
	await expect(sheet).toHaveClass(/rounded-t-3xl/);
	const bounds = await sheet.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
	});
	expect(Math.abs(bounds.bottom - bounds.viewportHeight)).toBeLessThanOrEqual(1);
	expect(bounds.top).toBeGreaterThan(0);
	await page.locator('#close-sheet-handle').click();
});

test('H-030 並び替えシートも画面下端から上へ表示される', async ({ page }) => {
	await page.goto('/?mode=headline_view');
	await page.locator('#open-sort-sheet-btn').click();
	await expect(page.locator('#sort-sheet-modal')).toBeVisible();
	await waitForSheetToSettle(page, '#sort-sheet-content');
	const sheet = page.locator('#sort-sheet-content');
	await expect(sheet).toHaveClass(/rounded-t-3xl/);
	const bounds = await sheet.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
	});
	expect(Math.abs(bounds.bottom - bounds.viewportHeight)).toBeLessThanOrEqual(1);
	expect(bounds.top).toBeGreaterThan(0);
	await page.locator('#close-sort-sheet-handle').click();
});
test('O-016 Ctrl+Kで検索modalを開き、結果を絞り込んで閉じる', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/about/');
	await page.keyboard.press('Control+KeyK');
	await expect(page.locator('#search-modal')).toBeVisible();
	await expect.poll(() => page.locator('#search-results li').count(), { timeout: 8000 }).toBeGreaterThan(0);
	await page.locator('#search-input').fill('夜泣き');
	await expect(page.locator('#search-results')).toContainText('夜泣き対応メモ');
	await page.locator('#search-close-btn').click();
	await expect(page.locator('#search-modal')).toBeHidden();
	await expectNoPageErrors(errors);
});

test('O-017 search APIは公開データだけを安定したschemaで返す', async ({ page }) => {
	const response = await page.request.get('/api/search.json');
	expect(response.status()).toBe(200);
	const data = await response.json() as Array<{ type: string; title: string; url: string }>;
	expect(data.length).toBeGreaterThan(0);
	for (const item of data) {
		expect(item.type).toBeTruthy();
		expect(item.title).toBeTruthy();
		expect(item.url).toMatch(/^\//);
	}
});
test('H-005 画像のsrcと意味のあるaltが全カードに存在する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=grid_view');
	const images = page.locator('.knowhow-card .knowhow-gallery-view img');
	await expect(images).toHaveCount(2);
	for (let index = 0; index < await images.count(); index += 1) {
		await expect(images.nth(index)).toHaveAttribute('src', /^\//);
		await expect(images.nth(index)).not.toHaveAttribute('alt', '');
	}
	await expectNoPageErrors(errors);
});

test('H-015 公開grid_viewは長押し処理を持たず、直後も他の操作を受け付ける', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=grid_view');
	const container = page.locator('#knowhow-container');
	const gallery = page.locator('.knowhow-gallery-view:visible').first();

	await gallery.dispatchEvent('pointerdown', { button: 0, buttons: 1, pointerType: 'mouse' });
	await page.waitForTimeout(700);
	await gallery.dispatchEvent('pointerup', { button: 0, buttons: 0, pointerType: 'mouse' });

	await expect(container).not.toHaveAttribute('data-grid-edit-mode');
	await expect(gallery).toHaveCSS('cursor', 'default');
	await expect(page.locator('dialog[data-list-sheet][open]')).toHaveCount(0);
	await page.locator('#open-filter-sheet-btn').click();
	await expect(page.locator('#filter-sheet-modal')).toBeVisible();
	await page.locator('#close-sheet-handle').click();
	await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
	await expectNoPageErrors(errors);
});

test('H-006/H-007 一覧カードから正しい公開詳細へ遷移する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await page.locator('[data-open-checklist="001-night-memo"]:visible').click();
	await expect(page).toHaveURL(/\/knowhow\/001-night-memo\/?$/);
	await expect(page.locator('#knowhow-modal-container')).toBeVisible();
	await expect(page.locator('#knowhow-modal-container h1').first()).toContainText('夜泣き対応メモ');
	await expectNoPageErrors(errors);
});

test('H-027 公開一覧の♡は開始と同時にいいねし、同じ開始を繰り返しても一度だけ送信する', async ({ page }) => {
	const errors = collectPageErrors(page);
	const addLikeRequests: string[] = [];
	await mockAnonymousLikeApi(page, addLikeRequests);
	await page.goto('/');
	await clearPrivateRuns(page);
	await page.goto('/knowhow/');
	const heart = page.locator('.knowhow-card[data-id="001-night-memo"] .like-btn:visible').first();
	await expect(heart).toBeVisible();
	await heart.click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/progress\/?$/);
	await expectTab(page, 'progress');
	expect(addLikeRequests).toHaveLength(1);
	let runs = await readPrivateRuns(page) as Array<{ checklistId: string; deletedAt?: string }>;
	expect(runs.filter((run) => run.checklistId === 'night-memo' && !run.deletedAt)).toHaveLength(1);

	await page.goto('/knowhow/001-night-memo/');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await expect(page.locator('[data-private-actions]:visible')).toHaveCount(1);
	await expect(page.locator('[data-start-checklist]:visible')).toHaveCount(0);
	await page.evaluate(() => {
		void (window as Window & { startChecklist?: () => Promise<void> }).startChecklist?.();
	});
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/progress\/?$/);
	expect(addLikeRequests).toHaveLength(1);
	runs = await readPrivateRuns(page) as Array<{ checklistId: string; deletedAt?: string }>;
	expect(runs.filter((run) => run.checklistId === 'night-memo' && !run.deletedAt)).toHaveLength(1);
	await expectNoPageErrors(errors);
});

test('D-028 公開詳細は既存マイリストを検出して始める導線をprivate操作アイコンへ置き換える', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/knowhow/001-night-memo/');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await expect(page.locator('[data-private-actions]:visible')).toHaveCount(1);
	await expect(page.locator('[data-start-checklist]:visible')).toHaveCount(0);
	for (const label of ['チェックリストの説明を開く', 'チェックリストの進捗を開く', 'このチェックリストのメモを開く']) {
		await expect(visiblePrivateAction(page, label)).toHaveCount(1);
	}
	await expectNoPageErrors(errors);
});

test('M-001 マイリストの左スワイプ→削除→削除済み絞り込みを一連で完走する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await expectListState(page, 1);
	await swipeMyListRow(page, 'night-memo');
	const row = page.locator('.knowhow-card[data-checklist-id="night-memo"] [data-my-list-swipe-row]');
	await expect(row).toHaveAttribute('data-swipe-open', 'true');
	await expect(row.locator('[data-my-list-delete]')).toBeVisible();
	page.once('dialog', (dialog) => void dialog.accept());
	await row.locator('[data-my-list-delete]').click();
	await expectListState(page, 0);
	const deletedRun = await readPrivateRuns(page) as Array<{ checklistId: string; deletedAt?: string }>;
	expect(deletedRun.filter((run) => run.checklistId === 'night-memo' && run.deletedAt)).toHaveLength(1);

	await openFilterSheet(page);
	await expect(page.locator('#sheet-deleted-only-row')).toBeVisible();
	await page.locator('#sheet-deleted-only').check();
	await page.locator('#sheet-apply-btn').click();
	await expect(page).toHaveURL(/\/my-knowhow\/\?mode=headline_view&deleted=1$/);
	await expectListState(page, 1);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText('夜泣き対応メモ');
	await expect(page.locator('.knowhow-card:visible [data-my-list-delete]:visible')).toHaveCount(0);
	await expectNoPageErrors(errors);
});

test('M-004 公開一覧のheadline_viewでも保存済みrunの左スワイプ削除を維持する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/?mode=headline_view');
	await expectListState(page, 2);
	await swipeMyListRow(page, 'night-memo');
	const row = page.locator('.knowhow-card[data-checklist-id="night-memo"] [data-my-list-swipe-row]');
	await expect(row).toHaveAttribute('data-swipe-open', 'true');
	await expect(row.locator('[data-my-list-delete]')).toBeVisible();
	page.once('dialog', (dialog) => void dialog.accept());
	await row.locator('[data-my-list-delete]').click();
	const deletedRun = await readPrivateRuns(page) as Array<{ checklistId: string; deletedAt?: string }>;
	expect(deletedRun.filter((run) => run.checklistId === 'night-memo' && run.deletedAt)).toHaveLength(1);
	await expect(row.locator('[data-my-list-delete]')).toBeHidden();
	await expectNoPageErrors(errors);
});

test('M-003 grid_viewでは削除UIと揺れを表示しない', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/?mode=grid_view');
	await expectListState(page, 1);
	const container = page.locator('#knowhow-container');
	const card = page.locator('.knowhow-card[data-checklist-id="night-memo"]');
	await expect(container).toHaveAttribute('data-display-mode', 'grid_view');
	await expect(card.locator('[data-my-list-delete]')).toBeHidden();
	await expect(card.locator('[data-my-list-grid-delete]')).toHaveCount(0);
	await expect(container).not.toHaveAttribute('data-grid-edit-mode');
	await expect(card).toHaveCSS('animation-name', 'none');
	await expect(card.locator('.knowhow-gallery-view')).toHaveCSS('cursor', 'default');
	await expect(card.locator('.knowhow-gallery-view img')).toHaveAttribute('draggable', 'false');
	await expect(card.locator('[data-my-list-swipe-content]')).toHaveCSS('transition-duration', '0s');
	const swipeTransform = await card.locator('[data-my-list-swipe-content]').evaluate((element) => getComputedStyle(element).transform);
	expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(swipeTransform);
	await expectNoPageErrors(errors);
});
test('M-002 削除済み表示は削除済みと未削除を同時に表示する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeDeletedRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await expectListState(page, 1);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText('夫婦共有ログ');
	await openFilterSheet(page);
	await expect(page.locator('#sheet-deleted-only-row')).toBeVisible();
	await page.locator('#sheet-deleted-only').check();
	await page.locator('#sheet-apply-btn').click();
	await expect(page).toHaveURL(/deleted=1/);
	await expectListState(page, 2);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText(['夜泣き対応メモ', '夫婦共有ログ']);
	await expect(page.locator('.knowhow-card[data-checklist-id="night-memo"] [data-my-list-delete]')).toBeHidden();
	await expect(page.locator('.knowhow-card[data-checklist-id="family-log"] [data-my-list-delete]')).toBeVisible();
	await expectNoPageErrors(errors);
});

test('M-005 マイリストの表示条件はお気に入りと削除済みをORで評価する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeDeletedRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/?mode=grid_view');
	await expectListState(page, 1);
	await page.evaluate(() => {
		window.dispatchEvent(new CustomEvent('article-like-changed', {
			detail: { slug: 'knowhow/002-family-log', liked: true, likeCount: 1 },
		}));
	});
	await page.locator('#open-filter-sheet-btn').click();
	await page.locator('#sheet-fav-only').check();
	await page.locator('#sheet-deleted-only').check();
	await page.locator('#sheet-apply-btn').click();
	await expectListState(page, 2);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText(['夜泣き対応メモ', '夫婦共有ログ']);
	await expectNoPageErrors(errors);
});

test('D-030 マイリストの絞り込み・並び替えと削除済み表示を上下移動へ引き継ぐ', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeDeletedRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await expectListState(page, 1);
	await page.evaluate(() => {
		window.dispatchEvent(new CustomEvent('article-like-changed', {
			detail: { slug: 'knowhow/002-family-log', liked: true, likeCount: 10 },
		}));
	});

	await openFilterSheet(page);
	await page.locator('#sheet-deleted-only').check();
	await page.locator('#sheet-apply-btn').click();
	await expectListState(page, 2);
	await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
	await page.locator('#open-sort-sheet-btn').click();
	await waitForSheetToSettle(page, '#sort-sheet-content');
	await page.locator('#sort-sheet-modal input[name="sheet-sort"][value="popular"]').check();
	await page.locator('#sort-sheet-apply-btn').click();

	const listState = await page.evaluate(() => {
		const cards = Array.from(document.querySelectorAll<HTMLElement>('.knowhow-card'))
			.filter((card) => card.style.display !== 'none')
			.sort((left, right) => Number(getComputedStyle(left).order) - Number(getComputedStyle(right).order));
		return {
			titles: cards.map((card) => card.querySelector('h2')?.textContent?.trim()),
			cache: JSON.parse(sessionStorage.getItem('knowhow-list-cache') ?? 'null'),
		};
	});
	expect(listState.titles).toEqual(['夫婦共有ログ', '夜泣き対応メモ']);
	expect(listState.cache).toMatchObject({
		view: 'my',
		deletedDisplay: true,
		sort: 'popular',
		orderedIds: ['002-family-log', '001-night-memo'],
	});

	await openPrivateDetailFromList(page, '002-family-log');
	const container = page.locator('#knowhow-modal-container');
	await expect(container).toHaveAttribute('data-private-state-loaded', 'true');
	await expect(container).not.toHaveAttribute('data-prev');
	await expect(container).toHaveAttribute('data-next', '/my-knowhow/001-night-memo/');
	await container.dispatchEvent('wheel', { deltaY: 120 });
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/?$/);
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-prev', '/my-knowhow/002-family-log/');
	await expect(page.locator('#knowhow-modal-container')).not.toHaveAttribute('data-next');
	await expectNoPageErrors(errors);
});

for (const item of ids) {
	test(`D-001/D-002 ${item.id} 公開詳細のlandmarkとMarkdown表示`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/knowhow/${item.id}/`);
		await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-knowhow-id', item.id);
		await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-checklist-id', item.checklistId);
		await expect(page.locator('#knowhow-modal-container h1').first()).toContainText(item.title);
		await expect(page.locator('#caption-content')).not.toHaveText('');
		await expect(page.locator('[data-checklist-template]')).toHaveCount(1);
		await expect(page.locator('[data-private-actions]:visible')).toHaveCount(0);
		await expectNoPageErrors(errors);
	});

	test(`D-007/D-008 ${item.id} public detailでは説明だけが公開される`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/knowhow/${item.id}/`);
		await expect(page.locator('#tab-btn-desc')).toHaveAttribute('aria-selected', 'true');
		await expect(page.locator('#tab-content-desc')).toContainText(item.title);
		await expect(page.locator('[data-start-checklist]:visible')).toHaveCount(1);
		await expect(page.locator('[data-private-tab]:visible')).toHaveCount(0);
		await expectNoPageErrors(errors);
	});

	test(`D-011/D-012 ${item.id} privateのprogress/memo直接URLが復元される`, async ({ page }) => {
		const errors = collectPageErrors(page);
		for (const tab of ['progress', 'memo'] as const) {
			await page.goto(`/my-knowhow/${item.id}/${tab}/`);
			await expect(page.locator('#knowhow-modal-container')).toBeVisible();
			await expectTab(page, tab);
			await expect(page.locator('[data-private-tab]:visible')).toHaveCount(2);
		}
		await expectNoPageErrors(errors);
	});

	test(`D-013 ${item.id} private baseからmemoへアイコンで遷移する`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/my-knowhow/${item.id}/`);
		const memoButton = visiblePrivateAction(page, 'このチェックリストのメモを開く');
		await expect(memoButton).toHaveCount(1);
		await memoButton.click();
		await expect(page).toHaveURL(new RegExp(`/my-knowhow/${item.id}/memo/?$`));
		await expectTab(page, 'memo');
		await expectNoPageErrors(errors);
	});

	test(`D-014 ${item.id} private base→memo→close→memoの操作列を保持する`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/my-knowhow/${item.id}/`);
		await visiblePrivateAction(page, 'このチェックリストのメモを開く').click();
		await expectTab(page, 'memo');
		await page.locator('button[aria-label="詳細パネルを閉じる"]').click();
		await expect(page).toHaveURL(new RegExp(`/my-knowhow/${item.id}/?$`));
		await visiblePrivateAction(page, 'このチェックリストのメモを開く').click();
		await expect(page).toHaveURL(new RegExp(`/my-knowhow/${item.id}/memo/?$`));
		await expectTab(page, 'memo');
		await expectNoPageErrors(errors);
	});

	test(`D-013/D-016 ${item.id} progress→memo→説明を一つずつ切り替える`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/my-knowhow/${item.id}/progress/`);
		await expectTab(page, 'progress');
		await page.locator('#tab-btn-memo').click();
		await expectTab(page, 'memo');
		await page.locator('#tab-btn-desc').click();
		await expectTab(page, 'desc');
		await expect(page.locator('#tab-btn-progress')).toHaveAttribute('aria-selected', 'false');
		await expect(page.locator('#tab-btn-memo')).toHaveAttribute('aria-selected', 'false');
		await expectNoPageErrors(errors);
	});

	test(`D-015 ${item.id} memo URLをreloadしてもメモが開いている`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/my-knowhow/${item.id}/memo/`);
		await expectTab(page, 'memo');
		await page.reload();
		await expectTab(page, 'memo');
		await expectNoPageErrors(errors);
	});
}

for (const item of ids) {
	test(`D-020/D-021 ${item.id} 公開詳細の開始操作はcanonical private progressへ遷移する`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(`/knowhow/${item.id}/`);
		await page.locator("button[aria-label='このチェックリストを始める']:visible").click();
		await expect(page).toHaveURL(new RegExp(`/my-knowhow/${item.id}/progress/?$`));
		await expectTab(page, 'progress');
		await expect.poll(() => page.locator('#tab-content-progress [data-checklist-item-id]').count(), { timeout: 8000 }).toBeGreaterThan(0);
		await expectNoPageErrors(errors);
	});
}

test('D-017/D-018 private001のwheelでprivate002へ移動し、family templateを表示する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/001-night-memo/');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await page.locator('#knowhow-modal-container').dispatchEvent('wheel', { deltaY: 120 });
	await expect(page).toHaveURL(/\/my-knowhow\/002-family-log\/?$/);
	await expect(page.locator('#knowhow-modal-container h1').first()).toContainText('夫婦共有ログ');
	expect(await page.locator('[data-checklist-template]').textContent()).toContain('family-log');
	await expectNoPageErrors(errors);
});

test('D-019 private002の末尾wheelで不正な次URLへ進まない', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/002-family-log/');
	await page.locator('#knowhow-modal-container').dispatchEvent('wheel', { deltaY: 120 });
	await page.waitForTimeout(400);
	await expect(page).toHaveURL(/\/my-knowhow\/002-family-log\/?$/);
	await expectNoPageErrors(errors);
});

test('D-029 削除済みprivate詳細から上下移動で別のマイリスト項目へ進まない', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeDeletedRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/001-night-memo/');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await expect(page.locator('#knowhow-modal-container')).not.toHaveAttribute('data-next');
	await expect(page.locator('#knowhow-modal-container')).not.toHaveAttribute('data-prev');
	await page.locator('#knowhow-modal-container').dispatchEvent('wheel', { deltaY: 120 });
	await page.waitForTimeout(400);
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/?$/);
	await expectNoPageErrors(errors);
});

test('D-023 private list→detail→一覧へ戻るでreturn-urlを使う', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await page.waitForSelector("[data-open-checklist='001-night-memo']:visible");
	await openPrivateDetailFromList(page, '001-night-memo');
	const isMobileViewport = await page.evaluate(() => window.innerWidth < 1024);
	if (isMobileViewport) {
		const mobileBackButton = page.locator('button[aria-label="チェックリスト一覧へ戻る"]');
		await expect(mobileBackButton).toBeVisible();
		await mobileBackButton.click();
	} else {
		await page.goBack({ waitUntil: 'domcontentloaded' });
	}
	await expect(page).toHaveURL(/\/my-knowhow\/\?mode=headline_view$/);
	await expectListState(page, 1);
	await expectNoPageErrors(errors);
});
test('D-024 mode=myの公開詳細URLはprivate UIへ安全にfallbackする', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/knowhow/001-night-memo/?mode=my');
	await expect(page.locator('[data-private-actions]:visible')).toHaveCount(1);
	await expect(page.locator('[data-public-only]:visible')).toHaveCount(0);
	await expectNoPageErrors(errors);
});

test('D-027 unknown tabは例外を出さず説明へfallbackする', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/my-knowhow/001-night-memo/?tab=unknown');
	await expectTab(page, 'desc');
	await expectNoPageErrors(errors);
});

test('K-001/K-004 private progressのtemplateと6項目が一致する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/knowhow/001-night-memo/');
	await page.locator("button[aria-label='このチェックリストを始める']:visible").click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/progress\/?$/);
	await expect.poll(() => page.locator('#tab-content-progress [data-checklist-item-id]').count(), { timeout: 8000 }).toBe(6);
	await expect(page.locator('#tab-content-progress [data-checklist-item-id] input[type="checkbox"]')).toHaveCount(6);
	await expectNoPageErrors(errors);
});

test('K-005 progressのcheckbox変更がreload後も維持される', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/knowhow/001-night-memo/');
	await page.locator("button[aria-label='このチェックリストを始める']:visible").click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/progress\/?$/);
	const checkbox = page.locator('#tab-content-progress input[type="checkbox"]').first();
	await expect(checkbox).toBeVisible();
	await checkbox.check();
	await expect(checkbox).toBeChecked();
	await expect.poll(async () => {
		const runs = await readPrivateRuns(page) as Array<{
			checklistId: string;
			items: Array<{ checked?: boolean }>;
		}>;
		return runs.find((run) => run.checklistId === 'night-memo')?.items[0]?.checked ?? false;
	}, { timeout: 8000 }).toBe(true);
	await page.reload();
	await expect(page.locator('#tab-content-progress input[type="checkbox"]').first()).toBeChecked();
	await expectNoPageErrors(errors);
});

test('K-006 memoは表示本文を直接編集し、文字数制限なく保存できる', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/002-family-log/memo/');
	const editor = page.locator('[data-note-editor]');
	await expect(editor).toHaveCount(1);
	await expect(editor).toHaveAttribute('contenteditable', 'true');
	await expect(editor).toHaveAttribute('role', 'textbox');
	const longNote = 'メモ'.repeat(1800);
	await editor.fill(longNote);
	await expect.poll(async () => {
		const runs = await readPrivateRuns(page) as Array<{ checklistId: string; note?: string }>;
		return runs.find((run) => run.checklistId === 'family-log')?.note ?? '';
	}, { timeout: 8000 }).toBe(longNote);
	await page.reload();
	await expect(page.locator('[data-note-editor]')).toHaveText(longNote);
	await expectNoPageErrors(errors);
});
test('K-007/K-008 progress編集→保存→reloadで項目文言を維持する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/001-night-memo/progress/');
	await expect(page.locator('[data-edit-checklist]:visible')).toBeVisible();
	await page.locator('[data-edit-checklist]:visible').click();
	const editor = page.locator('[data-item-editor]').first();
	await editor.fill('E2Eで変更した項目');
	await page.locator('[data-save-edit]:visible').click();
	await expect(page.locator('[data-item-editor]')).toHaveCount(0);
	await page.reload();
	await expect(page.locator('#tab-content-progress')).toContainText('E2Eで変更した項目');
	await expectNoPageErrors(errors);
});

test('K-011 progress編集→custom item追加→保存で追加項目を表示する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/001-night-memo/progress/');
	await page.locator('[data-edit-checklist]:visible').click();
	await page.locator('[data-add-item] input[name="label"]').fill('E2E追加項目');
	await page.locator('[data-add-item] button[type="submit"]').click();
	await expect(page.locator('[data-item-editor]')).toHaveCount(7);
	await page.locator('[data-save-edit]:visible').click();
	await expect(page.locator('[data-item-editor]')).toHaveCount(0);
	await expect(page.locator('#tab-content-progress')).toContainText('E2E追加項目');
	await expectNoPageErrors(errors);
});
