import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4321';
const outputPath = path.resolve(process.env.E2E_AUTH_STATE || 'tests/fixtures/auth/authenticated.real.storageState.json');

await mkdir(path.dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

try {
	await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
	console.log('ブラウザでGoogleログインを完了してください。完了すると自動保存します。');
	await page.waitForSelector('[data-google-signed-in]', { state: 'visible', timeout: 5 * 60 * 1000 });
	await context.storageState({ path: outputPath });
	console.log('認証状態を保存しました: ' + outputPath);
} finally {
	await browser.close();
}
