import type { SupabaseClient } from "@supabase/supabase-js";
import { agesData } from "../data/cdc/cdcData.ts";
import type { Answer, AppStorage, ConcernKey } from "../data/cdc/types.ts";

export const CDC_STORAGE_KEY = "kids-growth-memo-app-storage-v1";
export const CDC_USER_SETTINGS_TABLE = "cdc_user_settings";

const META_KEY = "kids-growth-memo-cdc-sync-v1";
const GUEST_KEY = "kids-growth-memo-cdc-guest-v1";
const ACCOUNT_KEY = "kids-growth-memo-cdc-account-v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ageKeys = new Set(agesData.map(({ key }) => key));
const concernKeys = new Set<ConcernKey>(["regression", "milestones", "communication", "play", "movement", "senses", "other"]);

export interface CdcStorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

interface FieldVersion {
	updatedAt: string;
	deleted: boolean;
}

export interface CdcSyncConflict {
	path: string;
	localValue?: string | boolean;
	remoteValue?: string | boolean;
	localDeleted: boolean;
	remoteDeleted: boolean;
	recordedAt: string;
}

export interface CdcStorageEnvelope {
	formatVersion: 1;
	state: AppStorage;
	updatedAt: string;
	fieldVersions: Record<string, FieldVersion>;
	legacyPaths: string[];
	conflicts: CdcSyncConflict[];
}

export interface CdcCloudAdapter {
	read(userId: string): Promise<CdcStorageEnvelope | null>;
	write(userId: string, envelope: CdcStorageEnvelope): Promise<void>;
}

export interface CdcStorageOptions {
	storage?: CdcStorageLike;
	cloud?: CdcCloudAdapter;
	initialState?: unknown;
	now?: () => Date;
}

export interface CdcSyncResult {
	state: AppStorage;
	status: "synced" | "pending" | "local-only" | "account-mismatch";
	conflictCount: number;
}

interface SyncMeta {
	version: 1;
	activeUserId: string | null;
	claimedByUserId: string | null;
	revision: number;
}

type StateValue = string | boolean;
type Fields = Map<string, StateValue>;
const queues = new Map<string, Promise<CdcSyncResult>>();

export function createEmptyCdcStorage(): AppStorage {
	return {
		version: 1, selectedAge: "1 year", language: "ja", milestoneAnswers: {}, checkedTips: {},
		milestoneNotes: {}, favoriteTips: [], savedTips: [], concerns: {}, concernNotes: {},
	};
}

function storageFor(options?: CdcStorageOptions): CdcStorageLike {
	if (options?.storage) return options.storage;
	if (typeof window === "undefined") throw new Error("CDCデータを保存できるブラウザー領域がありません。");
	return window.localStorage;
}

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
	return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function stringMap(value: unknown): Record<string, string> {
	if (!record(value)) return {};
	const result: Record<string, string> = {};
	for (const [key, item] of Object.entries(value)) if (typeof item === "string") result[key] = item;
	return result;
}

