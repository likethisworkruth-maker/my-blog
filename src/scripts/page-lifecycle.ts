export type PageInit = () => void;

/** Run a component on the initial document and after each Astro page swap. */
export const onPageLoad = (init: PageInit) => {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
	document.addEventListener('astro:page-load', init);
};
