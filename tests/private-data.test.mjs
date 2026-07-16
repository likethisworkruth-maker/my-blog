import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { createChecklistRun, duplicateChecklistRun } from '../src/scripts/checklist-state.ts';
import {
	PRIVATE_DB_NAME,
	clearPrivateChecklistData,
	deletePrivateChecklistRun,
	getActivePrivateChecklistRun,
	getBackupQueue,
	getPrivateChecklistRuns,
	getPrivateDataRevision,
	importPrivateChecklistRuns,
	normalizeChecklistRun,
	savePrivateChecklistRun,
} from '../src/scripts/private-db.ts';
import { validateDriveBackupPayload } from '../src/scripts/drive-backup.ts';
import { assertDriveAccountMatches } from '../src/scripts/drive-authorization.ts';
import { createAnonymousLikeToken } from '../src/scripts/article-likes.ts';
import {
	PRIVATE_DB_VERSION,
	deleteAnonymousArticleLike,
	getAnonymousArticleLike,
	getAnonymousArticleLikes,
	saveAnonymousArticleLike,
} from '../src/scripts/private-db.ts';

const template = {
	checklistId: 'private-test',
	title: '端末保存テスト',
	version: 1,
	status: 'published',
	groups: [{ id: 'setup', label: '準備', items: [{ id: 'first', label: '確認する' }] }],
};

test.before(async () => {
	await deleteDB(PRIVATE_DB_NAME);
});

test('旧localStorage形式のrunをprivate DB形式へ正規化する', () => {
	const legacy = createChecklistRun(template);
	delete legacy.note;
	delete legacy.createdAt;
	delete legacy.revision;
	delete legacy.items[0].updatedAt;
	const normalized = normalizeChecklistRun(legacy);
	assert.ok(normalized);
	assert.equal(normalized.note, '');
	assert.equal(normalized.createdAt, legacy.startedAt);
	assert.equal(normalized.revision, 0);
	assert.equal(normalized.items[0].updatedAt, legacy.updatedAt);
});

test('IndexedDBへ保存し、未完了の最新runを優先して取得する', async () => {
	await clearPrivateChecklistData();
	const completed = createChecklistRun(template);
	completed.status = 'completed';
	completed.completedAt = new Date().toISOString();
	await savePrivateChecklistRun(completed);

	const active = duplicateChecklistRun(completed);
	active.note = '端末だけのテストメモ';
	await savePrivateChecklistRun(active);

	assert.equal((await getPrivateChecklistRuns()).length, 2);
	assert.equal((await getActivePrivateChecklistRun(template.checklistId))?.runId, active.runId);
	assert.equal((await getActivePrivateChecklistRun(template.checklistId))?.note, '端末だけのテストメモ');
	assert.ok((await getPrivateDataRevision()) >= 2);
});

test('IndexedDB v2で匿名いいね資格情報をチェックリストと分離して保存する', async () => {
	assert.equal(PRIVATE_DB_VERSION, 2);
	const now = new Date().toISOString();
	await saveAnonymousArticleLike({
		slug: 'knowhow/private-test',
		token: 'anonymous-test-token-that-is-long-enough-0001',
		liked: true,
		createdAt: now,
		updatedAt: now,
	});
	assert.equal((await getAnonymousArticleLike('knowhow/private-test'))?.liked, true);

	await clearPrivateChecklistData();
	assert.equal((await getAnonymousArticleLike('knowhow/private-test'))?.token, 'anonymous-test-token-that-is-long-enough-0001');
	assert.deepEqual(await getPrivateChecklistRuns(), []);

	await deleteAnonymousArticleLike('knowhow/private-test');
	assert.deepEqual(await getAnonymousArticleLikes(), []);
});

test('匿名いいねトークンはWeb Crypto由来の32バイトをBase64URL化する', () => {
	const token = createAnonymousLikeToken({
		getRandomValues(array) {
			for (let index = 0; index < array.length; index += 1) array[index] = index;
			return array;
		},
	});
	assert.equal(token.length, 43);
	assert.match(token, /^[a-zA-Z0-9_-]+$/);
});

test('DriveバックアップJSONを検証し、不正なデータを拒否する', async () => {
	const runs = await getPrivateChecklistRuns();
	const payload = {
		schemaVersion: 1,
		deviceId: 'test-device',
		revision: await getPrivateDataRevision(),
		exportedAt: new Date().toISOString(),
		runs,
	};
	assert.equal(validateDriveBackupPayload(payload)?.runs.length, runs.length);
	assert.equal(validateDriveBackupPayload({ ...payload, schemaVersion: 2 }), null);
	assert.equal(validateDriveBackupPayload({ ...payload, revision: -1 }), null);
	assert.equal(validateDriveBackupPayload({ ...payload, runs: [{ broken: true }] }), null);
});

test('Drive認可アカウントをSupabaseログインメールと照合する', async () => {
	const matchingRequest = async (_url, options) => {
		assert.match(options.headers.Authorization, /^Bearer /);
		return new Response(JSON.stringify({ user: { emailAddress: 'Parent@Example.com' } }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	};
	assert.equal(
		await assertDriveAccountMatches('matching-token', 'parent@example.com', matchingRequest),
		'Parent@Example.com',
	);

	const differentAccountRequest = async () => new Response(
		JSON.stringify({ user: { emailAddress: 'other@example.com' } }),
		{ status: 200, headers: { 'Content-Type': 'application/json' } },
	);
	await assert.rejects(
		assertDriveAccountMatches('wrong-account-token', 'parent@example.com', differentAccountRequest),
		/一致しません/,
	);
});

test('競合した同一runを両方残し、片方を別runとして保持する', async () => {
	await clearPrivateChecklistData();
	const local = createChecklistRun(template);
	await savePrivateChecklistRun(local);
	const remote = {
		...local,
		note: 'Drive側で更新したメモ',
		revision: local.revision + 1,
		updatedAt: new Date(Date.now() + 1_000).toISOString(),
	};
	await importPrivateChecklistRuns([remote], { preserveConflicts: true });
	const runs = await getPrivateChecklistRuns();
	assert.equal(runs.length, 2);
	assert.equal(new Set(runs.map((run) => run.runId)).size, 2);
	assert.deepEqual(new Set(runs.map((run) => run.note)), new Set(['', 'Drive側で更新したメモ']));
});

test('run削除もrevisionを進めてDrive反映待ちにする', async () => {
	await clearPrivateChecklistData();
	const run = createChecklistRun(template);
	await savePrivateChecklistRun(run);
	const before = await getPrivateDataRevision();
	await deletePrivateChecklistRun(run.runId);
	assert.equal(await getPrivateDataRevision(), before + 1);
	assert.equal((await getBackupQueue()).some((entry) => entry.runId === run.runId), true);
});

test('端末データの削除でrunとrevisionを消す', async () => {
	await clearPrivateChecklistData();
	assert.deepEqual(await getPrivateChecklistRuns(), []);
	assert.equal(await getPrivateDataRevision(), 0);
});
