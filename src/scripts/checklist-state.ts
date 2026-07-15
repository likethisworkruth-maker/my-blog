export const CHECKLIST_STORAGE_KEY = 'likethis:checklist-runs:v1';

export type ChecklistStatus =
	| 'in_progress'
	| 'prepared'
	| 'review_pending'
	| 'completed';

export type ChecklistPhase = 'have' | 'prepare' | 'pack_day';

export type ChecklistOutcome =
	| 'used'
	| 'unused'
	| 'missed'
	| 'remove_next';

export interface ChecklistTemplateItem {
	id: string;
	label: string;
	defaultPhase?: ChecklistPhase;
}

export interface ChecklistTemplateGroup {
	id: string;
	label: string;
	items: ChecklistTemplateItem[];
}

export interface ChecklistTemplate {
	checklistId: string;
	title: string;
	version: number;
	status: 'draft' | 'published';
	groups: ChecklistTemplateGroup[];
}

export interface ChecklistRunItem {
	id: string;
	itemKey: string;
	groupId: string;
	groupLabel: string;
	label: string;
	origin: 'template' | 'custom';
	phase: ChecklistPhase;
	order: number;
	checked: boolean;
	checkedAt?: string;
	hidden: boolean;
	note: string;
	outcome?: ChecklistOutcome;
}

export interface ChecklistRun {
	runId: string;
	checklistId: string;
	templateVersion: number;
	status: ChecklistStatus;
	items: ChecklistRunItem[];
	startedAt: string;
	preparedAt?: string;
	reviewStartedAt?: string;
	completedAt?: string;
	updatedAt: string;
}

interface ChecklistStore {
	version: 1;
	runs: Record<string, ChecklistRun>;
	activeRunIds: Record<string, string>;
}

function emptyStore(): ChecklistStore {
	return {
		version: 1,
		runs: {},
		activeRunIds: {},
	};
}

function isChecklistStatus(value: unknown): value is ChecklistStatus {
	return value === 'in_progress'
		|| value === 'prepared'
		|| value === 'review_pending'
		|| value === 'completed';
}

function isChecklistRun(value: unknown): value is ChecklistRun {
	if (!value || typeof value !== 'object') return false;
	const run = value as Partial<ChecklistRun>;
	return typeof run.runId === 'string'
		&& typeof run.checklistId === 'string'
		&& Number.isInteger(run.templateVersion)
		&& isChecklistStatus(run.status)
		&& Array.isArray(run.items)
		&& typeof run.startedAt === 'string'
		&& typeof run.updatedAt === 'string';
}

export function readChecklistStore(storage?: Storage): ChecklistStore {
	const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
	if (!target) return emptyStore();

	try {
		const raw = target.getItem(CHECKLIST_STORAGE_KEY);
		if (!raw) return emptyStore();
		const parsed = JSON.parse(raw) as Partial<ChecklistStore>;
		if (parsed.version !== 1 || !parsed.runs || typeof parsed.runs !== 'object') {
			return emptyStore();
		}

		const runs = Object.fromEntries(
			Object.entries(parsed.runs).filter((entry): entry is [string, ChecklistRun] => isChecklistRun(entry[1])),
		);
		const activeRunIds = parsed.activeRunIds && typeof parsed.activeRunIds === 'object'
			? Object.fromEntries(
				Object.entries(parsed.activeRunIds).filter(
					([checklistId, runId]) => typeof runId === 'string' && runs[runId]?.checklistId === checklistId,
				),
			)
			: {};

		for (const run of Object.values(runs)) {
			if (!activeRunIds[run.checklistId]) {
				activeRunIds[run.checklistId] = run.runId;
			}
		}

		return { version: 1, runs, activeRunIds };
	} catch (error) {
		console.warn('チェックリストの保存データを読み込めませんでした。', error);
		return emptyStore();
	}
}

function notifyChecklistChange(checklistId?: string) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('checklist-runs-changed', {
		detail: { checklistId },
	}));
}

function writeChecklistStore(store: ChecklistStore, storage?: Storage, checklistId?: string) {
	const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
	if (!target) return;
	target.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(store));
	notifyChecklistChange(checklistId);
}

