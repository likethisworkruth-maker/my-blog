import { getPrivateSetting, setPrivateSetting } from './private-db';

const CHECKLIST_USAGE_COUNT_KEY = 'checklist-usage-count';
export const CHECKLIST_GOOGLE_LOGIN_NOTICE_KEY = 'checklist-google-login-notice';

export interface ChecklistUsageNotice {
	checklistId: string;
	usageCount: number;
}

export async function recordChecklistUsage(checklistId: string) {
	const storedCount = await getPrivateSetting<number>(CHECKLIST_USAGE_COUNT_KEY);
	const previousCount = typeof storedCount === 'number' && Number.isFinite(storedCount)
		? Math.max(0, Math.floor(storedCount))
		: 0;
	const usageCount = previousCount + 1;
	await setPrivateSetting(CHECKLIST_USAGE_COUNT_KEY, usageCount);

	const shouldPrompt = usageCount === 1 || usageCount % 3 === 0;
	if (shouldPrompt && typeof window !== 'undefined') {
		const notice: ChecklistUsageNotice = { checklistId, usageCount };
		try {
			sessionStorage.setItem(CHECKLIST_GOOGLE_LOGIN_NOTICE_KEY, JSON.stringify(notice));
		} catch {
			// The prompt can still be shown through the in-page event.
		}
		window.dispatchEvent(new CustomEvent<ChecklistUsageNotice>('checklist-usage-notice', { detail: notice }));
	}

	return { usageCount, shouldPrompt };
}