export function normalizeCdcStorage(value: unknown): AppStorage | null {
	if (!record(value) || value.version !== 1) return null;
	const answers: AppStorage["milestoneAnswers"] = {};
	if (record(value.milestoneAnswers)) {
		for (const [age, items] of Object.entries(value.milestoneAnswers)) {
			if (!ageKeys.has(age) || !record(items)) continue;
			const valid = Object.fromEntries(Object.entries(items).filter(([, answer]) => answer === "yes" || answer === "notYet" || answer === "unknown")) as Record<string, Answer>;
			if (Object.keys(valid).length) answers[age] = valid;
		}
	}
	const arraysByAge = (input: unknown): Record<string, number[]> => {
		if (!record(input)) return {};
		return Object.fromEntries(Object.entries(input).flatMap(([age, values]) => {
			if (!ageKeys.has(age) || !Array.isArray(values)) return [];
			const valid = [...new Set(values.filter((item): item is number => Number.isSafeInteger(item) && item >= 0))].sort((a, b) => a - b);
			return valid.length ? [[age, valid]] : [];
		}));
	};
	const concerns: AppStorage["concerns"] = {};
	if (record(value.concerns)) {
		for (const [age, entries] of Object.entries(value.concerns)) {
			if (!ageKeys.has(age) || !Array.isArray(entries)) continue;
			const valid = [...new Set(entries.filter((item): item is ConcernKey => typeof item === "string" && concernKeys.has(item as ConcernKey)))];
			if (valid.length) concerns[age] = valid;
		}
	}
	const notesByAge: AppStorage["milestoneNotes"] = {};
	if (record(value.milestoneNotes)) {
		for (const [age, notes] of Object.entries(value.milestoneNotes)) {
			if (ageKeys.has(age) && record(notes)) notesByAge[age] = stringMap(notes);
		}
	}
	const concernNotes = record(value.concernNotes)
		? Object.fromEntries(Object.entries(value.concernNotes).filter(([age, note]) => ageKeys.has(age) && typeof note === "string")) as Record<string, string>
		: {};
	const stringArray = (input: unknown) => Array.isArray(input)
		? [...new Set(input.filter((item): item is string => typeof item === "string" && item.length > 0))]
		: [];
	return {
		version: 1,
		selectedAge: typeof value.selectedAge === "string" && ageKeys.has(value.selectedAge) ? value.selectedAge : "1 year",
		language: value.language === "en" ? "en" : "ja",
		milestoneAnswers: answers,
		checkedTips: arraysByAge(value.checkedTips),
		milestoneNotes: notesByAge,
		favoriteTips: stringArray(value.favoriteTips),
		savedTips: stringArray(value.savedTips),
		concerns,
		concernNotes,
	};
}

const path = (...parts: string[]) => JSON.stringify(parts);
function pathParts(key: string): string[] | null {
	try {
		const value: unknown = JSON.parse(key);
		return Array.isArray(value) && value.every((part) => typeof part === "string") ? value : null;
	} catch { return null; }
}

function flatten(state: AppStorage): Fields {
	const fields: Fields = new Map([[path("selectedAge"), state.selectedAge], [path("language"), state.language]]);
	for (const [age, answers] of Object.entries(state.milestoneAnswers)) for (const [id, answer] of Object.entries(answers)) fields.set(path("answer", age, id), answer);
	for (const [age, indexes] of Object.entries(state.checkedTips)) for (const index of indexes) fields.set(path("tip", age, String(index)), true);
	for (const [age, notes] of Object.entries(state.milestoneNotes)) for (const [id, note] of Object.entries(notes)) fields.set(path("note", age, id), note);
	for (const id of state.favoriteTips) fields.set(path("favorite", id), true);
	for (const id of state.savedTips) fields.set(path("savedTip", id), true);
	for (const [age, entries] of Object.entries(state.concerns)) for (const key of entries) fields.set(path("concern", age, key), true);
	for (const [age, note] of Object.entries(state.concernNotes)) fields.set(path("concernNote", age), note);
	return fields;
}

