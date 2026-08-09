import path from 'node:path';
import { test, expect } from '@playwright/test';
import { collectPageErrors, expectNoPageErrors } from '../helpers';

test.use({ storageState: path.resolve('tests/fixtures/auth/anonymous.storageState.json') });


test.describe('未ログイン回帰テスト', () => {
	test('ルートのMarkdownカードがJS初期化後も表示される', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		const cards = page.locator('.knowhow-card');
		await expect(cards).toHaveCount(2);
		await expect(page.locator('#knowhow-empty')).toBeHidden();
		await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'headline_view');
		const titles = (await page.locator('.knowhow-card h2').allTextContents()).map((title) => title.trim());
		expect(titles).toEqual(['夜泣き対応メモ', '夫婦共有ログ']);
		await expectNoPageErrors(errors);
	});

	test('Markdownの説明文が検索対象になる', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		await page.locator('#search-keyword-input').fill('子育て');
		await expect(page.locator('.knowhow-card:visible')).toHaveCount(1);
		await expect(page.locator('.knowhow-card:visible h2')).toHaveText('夫婦共有ログ');
		await expectNoPageErrors(errors);
	});

	test('表示形式切り替えがURLとカード表示へ反映される', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/?mode=headline_view');
		await page.locator('[data-display-mode-option="grid_view"]').click();
		await expect(page).toHaveURL(/\/\?mode=grid_view$/);
		await expect(page.locator('#knowhow-container')).toHaveAttribute('data-display-mode', 'grid_view');
		await expect(page.locator('.knowhow-card')).toHaveCount(2);
		await expectNoPageErrors(errors);
	});

	test('公開詳細の初期化でReferenceErrorを出さず開始関数を登録する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/knowhow/002-family-log/');
		await expect(page.locator('#knowhow-modal-container')).toBeVisible();
		await expect(page.locator('[data-checklist-template]')).toHaveCount(1);
		await expect.poll(() => page.evaluate(() => typeof (window as Window & { startChecklist?: unknown }).startChecklist)).toBe('function');
		await expectNoPageErrors(errors);
	});

	test('始めるアイコンがcanonical private progressへ遷移する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/knowhow/002-family-log/');
		const startButtons = page.locator('button[aria-label="このチェックリストを始める"]:visible');
		await expect(startButtons).toHaveCount(1);
		await startButtons.click();
		await expect(page).toHaveURL(/\/my-knowhow\/002-family-log\/progress\/?$/);
		await expect(page.locator('#tab-content-progress')).toBeVisible();
		await expectNoPageErrors(errors);
	});

	test('private memoの直接URLを復元する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/my-knowhow/002-family-log/memo/');
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
