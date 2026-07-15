import test from 'node:test';
import assert from 'node:assert/strict';
import {
	createChecklistRun,
	deleteChecklistRun,
	duplicateChecklistRun,
	getActiveChecklistRun,
	getChecklistProgress,
	getChecklistRuns,
	readChecklistStore,
	resetChecklistRun,
	saveChecklistRun,
} from '../src/scripts/checklist-state.ts';

class MemoryStorage {
	#values = new Map();

	get length() {
		return this.#values.size;
	}

	clear() {
		this.#values.clear();
	}

	getItem(key) {
		return this.#values.get(key) ?? null;
	}

	key(index) {
		return Array.from(this.#values.keys())[index] ?? null;
	}

	removeItem(key) {
		this.#values.delete(key);
	}

	setItem(key, value) {
		this.#values.set(key, String(value));
	}
}

const template = {
	checklistId: 'sample-list',
	title: 'サンプル',
	version: 1,
	status: 'published',
	groups: [
		{
			id: 'preparation',
			label: '準備',
			items: [
				{ id: 'first', label: '最初の項目', defaultPhase: 'prepare' },
				{ id: 'second', label: '次の項目', defaultPhase: 'pack_day' },
			],
		},
	],
};

test('原本から開始状態を作成し、非表示項目を進捗の母数から除く', () => {
	const run = createChecklistRun(template);
	assert.equal(run.status, 'in_progress');
	assert.equal(run.items.length, 2);

	run.items[0].checked = true;
	run.items[1].hidden = true;
	assert.deepEqual(getChecklistProgress(run), {
		completed: 1,
		total: 1,
		percent: 100,
	});
});

test('同じチェックリストの履歴を残しながら、複製版をアクティブにする', () => {
	const storage = new MemoryStorage();
	const original = createChecklistRun(template);
	original.status = 'completed';
	saveChecklistRun(original, { storage });

	const duplicated = duplicateChecklistRun(original);
	saveChecklistRun(duplicated, { storage });

	assert.equal(getChecklistRuns(storage).length, 2);
	assert.equal(getActiveChecklistRun(template.checklistId, storage)?.runId, duplicated.runId);
	assert.equal(duplicated.status, 'in_progress');
	assert.ok(duplicated.items.every((item) => !item.checked && !item.outcome));

	deleteChecklistRun(duplicated.runId, storage);
	assert.equal(getActiveChecklistRun(template.checklistId, storage)?.runId, original.runId);
});

test('初期状態へ戻すと追加・非表示・チェック・メモを消す', () => {
	const run = createChecklistRun(template);
	run.items[0].checked = true;
	run.items[0].hidden = true;
	run.items[0].note = 'メモ';
	run.items.push({
		id: '12345678-1234-4123-8123-123456789012',
		itemKey: 'custom-item',
		groupId: 'custom',
		groupLabel: '自分で追加',
		label: '追加項目',
		origin: 'custom',
		phase: 'prepare',
		order: 3,
		checked: false,
		hidden: false,
		note: '',
	});

	const reset = resetChecklistRun(run, template);
	assert.equal(reset.runId, run.runId);
	assert.equal(reset.items.length, 2);
	assert.ok(reset.items.every((item) => !item.checked && !item.hidden && item.note === ''));
});

test('壊れたLocalStorageデータは空のStoreとして扱う', () => {
	const storage = new MemoryStorage();
	storage.setItem('likethis:checklist-runs:v1', '{invalid json');
	const originalWarn = console.warn;
	console.warn = () => {};
	const store = readChecklistStore(storage);
	console.warn = originalWarn;
	assert.deepEqual(store.runs, {});
	assert.deepEqual(store.activeRunIds, {});
});