function inflate(fields: Fields): AppStorage {
	const state = createEmptyCdcStorage();
	const tips: Record<string, Set<number>> = {};
	const favorites = new Set<string>();
	const savedTips = new Set<string>();
	const concerns: Record<string, Set<ConcernKey>> = {};
	for (const [key, value] of fields) {
		const [kind, age, id] = pathParts(key) ?? [];
		if (kind === "selectedAge" && typeof value === "string" && ageKeys.has(value)) state.selectedAge = value;
		else if (kind === "language" && (value === "ja" || value === "en")) state.language = value;
		else if (kind === "answer" && age && id && (value === "yes" || value === "notYet" || value === "unknown")) (state.milestoneAnswers[age] ??= {})[id] = value;
		else if (kind === "tip" && age && id && value === true && Number.isSafeInteger(Number(id))) (tips[age] ??= new Set()).add(Number(id));
		else if (kind === "note" && age && id && typeof value === "string") (state.milestoneNotes[age] ??= {})[id] = value;
		else if (kind === "favorite" && age && value === true) favorites.add(age);
		else if (kind === "savedTip" && age && value === true) savedTips.add(age);
		else if (kind === "concern" && age && id && value === true && concernKeys.has(id as ConcernKey)) (concerns[age] ??= new Set()).add(id as ConcernKey);
		else if (kind === "concernNote" && age && id === undefined && typeof value === "string") state.concernNotes[age] = value;
	}
	state.checkedTips = Object.fromEntries(Object.entries(tips).map(([age, values]) => [age, [...values].sort((a, b) => a - b)]));
	state.favoriteTips = [...favorites].sort();
	state.savedTips = [...savedTips].sort();
	state.concerns = Object.fromEntries(Object.entries(concerns).map(([age, values]) => [age, [...values].sort()]));
	return state;
}

function envelope(stateInput: unknown, previous: CdcStorageEnvelope | null, now: Date, legacy = false): CdcStorageEnvelope {
	const state = normalizeCdcStorage(stateInput) ?? createEmptyCdcStorage();
	const fields = flatten(state);
	const oldFields = previous ? flatten(previous.state) : new Map<string, StateValue>();
	const allPaths = new Set([...fields.keys(), ...oldFields.keys(), ...(previous ? Object.keys(previous.fieldVersions) : [])]);
	const fieldVersions: Record<string, FieldVersion> = {};
	const legacyPaths = new Set(previous?.legacyPaths ?? []);
	for (const key of allPaths) {
		const same = previous && fields.has(key) === oldFields.has(key) && Object.is(fields.get(key), oldFields.get(key));
		if (same) {
			fieldVersions[key] = previous.fieldVersions[key] ?? { updatedAt: previous.updatedAt, deleted: !fields.has(key) };
		} else {
			fieldVersions[key] = { updatedAt: now.toISOString(), deleted: !fields.has(key) };
			legacyPaths.delete(key);
		}
	}
	return {
		formatVersion: 1, state, updatedAt: now.toISOString(), fieldVersions,
		legacyPaths: previous ? [...legacyPaths] : legacy ? [...fields.keys()] : [],
		conflicts: previous?.conflicts ?? [],
	};
}

export function normalizeCdcEnvelope(value: unknown, now = new Date()): CdcStorageEnvelope | null {
	if (!record(value)) return null;
	if (value.formatVersion !== 1) {
		const oldState = normalizeCdcStorage(value);
		return oldState ? envelope(oldState, null, now, true) : null;
	}
	const state = normalizeCdcStorage(value.state);
	if (!state || !validDate(value.updatedAt) || !record(value.fieldVersions)) return null;
	const fieldVersions: Record<string, FieldVersion> = {};
	for (const [key, item] of Object.entries(value.fieldVersions)) {
		if (pathParts(key) && record(item) && validDate(item.updatedAt) && typeof item.deleted === "boolean") {
			fieldVersions[key] = { updatedAt: item.updatedAt, deleted: item.deleted };
		}
	}
	const conflicts = Array.isArray(value.conflicts) ? value.conflicts.filter((item): item is CdcSyncConflict =>
		record(item) && Boolean(pathParts(String(item.path))) && typeof item.localDeleted === "boolean"
		&& typeof item.remoteDeleted === "boolean" && validDate(item.recordedAt),
	) as CdcSyncConflict[] : [];
	return {
		formatVersion: 1, state, updatedAt: value.updatedAt, fieldVersions,
		legacyPaths: Array.isArray(value.legacyPaths) ? value.legacyPaths.filter((key): key is string => typeof key === "string" && Boolean(pathParts(key))) : [],
		conflicts,
	};
}

