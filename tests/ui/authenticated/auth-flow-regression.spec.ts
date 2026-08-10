import path from 'node:path';
import { test, expect } from '../auth-fixture';
import {
	clearPrivateRuns,
	collectPageErrors,
	expectListState,
	expectNoPageErrors,
	makeRegressionRun,
	openPrivateDetailFromList,
	seedPrivateRuns,
	swipeMyListRow,
	visiblePrivateAction,
} from '../helpers';

const defaultState = path.resolve('tests/fixtures/auth/authenticated.storageState.json');
const authState = process.env.E2E_AUTH_STATE ? path.resolve(process.env.E2E_AUTH_STATE) : defaultState;
test.use({ storageState: authState });

const authPages = [
	{ id: 'A-101', label: '公開一覧', url: '/' },
	{ id: 'A-102', label: 'knowhow一覧', url: '/knowhow/' },
	{ id: 'A-103', label: 'おすすめ', url: '/recommend/' },
	{ id: 'A-104', label: 'アプリ', url: '/apps/' },
	{ id: 'A-105', label: 'アイテム', url: '/items/' },
	{ id: 'A-106', label: '育児ログ', url: '/logs/' },
	{ id: 'A-107', label: '概要', url: '/about/' },
	{ id: 'A-108', label: 'ポリシー', url: '/policy/' },
];

async function expectSignedIn(page: import('@playwright/test').Page) {
	const isSp = await page.evaluate(() => window.innerWidth < 1024);
	const signedInUi = page.locator('[data-google-signed-in]');
	if (isSp) {
		await expect(page.locator('[data-site-header]')).toBeHidden();
		await expect(signedInUi).toBeHidden();
	} else if (await signedInUi.count()) {
		await expect(signedInUi).toBeVisible();
		await expect(page.locator('[data-google-login]')).toBeHidden();
	}
	const session = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
	expect(session).toContain('e2e-authenticated@example.test');
	return isSp;
}

for (const route of authPages) {
	test(`${route.id} authenticated ${route.label}でログイン表示を維持する`, async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto(route.url);
		const isSp = await expectSignedIn(page);
		if (isSp) await expect(page.locator('[data-google-account-trigger]')).toBeHidden();
		else await expect(page.locator('[data-google-account-trigger]')).toBeVisible();
		await expectNoPageErrors(errors);
	});
}

test('A-109 account menuは開閉とEscapeを正しく処理する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/');
	await expectSignedIn(page);
	const trigger = page.locator('[data-google-account-trigger]');
	const menu = page.locator('[data-google-account-menu]');
	await trigger.click();
	await expect(menu).toBeVisible();
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('[data-google-email]')).not.toHaveText('');
	if (process.env.E2E_AUTH_EMAIL) await expect(page.locator('[data-google-email]')).toHaveText(process.env.E2E_AUTH_EMAIL);
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	await expectNoPageErrors(errors);
});

test('A-110 account menuは外側clickで閉じる', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/');
	await expectSignedIn(page);
	await page.locator('[data-google-account-trigger]').click();
	await expect(page.locator('[data-google-account-menu]')).toBeVisible();
	await page.locator('main').click({ position: { x: 20, y: 20 } });
	await expect(page.locator('[data-google-account-menu]')).toBeHidden();
	await expectNoPageErrors(errors);
});

test('A-111 authenticated public navigation keeps the same Supabase session', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await expectSignedIn(page);
	const before = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
	expect(before).toContain('e2e-authenticated@example.test');
	await page.locator('[data-open-checklist="002-family-log"]:visible').click();
	await expect(page).toHaveURL(/\/knowhow\/002-family-log\/?$/);
	const after = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
	expect(after).toBe(before);
	await expectNoPageErrors(errors);
});

test('A-112 authenticated private list only shows seeded runs', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await expectSignedIn(page);
	await expectListState(page, 1);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText('夫婦共有ログ');
	await expectNoPageErrors(errors);
});

test('A-113 authenticated private list→detail→memoの操作列を維持する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await openPrivateDetailFromList(page, '001-night-memo');
	await page.locator('#tab-btn-memo:visible').click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/memo\/?$/);
	await expect(page.locator('#tab-btn-memo')).toHaveAttribute('aria-selected', 'true');
	await expectSignedIn(page);
	await expectNoPageErrors(errors);
});

