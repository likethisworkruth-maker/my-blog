import { test as base, expect } from '@playwright/test';

export const test = base.extend({
	context: async ({ context }, use) => {
		await context.addInitScript(() => {
			(window as Window & { __E2E_AUTH_STUB__?: boolean }).__E2E_AUTH_STUB__ = true;
		});
		await use(context);
	},
});

export { expect };
