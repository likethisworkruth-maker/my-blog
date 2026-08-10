import path from 'node:path';
import { test, expect } from '@playwright/test';
import { collectPageErrors, expectListState, expectNoPageErrors, visibleCardTitles } from '../helpers';

test.use({ storageState: path.resolve('tests/fixtures/auth/anonymous.storageState.json') });

const phases = [
	{ slug: 'pregnancy', expected: 1 },
	{ slug: '0-3m', expected: 2 },
	{ slug: '4-6m', expected: 2 },
	{ slug: '7-11m', expected: 2 },
	{ slug: '1y-plus', expected: 2 },
] as const;

const scenes = [
	{ slug: 'outing', expected: 0 },
	{ slug: 'medical', expected: 0 },
	{ slug: 'daily', expected: 2 },
	{ slug: 'travel', expected: 0 },
	{ slug: 'nursery', expected: 0 },
	{ slug: 'disaster', expected: 0 },
] as const;

type SheetMotionSample = {
	type: 'initial' | 'transitionend';
	top: number;
	bottom: number;
	viewportHeight: number;
	dialogClass: string;
	translatedTop: number;
	activeAnimationCount: number;
};

async function captureSheetOpenMotion(
	page: import('@playwright/test').Page,
	triggerSelector: string,
	contentSelector: string,
) {
	await expect.poll(() => page.evaluate(() => Boolean(document.querySelector(
		'[data-knowhow-list-initialized="true"], [data-content-list][data-list-initialized="true"]',
	)))).toBe(true);
	const content = page.locator(contentSelector);
	await content.evaluate(async (element, sheetTriggerSelector) => {
		type MotionWindow = Window & { __listSheetMotion?: SheetMotionSample[] };
		const motionWindow = window as MotionWindow;
		motionWindow.__listSheetMotion = [];
		const record = (type: SheetMotionSample['type']) => {
			const rect = element.getBoundingClientRect();
			const dialog = element.closest('dialog');
			const style = getComputedStyle(element);
			const translateY = style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42;
			motionWindow.__listSheetMotion?.push({
				type,
				top: rect.top,
				bottom: rect.bottom,
				viewportHeight: window.innerHeight,
				dialogClass: dialog?.className ?? '',
				translatedTop: (element as HTMLElement).offsetTop + translateY,
				activeAnimationCount: element.getAnimations().length,
			});
		};
		const trigger = document.querySelector(sheetTriggerSelector);
		if (!trigger) throw new Error(`sheet trigger not found: ${sheetTriggerSelector}`);
		const recordTransformEnd = (event: Event) => {
			const transitionEvent = event as TransitionEvent;
			if (event.target !== element || transitionEvent.propertyName !== 'transform') return;
			element.removeEventListener('transitionend', recordTransformEnd);
			record('transitionend');
		};
		element.addEventListener('transitionend', recordTransformEnd);
		// clickは同期的にアプリ側のハンドラーを完了する。次のrequestAnimationFrameへ
		// 制御を返した後、初期状態を描画する1フレーム目で画面下外の位置を記録する。
		(trigger as HTMLElement).click();
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		record('initial');
	}, triggerSelector);
	await expect.poll(() => page.evaluate(() => {
		const motionWindow = window as Window & { __listSheetMotion?: SheetMotionSample[] };
		return motionWindow.__listSheetMotion?.length ?? 0;
	}), { timeout: 3000 }).toBe(2);

	return page.evaluate(() => {
		const motionWindow = window as Window & { __listSheetMotion?: SheetMotionSample[] };
		return motionWindow.__listSheetMotion ?? [];
	});
}

