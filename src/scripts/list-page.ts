import { onPageLoad } from './page-lifecycle';

type ListSheetMode = 'filter' | 'sort';

const SHEET_TRANSITION_MS = 250;

interface ListSheetControllerOptions {
	content?: HTMLElement | null;
	handle?: HTMLElement | null;
}

export interface ListSheetController {
	open: () => void;
	close: () => void;
	destroy: () => void;
}

let bodyScrollLockCount = 0;
let bodyOverflowBeforeSheets = '';

const lockBodyScroll = () => {
	if (bodyScrollLockCount === 0) bodyOverflowBeforeSheets = document.body.style.overflow;
	bodyScrollLockCount += 1;
	document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = () => {
	bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
	if (bodyScrollLockCount === 0) document.body.style.overflow = bodyOverflowBeforeSheets;
};

const toggleClasses = (element: Element | null, active: boolean) => {
	element?.classList.toggle('border-mint-500', active);
	element?.classList.toggle('bg-mint-50', active);
	element?.classList.toggle('text-mint-600', active);
	element?.classList.toggle('border-gray-200', !active);
	element?.classList.toggle('text-gray-700', !active);
};

export const createListSheetController = (
	modal: HTMLDialogElement | null,
	options: ListSheetControllerOptions = {},
): ListSheetController | null => {
	if (!modal) return null;

	const content = options.content ?? modal.querySelector<HTMLElement>('[data-list-sheet-content]');
	if (!content) return null;

	const handle = options.handle ?? content.querySelector<HTMLElement>('[data-list-sheet-handle]');
	const listeners = new AbortController();
	let closeTimer: number | undefined;
	let openFrame: number | undefined;
	let dragStartY: number | null = null;
	let dragCurrentY = 0;
	let scrollLocked = false;
	let destroyed = false;

	const resetContent = () => {
		content.classList.remove('is-dragging');
		content.style.removeProperty('transform');
	};

	const cancelOpenFrame = () => {
		if (openFrame === undefined) return;
		window.cancelAnimationFrame(openFrame);
		openFrame = undefined;
	};

	const finishClose = () => {
		cancelOpenFrame();
		if (closeTimer !== undefined) window.clearTimeout(closeTimer);
		closeTimer = undefined;
		const shouldUnlock = scrollLocked;
		scrollLocked = false;
		if (modal.open) modal.close();
		modal.classList.remove('is-open', 'is-motion-ready');
		resetContent();
		if (shouldUnlock) unlockBodyScroll();
	};

	const close = () => {
		cancelOpenFrame();
		if (closeTimer !== undefined) window.clearTimeout(closeTimer);
		if (!modal.open) {
			finishClose();
			return;
		}

		resetContent();
		modal.classList.remove('is-open');
		closeTimer = window.setTimeout(finishClose, SHEET_TRANSITION_MS);
	};

	const open = () => {
		if (destroyed) return;
		cancelOpenFrame();
		if (closeTimer !== undefined) {
			window.clearTimeout(closeTimer);
			closeTimer = undefined;
		}
		if (!scrollLocked) {
			lockBodyScroll();
			scrollLocked = true;
		}
		resetContent();
		modal.classList.remove('is-open', 'is-motion-ready');
		if (!modal.open) modal.showModal();

		// showModal直後の「画面下外」状態を確定させ、最初のフレームでは何も変えず描画する。
		// 次にtransitionだけを有効化し、その次のフレームで上昇を開始する。
		void content.offsetHeight;
		openFrame = window.requestAnimationFrame(() => {
			openFrame = window.requestAnimationFrame(() => {
				modal.classList.add('is-motion-ready');
				openFrame = window.requestAnimationFrame(() => {
					openFrame = undefined;
					if (destroyed || !modal.open) return;
					modal.classList.add('is-open');
				});
			});
		});
	};

	const resetDrag = () => {
		dragStartY = null;
		dragCurrentY = 0;
		content.classList.remove('is-dragging');
		content.style.removeProperty('transform');
	};
	const isMobileSheet = () => window.innerWidth < 1024;

	content.addEventListener('touchstart', (event) => {
		if (!isMobileSheet()) return;
		const target = event.target as Node | null;
		if (content.scrollTop > 0 && (!target || !handle?.contains(target))) return;
		const touch = event.touches[0];
		if (!touch) return;
		dragStartY = touch.clientY;
		dragCurrentY = touch.clientY;
		content.classList.add('is-dragging');
	}, { passive: true, signal: listeners.signal });

	content.addEventListener('touchmove', (event) => {
		if (!isMobileSheet()) return;
		if (dragStartY === null || event.touches.length !== 1) return;
		const touch = event.touches[0];
		dragCurrentY = touch.clientY;
		const distance = dragCurrentY - dragStartY;
		if (distance <= 0) return;
		content.style.transform = `translateY(${distance}px)`;
		event.preventDefault();
	}, { passive: false, signal: listeners.signal });

	content.addEventListener('touchend', () => {
		if (!isMobileSheet()) return;
		if (dragStartY === null) return;
		const shouldClose = dragCurrentY - dragStartY >= 80;
		resetDrag();
		if (shouldClose) close();
	}, { passive: true, signal: listeners.signal });

	content.addEventListener('touchcancel', () => {
		if (isMobileSheet()) resetDrag();
	}, { passive: true, signal: listeners.signal });
	handle?.addEventListener('click', close, { signal: listeners.signal });
	modal.addEventListener('click', (event) => {
		if (event.target === modal) close();
	}, { signal: listeners.signal });
	modal.addEventListener('cancel', (event) => {
		event.preventDefault();
		close();
	}, { signal: listeners.signal });
	modal.addEventListener('close', finishClose, { signal: listeners.signal });

	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		finishClose();
		listeners.abort();
	};

	return { open, close, destroy };
};

