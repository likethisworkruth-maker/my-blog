import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
	CHECKLIST_STORAGE_KEY,
	type ChecklistOutcome,
	type ChecklistRun,
	type ChecklistRunItem,
	readChecklistStore,
} from './checklist-state.ts';

export const PRIVATE_DB_NAME = 'likethis-private';
export const PRIVATE_DB_VERSION = 2;
const LEGACY_MIGRATION_KEY = 'legacy-local-storage-migrated-v1';
const LOCAL_REVISION_KEY = 'private-data-revision';
const DEVICE_ID_KEY = 'device-id';

export interface PrivateSetting<T = unknown> {
	key: string;
	value: T;
}

export interface BackupQueueEntry {
	runId: string;
	revision: number;
	updatedAt: string;
}

export interface AnonymousArticleLike {
	slug: string;
	token: string;
	liked: true;
	createdAt: string;
	updatedAt: string;
}

function createPrivateId() {
	return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `private-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface LikeThisPrivateDb extends DBSchema {
	runs: {
		key: string;
		value: ChecklistRun;
		indexes: { 'by-checklist': string; 'by-updated': string };
	};
	settings: {
		key: string;
		value: PrivateSetting;
	};
	backupQueue: {
		key: string;
		value: BackupQueueEntry;
	};
	article_likes: {
		key: string;
		value: AnonymousArticleLike;
	};
}

let databasePromise: Promise<IDBPDatabase<LikeThisPrivateDb>> | undefined;
let initializationPromise: Promise<void> | undefined;

function getDatabase() {
	if (typeof indexedDB === 'undefined') {
		throw new Error('このブラウザーでは端末保存を利用できません。');
	}
	if (!databasePromise) {
		databasePromise = openDB<LikeThisPrivateDb>(PRIVATE_DB_NAME, PRIVATE_DB_VERSION, {
			upgrade(database) {
				if (!database.objectStoreNames.contains('runs')) {
					const runs = database.createObjectStore('runs', { keyPath: 'runId' });
					runs.createIndex('by-checklist', 'checklistId');
					runs.createIndex('by-updated', 'updatedAt');
				}
				if (!database.objectStoreNames.contains('settings')) {
					database.createObjectStore('settings', { keyPath: 'key' });
				}
				if (!database.objectStoreNames.contains('backupQueue')) {
					database.createObjectStore('backupQueue', { keyPath: 'runId' });
				}
				if (!database.objectStoreNames.contains('article_likes')) {
					database.createObjectStore('article_likes', { keyPath: 'slug' });
				}
			},
		});
	}
	return databasePromise;
}

function isValidDate(value: unknown): value is string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function normalizeChecklistOutcome(value: unknown): ChecklistOutcome | undefined {
	return value === 'used'
		|| value === 'unused'
		|| value === 'missed'
		|| value === 'remove_next'
		|| value === 'custom_helpful'
		? value
		: undefined;
}

export function normalizeChecklistRun(value: unknown): ChecklistRun | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<ChecklistRun>;
	if (
		typeof candidate.runId !== 'string'
		|| typeof candidate.checklistId !== 'string'
		|| !Number.isInteger(candidate.templateVersion)
		|| !Array.isArray(candidate.items)
		|| !isValidDate(candidate.updatedAt)
	) return null;
	const runUpdatedAt = candidate.updatedAt;

	const createdAt = isValidDate(candidate.createdAt)
		? candidate.createdAt
		: isValidDate(candidate.startedAt)
			? candidate.startedAt
			: candidate.updatedAt;
	const items = candidate.items.flatMap((item, order) => {
		if (!item || typeof item !== 'object') return [];
		const source = item as Partial<ChecklistRunItem>;
		if (typeof source.id !== 'string' || typeof source.label !== 'string') return [];
		return [{
			id: source.id,
			itemKey: typeof source.itemKey === 'string' ? source.itemKey : source.id,
			groupId: typeof source.groupId === 'string' ? source.groupId : 'legacy',
			groupLabel: typeof source.groupLabel === 'string' ? source.groupLabel : '移行済み項目',
			label: source.label,
			origin: source.origin === 'custom' ? 'custom' as const : 'template' as const,
			phase: source.phase === 'have' || source.phase === 'pack_day' ? source.phase : 'prepare' as const,
			order: Number.isFinite(source.order) ? Number(source.order) : order,
			checked: Boolean(source.checked),
			checkedAt: isValidDate(source.checkedAt) ? source.checkedAt : undefined,
			hidden: Boolean(source.hidden),
			note: typeof source.note === 'string' ? source.note : '',
			outcome: normalizeChecklistOutcome(source.outcome),
			updatedAt: isValidDate(source.updatedAt) ? source.updatedAt : runUpdatedAt,
		}];
	});

	return {
		runId: candidate.runId,
		checklistId: candidate.checklistId,
		templateVersion: candidate.templateVersion as number,
		status: candidate.status === 'prepared' || candidate.status === 'review_pending' || candidate.status === 'completed'
			? candidate.status
			: 'in_progress',
		items,
		note: typeof candidate.note === 'string' ? candidate.note : '',
		createdAt,
		startedAt: isValidDate(candidate.startedAt) ? candidate.startedAt : createdAt,
		preparedAt: isValidDate(candidate.preparedAt) ? candidate.preparedAt : undefined,
		reviewStartedAt: isValidDate(candidate.reviewStartedAt) ? candidate.reviewStartedAt : undefined,
		completedAt: isValidDate(candidate.completedAt) ? candidate.completedAt : undefined,
		updatedAt: runUpdatedAt,
		revision: Number.isInteger(candidate.revision) && Number(candidate.revision) >= 0 ? Number(candidate.revision) : 0,
	};
}

async function readSetting<T>(key: string): Promise<T | undefined> {
	const database = await getDatabase();
	return (await database.get('settings', key))?.value as T | undefined;
}

export async function setPrivateSetting<T>(key: string, value: T) {
	const database = await getDatabase();
	await database.put('settings', { key, value });
}

export async function getPrivateSetting<T>(key: string): Promise<T | undefined> {
	await initializePrivateDb();
	return readSetting<T>(key);
}

export async function getAnonymousArticleLike(slug: string) {
	const database = await getDatabase();
	return database.get('article_likes', slug);
}

export async function getAnonymousArticleLikes() {
	const database = await getDatabase();
	return database.getAll('article_likes');
}

export async function saveAnonymousArticleLike(value: AnonymousArticleLike) {
	const database = await getDatabase();
	await database.put('article_likes', value);
}

export async function deleteAnonymousArticleLike(slug: string) {
	const database = await getDatabase();
	await database.delete('article_likes', slug);
}

export async function migrateLegacyChecklistData(storage?: Storage) {
	if (await readSetting<unknown>(LEGACY_MIGRATION_KEY)) return;
	const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
	const database = await getDatabase();
	const legacyStore = readChecklistStore(target);
	const transaction = database.transaction(['runs', 'settings'], 'readwrite');

	for (const value of Object.values(legacyStore.runs)) {
		const run = normalizeChecklistRun(value);
		if (!run) continue;
		const existing = await transaction.objectStore('runs').get(run.runId);
		if (!existing || existing.updatedAt < run.updatedAt) {
			await transaction.objectStore('runs').put(run);
		}
	}
	const migratedRevision = Object.values(legacyStore.runs).reduce((highest, run) => Math.max(highest, run.revision ?? 0), 0);
	await transaction.objectStore('settings').put({ key: LOCAL_REVISION_KEY, value: migratedRevision });
	await transaction.objectStore('settings').put({
		key: LEGACY_MIGRATION_KEY,
		value: {
			completedAt: new Date().toISOString(),
			sourceKey: CHECKLIST_STORAGE_KEY,
			legacyDataRetained: true,
		},
	});
	await transaction.done;
}

export function initializePrivateDb() {
	if (!initializationPromise) {
		initializationPromise = migrateLegacyChecklistData().catch((error) => {
			initializationPromise = undefined;
			throw error;
		});
	}
	return initializationPromise;
}

function notifyChecklistChange(checklistId?: string) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('checklist-runs-changed', { detail: { checklistId } }));
}

export async function getPrivateChecklistRuns(): Promise<ChecklistRun[]> {
	await initializePrivateDb();
	const database = await getDatabase();
	return (await database.getAll('runs'))
		.map(normalizeChecklistRun)
		.filter((run): run is ChecklistRun => Boolean(run))
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getActivePrivateChecklistRun(checklistId: string): Promise<ChecklistRun | null> {
	await initializePrivateDb();
	const database = await getDatabase();
	const runs = (await database.getAllFromIndex('runs', 'by-checklist', checklistId))
		.map(normalizeChecklistRun)
		.filter((run): run is ChecklistRun => Boolean(run))
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	return runs.find((run) => run.status !== 'completed') ?? runs[0] ?? null;
}

export async function savePrivateChecklistRun(run: ChecklistRun, options?: { queueBackup?: boolean }) {
	await initializePrivateDb();
	const database = await getDatabase();
	const now = new Date().toISOString();
	const normalized = normalizeChecklistRun({
		...run,
		updatedAt: now,
		revision: Math.max(0, run.revision ?? 0) + 1,
	});
	if (!normalized) throw new Error('チェックリストの保存データが不正です。');
	Object.assign(run, normalized);
	const transaction = database.transaction(['runs', 'backupQueue', 'settings'], 'readwrite');
	await transaction.objectStore('runs').put(normalized);
	const revisionSetting = await transaction.objectStore('settings').get(LOCAL_REVISION_KEY);
	const localRevision = typeof revisionSetting?.value === 'number' ? revisionSetting.value + 1 : 1;
	await transaction.objectStore('settings').put({ key: LOCAL_REVISION_KEY, value: localRevision });
	if (options?.queueBackup !== false) {
		await transaction.objectStore('backupQueue').put({
			runId: normalized.runId,
			revision: normalized.revision,
			updatedAt: normalized.updatedAt,
		});
	}
	await transaction.done;
	notifyChecklistChange(normalized.checklistId);
	return normalized;
}

export async function importPrivateChecklistRuns(runs: ChecklistRun[], options?: {
	replace?: boolean;
	preserveConflicts?: boolean;
}) {
	await initializePrivateDb();
	const database = await getDatabase();
	const transaction = database.transaction(['runs', 'backupQueue', 'settings'], 'readwrite');
	if (options?.replace) {
		await transaction.objectStore('runs').clear();
		await transaction.objectStore('backupQueue').clear();
	}
	for (const value of runs) {
		const run = normalizeChecklistRun(value);
		if (!run) continue;
		const existing = await transaction.objectStore('runs').get(run.runId);
		if (
			existing
			&& options?.preserveConflicts
			&& JSON.stringify(existing) !== JSON.stringify(run)
		) {
			await transaction.objectStore('runs').put({ ...run, runId: createPrivateId() });
			continue;
		}
		if (!existing || existing.revision < run.revision || existing.updatedAt < run.updatedAt) {
			await transaction.objectStore('runs').put(run);
		}
	}
	const revisionSetting = await transaction.objectStore('settings').get(LOCAL_REVISION_KEY);
	const nextRevision = (typeof revisionSetting?.value === 'number' ? revisionSetting.value : 0) + 1;
	await transaction.objectStore('settings').put({ key: LOCAL_REVISION_KEY, value: nextRevision });
	await transaction.done;
	notifyChecklistChange();
}

export async function deletePrivateChecklistRun(runId: string) {
	await initializePrivateDb();
	const database = await getDatabase();
	const run = await database.get('runs', runId);
	if (!run) return;
	const transaction = database.transaction(['runs', 'backupQueue', 'settings'], 'readwrite');
	await transaction.objectStore('runs').delete(runId);
	const revisionSetting = await transaction.objectStore('settings').get(LOCAL_REVISION_KEY);
	const localRevision = typeof revisionSetting?.value === 'number' ? revisionSetting.value + 1 : 1;
	await transaction.objectStore('settings').put({ key: LOCAL_REVISION_KEY, value: localRevision });
	await transaction.objectStore('backupQueue').put({
		runId,
		revision: localRevision,
		updatedAt: new Date().toISOString(),
	});
	await transaction.done;
	notifyChecklistChange(run?.checklistId);
}

export async function deletePrivateChecklistRunsByChecklistId(checklistId: string) {
	await initializePrivateDb();
	const database = await getDatabase();
	const runs = (await database.getAllFromIndex('runs', 'by-checklist', checklistId))
		.map(normalizeChecklistRun)
		.filter((run): run is ChecklistRun => Boolean(run));
	if (runs.length === 0) return 0;

	const transaction = database.transaction(['runs', 'backupQueue', 'settings'], 'readwrite');
	const revisionSetting = await transaction.objectStore('settings').get(LOCAL_REVISION_KEY);
	const localRevision = typeof revisionSetting?.value === 'number' ? revisionSetting.value + 1 : 1;
	const updatedAt = new Date().toISOString();
	for (const run of runs) {
		await transaction.objectStore('runs').delete(run.runId);
		await transaction.objectStore('backupQueue').put({
			runId: run.runId,
			revision: localRevision,
			updatedAt,
		});
	}
	await transaction.objectStore('settings').put({ key: LOCAL_REVISION_KEY, value: localRevision });
	await transaction.done;
	notifyChecklistChange(checklistId);
	return runs.length;
}

export async function clearPrivateChecklistData() {
	await initializePrivateDb();
	const database = await getDatabase();
	const transaction = database.transaction(['runs', 'backupQueue', 'settings'], 'readwrite');
	await transaction.objectStore('runs').clear();
	await transaction.objectStore('backupQueue').clear();
	await transaction.objectStore('settings').put({ key: LOCAL_REVISION_KEY, value: 0 });
	await transaction.done;
	if (typeof window !== 'undefined') window.localStorage.removeItem(CHECKLIST_STORAGE_KEY);
	notifyChecklistChange();
}

export async function getBackupQueue() {
	await initializePrivateDb();
	return (await getDatabase()).getAll('backupQueue');
}

export async function clearBackupQueue(runIds?: string[]) {
	await initializePrivateDb();
	const database = await getDatabase();
	if (!runIds) {
		await database.clear('backupQueue');
		return;
	}
	const transaction = database.transaction('backupQueue', 'readwrite');
	for (const runId of runIds) await transaction.store.delete(runId);
	await transaction.done;
}

export async function getPrivateDataRevision() {
	await initializePrivateDb();
	return (await readSetting<number>(LOCAL_REVISION_KEY)) ?? 0;
}

export async function getOrCreateDeviceId() {
	await initializePrivateDb();
	const current = await readSetting<string>(DEVICE_ID_KEY);
	if (current) return current;
	const deviceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	await setPrivateSetting(DEVICE_ID_KEY, deviceId);
	return deviceId;
}
