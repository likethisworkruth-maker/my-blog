import test from 'node:test';
import assert from 'node:assert/strict';
import {
	compareKnowhowByAge,
	compareKnowhowByRecommendation,
	sortKnowhowEntries,
} from '../src/scripts/knowhow-sort.ts';
import {
	readKnowhowListCache,
	saveKnowhowListCache,
} from '../src/scripts/knowhow-list-cache.ts';

test('年齢順では0か月を有効値として扱い、未設定値を最後にする', () => {
	const entries = [
		{ id: 'unset' },
		{ id: 'four-months', data: { childAgeMonths: 4 } },
		{ id: 'zero-months', data: { childAgeMonths: 0 } },
	];

	assert.deepEqual(sortKnowhowEntries(entries, 'age').map(({ id }) => id), [
		'zero-months',
		'four-months',
		'unset',
	]);
	assert.equal(compareKnowhowByAge(entries[2], entries[0]), -1);
});

test('同年齢ではtimelineOrder、さらにidで安定して並べる', () => {
	const entries = [
		{ id: 'c', data: { childAgeMonths: 8 } },
		{ id: 'later', data: { childAgeMonths: 8, timelineOrder: 20 } },
		{ id: 'a', data: { childAgeMonths: 8 } },
		{ id: 'earlier', data: { childAgeMonths: 8, timelineOrder: 10 } },
	];

	assert.deepEqual(sortKnowhowEntries(entries, 'age').map(({ id }) => id), [
		'earlier',
		'later',
		'a',
		'c',
	]);
});

test('おすすめ順はおすすめ記事を先頭にし、各グループを年齢順にする', () => {
	const entries = [
		{ id: 'regular-early', data: { childAgeMonths: 1 } },
		{ id: 'recommended-late', data: { childAgeMonths: 7, recommended: true } },
		{ id: 'recommended-early', data: { childAgeMonths: 2, recommended: true } },
		{ id: 'regular-unknown' },
	];

	assert.deepEqual(sortKnowhowEntries(entries, 'recommend').map(({ id }) => id), [
		'recommended-early',
		'recommended-late',
		'regular-early',
		'regular-unknown',
	]);
	assert.ok(compareKnowhowByRecommendation(entries[1], entries[0]) < 0);
});

test('年齢順とorderedIdsを一覧キャッシュへ保存し復元する', () => {
	const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
	const values = new Map();
	Object.defineProperty(globalThis, 'sessionStorage', {
		configurable: true,
		value: {
			getItem: (key) => values.get(key) ?? null,
			setItem: (key, value) => values.set(key, String(value)),
			removeItem: (key) => values.delete(key),
		},
	});

	try {
		saveKnowhowListCache({
			sourcePath: '/my-knowhow/',
			view: 'my',
			displayMode: 'headline_view',
			phases: [],
			scene: 'all',
			favoriteOnly: false,
			completedOnly: false,
			searchKeyword: '',
			sort: 'age',
			orderedIds: ['youngest', 'next'],
		});

		const restored = readKnowhowListCache();
		assert.equal(restored?.sort, 'age');
		assert.deepEqual(restored?.orderedIds, ['youngest', 'next']);
	} finally {
		if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
		else delete globalThis.sessionStorage;
	}
});
