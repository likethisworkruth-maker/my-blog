import path from 'node:path';
import { test, expect } from '@playwright/test';
import { makeRegressionRun, openPrivateDetailFromList, seedPrivateRuns } from './helpers';

test.use({ storageState: path.resolve('tests/fixtures/auth/anonymous.storageState.json') });

const visibleMemoButton = (page: import('@playwright/test').Page) => page.locator('a[aria-label="このチェックリストのメモを開く"]:visible');
const visibleMemoTab = (page: import('@playwright/test').Page) => page.locator('#tab-btn-memo:visible');

test.describe('Knowhow Detail Page Navigation', () => {
  test('private詳細のURL直接アクセスからメモアイコン押下処理', async ({ page }) => {
    await page.goto('/my-knowhow/004-cdc-4-months/');
    await expect(page.locator('#knowhow-modal-container')).toBeVisible();

    await expect(page.locator('#info-panel')).toHaveCount(0);

    const memoButton = visibleMemoButton(page);
    await expect(memoButton).toHaveCount(1);
    await memoButton.click();

    await expect(page).toHaveURL(/\/my-knowhow\/004-cdc-4-months\/memo\/?$/);
    await expect(page.locator('#info-panel')).toHaveClass(/translate-y-0/);

    await expect(page.locator('#tab-content-memo')).toBeVisible();
  });

  test('001のprivate詳細からメモアイコンを押す操作列でメモを開ける', async ({ page }) => {
    await page.goto('/my-knowhow/003-cdc-2-months/');
    await expect(page.locator('#knowhow-modal-container')).toBeVisible();

    const memoButton = visibleMemoButton(page);
    await expect(memoButton).toHaveCount(1);
    await memoButton.click();

    await expect(page).toHaveURL(/\/my-knowhow\/003-cdc-2-months\/memo\/?$/);
    await expect(page.locator('#tab-btn-memo')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-content-memo')).toBeVisible();
  });

  test('private一覧から001詳細へ遷移した直後でもメモアイコンを開ける', async ({ page }) => {
    await page.goto('/my-knowhow/?mode=headline_view');
    await seedPrivateRuns(page, [makeRegressionRun('cdc-2-months')]);
    await page.reload();

    await openPrivateDetailFromList(page, '003-cdc-2-months');
    await expect(page.locator('#knowhow-modal-container')).toBeVisible();

    const memoButton = visibleMemoTab(page);
    await expect(memoButton).toHaveCount(1);
    await memoButton.click();

    await expect(page).toHaveURL(/\/my-knowhow\/003-cdc-2-months\/memo\/?$/);
    await expect(page.locator('#tab-content-memo')).toBeVisible();
  });
  test('private詳細のスクロールで次のprivate詳細へ移動する', async ({ page }) => {
    await page.goto('/my-knowhow/?mode=headline_view');
    await seedPrivateRuns(page, [makeRegressionRun('cdc-2-months'), makeRegressionRun('cdc-4-months')]);
    await page.goto('/my-knowhow/003-cdc-2-months/');
    await expect(page.locator('#knowhow-modal-container')).toBeVisible();
    await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-private-state-loaded', 'true');

    await page.locator('#knowhow-modal-container').dispatchEvent('wheel', { deltaY: 100 });
    await expect(page).toHaveURL(/\/my-knowhow\/004-cdc-4-months\/?$/);

    const memoButton = visibleMemoButton(page);
    await expect(memoButton).toHaveCount(1);
    await memoButton.click();
    await expect(page).toHaveURL(/\/my-knowhow\/004-cdc-4-months\/memo\/?$/);
    await expect(page.locator('#tab-content-memo')).toBeVisible();
  });

  test('progressで閉じるボタンを押下後、メモアイコンを開ける', async ({ page }) => {
    await page.goto('/my-knowhow/003-cdc-2-months/progress/');

    const infoPanel = page.locator('#info-panel');
    await expect(infoPanel).toBeVisible();
    await expect(page.locator('#tab-btn-progress')).toHaveAttribute('aria-selected', 'true');

    await page.locator('button[aria-label="詳細パネルを閉じる"]').click();
    await expect(page).toHaveURL(/\/my-knowhow\/003-cdc-2-months\/?$/);

    const memoButton = visibleMemoButton(page);
    await expect(memoButton).toHaveCount(1);
    await memoButton.click();
    await expect(page).toHaveURL(/\/my-knowhow\/003-cdc-2-months\/memo\/?$/);
    await expect(page.locator('#tab-content-memo')).toBeVisible();
  });
});