function merge(local: CdcStorageEnvelope, remote: CdcStorageEnvelope, now: Date): CdcStorageEnvelope {
	const localFields = flatten(local.state);
	const remoteFields = flatten(remote.state);
	const allPaths = new Set([...localFields.keys(), ...remoteFields.keys(), ...Object.keys(local.fieldVersions), ...Object.keys(remote.fieldVersions)]);
	const merged: Fields = new Map();
	const versions: Record<string, FieldVersion> = {};
	const conflicts = [...local.conflicts, ...remote.conflicts];
	for (const key of allPaths) {
		const lv = local.fieldVersions[key];
		const rv = remote.fieldVersions[key];
		const localHas = lv ? !lv.deleted : localFields.has(key);
		const remoteHas = rv ? !rv.deleted : remoteFields.has(key);
		const localValue = lv?.deleted ? undefined : localFields.get(key);
		const remoteValue = rv?.deleted ? undefined : remoteFields.get(key);
		let chooseLocal = false;
		if (localHas !== remoteHas || !Object.is(localValue, remoteValue)) {
			const differingPresentValues = localHas && remoteHas && !Object.is(localValue, remoteValue);
			if (differingPresentValues && local.legacyPaths.includes(key) && !remote.legacyPaths.includes(key)) chooseLocal = false;
			else if (differingPresentValues && remote.legacyPaths.includes(key) && !local.legacyPaths.includes(key)) chooseLocal = true;
			else if (lv && rv && lv.updatedAt !== rv.updatedAt) chooseLocal = lv.updatedAt > rv.updatedAt;
			else if (lv && !rv) chooseLocal = true;
			else if (rv && !lv) chooseLocal = false;
			else if (localHas !== remoteHas) chooseLocal = localHas;
			conflicts.push({ path: key, localValue, remoteValue, localDeleted: !localHas, remoteDeleted: !remoteHas, recordedAt: now.toISOString() });
		} else {
			chooseLocal = Boolean(lv && (!rv || lv.updatedAt >= rv.updatedAt));
		}
		const chosenHas = chooseLocal ? localHas : remoteHas;
		const chosenValue = chooseLocal ? localValue : remoteValue;
		const chosenVersion = chooseLocal ? lv : rv;
		if (chosenHas && chosenValue !== undefined) merged.set(key, chosenValue);
		versions[key] = chosenVersion ?? { updatedAt: now.toISOString(), deleted: !chosenHas };
	}
	const uniqueConflicts = new Map(conflicts.map((item) => [JSON.stringify([item.path, item.localValue, item.remoteValue, item.localDeleted, item.remoteDeleted]), item]));
	return {
		formatVersion: 1,
		state: inflate(merged),
		updatedAt: local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt,
		fieldVersions: versions,
		legacyPaths: [...new Set([...local.legacyPaths, ...remote.legacyPaths])],
		conflicts: [...uniqueConflicts.values()],
	};
}

function accountKey(userId: string) { return ACCOUNT_KEY + encodeURIComponent(userId); }
function defaultMeta(): SyncMeta { return { version: 1, activeUserId: null, claimedByUserId: null, revision: 0 }; }
function readMeta(storage: CdcStorageLike): SyncMeta {
	const raw = storage.getItem(META_KEY);
	if (raw === null) return defaultMeta();
	try {
		const value: unknown = JSON.parse(raw);
		if (!record(value) || value.version !== 1) throw new Error("invalid CDC sync metadata");
		return {
			version: 1,
			activeUserId: typeof value.activeUserId === "string" ? value.activeUserId : null,
			claimedByUserId: typeof value.claimedByUserId === "string" ? value.claimedByUserId : null,
			revision: Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 ? Number(value.revision) : 0,
		};
	} catch {
		if (storage.getItem(`${META_KEY}:recovery`) === null) storage.setItem(`${META_KEY}:recovery`, raw);
		return { ...defaultMeta(), claimedByUserId: "__unknown__" };
	}
}

