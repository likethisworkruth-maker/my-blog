import { test, expect } from '../auth-fixture';

const storageKey = 'kids-growth-memo-app-storage-v1';

test.beforeEach(async ({ page }) => {
	await page.addInitScript((key) => {
		localStorage.setItem(key, JSON.stringify({
			version: 1,
			selectedAge: '1 year',
			language: 'ja',
			milestoneAnswers: {
				'1 year': Object.fromEntries(Array.from({ length: 10 }, (_, index) => [String(index), 'notYet'])),
			},
		}));
	}, storageKey);
	await page.goto('/cdc/');
	await page.locator('[data-toggle-results]').click();
});

test('先月分の回答・変更・解除を続けても確認ポップアップとスクロール位置を維持する', async ({ page }) => {
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	const answer = (id: string, value: string) => dialog.locator(`[data-answer-id="${id}"][data-answer-value="${value}"]`);
	await answer('0', 'yes').click();
	await expect(dialog).toBeVisible();
	await expect(answer('0', 'yes')).toHaveAttribute('aria-pressed', 'true');
	await expect(answer('1', 'yes')).toHaveAttribute('aria-pressed', 'false');
	await expect(answer('1', 'notYet')).toHaveAttribute('aria-pressed', 'false');
	await answer('0', 'notYet').click();
	await expect(dialog).toBeVisible();
	await expect(answer('0', 'notYet')).toHaveAttribute('aria-pressed', 'true');
	await expect(answer('0', 'yes')).toHaveAttribute('aria-pressed', 'false');
	await answer('0', 'notYet').click();
	await expect(dialog).toBeVisible();
	await expect(answer('0', 'notYet')).toHaveAttribute('aria-pressed', 'false');

	await answer('12', 'notYet').scrollIntoViewIfNeeded();
	const scrollTop = await dialog.evaluate((element) => element.scrollTop);
	expect(scrollTop).toBeGreaterThan(0);
	await answer('12', 'notYet').click();
	await expect(dialog).toBeVisible();
	await expect(answer('12', 'notYet')).toHaveAttribute('aria-pressed', 'true');
	expect(await dialog.evaluate((element) => element.scrollTop)).toBe(scrollTop);
	await answer('11', 'yes').click();
	await expect(dialog).toBeVisible();
	await expect(answer('11', 'yes')).toHaveAttribute('aria-pressed', 'true');

	const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).milestoneAnswers, storageKey);
	expect(saved['9 mo']).toEqual({ '11': 'yes', '12': 'notYet' });
	expect(Object.values(saved['1 year'])).toEqual(Array(10).fill('notYet'));
	await dialog.getByRole('button', { name: '確認を終える', exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.locator('[data-open-review]').click();
	await expect(dialog).toBeVisible();
	await expect(answer('12', 'notYet')).toHaveAttribute('aria-pressed', 'true');
	await expect(answer('11', 'yes')).toHaveAttribute('aria-pressed', 'true');
	await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
	await expect(dialog).toHaveCount(0);
});
