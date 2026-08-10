import { expect, type Page } from '@playwright/test';

export function collectPageErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => {
		const message = error.message;
		const isUnavailableLocalSupabase = message.includes('127.0.0.1:54321/rest/v1/') && message.includes('access control checks');
		if (!isUnavailableLocalSupabase) errors.push(message);
	});
	return errors;
}

export async function expectNoPageErrors(errors: string[]) {
	await new Promise((resolve) => setTimeout(resolve, 75));
	expect(errors).toEqual([]);
}

export async function visibleCardCount(page: Page) {
	return page.locator('.knowhow-card:visible').count();
}

export async function visibleCardTitles(page: Page) {
	return (await page.locator('.knowhow-card:visible h2').allTextContents()).map((title) => title.trim());
}

export function makeRegressionRun(checklistId: string, itemCount = 6) {
	const now = '2026-08-08T00:00:00.000Z';
	return {
		runId: `e2e-${checklistId}`,
		checklistId,
		templateVersion: 1,
		status: 'in_progress',
		isCompleted: false,
		items: Array.from({ length: itemCount }, (_, index) => ({
			id: `e2e-${checklistId}-item-${index + 1}`,
			itemKey: `${checklistId}-item-${index + 1}`,
			groupId: index < Math.ceil(itemCount / 2) ? 'e2e-group-a' : 'e2e-group-b',
			groupLabel: index < Math.ceil(itemCount / 2) ? 'E2E 基本確認' : 'E2E 追加確認',
			label: `${checklistId} 回帰項目 ${index + 1}`,
			origin: 'template',
			phase: 'prepare',
			order: index,
			checked: false,
			hidden: false,
			note: '',
			updatedAt: now,
		})),
		note: '',
		createdAt: now,
		startedAt: now,
		updatedAt: now,
		revision: 1,
	};
}

export function makeCompletedRegressionRun(checklistId: string, itemCount = 6) {
	const run = makeRegressionRun(checklistId, itemCount);
	return {
		...run,
		runId: `e2e-completed-${checklistId}`,
		isCompleted: true,
		items: run.items.map((item) => ({
			...item,
			checked: true,
			checkedAt: '2026-08-08T00:01:00.000Z',
			updatedAt: '2026-08-08T00:01:00.000Z',
		})),
		updatedAt: '2026-08-08T00:01:00.000Z',
		revision: 2,
	};
}
export async function seedPrivateRuns(page: Page, runs: unknown[]) {
	await page.evaluate(async (seedRuns) => {
		const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('likethis-private', 2);
			request.onupgradeneeded = () => {
				const database = request.result;
				if (!database.objectStoreNames.contains('runs')) {
					const runsStore = database.createObjectStore('runs', { keyPath: 'runId' });
					runsStore.createIndex('by-checklist', 'checklistId');
					runsStore.createIndex('by-updated', 'updatedAt');
				}
				if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings', { keyPath: 'key' });
				if (!database.objectStoreNames.contains('backupQueue')) database.createObjectStore('backupQueue', { keyPath: 'runId' });
				if (!database.objectStoreNames.contains('article_likes')) database.createObjectStore('article_likes', { keyPath: 'slug' });
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});

		const database = await openDatabase();
		const transaction = database.transaction(['runs', 'backupQueue', 'settings'], 'readwrite');
		for (const run of seedRuns) transaction.objectStore('runs').put(run);
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
		database.close();
	}, runs);
}

export async function clearPrivateRuns(page: Page) {
	await page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('likethis-private', 2);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const transaction = database.transaction(['runs', 'backupQueue'], 'readwrite');
		transaction.objectStore('runs').clear();
		transaction.objectStore('backupQueue').clear();
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
		database.close();
	});
}

export async function readPrivateRuns(page: Page) {
	return page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('likethis-private', 2);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const transaction = database.transaction('runs', 'readonly');
		const request = transaction.objectStore('runs').getAll();
		const runs = await new Promise<unknown[]>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result as unknown[]);
			request.onerror = () => reject(request.error);
		});
		database.close();
		return runs;
	});
}

export async function swipeMyListRow(page: Page, checklistId: string) {
	await page.evaluate((id) => {
		const row = document.querySelector<HTMLElement>(`.knowhow-card[data-checklist-id="${id}"] [data-my-list-swipe-row]`);
		if (!row) throw new Error(`swipe row not found: ${id}`);
		const dispatchTouch = (type: string, clientX: number) => {
			const event = new Event(type, { bubbles: true, cancelable: true });
			const touch = { identifier: 1, target: row, clientX, clientY: 32, pageX: clientX, pageY: 32 };
			Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch] });
			Object.defineProperty(event, 'changedTouches', { value: [touch] });
			row.dispatchEvent(event);
		};
		dispatchTouch('touchstart', 240);
		dispatchTouch('touchmove', 150);
		dispatchTouch('touchend', 150);
	}, checklistId);
	await page.waitForTimeout(250);
}
export async function expectListState(page: Page, expectedCount: number) {
	await expect.poll(() => visibleCardCount(page), { timeout: 8000 }).toBe(expectedCount);
	if (expectedCount === 0) await expect(page.locator('#knowhow-empty')).toBeVisible();
	else await expect(page.locator('#knowhow-empty')).toBeHidden();
}

export async function openPrivateDetailFromList(page: Page, id: string) {
	const pageLoadPromise = page.evaluate(() => new Promise<void>((resolve) => document.addEventListener('astro:page-load', () => resolve(), { once: true })));
	await page.locator(`[data-open-checklist="${id}"]:visible`).click();
	await expect(page).toHaveURL(new RegExp(`/my-knowhow/${id}/progress/?$`));
	await pageLoadPromise;
	await expect(page.locator('#knowhow-modal-container')).toBeVisible();
	await expect(page.locator('#knowhow-modal-container')).toHaveAttribute('data-reels-initialized', 'true');
	await expect.poll(() => page.locator('html').getAttribute('data-astro-transition'), { timeout: 8000 }).toBeNull();
}

export function visiblePrivateAction(page: Page, label: string) {
	return page.locator(`button[aria-label="${label}"]:visible, a[aria-label="${label}"]:visible`);
}