function readJson(storage: CdcStorageLike, key: string): unknown {
	const raw = storage.getItem(key);
	if (!raw) return undefined;
	try { return JSON.parse(raw) as unknown; } catch {
		if (storage.getItem(`${key}:recovery`) === null) storage.setItem(`${key}:recovery`, raw);
		return undefined;
	}
}

function readState(storage: CdcStorageLike, key = CDC_STORAGE_KEY): AppStorage | null {
	return normalizeCdcStorage(readJson(storage, key));
}

function readEnvelope(storage: CdcStorageLike, userId: string | null, now: Date): CdcStorageEnvelope | null {
	const key = userId ? accountKey(userId) : GUEST_KEY;
	const saved = normalizeCdcEnvelope(readJson(storage, key), now);
	if (saved) return saved;
	const state = readState(storage, userId ? accountKey(userId) + ":state" : `${GUEST_KEY}:state`);
	return state ? envelope(state, null, now, true) : null;
}

function writeEnvelope(storage: CdcStorageLike, userId: string | null, value: CdcStorageEnvelope): void {
	const key = userId ? accountKey(userId) : GUEST_KEY;
	storage.setItem(key, JSON.stringify(value));
	storage.setItem(`${key}:state`, JSON.stringify(value.state));
}

function writeActive(storage: CdcStorageLike, state: AppStorage) {
	storage.setItem(CDC_STORAGE_KEY, JSON.stringify(state));
}

function validUserId(userId: string): string {
	if (!UUID.test(userId)) throw new Error("Googleアカウントの識別子が不正です。");
	return userId;
}

function queued(userId: string, task: () => Promise<CdcSyncResult>): Promise<CdcSyncResult> {
	const previous = queues.get(userId) ?? Promise.resolve({ state: createEmptyCdcStorage(), status: "local-only" as const, conflictCount: 0 });
	const next = previous.catch(() => ({ state: createEmptyCdcStorage(), status: "local-only" as const, conflictCount: 0 })).then(task);
	queues.set(userId, next);
	void next.finally(() => { if (queues.get(userId) === next) queues.delete(userId); }).catch(() => undefined);
	return next;
}

async function syncAccount(userId: string, storage: CdcStorageLike, cloud: CdcCloudAdapter, now: () => Date): Promise<CdcSyncResult> {
	if (readMeta(storage).activeUserId !== userId) return { state: readState(storage) ?? createEmptyCdcStorage(), status: "account-mismatch", conflictCount: 0 };
	try {
		const remote = await cloud.read(userId);
		const local = readEnvelope(storage, userId, now()) ?? envelope(readState(storage) ?? createEmptyCdcStorage(), null, now());
		const merged = remote ? merge(local, remote, now()) : local;
		const meta = readMeta(storage);
		const revision = meta.revision;
		writeEnvelope(storage, userId, merged);
		writeActive(storage, merged.state);
		await cloud.write(userId, merged);
		const latestMeta = readMeta(storage);
		if (latestMeta.activeUserId === userId && latestMeta.revision === revision) {
			const synced = { ...merged, legacyPaths: [] };
			writeEnvelope(storage, userId, synced);
			writeActive(storage, synced.state);
			const unknownOwner = latestMeta.claimedByUserId === "__unknown__";
			const claimedByUserId = unknownOwner ? "__unknown__" : userId;
			storage.setItem(META_KEY, JSON.stringify({ ...latestMeta, claimedByUserId } satisfies SyncMeta));
			if (!unknownOwner) { storage.removeItem(GUEST_KEY); storage.removeItem(`${GUEST_KEY}:state`); }
			return { state: synced.state, status: "synced", conflictCount: synced.conflicts.length };
		}
		return { state: readState(storage) ?? merged.state, status: "pending", conflictCount: merged.conflicts.length };
	} catch {
		return { state: readState(storage) ?? createEmptyCdcStorage(), status: "pending", conflictCount: 0 };
	}
}

