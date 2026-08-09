type ListSheetMode = 'filter' | 'sort';

interface ListSheetControllerOptions {
	content?: HTMLElement | null;
	handle?: HTMLElement | null;
}

export interface ListSheetController {
	open: () => void;
	close: () => void;
}

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
	let closeTimer: number | undefined;
	let previousBodyOverflow = '';
	let dragStartY: number | null = null;
	let dragCurrentY = 0;

	const restorePageScroll = () => {
		document.body.style.overflow = previousBodyOverflow;
	};

	const resetContent = () => {
		content.classList.remove('is-dragging');
		content.style.removeProperty('transform');
		content.classList.add('translate-y-full');
	};

	const finishClose = () => {
		if (modal.open) modal.close();
		modal.classList.remove('is-open', 'opacity-100');
		modal.classList.add('opacity-0', 'pointer-events-none');
		resetContent();
		restorePageScroll();
		closeTimer = undefined;
	};

	const close = () => {
		if (closeTimer !== undefined) window.clearTimeout(closeTimer);
		if (!modal.open) {
			finishClose();
			return;
		}

		modal.classList.remove('is-open', 'opacity-100');
		modal.classList.add('opacity-0', 'pointer-events-none');
		resetContent();
		closeTimer = window.setTimeout(finishClose, 250);
	};

	const open = () => {
		if (closeTimer !== undefined) {
			window.clearTimeout(closeTimer);
			closeTimer = undefined;
		}
		previousBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		if (!modal.open) modal.showModal();
		modal.classList.add('is-open');
		modal.classList.remove('opacity-0', 'pointer-events-none');
		requestAnimationFrame(() => {
			content.classList.remove('translate-y-full');
		});
	};

	const resetDrag = () => {
		dragStartY = null;
		dragCurrentY = 0;
		content.classList.remove('is-dragging');
		content.style.removeProperty('transform');
	};

	content.addEventListener('touchstart', (event) => {
		const target = event.target as Node | null;
		if (content.scrollTop > 0 && (!target || !handle?.contains(target))) return;
		const touch = event.touches[0];
		if (!touch) return;
		dragStartY = touch.clientY;
		dragCurrentY = touch.clientY;
		content.classList.add('is-dragging');
	}, { passive: true });

	content.addEventListener('touchmove', (event) => {
		if (dragStartY === null || event.touches.length !== 1) return;
		const touch = event.touches[0];
		dragCurrentY = touch.clientY;
		const distance = dragCurrentY - dragStartY;
		if (distance <= 0) return;
		content.style.transform = `translateY(${distance}px)`;
		event.preventDefault();
	}, { passive: false });

	content.addEventListener('touchend', () => {
		if (dragStartY === null) return;
		const shouldClose = dragCurrentY - dragStartY >= 80;
		resetDrag();
		if (shouldClose) close();
	}, { passive: true });

	content.addEventListener('touchcancel', resetDrag, { passive: true });
	handle?.addEventListener('click', close);
	modal.addEventListener('click', (event) => {
		if (event.target === modal) close();
	});
	modal.addEventListener('close', finishClose);

	return { open, close };
};

interface ContentListElements {
	container: HTMLElement;
	cards: HTMLElement[];
	emptyState: HTMLElement | null;
	searchInput: HTMLInputElement | null;
	filterModal: HTMLDialogElement | null;
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
		filterModal,
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

const initContentList = (container: HTMLElement) => {
	if (container.dataset.listInitialized === 'true') return;
	const elements = getListElements(container);
	if (elements.cards.length === 0 || !elements.sheetController) return;
	container.dataset.listInitialized = 'true';

	let category = elements.categoryButtons.find((button) => button.dataset.sheetCategory === 'すべて')?.dataset.sheetCategory ?? 'すべて';
	let age = 'all';
	let sort = container.dataset.listDefaultSort ?? elements.sortRadios.find((radio) => radio.checked)?.value ?? 'recommended';
	let search = '';
	let sheetMode: ListSheetMode = 'filter';

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
		sheetMode = mode;
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
		});
	});
	elements.ageButtons.forEach((button) => {
		button.addEventListener('click', () => {
			age = button.dataset.sheetAge ?? 'all';
			updateSheet();
		});
	});
	elements.sortRadios.forEach((radio) => {
		radio.addEventListener('change', () => {
			if (radio.checked) sort = radio.value;
		});
	});
	elements.filterTrigger?.addEventListener('click', () => openSheet('filter'));
	elements.sortTrigger?.addEventListener('click', () => openSheet('sort'));
	elements.applyButton?.addEventListener('click', () => {
		updateView();
		elements.sheetController?.close();
	});
	elements.searchInput?.addEventListener('input', () => {
		search = elements.searchInput?.value.toLowerCase() ?? '';
		updateView();
	});

	updateSheet();
	updateView();
};

let didBootContentLists = false;

const initContentLists = () => {
	document.querySelectorAll<HTMLElement>('[data-content-list]').forEach(initContentList);
};

export const bootContentLists = () => {
	initContentLists();
	if (didBootContentLists) return;
	didBootContentLists = true;
	document.addEventListener('astro:page-load', initContentLists);
};
