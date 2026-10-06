import path from 'node:path';
import { test, expect } from '@playwright/test';
import { collectPageErrors, expectNoPageErrors } from '../helpers';

test.use({ storageState: path.resolve('tests/fixtures/auth/anonymous.storageState.json') });


test.describe('未ログイン回帰テスト', () => {
	test('ルートのMarkdownカードがJS初期化後も表示される', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		const cards = page.locator('.knowhow-card');
		await expect(cards).toHaveCount(12);
		await expect(page.locator('#knowhow-empty')).toBeHidden();
		await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'headline_view');
		const titles = (await page.locator('.knowhow-card h2').allTextContents()).map((title) => title.trim());
		expect(titles).toEqual([
			'生後2か月ごろの発達チェック',
			'生後4か月ごろの発達チェック',
			'生後6か月ごろの発達チェック',
			'生後9か月ごろの発達チェック',
			'1歳ごろの発達チェック',
			'1歳3か月ごろの発達チェック',
			'1歳6か月ごろの発達チェック',
			'2歳ごろの発達チェック',
			'2歳6か月ごろの発達チェック',
			'3歳ごろの発達チェック',
			'4歳ごろの発達チェック',
			'5歳ごろの発達チェック',
		]);
		await expectNoPageErrors(errors);
	});

	test('Markdownの説明文が検索対象になる', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		await page.locator('#search-keyword-input').fill('4か月');
		await expect(page.locator('.knowhow-card:visible')).toHaveCount(1);
		await expect(page.locator('.knowhow-card:visible h2')).toHaveText('生後4か月ごろの発達チェック');
		await expectNoPageErrors(errors);
	});

	test('表示形式切り替えがURLとカード表示へ反映される', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		await page.locator('[data-display-mode-option="grid_view"]').click();
		await expect(page).toHaveURL(/\/\?mode=grid_view$/);
		await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'grid_view');
		await expect(page.locator('.knowhow-card')).toHaveCount(12);
		await expectNoPageErrors(errors);
	});

	test('公開詳細の初期化でReferenceErrorを出さず開始関数を登録する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/knowhow/004-cdc-4-months/');
		await expect(page.locator('#knowhow-modal-container')).toBeVisible();
		await expect(page.locator('[data-checklist-template]')).toHaveCount(1);
		await expect.poll(() => page.evaluate(() => typeof (window as Window & { startChecklist?: unknown }).startChecklist)).toBe('function');
		await expectNoPageErrors(errors);
	});

	test('始めるアイコンがcanonical private progressへ遷移する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/knowhow/004-cdc-4-months/');
		const startButtons = page.locator('button[aria-label="このチェックリストを始める"]:visible');
		await expect(startButtons).toHaveCount(1);
		await startButtons.click();
		await expect(page).toHaveURL(/\/my-knowhow\/004-cdc-4-months\/progress\/?$/);
		await expect(page.locator('#tab-content-progress')).toBeVisible();
		await expectNoPageErrors(errors);
	});

	test('private memoの直接URLを復元する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/my-knowhow/004-cdc-4-months/memo/');
		await expect(page.locator('#tab-btn-memo')).toHaveAttribute('aria-selected', 'true');
		await expect(page.locator('#tab-content-memo')).toBeVisible();
		await expectNoPageErrors(errors);
	});

	test('データがないマイリストは公開カードを表示しない', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/my-knowhow/');
		await expect(page.locator('#knowhow-empty')).toBeVisible();
		await expect(page.locator('.knowhow-card:visible')).toHaveCount(0);
		await expectNoPageErrors(errors);
	});
});
