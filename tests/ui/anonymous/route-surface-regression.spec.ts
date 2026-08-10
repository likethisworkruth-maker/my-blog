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
