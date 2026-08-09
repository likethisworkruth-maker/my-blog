import path from 'node:path';
import { test, expect } from '../auth-fixture';

const defaultState = path.resolve('tests/fixtures/auth/authenticated.storageState.json');
const authState = process.env.E2E_AUTH_STATE ? path.resolve(process.env.E2E_AUTH_STATE) : defaultState;
test.use({ storageState: authState });

function collectPageErrors(page: import('@playwright/test').Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	return errors;
}

async function expectNoPageErrors(errors: string[]) {
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(errors).toEqual([]);
}

test.describe('ログイン済み回帰テスト', () => {
	test('保存済みauth stateでアカウントUIを表示する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/');
		await expect(page.locator('[data-google-signed-in]')).toBeVisible();
		await expect(page.locator('[data-google-login]')).toBeHidden();
		await page.locator('[data-google-account-trigger]').click();
		const email = page.locator('[data-google-email]');
		await expect(email).not.toHaveText('');
		if (process.env.E2E_AUTH_EMAIL) await expect(email).toHaveText(process.env.E2E_AUTH_EMAIL);
		await expectNoPageErrors(errors);
	});

	test('Astro画面遷移後もログイン状態を維持する', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/');
		await page.locator('[data-open-checklist="002-family-log"]:visible').click();
		await expect(page).toHaveURL(/\/knowhow\/002-family-log\/?$/);
		await expect(page.locator('#knowhow-modal-container')).toBeVisible();
		const storedSession = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
		expect(storedSession).toContain('e2e-authenticated@example.test');
		await expectNoPageErrors(errors);
	});
});
