import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const knowhowDirectory = join(root, 'src', 'content', 'knowhow');
const checklistDirectory = join(root, 'src', 'content', 'checklists');
const errors = [];

function listFiles(directory, extensions) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return listFiles(path, extensions);
		return extensions.includes(extname(entry.name)) ? [path] : [];
	});
}

const checklistFiles = listFiles(checklistDirectory, ['.json']);
const checklists = new Map();

for (const file of checklistFiles) {
	let checklist;
	try {
		checklist = JSON.parse(readFileSync(file, 'utf8'));
	} catch (error) {
		errors.push(file + ': JSONを読み込めません（' + error.message + '）');
		continue;
	}

	const fileId = basename(file, '.json');
	if (!checklist.checklistId) {
		errors.push(file + ': checklistIdがありません');
		continue;
	}
	if (checklist.checklistId !== fileId) {
		errors.push(file + ': checklistIdはファイル名「' + fileId + '」と一致させてください');
	}
	if (checklists.has(checklist.checklistId)) {
		errors.push(file + ': checklistId「' + checklist.checklistId + '」が重複しています');
	}
	checklists.set(checklist.checklistId, checklist);

	if (checklist.status !== 'published') {
		errors.push(file + ': 公開記事に紐付く原本はpublishedにしてください');
	}
	if (!Number.isInteger(checklist.version) || checklist.version < 1) {
		errors.push(file + ': versionは1以上の整数にしてください');
	}
	if (!Array.isArray(checklist.groups) || checklist.groups.length === 0) {
		errors.push(file + ': groupsを1件以上設定してください');
		continue;
	}

	const groupIds = new Set();
	const itemIds = new Set();
	let itemCount = 0;
	for (const group of checklist.groups) {
		if (!group.id || groupIds.has(group.id)) {
			errors.push(file + ': グループID「' + (group.id ?? '') + '」が空または重複しています');
		}
		groupIds.add(group.id);
		if (!group.label?.trim()) {
			errors.push(file + ': グループ「' + (group.id ?? '') + '」のラベルが空です');
		}
		if (!Array.isArray(group.items)) continue;
		for (const item of group.items) {
			itemCount += 1;
			if (!item.id || itemIds.has(item.id)) {
				errors.push(file + ': 項目ID「' + (item.id ?? '') + '」が空または重複しています');
			}
			itemIds.add(item.id);
			if (!item.label?.trim()) {
				errors.push(file + ': 項目「' + (item.id ?? '') + '」のラベルが空です');
			}
		}
	}
	if (itemCount === 0) {
		errors.push(file + ': 項目を1件以上設定してください');
	}
}

for (const file of listFiles(knowhowDirectory, ['.md', '.mdx'])) {
	const source = readFileSync(file, 'utf8');
	const frontmatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
	if (!frontmatter) {
		errors.push(file + ': frontmatterがありません');
		continue;
	}
	const checklistIdMatch = frontmatter[1].match(/^checklistId:\s*["']?([^"'#\r\n]+)["']?\s*$/m);
	const checklistId = checklistIdMatch?.[1]?.trim();
	if (!checklistId) {
		errors.push(file + ': checklistIdがありません');
		continue;
	}
	if (!checklists.has(checklistId)) {
		errors.push(file + ': 対応する原本「' + checklistId + '.json」がありません');
	}
}

if (errors.length > 0) {
	console.error('チェックリスト原本の検証に失敗しました。');
	for (const error of errors) console.error('- ' + error);
	process.exit(1);
}

console.log('チェックリスト原本を検証しました（' + checklists.size + '件）。');
