export type KnowhowListView = 'discover' | 'my';
export type KnowhowListDisplayMode = 'headline_view' | 'grid_view';
export type KnowhowListSort = 'recommend' | 'newest' | 'popular';

export interface KnowhowListCache {
	version: 2;
	sourcePath: string;
	view: KnowhowListView;
	displayMode: KnowhowListDisplayMode;
	phases: string[];
	scene: string;
	favoriteOnly: boolean;
	completedOnly: boolean;
	searchKeyword: string;
	sort: KnowhowListSort;
	orderedIds: string[];
	savedAt: number;
}

export const KNOWHOW_LIST_CACHE_KEY = 'knowhow-list-cache';

type KnowhowListCacheInput = Omit<KnowhowListCache, 'version' | 'savedAt'>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
	Boolean(value) && typeof value === 'object'
);

const isListView = (value: unknown): value is KnowhowListView => value === 'discover' || value === 'my';
const isDisplayMode = (value: unknown): value is KnowhowListDisplayMode => value === 'headline_view' || value === 'grid_view';
const isSort = (value: unknown): value is KnowhowListSort => value === 'recommend' || value === 'newest' || value === 'popular';

export const saveKnowhowListCache = (input: KnowhowListCacheInput) => {
	try {
		const cache: KnowhowListCache = {
			...input,
			orderedIds: Array.from(new Set(input.orderedIds)),
			version: 2,
			savedAt: Date.now(),
		};
		sessionStorage.setItem(KNOWHOW_LIST_CACHE_KEY, JSON.stringify(cache));
	} catch {
		// Session storage can be unavailable in strict privacy modes.
	}
};

export const readKnowhowListCache = (): KnowhowListCache | null => {
	try {
		const parsed = JSON.parse(sessionStorage.getItem(KNOWHOW_LIST_CACHE_KEY) ?? 'null') as unknown;
		if (!isRecord(parsed) || parsed.version !== 2) return null;
		if (!isListView(parsed.view) || !isDisplayMode(parsed.displayMode) || !isSort(parsed.sort)) return null;
		if (typeof parsed.sourcePath !== 'string' || typeof parsed.scene !== 'string') return null;
		if (!Array.isArray(parsed.phases) || !parsed.phases.every((phase) => typeof phase === 'string')) return null;
		if (!Array.isArray(parsed.orderedIds) || !parsed.orderedIds.every((id) => typeof id === 'string')) return null;
		if (typeof parsed.favoriteOnly !== 'boolean' || typeof parsed.completedOnly !== 'boolean') return null;
		if (typeof parsed.searchKeyword !== 'string') return null;
		return parsed as unknown as KnowhowListCache;
	} catch {
		return null;
	}
};

export const clearKnowhowListCache = () => {
	try {
		sessionStorage.removeItem(KNOWHOW_LIST_CACHE_KEY);
	} catch {
		// Session storage can be unavailable in strict privacy modes.
	}
};
