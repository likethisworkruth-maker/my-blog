import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('回帰テストfixtureのMarkdownとChecklist JSONが1対1で対応する', () => {
	const markdown = read('tests/fixtures/content/003-regression-checklist.md');
	const template = JSON.parse(read('tests/fixtures/content/regression-test.json'));
	const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? '';
	const scalar = (key) => frontmatter.match(new RegExp('^' + key + ':\\s*(.+)$', 'm'))?.[1]?.trim();

	assert.equal(scalar('checklistId'), template.checklistId);
	assert.equal(scalar('title'), template.title);
	assert.match(markdown, /MarkdownとチェックリストJSON/);
	assert.equal(template.status, 'published');
	assert.ok(Array.isArray(template.groups) && template.groups.length > 0);
	const itemIds = template.groups.flatMap((group) => group.items.map((item) => item.id));
	assert.equal(itemIds.length, new Set(itemIds).size);
	assert.ok(itemIds.length >= 3);
});

test('旧サンプル記事のfixtureは保持しつつ、本番content collectionから除外する', () => {
	for (const { markdownPath, jsonPath, id } of [
		{ markdownPath: 'tests/fixtures/content/001-night-memo.md', jsonPath: 'tests/fixtures/content/night-memo.json', id: 'night-memo' },
		{ markdownPath: 'tests/fixtures/content/002-family-log.md', jsonPath: 'tests/fixtures/content/family-log.json', id: 'family-log' },
	]) {
		const markdown = read(markdownPath);
		const template = JSON.parse(read(jsonPath));
		const checklistId = markdown.match(/^checklistId:\s*"([^"]+)"/m)?.[1];
		assert.equal(checklistId, id);
		assert.equal(template.checklistId, id);
		assert.equal(existsSync(new URL(`../src/content/knowhow/${markdownPath.split('/').at(-1)}`, import.meta.url)), false);
		assert.equal(existsSync(new URL(`../src/content/checklists/${jsonPath.split('/').at(-1)}`, import.meta.url)), false);
	}
});