const listRoutes = [
	{ id: 'R-001', label: '公開ルート', url: '/?mode=headline_view', expected: 2 },
	{ id: 'R-002', label: '公開knowhowルート', url: '/knowhow/?mode=headline_view', expected: 2 },
	...phases.map((phase) => ({
		id: `R-012-${phase.slug}`,
		label: `phase=${phase.slug}`,
		url: `/knowhow/phase/${phase.slug}/?mode=headline_view`,
		expected: phase.expected,
	})),
	...scenes.map((scene) => ({
		id: `R-016-${scene.slug}`,
		label: `scene=${scene.slug}`,
		url: `/knowhow/scene/${scene.slug}/?mode=headline_view`,
		expected: scene.expected,
	})),
	...phases.flatMap((phase) => scenes.map((scene) => ({
		id: `R-028-${phase.slug}-${scene.slug}`,
		label: `${phase.slug} + ${scene.slug}`,
		url: `/knowhow/phase/${phase.slug}/scene/${scene.slug}/?mode=headline_view`,
		expected: phase.slug === 'pregnancy' && scene.slug === 'daily' ? 1
			: phase.slug !== 'pregnancy' && scene.slug === 'daily' ? 2
			: 0,
	}))),
];

for (const route of listRoutes) {
	test(`${route.id} 一覧ルート ${route.label} の表示件数と空状態`, async ({ page }) => {
		const errors = collectPageErrors(page);
		const response = await page.goto(route.url);
		expect(response?.status()).toBe(200);
		const header = page.locator('body > div > header');
		const isSp = await page.evaluate(() => window.innerWidth < 1024);
		if (isSp) await expect(header).toBeHidden();
		else await expect(header).toBeVisible();
		await expect(page.locator('body > div > main')).toBeVisible();
		if (route.expected > 0) await expect(page.locator('#knowhow-container')).toBeVisible();
		await expectListState(page, route.expected);
		if (route.expected > 0) {
			await expect(page.locator('.knowhow-card:visible h2')).not.toHaveCount(0);
		}
		await expectNoPageErrors(errors);
	});
}

const publicPages = [
	{ id: 'R-030', label: 'おすすめ', url: '/recommend/' },
	{ id: 'R-031', label: 'アプリ一覧', url: '/apps/' },
	{ id: 'R-032', label: 'アイテム一覧', url: '/items/' },
	{ id: 'R-033', label: '育児ログ一覧', url: '/logs/' },
	{ id: 'R-034', label: 'サイトポリシー', url: '/policy/' },
	{ id: 'R-035', label: '概要', url: '/about/' },
];

for (const route of publicPages) {
	test(`${route.id} 共通ページ ${route.label} が白画面にならない`, async ({ page }) => {
		const errors = collectPageErrors(page);
		const response = await page.goto(route.url);
		expect(response?.status()).toBe(200);
		await expect(page.locator('body > div > main')).toBeVisible();
		await expect(page.locator('body > div > main')).not.toHaveText('');
		await expectNoPageErrors(errors);
	});
}

test('R-036 unknown queryでも公開一覧が安全に初期化される', async ({ page }) => {
	const errors = collectPageErrors(page);
	const response = await page.goto('/?mode=unknown&phase=unknown&scene=unknown');
	expect(response?.status()).toBe(200);
	await expectListState(page, 2);
	await expectNoPageErrors(errors);
});

test('R-038 SP表示では共通ヘッダーを完全に非表示にする', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/my-knowhow/?mode=grid_view');
	await expect(page.locator('[data-site-header]')).toBeHidden();
	await expect(page.locator('footer.fixed')).toBeVisible();
});

test('R-039 コンテンツ一覧の絞り込み・並び替えシートを共通動作にする', async ({ page }) => {
	for (const url of ['/apps/', '/items/', '/logs/']) {
		await page.goto(url);
		await expect(page.locator('[data-content-list]')).toHaveAttribute('data-list-initialized', 'true');

		await page.locator('#open-filter-sheet-btn').click();
		await expect(page.locator('#filter-sheet-modal')).toBeVisible();
		await expect(page.locator('#sheet-section-filter')).toBeVisible();
		await expect.poll(async () => page.locator('#filter-sheet-content').evaluate((content) => {
			return Math.round(window.innerHeight - content.getBoundingClientRect().bottom);
		})).toBe(0);
		await page.locator('#sheet-apply-btn').click();
		await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

		await page.locator('#open-sort-sheet-btn').click();
		await expect(page.locator('#sheet-section-sort')).toBeVisible();
		await page.locator('#sheet-apply-btn').click();
		await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
	}
});

