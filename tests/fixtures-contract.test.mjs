import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