test('A-114 authenticated private list→detail→progress→memo→closeを完走する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await openPrivateDetailFromList(page, '001-night-memo');
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/progress\/?$/);
	await expect(page.locator('#tab-btn-progress')).toHaveAttribute('aria-selected', 'true');
	await page.locator('#tab-btn-memo').click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/memo\/?$/);
	await expect(page.locator('#tab-content-memo')).toBeVisible();
	await page.locator('button[aria-label="詳細パネルを閉じる"]').click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/?$/);
	await expectSignedIn(page);
	await expectNoPageErrors(errors);
});

test('A-115 authenticated private direct progress/memo URL restores both tabs', async ({ page }) => {
	const errors = collectPageErrors(page);
	for (const tab of ['progress', 'memo'] as const) {
		await page.goto(`/my-knowhow/002-family-log/${tab}/`);
		await expectSignedIn(page);
		await expect(page.locator(`#tab-btn-${tab}`)).toHaveAttribute('aria-selected', 'true');
		await expect(page.locator(`#tab-content-${tab}`)).toBeVisible();
	}
	await expectNoPageErrors(errors);
});

test('A-116 authenticated progress checkbox is local and session is unchanged', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/my-knowhow/001-night-memo/progress/');
	await expectSignedIn(page);
	const before = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
	const checkbox = page.locator('#tab-content-progress input[type="checkbox"]').first();
	await expect(checkbox).toBeVisible();
	await checkbox.check();
	await expect(checkbox).toBeChecked();
	const after = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
	expect(after).toBe(before);
	await expectNoPageErrors(errors);
});

test('A-117 authenticated public list does not expose private run labels', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/?mode=headline_view');
	await expectListState(page, 2);
	await expect(page.locator('body')).not.toContainText('night-memo 回帰項目');
	await expectNoPageErrors(errors);
});

test('A-118 authenticated detail wheel keeps canonical private route', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await seedPrivateRuns(page, [makeRegressionRun('night-memo'), makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/001-night-memo/');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await page.locator('#knowhow-modal-container').dispatchEvent('wheel', { deltaY: 120 });
	await expect(page).toHaveURL(/\/my-knowhow\/002-family-log\/?$/);
	await expectSignedIn(page);
	await expectNoPageErrors(errors);
});
test('A-119 authenticated public一覧の♡開始でも認証セッションを維持する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await expectSignedIn(page);
	await clearPrivateRuns(page);
	await page.goto('/knowhow/');
	const before = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'));
	await page.locator('.knowhow-card[data-id="001-night-memo"] .like-btn:visible').first().click();
	await expect(page).toHaveURL(/\/my-knowhow\/001-night-memo\/progress\/?$/);
	await expect(page.locator('#tab-btn-progress')).toHaveAttribute('aria-selected', 'true');
	expect(await page.evaluate(() => localStorage.getItem('sb-127-auth-token'))).toBe(before);
	await expectSignedIn(page);
	await expectNoPageErrors(errors);
});

test('A-120 authenticated 公開詳細は既存マイリストをprivate操作アイコンへ切り替える', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await expectSignedIn(page);
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('night-memo')]);
	await page.goto('/knowhow/001-night-memo/');
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');
	await expect(page.locator('[data-private-actions]:visible')).toHaveCount(1);
	await expect(page.locator('[data-start-checklist]:visible')).toHaveCount(0);
	await expect(visiblePrivateAction(page, 'このチェックリストのメモを開く')).toHaveCount(1);
	await expectSignedIn(page);
	await expectNoPageErrors(errors);
});

test('A-121 authenticated マイリストの削除済み絞り込みまでの操作列を維持する', async ({ page }) => {
	const errors = collectPageErrors(page);
	await page.goto('/');
	await expectSignedIn(page);
	await clearPrivateRuns(page);
	await seedPrivateRuns(page, [makeRegressionRun('family-log')]);
	await page.goto('/my-knowhow/?mode=headline_view');
	await expectListState(page, 1);
	await swipeMyListRow(page, 'family-log');
	const row = page.locator('.knowhow-card[data-checklist-id="family-log"] [data-my-list-swipe-row]');
	await expect(row).toHaveAttribute('data-swipe-open', 'true');
	page.once('dialog', (dialog) => void dialog.accept());
	await row.locator('[data-my-list-delete]').click();
	await expectListState(page, 0);
	await page.locator('#open-filter-sheet-btn').click();
	await page.locator('#sheet-deleted-only').check();
	await page.locator('#sheet-apply-btn').click();
	await expect(page).toHaveURL(/deleted=1/);
	await expectListState(page, 1);
	await expect(page.locator('.knowhow-card:visible h2')).toHaveText('夫婦共有ログ');
	await expectSignedIn(page);
	await expectNoPageErrors(errors);
});
