import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	CDC_STORAGE_KEY,
	createEmptyCdcStorage,
	deactivateCdcStorageUser,
	normalizeCdcEnvelope,
	restoreCdcStorageForUser,
	saveCdcStorageForUser,
	saveCdcStorageLocally,
} from "../src/scripts/cdc-user-storage.ts";

class MemoryStorage {
	values = new Map();
	getItem(key) { return this.values.get(key) ?? null; }
	setItem(key, value) { this.values.set(key, String(value)); }
	removeItem(key) { this.values.delete(key); }
}

class MemoryCloud {
	rows = new Map();
	async read(userId) { return this.rows.get(userId) ?? null; }
	async write(userId, envelope) { this.rows.set(userId, structuredClone(envelope)); }
}

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const fixedNow = () => new Date("2026-10-03T00:00:00.000Z");

function storageWith(state) {
	const storage = new MemoryStorage();
	storage.setItem(CDC_STORAGE_KEY, JSON.stringify(state));
	return storage;
}

function existingRemote(state, updatedAt = "2026-10-01T00:00:00.000Z") {
	const value = normalizeCdcEnvelope(state, new Date(updatedAt));
	value.legacyPaths = [];
	value.updatedAt = updatedAt;
	Object.keys(value.fieldVersions).forEach((key) => { value.fieldVersions[key].updatedAt = updatedAt; });
	return value;
}

test("未連携の端末データを初回同期し、ログアウト後は別アカウントへ表示しない", async () => {
	const legacy = {
		...createEmptyCdcStorage(),
		selectedAge: "18 mo",
		milestoneAnswers: { "18 mo": { "0": "yes" } },
		checkedTips: { "18 mo": [1, 3] },
	};
	const storage = storageWith(legacy);
	const cloud = new MemoryCloud();
	const first = await restoreCdcStorageForUser(userA, { storage, cloud, now: fixedNow });
	assert.equal(first.status, "synced");
	assert.equal(first.state.selectedAge, "18 mo");
	assert.deepEqual(cloud.rows.get(userA).state.milestoneAnswers, legacy.milestoneAnswers);
	assert.deepEqual(cloud.rows.get(userA).state.checkedTips, legacy.checkedTips);

	const guest = deactivateCdcStorageUser({ storage, now: fixedNow });
	assert.equal(guest.selectedAge, "1 year");
	const second = await restoreCdcStorageForUser(userB, { storage, cloud, now: fixedNow });
	assert.equal(second.status, "synced");
	assert.deepEqual(second.state.milestoneAnswers, {});
	assert.deepEqual(second.state.checkedTips, {});
	assert.notEqual(second.state.selectedAge, "18 mo");
});

test("初回の同一項目衝突は同期済み回答を表示し、端末側の値も衝突記録に残す", async () => {
	const local = {
		...createEmptyCdcStorage(),
		selectedAge: "1 year",
		milestoneAnswers: { "1 year": { "0": "notYet", "1": "yes" } },
		checkedTips: { "1 year": [1] },
	};
	const remote = existingRemote({
		...createEmptyCdcStorage(),
		selectedAge: "2 years",
		milestoneAnswers: { "1 year": { "0": "yes", "2": "unknown" } },
		checkedTips: { "1 year": [2] },
	});
	const storage = storageWith(local);
	const cloud = new MemoryCloud();
	cloud.rows.set(userA, remote);
	const result = await restoreCdcStorageForUser(userA, { storage, cloud, now: fixedNow });

	assert.equal(result.status, "synced");
	assert.equal(result.state.selectedAge, "2 years");
	assert.equal(result.state.milestoneAnswers["1 year"]["0"], "yes");
	assert.equal(result.state.milestoneAnswers["1 year"]["1"], "yes");
	assert.equal(result.state.milestoneAnswers["1 year"]["2"], "unknown");
	assert.deepEqual(result.state.checkedTips["1 year"], [1, 2]);
	assert.ok(result.conflictCount > 0);
	assert.ok(cloud.rows.get(userA).conflicts.some((entry) => entry.localValue === "notYet" && entry.remoteValue === "yes"));
});

test("端末にアカウント用キャッシュがなくてもクラウドの年齢と回答を復元する", async () => {
	const storage = new MemoryStorage();
	const cloud = new MemoryCloud();
	cloud.rows.set(userA, existingRemote({
		...createEmptyCdcStorage(),
		selectedAge: "2 years",
		milestoneAnswers: { "2 years": { "0": "yes" } },
		checkedTips: { "2 years": [2] },
	}));

	const result = await restoreCdcStorageForUser(userA, { storage, cloud, now: fixedNow });
	assert.equal(result.status, "synced");
	assert.equal(result.state.selectedAge, "2 years");
	assert.deepEqual(result.state.milestoneAnswers["2 years"], { "0": "yes" });
	assert.deepEqual(result.state.checkedTips["2 years"], [2]);
});