export function getChecklistRuns(storage?: Storage): ChecklistRun[] {
	return Object.values(readChecklistStore(storage).runs)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveChecklistRun(checklistId: string, storage?: Storage): ChecklistRun | null {
	const store = readChecklistStore(storage);
	const activeRunId = store.activeRunIds[checklistId];
	if (activeRunId && store.runs[activeRunId]) return store.runs[activeRunId];

	return Object.values(store.runs)
		.filter((run) => run.checklistId === checklistId)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function saveChecklistRun(run: ChecklistRun, options?: {
	storage?: Storage;
	setActive?: boolean;
}) {
	const storage = options?.storage;
	const store = readChecklistStore(storage);
	store.runs[run.runId] = run;
	if (options?.setActive !== false) {
		store.activeRunIds[run.checklistId] = run.runId;
	}
	writeChecklistStore(store, storage, run.checklistId);
}

export function mergeChecklistRuns(runs: ChecklistRun[], storage?: Storage) {
	const store = readChecklistStore(storage);
	const affected = new Set<string>();

	for (const run of runs) {
		const current = store.runs[run.runId];
		if (!current || run.updatedAt > current.updatedAt) {
			store.runs[run.runId] = run;
			affected.add(run.checklistId);
		}
	}

	for (const checklistId of affected) {
		const latest = Object.values(store.runs)
			.filter((run) => run.checklistId === checklistId)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
		if (latest) store.activeRunIds[checklistId] = latest.runId;
	}

	writeChecklistStore(store, storage);
}

export function deleteChecklistRun(runId: string, storage?: Storage) {
	const store = readChecklistStore(storage);
	const run = store.runs[runId];
	if (!run) return;

	delete store.runs[runId];
	if (store.activeRunIds[run.checklistId] === runId) {
		const next = Object.values(store.runs)
			.filter((candidate) => candidate.checklistId === run.checklistId)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
		if (next) store.activeRunIds[run.checklistId] = next.runId;
		else delete store.activeRunIds[run.checklistId];
	}
	writeChecklistStore(store, storage, run.checklistId);
}

export function createUuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
		const random = Math.floor(Math.random() * 16);
		const value = character === 'x' ? random : (random & 0x3) | 0x8;
		return value.toString(16);
	});
}

export function createChecklistRun(template: ChecklistTemplate): ChecklistRun {
	const now = new Date().toISOString();
	let order = 0;
	return {
		runId: createUuid(),
		checklistId: template.checklistId,
		templateVersion: template.version,
		status: 'in_progress',
		items: template.groups.flatMap((group) => group.items.map((item) => ({
			id: createUuid(),
			itemKey: item.id,
			groupId: group.id,
			groupLabel: group.label,
			label: item.label,
			origin: 'template' as const,
			phase: item.defaultPhase ?? 'prepare',
			order: order++,
			checked: false,
			hidden: false,
			note: '',
		}))),
		startedAt: now,
		updatedAt: now,
	};
}

export function resetChecklistRun(run: ChecklistRun, template: ChecklistTemplate): ChecklistRun {
	const reset = createChecklistRun(template);
	return {
		...reset,
		runId: run.runId,
		startedAt: run.startedAt,
		updatedAt: new Date().toISOString(),
	};
}

export function duplicateChecklistRun(run: ChecklistRun): ChecklistRun {
	const now = new Date().toISOString();
	return {
		...run,
		runId: createUuid(),
		status: 'in_progress',
		items: run.items.map((item, order) => ({
			...item,
			id: createUuid(),
			order,
			checked: false,
			checkedAt: undefined,
			note: item.note,
			outcome: undefined,
		})),
		startedAt: now,
		preparedAt: undefined,
		reviewStartedAt: undefined,
		completedAt: undefined,
		updatedAt: now,
	};
}

export function getChecklistProgress(run: ChecklistRun | null) {
	if (!run) return { completed: 0, total: 0, percent: 0 };
	const activeItems = run.items.filter((item) => !item.hidden);
	const completed = activeItems.filter((item) => item.checked).length;
	const total = activeItems.length;
	return {
		completed,
		total,
		percent: total === 0 ? 0 : Math.round((completed / total) * 100),
	};
}

export function getChecklistStatusLabel(status: ChecklistStatus) {
	switch (status) {
		case 'prepared':
			return '準備完了';
		case 'review_pending':
			return '振り返り待ち';
		case 'completed':
			return '完了済み';
		default:
			return '実行中';
	}
}