test('R-040 共有モーダルを通常のイベント処理で開閉する', async ({ page }) => {
	await page.goto('/apps/002-family-log/');
	await page.locator('[data-share-trigger]').click();
	await expect(page.locator('#share-modal')).toBeVisible();
	await expect(page.locator('[data-share-platform="x"]')).toHaveAttribute('href', /twitter\.com\/intent\/tweet/);
	await page.locator('#share-cancel').click();
	await expect(page.locator('#share-modal[open]')).toHaveCount(0);
});

test('R-041 knowhow一覧の絞り込みシートを画面下端に固定する', async ({ page }) => {
	for (const url of ['/?mode=headline_view', '/my-knowhow/?mode=headline_view']) {
		await page.goto(url);
		await page.locator('#open-filter-sheet-btn').click();
		await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(1);
		await expect.poll(() => page.locator('#filter-sheet-content').evaluate((content) => {
			return Math.round(window.innerHeight - content.getBoundingClientRect().bottom);
		})).toBe(0);
		await page.locator('#sheet-apply-btn').click();
		await expect(page.locator('#filter-sheet-modal[open]')).toHaveCount(0);
	}
});

test('R-042 PCのシートハンドルはドラッグせず、他の操作を阻害しない', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/my-knowhow/?mode=grid_view');
	await page.locator('#open-sort-sheet-btn').click();
	const handle = page.locator('#sort-sheet-content [data-list-sheet-handle]');
	await expect(handle).toHaveCSS('cursor', 'default');
	const bounds = await handle.boundingBox();
	if (!bounds) throw new Error('sort sheet handle not found');
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 180);
	await page.mouse.up();
	await page.locator('#sort-sheet-modal input[name="sheet-sort"][value="newest"]').check();
	await expect(page.locator('#sort-sheet-modal input[name="sheet-sort"][value="newest"]')).toBeChecked();
});

test('R-043 絞り込み・並び替えシートは必ず画面下の外側から下端へ上昇する', async ({ page }) => {
	const cases = [
		{ url: '/?mode=headline_view', trigger: '#open-filter-sheet-btn', content: '#filter-sheet-content' },
		{ url: '/?mode=headline_view', trigger: '#open-sort-sheet-btn', content: '#sort-sheet-content' },
		{ url: '/items/', trigger: '#open-filter-sheet-btn', content: '#filter-sheet-content' },
		{ url: '/items/', trigger: '#open-sort-sheet-btn', content: '#filter-sheet-content' },
	] as const;

	for (const target of cases) {
		await page.goto(target.url);
		const samples = await captureSheetOpenMotion(page, target.trigger, target.content);
		const start = samples.find((sample) => sample.type === 'initial');
		const end = samples.find((sample) => sample.type === 'transitionend');
		expect(start).toBeDefined();
		expect(end).toBeDefined();
		if (!start || !end) continue;

		expect(start.dialogClass).not.toContain('is-open');
		expect(start.activeAnimationCount).toBe(0);
		expect(start.translatedTop).toBeGreaterThanOrEqual(start.viewportHeight - 1);
		expect(end.dialogClass).toContain('is-open');
		expect(Math.abs(end.bottom - end.viewportHeight)).toBeLessThanOrEqual(1);

		await page.keyboard.press('Escape');
		await expect(page.locator('dialog[data-list-sheet][open]')).toHaveCount(0);
	}
});

test('R-037 Markdownのタイトルと説明が画面に存在する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/?mode=headline_view');
	await expectListState(page, 2);
	await expect(page.locator('.knowhow-card h2')).toHaveText(['夜泣き対応メモ', '夫婦共有ログ']);
	const titles = await visibleCardTitles(page);
	expect(titles).toEqual(['夜泣き対応メモ', '夫婦共有ログ']);
	await expect(page.locator('.knowhow-summary')).toHaveCount(2);
	await expectNoPageErrors(errors);
});