test("ログアウト中の編集を別アカウントへ混ぜず、元アカウントには残す", async () => {
	const initial = {
		...createEmptyCdcStorage(),
		selectedAge: "18 mo",
		milestoneAnswers: { "18 mo": { "0": "yes" } },
	};
	const storage = storageWith(initial);
	const cloud = new MemoryCloud();
	let tick = 0;
	const advancingNow = () => new Date(Date.UTC(2026, 9, 3, 0, 0, tick++));
	await restoreCdcStorageForUser(userA, { storage, cloud, now: advancingNow });
	const guest = deactivateCdcStorageUser({ storage, now: advancingNow });
	const offlineEdit = {
		...guest,
		milestoneAnswers: { "1 year": { "0": "notYet" } },
	};
	saveCdcStorageLocally(offlineEdit, { storage, now: advancingNow });

	const second = await restoreCdcStorageForUser(userB, { storage, cloud, now: advancingNow });
	assert.deepEqual(second.state.milestoneAnswers, {});
	assert.deepEqual(cloud.rows.get(userB).state.milestoneAnswers, {});

	deactivateCdcStorageUser({ storage, now: advancingNow });
	const firstAgain = await restoreCdcStorageForUser(userA, { storage, cloud, now: advancingNow });
	assert.equal(firstAgain.state.milestoneAnswers["1 year"]["0"], "notYet");
	assert.equal(firstAgain.state.milestoneAnswers["18 mo"]["0"], "yes");
});

test("同期に失敗してもローカル回答を残し、後から同じユーザーで復元できる", async () => {
	const local = { ...createEmptyCdcStorage(), selectedAge: "30 mo", milestoneAnswers: { "30 mo": { "0": "yes" } } };
	const storage = storageWith(local);
	const offline = { read: async () => { throw new Error("offline"); }, write: async () => { throw new Error("offline"); } };
	const result = await restoreCdcStorageForUser(userA, { storage, cloud: offline, now: fixedNow });
	assert.equal(result.status, "pending");
	assert.deepEqual(JSON.parse(storage.getItem(CDC_STORAGE_KEY)).milestoneAnswers, local.milestoneAnswers);

	const localRestore = await restoreCdcStorageForUser(userA, { storage, now: fixedNow });
	assert.equal(localRestore.status, "local-only");
	assert.equal(localRestore.state.selectedAge, "30 mo");
	assert.equal(localRestore.state.milestoneAnswers["30 mo"]["0"], "yes");
});

test("クラウド読込中の編集は古い応答で上書きされず、その後同期される", async () => {
	const local = { ...createEmptyCdcStorage(), milestoneAnswers: { "1 year": { "0": "notYet" } } };
	const storage = storageWith(local);
	const cloud = new MemoryCloud();
	const remote = existingRemote({ ...createEmptyCdcStorage(), milestoneAnswers: { "1 year": { "0": "yes", "2": "unknown" } } });
	let releaseRead;
	let readStarted;
	const started = new Promise((resolve) => { readStarted = resolve; });
	const delayedCloud = {
		read: async (userId) => {
			if (userId === userA && !releaseRead) {
				readStarted();
				return new Promise((resolve) => { releaseRead = () => resolve(remote); });
			}
			return cloud.read(userId);
		},
		write: (userId, value) => cloud.write(userId, value),
	};
	const restoring = restoreCdcStorageForUser(userA, { storage, cloud: delayedCloud, now: fixedNow });
	await started;
	const edited = { ...local, milestoneAnswers: { "1 year": { "0": "yes" } } };
	const saving = saveCdcStorageForUser(userA, edited, { storage, cloud: delayedCloud, now: fixedNow });
	releaseRead();
	await Promise.all([restoring, saving]);
	assert.equal(JSON.parse(storage.getItem(CDC_STORAGE_KEY)).milestoneAnswers["1 year"]["0"], "yes");
	assert.equal(cloud.rows.get(userA).state.milestoneAnswers["1 year"]["0"], "yes");
	assert.equal(cloud.rows.get(userA).state.milestoneAnswers["1 year"]["2"], "unknown");
});

test("migrationはログイン中ユーザー本人の行だけを許可し、匿名アクセスと削除権限を付けない", () => {
	const sql = readFileSync(new URL("../supabase/migrations/20261003000000_cdc_user_settings.sql", import.meta.url), "utf8");
	assert.match(sql, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
	assert.match(sql, /alter table public\.cdc_user_settings enable row level security/i);
	assert.equal((sql.match(/auth\.uid\(\) = user_id/g) ?? []).length, 4);
	assert.match(sql, /grant select, insert, update on table public\.cdc_user_settings to authenticated/i);
	assert.doesNotMatch(sql, /grant [^;]*delete[^;]*cdc_user_settings/i);
	assert.doesNotMatch(sql, /to anon/i);
});