interface ContentListElements {
	container: HTMLElement;
	cards: HTMLElement[];
	emptyState: HTMLElement | null;
	searchInput: HTMLInputElement | null;
	sheetController: ListSheetController | null;
	filterTrigger: HTMLButtonElement | null;
	sortTrigger: HTMLButtonElement | null;
	filterSection: HTMLElement | null;
	sortSection: HTMLElement | null;
	applyButton: HTMLButtonElement | null;
	categoryButtons: HTMLButtonElement[];
	ageButtons: HTMLButtonElement[];
	sortRadios: HTMLInputElement[];
}

const getById = <T extends HTMLElement>(id: string | undefined): T | null => {
	return id ? document.getElementById(id) as T | null : null;
};

const compareAge = (left: HTMLElement, right: HTMLElement, descending: boolean) => {
	const toAge = (card: HTMLElement) => {
		const value = card.dataset.age;
		return value === 'none' || value === undefined ? Number.POSITIVE_INFINITY : Number(value);
	};
	const leftAge = toAge(left);
	const rightAge = toAge(right);
	if (leftAge === rightAge) return 0;
	if (leftAge === Number.POSITIVE_INFINITY) return 1;
	if (rightAge === Number.POSITIVE_INFINITY) return -1;
	return descending ? rightAge - leftAge : leftAge - rightAge;
};

const sortCards = (cards: HTMLElement[], sort: string) => {
	return cards.sort((left, right) => {
		if (sort === 'age-asc') return compareAge(left, right, false);
		if (sort === 'age-desc') return compareAge(left, right, true);
		if (sort === 'newest') {
			return (right.dataset.lognumber ?? '').localeCompare(left.dataset.lognumber ?? '');
		}
		return Number(left.dataset.order ?? 0) - Number(right.dataset.order ?? 0);
	});
};

const updateTrigger = (button: HTMLButtonElement | null, active: boolean) => {
	button?.classList.toggle('border-mint-500', active);
	button?.classList.toggle('bg-mint-50', active);
	button?.classList.toggle('text-mint-600', active);
};

const getListElements = (container: HTMLElement): ContentListElements => {
	const filterModal = getById<HTMLDialogElement>('filter-sheet-modal');
	const content = filterModal?.querySelector<HTMLElement>('[data-list-sheet-content]');
	return {
		container,
		cards: Array.from(container.querySelectorAll<HTMLElement>('[data-list-card]')),
		emptyState: getById(container.dataset.listEmpty),
		searchInput: getById<HTMLInputElement>(container.dataset.listSearch),
		sheetController: createListSheetController(filterModal, { content }),
		filterTrigger: getById<HTMLButtonElement>('open-filter-sheet-btn'),
		sortTrigger: getById<HTMLButtonElement>('open-sort-sheet-btn'),
		filterSection: getById('sheet-section-filter'),
		sortSection: getById('sheet-section-sort'),
		applyButton: getById<HTMLButtonElement>('sheet-apply-btn'),
		categoryButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sheet-category]')),
		ageButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sheet-age]')),
		sortRadios: Array.from(filterModal?.querySelectorAll<HTMLInputElement>('input[name="sheet-sort"]') ?? []),
	};
};