export function createSupabaseCdcCloudAdapter(client: SupabaseClient): CdcCloudAdapter {
	return {
		async read(userId) {
			const { data, error } = await client.auth.getSession();
			if (error) throw error;
			if (data.session?.user.id !== userId) throw new Error("CDCデータの読み込み先とログイン中のアカウントが一致しません。");
			const query = client.from(CDC_USER_SETTINGS_TABLE) as unknown as { select(columns: string): { eq(column: string, value: string): { maybeSingle(): Promise<{ data: unknown; error: unknown }> } } };
			const result = await query.select("user_id, storage").eq("user_id", userId).maybeSingle();
			if (result.error) throw result.error;
			if (result.data === null) return null;
			if (!record(result.data) || result.data.user_id !== userId) throw new Error("CDCデータの所有者を確認できません。");
			const value = normalizeCdcEnvelope(result.data.storage);
			if (!value) throw new Error("クラウド上のCDCデータ形式を読み取れません。");
			return value;
		},
		async write(userId, value) {
			const { data, error } = await client.auth.getSession();
			if (error) throw error;
			if (data.session?.user.id !== userId) throw new Error("CDCデータの保存先とログイン中のアカウントが一致しません。");
			const query = client.from(CDC_USER_SETTINGS_TABLE) as unknown as { upsert(values: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: unknown }> };
			const result = await query.upsert({ user_id: userId, storage: value }, { onConflict: "user_id" });
			if (result.error) throw result.error;
		},
	};
}

export async function restoreCdcStorageForUser(userIdInput: string, options: CdcStorageOptions = {}): Promise<CdcSyncResult> {
	const userId = validUserId(userIdInput);
	const storage = storageFor(options);
	const now = options.now ?? (() => new Date());
	const meta = readMeta(storage);
	const current = readState(storage) ?? (
		(!meta.activeUserId || meta.activeUserId === userId)
		&& (!meta.claimedByUserId || meta.claimedByUserId === userId)
			? normalizeCdcStorage(options.initialState)
			: null
	);
	let local = readEnvelope(storage, userId, now());
	const hadAccountLocal = Boolean(local);
	if (meta.activeUserId === userId && current) {
		local = local ? envelope(current, local, now()) : envelope(current, null, now(), true);
	}
	if (meta.activeUserId && meta.activeUserId !== userId) {
		const previous = readEnvelope(storage, meta.activeUserId, now()) ?? (current ? envelope(current, null, now(), true) : null);
		if (previous) writeEnvelope(storage, meta.activeUserId, previous);
	} else if (!local && !meta.activeUserId && current && (!meta.claimedByUserId || meta.claimedByUserId === userId)) {
		const savedGuest = readEnvelope(storage, null, now());
		local = savedGuest ? envelope(current, savedGuest, now()) : envelope(current, null, now(), true);
		storage.setItem(`${GUEST_KEY}:state`, JSON.stringify(current));
		storage.setItem(GUEST_KEY, JSON.stringify(local));
	} else if (!meta.activeUserId && current && meta.claimedByUserId === "__unknown__") {
		if (storage.getItem(`${GUEST_KEY}:state`) === null) {
			storage.setItem(`${GUEST_KEY}:state`, JSON.stringify(current));
			storage.setItem(GUEST_KEY, JSON.stringify(envelope(current, null, now(), true)));
		}
	}
	if (meta.claimedByUserId && meta.claimedByUserId !== userId && meta.claimedByUserId !== "__unknown__") {
		const previousOwner = meta.claimedByUserId;
		const guest = readEnvelope(storage, null, now()) ?? (!meta.activeUserId && current ? envelope(current, null, now(), true) : null);
		if (guest) {
			const previous = readEnvelope(storage, previousOwner, now()) ?? envelope(createEmptyCdcStorage(), null, now());
			writeEnvelope(storage, previousOwner, merge(guest, previous, now()));
			storage.removeItem(GUEST_KEY);
			storage.removeItem(`${GUEST_KEY}:state`);
		}
	}
	if (!meta.activeUserId && meta.claimedByUserId === userId && hadAccountLocal && local) {
		const savedGuest = readEnvelope(storage, null, now());
		if (savedGuest) local = merge(savedGuest, local, now());
	}
	if (!meta.activeUserId && !meta.claimedByUserId && hadAccountLocal && local) {
		const savedGuest = readEnvelope(storage, null, now());
		if (savedGuest) local = merge(savedGuest, local, now());
	}
	local ??= envelope(createEmptyCdcStorage(), null, now(), true);
	writeEnvelope(storage, userId, local);
	writeActive(storage, local.state);
	storage.setItem(META_KEY, JSON.stringify({
		...meta,
		activeUserId: userId,
		claimedByUserId: meta.claimedByUserId === "__unknown__" ? "__unknown__" : userId,
	} satisfies SyncMeta));
	if (!options.cloud) return { state: local.state, status: "local-only", conflictCount: local.conflicts.length };
	return queued(userId, () => syncAccount(userId, storage, options.cloud!, now));
}

