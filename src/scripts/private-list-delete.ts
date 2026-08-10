import { deletePrivateChecklistRunsByChecklistId } from './private-db';
import { clearKnowhowListCache } from './knowhow-list-cache';

export const PRIVATE_LIST_DELETE_CONFIRM_MESSAGE =
  'このチェックリストをマイリストから削除しますか？\n保存した進捗とメモも削除されます。';

type ConfirmFn = (message: string) => boolean;

const defaultConfirm: ConfirmFn = (message) =>
  typeof window !== 'undefined' ? window.confirm(message) : false;

const clearChecklistSessionState = () => {
	clearKnowhowListCache();
	if (typeof window === 'undefined') return;
	try {
		for (const key of Object.keys(window.sessionStorage)) {
			if (key.startsWith('knowhow:')) window.sessionStorage.removeItem(key);
		}
	} catch {
		// Session storage can be unavailable in strict privacy modes.
	}
};

export async function deletePrivateListByChecklistId(
	checklistId: string,
	confirmFn: ConfirmFn = defaultConfirm,
): Promise<boolean> {
	if (!checklistId || !confirmFn(PRIVATE_LIST_DELETE_CONFIRM_MESSAGE)) return false;
	await deletePrivateChecklistRunsByChecklistId(checklistId);
	clearChecklistSessionState();
	return true;
}

interface PrivateListSwipeOptions {
	rows: HTMLElement[];
	canDelete: (row: HTMLElement) => boolean;
	onDeleted?: () => Promise<void> | void;
}

export const bindPrivateListSwipeRows = ({
	rows,
	canDelete,
	onDeleted,
}: PrivateListSwipeOptions) => {
	const listeners = new AbortController();
	const states = new WeakMap<HTMLElement, { startX: number; startY: number; horizontal: boolean; ignored: boolean }>();
	let openRow: HTMLElement | null = null;

	const setOpen = (row: HTMLElement, open: boolean) => {
		const content = row.querySelector<HTMLElement>('[data-my-list-swipe-content]');
		if (!content) return;
		if (openRow && openRow !== row) setOpen(openRow, false);
		content.style.transform = open ? 'translateX(-80px)' : 'translateX(0)';
		row.dataset.swipeOpen = String(open);
		openRow = open ? row : openRow === row ? null : openRow;
	};

	const refresh = () => {
		rows.forEach((row) => {
			const deleteButton = row.querySelector<HTMLElement>('[data-my-list-delete]');
			const enabled = canDelete(row);
			if (deleteButton) deleteButton.hidden = !enabled;
			if (!enabled) setOpen(row, false);
		});
	};

	const removeRow = async (row: HTMLElement) => {
		const checklistId = row.closest<HTMLElement>('.knowhow-card')?.dataset.checklistId;
		if (!checklistId || !canDelete(row)) return;
		const deleteButtons = Array.from(row.querySelectorAll<HTMLButtonElement>('[data-my-list-delete]'));
		deleteButtons.forEach((button) => { button.disabled = true; });
		try {
			if (await deletePrivateListByChecklistId(checklistId)) {
				setOpen(row, false);
				await onDeleted?.();
			}
		} catch {
			window.alert('マイリストから削除できませんでした。もう一度お試しください。');
		} finally {
			deleteButtons.forEach((button) => { button.disabled = false; });
		}
	};

	rows.forEach((row) => {
		const content = row.querySelector<HTMLElement>('[data-my-list-swipe-content]');
		const deleteButton = row.querySelector<HTMLButtonElement>('[data-my-list-delete]');
		if (!content || !deleteButton) return;

		row.addEventListener('touchstart', (event) => {
			if (!canDelete(row) || (event.target as HTMLElement).closest('.like-btn, [data-my-list-delete]')) return;
			const touch = event.touches[0];
			if (touch) states.set(row, { startX: touch.clientX, startY: touch.clientY, horizontal: false, ignored: false });
		}, { passive: true, signal: listeners.signal });

		row.addEventListener('touchmove', (event) => {
			const state = states.get(row);
			const touch = event.touches[0];
			if (!state || !touch) return;
			const deltaX = touch.clientX - state.startX;
			const deltaY = touch.clientY - state.startY;
			if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
				state.ignored = true;
				return;
			}
			if (state.ignored || deltaX >= 0) return;
			state.horizontal = true;
			event.preventDefault();
			content.style.transform = `translateX(${Math.max(-80, deltaX)}px)`;
		}, { passive: false, signal: listeners.signal });

		row.addEventListener('touchend', (event) => {
			const state = states.get(row);
			states.delete(row);
			if (!state || state.ignored) return;
			const touch = event.changedTouches[0];
			if (!touch) return;
			const deltaX = touch.clientX - state.startX;
			if (state.horizontal && Math.abs(deltaX) > 10) {
				row.dataset.swipeConsumed = 'true';
				window.setTimeout(() => delete row.dataset.swipeConsumed, 450);
			}
			if (deltaX <= -48) setOpen(row, true);
			else if (deltaX >= 48) setOpen(row, false);
		}, { passive: true, signal: listeners.signal });

		row.addEventListener('touchcancel', () => states.delete(row), { passive: true, signal: listeners.signal });
		row.addEventListener('click', (event) => {
			const target = event.target as HTMLElement;
			if (target.closest('[data-my-list-delete]') || row.dataset.swipeConsumed !== 'true') return;
			event.preventDefault();
			event.stopPropagation();
		}, { capture: true, signal: listeners.signal });
		deleteButton.addEventListener('click', () => void removeRow(row), { signal: listeners.signal });
	});

	refresh();
	const closeAll = () => rows.forEach((row) => setOpen(row, false));
	const destroy = () => {
		closeAll();
		listeners.abort();
		rows.forEach((row) => {
			row.removeAttribute('data-swipe-open');
			const deleteButton = row.querySelector<HTMLElement>('[data-my-list-delete]');
			if (deleteButton) deleteButton.hidden = true;
		});
	};
	return { refresh, closeAll, destroy };
};