const initContentList = (container: HTMLElement): (() => void) | null => {
	if (container.dataset.listInitialized === 'true') return null;
	const elements = getListElements(container);
	if (!elements.sheetController) return null;
	container.dataset.listInitialized = 'true';
	const listeners = new AbortController();
	const listenerOptions = { signal: listeners.signal };

	let category = elements.categoryButtons.find((button) => button.dataset.sheetCategory === 'すべて')?.dataset.sheetCategory ?? 'すべて';
	let age = 'all';
	let sort = container.dataset.listDefaultSort ?? elements.sortRadios.find((radio) => radio.checked)?.value ?? 'recommended';
	let search = '';

	const updateSheet = () => {
		elements.categoryButtons.forEach((button) => toggleClasses(button, button.dataset.sheetCategory === category));
		elements.ageButtons.forEach((button) => toggleClasses(button, button.dataset.sheetAge === age));
		elements.sortRadios.forEach((radio) => { radio.checked = radio.value === sort; });
	};

	const updateView = () => {
		const query = search.trim();
		const visible: HTMLElement[] = [];
		const hidden: HTMLElement[] = [];

		elements.cards.forEach((card) => {
			const matchesCategory = category === 'すべて' || (card.dataset.categories ?? '').split(',').includes(category);
			const matchesAge = age === 'all' || card.dataset.age === age;
			const matchesSearch = !query || (card.textContent ?? '').toLowerCase().includes(query);
			const isVisible = matchesCategory && matchesAge && matchesSearch;
			card.style.display = isVisible ? (card.dataset.listDisplay ?? 'flex') : 'none';
			(isVisible ? visible : hidden).push(card);
		});

		sortCards(visible, sort).forEach((card) => elements.container.appendChild(card));
		hidden.forEach((card) => elements.container.appendChild(card));
		elements.emptyState?.classList.toggle('hidden', visible.length > 0);
		updateTrigger(elements.filterTrigger, category !== 'すべて' || age !== 'all');
		updateTrigger(elements.sortTrigger, sort !== (container.dataset.listDefaultSort ?? 'recommended'));
	};

	const openSheet = (mode: ListSheetMode) => {
		elements.filterSection?.classList.toggle('hidden', mode !== 'filter');
		elements.sortSection?.classList.toggle('hidden', mode !== 'sort');
		if (elements.applyButton) elements.applyButton.textContent = mode === 'filter' ? '絞り込む' : '並び替える';
		updateSheet();
		elements.sheetController?.open();
	};

	elements.categoryButtons.forEach((button) => {
		button.addEventListener('click', () => {
			category = button.dataset.sheetCategory ?? 'すべて';
			updateSheet();
		}, listenerOptions);
	});
	elements.ageButtons.forEach((button) => {
		button.addEventListener('click', () => {
			age = button.dataset.sheetAge ?? 'all';
			updateSheet();
		}, listenerOptions);
	});
	elements.sortRadios.forEach((radio) => {
		radio.addEventListener('change', () => {
			if (radio.checked) sort = radio.value;
		}, listenerOptions);
	});
	elements.filterTrigger?.addEventListener('click', () => openSheet('filter'), listenerOptions);
	elements.sortTrigger?.addEventListener('click', () => openSheet('sort'), listenerOptions);
	elements.applyButton?.addEventListener('click', () => {
		updateView();
		elements.sheetController?.close();
	}, listenerOptions);
	elements.searchInput?.addEventListener('input', () => {
		search = elements.searchInput?.value.toLowerCase() ?? '';
		updateView();
	}, listenerOptions);

	updateSheet();
	updateView();

	return () => {
		listeners.abort();
		elements.sheetController?.destroy();
		delete container.dataset.listInitialized;
	};
};

let didBootContentLists = false;
const contentListCleanups = new Set<() => void>();

const initContentLists = () => {
	document.querySelectorAll<HTMLElement>('[data-content-list]').forEach((container) => {
		const cleanup = initContentList(container);
		if (cleanup) contentListCleanups.add(cleanup);
	});
};

const destroyContentLists = () => {
	contentListCleanups.forEach((cleanup) => cleanup());
	contentListCleanups.clear();
};

export const bootContentLists = () => {
	initContentLists();
	if (didBootContentLists) return;
	didBootContentLists = true;
	onPageLoad(initContentLists);
	document.addEventListener('astro:before-swap', destroyContentLists);
};