export async function saveCdcStorageForUser(userIdInput: string, stateValue: unknown, options: CdcStorageOptions = {}): Promise<CdcSyncResult> {
	const userId = validUserId(userIdInput);
	const storage = storageFor(options);
	const state = normalizeCdcStorage(stateValue);
	if (!state) throw new Error("CDCデータの形式が不正です。");
	const meta = readMeta(storage);
	if (meta.activeUserId !== userId) return { state: readState(storage) ?? state, status: "account-mismatch", conflictCount: 0 };
	const now = options.now ?? (() => new Date());
	const previous = readEnvelope(storage, userId, now()) ?? envelope(state, null, now(), true);
	const next = envelope(state, previous, now());
	writeEnvelope(storage, userId, next);
	writeActive(storage, state);
	const revision = meta.revision + 1;
	storage.setItem(META_KEY, JSON.stringify({ ...meta, revision } satisfies SyncMeta));
	if (!options.cloud) return { state, status: "local-only", conflictCount: next.conflicts.length };
	return queued(userId, () => syncAccount(userId, storage, options.cloud!, now));
}

export function saveCdcStorageLocally(stateValue: unknown, options: Pick<CdcStorageOptions, "storage" | "now"> = {}): AppStorage {
	const state = normalizeCdcStorage(stateValue);
	if (!state) throw new Error("CDCデータの形式が不正です。");
	const storage = storageFor(options);
	const meta = readMeta(storage);
	const now = options.now ?? (() => new Date());
	const previous = readEnvelope(storage, meta.activeUserId, now());
	const next = envelope(state, previous, now());
	writeEnvelope(storage, meta.activeUserId, next);
	writeActive(storage, state);
	storage.setItem(META_KEY, JSON.stringify({ ...meta, revision: meta.revision + 1 } satisfies SyncMeta));
	return state;
}

export function deactivateCdcStorageUser(options: Pick<CdcStorageOptions, "storage" | "now" | "initialState"> = {}): AppStorage {
	const storage = storageFor(options);
	const meta = readMeta(storage);
	const now = (options.now ?? (() => new Date()))();
	const hadActiveUser = Boolean(meta.activeUserId);
	if (meta.activeUserId) {
		const state = readState(storage);
		const previous = readEnvelope(storage, meta.activeUserId, now);
		if (state) {
			const saved = envelope(state, previous, now);
			writeEnvelope(storage, meta.activeUserId, saved);
			meta.revision += 1;
		}
	}
	const guest = hadActiveUser && meta.claimedByUserId
		? createEmptyCdcStorage()
		: readState(storage, `${GUEST_KEY}:state`)
			?? (!hadActiveUser ? readState(storage) ?? normalizeCdcStorage(options.initialState) : null)
			?? createEmptyCdcStorage();
	writeActive(storage, guest);
	storage.setItem(META_KEY, JSON.stringify({ ...meta, activeUserId: null } satisfies SyncMeta));
	return guest;
}
