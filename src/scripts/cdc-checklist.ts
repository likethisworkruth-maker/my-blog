import { agesData } from "../data/cdc/cdcData";
import { ageLabel } from "../data/cdc/ageLabels";
import { milestoneCategoryCounts, detailedMilestonesData, type MilestoneItem } from "../data/cdc/milestonesData";
import { detailedTipsData } from "../data/cdc/tipsData";
import { consultationText, type ConsultationCategory } from "../data/cdc/consultationText";
import { translations } from "../data/cdc/i18n";
import type { Answer, AppStorage, Language } from "../data/cdc/types";

const STORAGE_KEY = "kids-growth-memo-app-storage-v1";
const cdcPageSlugs: Record<string, string> = {
	"2 mo": "2-months",
	"4 mo": "4-months",
	"6 mo": "6-months",
	"9 mo": "9-months",
	"1 year": "1-year",
	"15 mo": "15-months",
	"18 mo": "18-months",
	"2 years": "2-years",
	"30 mo": "30-months",
	"3 years": "3-years",
	"4 years": "4-years",
	"5 years": "5-years",
};
const categoryNames: Record<Language, string[]> = {
	ja: ["社会性・情緒", "ことば・コミュニケーション", "認知・学習", "運動・身体"],
	en: ["Social & emotional", "Language & communication", "Cognitive", "Movement"],
};
const emptyStorage: AppStorage = {
	version: 1,
	selectedAge: "1 year",
	language: "ja",
	milestoneAnswers: {},
	checkedTips: {},
	milestoneNotes: {},
	favoriteTips: [],
	savedTips: [],
	concerns: {},
	concernNotes: {},
};

type View = "checklist" | "tips";
type Audience = "doctor" | "ai";
type TipsFilter = "unchecked" | "all";
type MilestoneGroup = { index: number; start: number; items: MilestoneItem[] };
type PreviousReviewSection = {
	index: number;
	title: string;
	items: Array<{ id: string; item: MilestoneItem; answer?: Answer }>;
};

function parseStored<T>(key: string): T | undefined {
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? JSON.parse(raw) as T : undefined;
	} catch {
		return undefined;
	}
}

function migrateFlatMap<T>(flat: Record<string, T> | undefined): Record<string, Record<string, T>> {
	const result: Record<string, Record<string, T>> = {};
	if (!flat) return result;
	Object.entries(flat).forEach(([combinedId, value]) => {
		const separator = combinedId.lastIndexOf(":");
		if (separator < 1) return;
		const age = combinedId.slice(0, separator);
		const id = combinedId.slice(separator + 1);
		result[age] = { ...(result[age] ?? {}), [id]: value };
	});
	return result;
}

function migrateAnswers(flat: Record<string, Answer> | undefined): Record<string, Record<string, Answer>> {
	const answers = migrateFlatMap(flat);
	Object.values(answers).forEach((forAge) => {
		Object.keys(forAge).forEach((id) => {
			if ((forAge[id] as string) === "unsure") forAge[id] = "unknown";
		});
	});
	return answers;
}

function loadStorage(): AppStorage {
	const saved = parseStored<Partial<AppStorage>>(STORAGE_KEY);
	if (saved?.version === 1) {
		return {
			...emptyStorage,
			...saved,
			selectedAge: agesData.some((age) => age.key === saved.selectedAge) ? saved.selectedAge as string : emptyStorage.selectedAge,
			language: saved.language === "en" ? "en" : "ja",
			milestoneAnswers: saved.milestoneAnswers ?? {},
			checkedTips: saved.checkedTips ?? {},
			milestoneNotes: saved.milestoneNotes ?? {},
			favoriteTips: saved.favoriteTips ?? [],
			savedTips: saved.savedTips ?? [],
			concerns: saved.concerns ?? {},
			concernNotes: saved.concernNotes ?? {},
		};
	}

	const oldAge = parseStored<string>("kids-web-age-v1");
	const oldLanguage = parseStored<Language>("kids-web-language-v1");
	const oldConcernRecords = parseStored<Record<string, { selected?: AppStorage["concerns"][string]; note?: string }>>("kids-web-concern-records-v2");
	const concerns: AppStorage["concerns"] = {};
	const concernNotes: AppStorage["concernNotes"] = {};
	Object.entries(oldConcernRecords ?? {}).forEach(([age, record]) => {
		concerns[age] = record.selected ?? [];
		concernNotes[age] = record.note ?? "";
	});
	const oldAnswers = parseStored<Record<string, Answer>>("kids-web-checklist-v1");
	const oldNotes = parseStored<Record<string, string>>("kids-web-item-notes-v1");
	return {
		...emptyStorage,
		selectedAge: agesData.some((age) => age.key === oldAge) ? oldAge as string : emptyStorage.selectedAge,
		language: oldLanguage === "en" ? "en" : "ja",
		milestoneAnswers: migrateAnswers(oldAnswers),
		milestoneNotes: migrateFlatMap(oldNotes),
		favoriteTips: parseStored<string[]>("kids-web-favorites-v1") ?? [],
		savedTips: parseStored<string[]>("kids-web-saved-tips-v1") ?? [],
		concerns,
		concernNotes,
	};
}

function escapeHtml(value: string): string {
	const entities: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function pageFromHash(): View {
	return window.location.hash === "#tips" ? "tips" : "checklist";
}

function groupsForAge(age: string): MilestoneGroup[] {
	const counts = milestoneCategoryCounts[age] ?? [0, 0, 0, 0];
	const items = detailedMilestonesData[age] ?? [];
	let start = 0;
	return counts.map((count, index) => {
		const group = { index, start, items: items.slice(start, start + count) };
		start += count;
		return group;
	});
}

function ageSourceUrl(age: string): string {
	const slug = cdcPageSlugs[age];
	return slug ? "https://www.cdc.gov/act-early/milestones/" + slug + ".html" : "https://www.cdc.gov/act-early/milestones/";
}

function initChecklist(root: HTMLElement): () => void {
	let storage = loadStorage();
	let view = pageFromHash();
	let activeCategory = 0;
	let showResults = false;
	let showPreviousReview = false;
	let audience: Audience = "doctor";
	let tipsFilter: TipsFilter = "unchecked";
	let copyStatus: "copied" | "failed" | "" = "";
	let saveAvailable = true;
	const desktopQuery = window.matchMedia("(min-width: 900px)");
	let language: Language = desktopQuery.matches ? storage.language : "ja";

	const currentAnswers = (age: string) => storage.milestoneAnswers[age] ?? {};
	const currentLanguage = () => desktopQuery.matches ? storage.language : "ja";
	const copy = () => translations[language];
	const categories = () => categoryNames[language];

	const previousReviewSections = (age: string): PreviousReviewSection[] => {
		const ageIndex = agesData.findIndex((entry) => entry.key === age);
		if (ageIndex <= 0) return [];
		const previousAge = agesData[ageIndex - 1].key;
		const previousItems = detailedMilestonesData[previousAge] ?? [];
		const previousAnswers = currentAnswers(previousAge);
		const previousCounts = milestoneCategoryCounts[previousAge] ?? [0, 0, 0, 0];
		const answers = currentAnswers(age);
		return groupsForAge(age)
			.filter((group) => group.items.length > 0 && group.items.every((_item, localIndex) => answers[String(group.start + localIndex)] === "notYet"))
			.map((group) => {
				const start = previousCounts.slice(0, group.index).reduce((sum, count) => sum + count, 0);
				return {
					index: group.index,
					title: categories()[group.index],
					items: previousItems.slice(start, start + previousCounts[group.index]).map((item, localIndex) => {
						const id = String(start + localIndex);
						return { id, item, answer: previousAnswers[id] };
					}),
				};
			})
			.filter((section) => section.items.length > 0);
	};

	const resultCategories = (age: string): ConsultationCategory[] => {
		const answers = currentAnswers(age);
		const previousAgeIndex = agesData.findIndex((entry) => entry.key === age) - 1;
		const previousAge = previousAgeIndex >= 0 ? agesData[previousAgeIndex].key : undefined;
		const reviewByCategory = new Map(previousReviewSections(age).map((section) => [section.index, section]));
		return groupsForAge(age).map((group) => {
			const checked: string[] = [];
			const notYet: string[] = [];
			const unknown: string[] = [];
			group.items.forEach((item, localIndex) => {
				const answer = answers[String(group.start + localIndex)];
				const label = language === "ja" ? item.ja : item.en;
				if (answer === "yes") checked.push(label);
				else if (answer === "notYet") notYet.push(label);
				else unknown.push(label);
			});
			const section = reviewByCategory.get(group.index);
			const previous = section && previousAge ? {
				ageKey: previousAge,
				age: ageLabel(previousAge, language),
				checked: section.items.filter(({ answer }) => answer === "yes").map(({ item }) => language === "ja" ? item.ja : item.en),
				notYet: section.items.filter(({ answer }) => answer === "notYet").map(({ item }) => language === "ja" ? item.ja : item.en),
				unknown: section.items.filter(({ answer }) => answer !== "yes" && answer !== "notYet").map(({ item }) => language === "ja" ? item.ja : item.en),
			} : undefined;
			return { title: categories()[group.index], checked, notYet, unknown, previous };
		});
	};

	const answerButtons = (age: string, id: string, answer?: Answer): string => {
		const labels = copy();
		return '<div class="flex shrink-0 gap-1" role="group" aria-label="' + escapeHtml(language === "ja" ? "項目の回答" : "Milestone answer") + '">' +
			(["yes", "notYet"] as const).map((value) => {
				const selected = answer === value;
				const text = value === "yes" ? labels.yes : labels.notYet;
				const style = selected
					? "border-mint-500 bg-mint-50 text-mint-600"
					: "border-gray-300 bg-white text-gray-600 hover:bg-gray-50";
				return '<button type="button" data-answer-age="' + escapeHtml(age) + '" data-answer-id="' + escapeHtml(id) + '" data-answer-value="' + value + '" aria-pressed="' + String(selected) + '" class="min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition-colors ' + style + '">' + escapeHtml(text) + "</button>";
			}).join("") +
		"</div>";
	};

	const renderCategoryNavigation = (age: string): string => {
		const names = categories();
		return '<nav class="sticky top-0 z-20 -mx-4 grid grid-cols-2 gap-x-3 border-y border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:mx-0 sm:flex sm:gap-1 sm:overflow-x-auto sm:px-0 lg:top-[72px]" aria-label="' + escapeHtml(language === "ja" ? "発達カテゴリ" : "Milestone categories") + '">' +
			groupsForAge(age).map((group) => {
				const selected = group.index === activeCategory;
				const style = selected ? "border-mint-500 text-mint-600" : "border-transparent text-gray-500 hover:text-navy-900";
				return '<button type="button" data-category="' + group.index + '" aria-current="' + (selected ? "true" : "false") + '" class="w-full border-b-2 px-2 py-2 text-left text-xs font-semibold sm:w-auto sm:shrink-0 ' + style + '">' + escapeHtml(names[group.index]) + " · " + group.items.length + "</button>";
			}).join("") +
		"</nav>";
	};

	const renderChecklist = (age: string): string => {
		const labels = copy();
		const groups = groupsForAge(age);
		const items = detailedMilestonesData[age] ?? [];
		const answers = currentAnswers(age);
		const answered = items.reduce((sum, _item, index) => {
			const value = answers[String(index)];
			return sum + (value === "yes" || value === "notYet" ? 1 : 0);
		}, 0);
		const percent = items.length > 0 ? Math.round(answered / items.length * 100) : 0;
		const summary = '<section class="border-b border-gray-200 pb-4" aria-labelledby="cdc-checklist-heading">' +
			'<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">' +
				'<h2 id="cdc-checklist-heading" class="text-lg font-bold text-navy-900">' + escapeHtml(ageLabel(age, language) + labels.checklistHeading) + "</h2>" +
				'<p class="text-xs text-gray-500">' + escapeHtml(labels.answered) + " <span class=\"font-bold text-navy-900\">" + answered + " / " + items.length + "</span>　" + escapeHtml(labels.total) + " " + items.length + (language === "ja" ? "項目" : " items") + "</p>" +
			"</div>" +
			'<div class="mt-3 flex items-center gap-3">' +
				'<span class="text-xs text-gray-500">' + escapeHtml(labels.progress) + "</span>" +
				'<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="' + escapeHtml(labels.progress) + '" aria-valuemin="0" aria-valuemax="' + items.length + '" aria-valuenow="' + answered + '">' +
					'<span class="block h-full rounded-full bg-mint-500 transition-[width]" style="width:' + percent + '%"></span>' +
				"</div><span class=\"w-10 text-right text-xs font-semibold text-mint-600\">" + percent + "%</span>" +
			"</div></section>";
		const sections = groups.map((group) => {
			const rows = group.items.map((item, localIndex) => {
				const index = group.start + localIndex;
				const text = language === "ja" ? item.ja : item.en;
				return '<li class="grid gap-2 border-b border-gray-100 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">' +
					'<div class="flex min-w-0 gap-3"><span class="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-gray-400">' + (index + 1) + "</span>" +
					'<p class="text-sm leading-6 text-navy-900">' + escapeHtml(text) + "</p></div>" +
					answerButtons(age, String(index), answers[String(index)]) +
				"</li>";
			}).join("");
			return '<section id="cdc-category-' + group.index + '" data-cdc-category class="scroll-mt-20 pt-5">' +
				'<h3 class="mb-1 flex items-baseline justify-between gap-3 border-b border-gray-200 pb-2 text-sm font-bold text-navy-900"><span>' + escapeHtml(categories()[group.index]) + '</span><span class="text-xs font-medium text-gray-400">' + group.items.length + (language === "ja" ? "項目" : " items") + "</span></h3>" +
				'<ul class="m-0 list-none p-0">' + rows + "</ul></section>";
		}).join("");
		const empty = items.length === 0 ? '<p class="py-6 text-sm text-gray-500">' + escapeHtml(labels.emptyChecklist) + "</p>" : "";
		const reviewSections = previousReviewSections(age);
		const buttonText = showResults ? (language === "ja" ? "結果を閉じる" : "Hide results") : labels.viewResults;
		const resultButton = items.length > 0
			? '<button type="button" data-toggle-results aria-expanded="' + String(showResults) + '" class="mt-5 w-full border-y border-gray-200 py-3 text-sm font-bold text-navy-900 hover:text-mint-600">' + escapeHtml(buttonText) + "</button>"
			: "";
		const results = showResults && items.length > 0 ? renderResults(age, reviewSections) : "";
		const dialog = showPreviousReview ? renderPreviousReview(age, reviewSections) : "";
		return summary + renderCategoryNavigation(age) + sections + empty + resultButton + results + dialog;
	};

	const renderTips = (age: string): string => {
		const labels = copy();
		const tips = detailedTipsData[age] ?? [];
		const checked = storage.checkedTips[age] ?? [];
		const visible = tips.map((tip, index) => ({ tip, index })).filter(({ index }) => tipsFilter === "all" || !checked.includes(index));
		const filterButtons = (["unchecked", "all"] as const).map((value) => {
			const selected = tipsFilter === value;
			const text = value === "unchecked" ? (language === "ja" ? "チェックなし" : "Unchecked") : (language === "ja" ? "全部" : "All");
			return '<button type="button" data-tips-filter="' + value + '" aria-pressed="' + String(selected) + '" class="min-h-9 border px-3 text-xs font-semibold ' + (selected ? "border-mint-500 bg-mint-50 text-mint-600" : "border-gray-300 text-gray-600 hover:bg-gray-50") + '">' + escapeHtml(text) + "</button>";
		}).join("");
		const rows = visible.map(({ tip, index }) => {
			const selected = checked.includes(index);
			const text = language === "ja" ? tip.ja : tip.en;
			const stateLabel = selected ? (language === "ja" ? "チェック済み" : "Checked") : (language === "ja" ? "チェックする" : "Check");
			return '<li class="flex items-start gap-3 border-b border-gray-100 py-3">' +
				'<span class="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-gray-400">' + (index + 1) + "</span>" +
				'<p class="min-w-0 flex-1 text-sm leading-6 text-navy-900">' + escapeHtml(text) + "</p>" +
				'<button type="button" data-tip-index="' + index + '" aria-pressed="' + String(selected) + '" aria-label="' + escapeHtml(stateLabel) + '" class="min-h-9 shrink-0 rounded-lg border px-2.5 text-xs font-semibold ' + (selected ? "border-mint-500 bg-mint-50 text-mint-600" : "border-gray-300 text-gray-600 hover:bg-gray-50") + '">' + escapeHtml(stateLabel) + "</button>" +
			"</li>";
		}).join("");
		const empty = tips.length === 0
			? '<p class="py-6 text-sm text-gray-500">' + escapeHtml(labels.emptyTips) + "</p>"
			: visible.length === 0
				? '<p role="status" class="py-6 text-center text-sm text-gray-500">' + escapeHtml(language === "ja" ? "この年齢のヒントはすべてチェック済みです。「全部」で確認・解除できます。" : "All tips for this age are checked. Choose All to review or uncheck them.") + "</p>"
				: "";
		return '<section aria-label="' + escapeHtml(language === "ja" ? ageLabel(age, language) + "の関わり方のヒント" : "Tips for " + ageLabel(age, language)) + '">' +
			'<div class="mb-2 flex justify-end"><div class="inline-flex overflow-hidden rounded-lg">' + filterButtons + "</div></div>" +
			'<ul class="m-0 list-none p-0">' + rows + "</ul>" + empty + "</section>";
	};

	const renderResults = (age: string, reviewSections: PreviousReviewSection[]): string => {
		const labels = language === "ja"
			? { doctor: "先生への相談文", ai: "AIへの質問文" }
			: { doctor: "Message for a clinician", ai: "Question for AI" };
		const tabs = (["doctor", "ai"] as const).map((value) => {
			const selected = audience === value;
			return '<button type="button" data-audience="' + value + '" role="tab" aria-selected="' + String(selected) + '" class="border-b-2 px-3 py-2 text-xs font-semibold ' + (selected ? "border-mint-500 text-mint-600" : "border-transparent text-gray-500 hover:text-navy-900") + '">' + labels[value] + "</button>";
		}).join("");
		const copied = copyStatus === "copied"
			? (language === "ja" ? "文章をコピーしました。" : "Text copied.")
			: copyStatus === "failed"
				? (language === "ja" ? "コピーできませんでした。下の文章を選択してコピーしてください。" : "Could not copy. Select the text below to copy it.")
				: "";
		const reviewButton = reviewSections.length > 0
			? '<button type="button" data-open-review class="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-navy-900 hover:border-mint-500">' + escapeHtml(language === "ja" ? ageLabel(agesData[Math.max(0, agesData.findIndex((entry) => entry.key === age) - 1)]?.key ?? "", language) + "の項目を再確認" : "Review the previous-age milestones") + "</button>"
			: "";
		return '<section class="mt-5 border-t border-gray-200 pt-4" aria-label="' + escapeHtml(language === "ja" ? "相談に使う文章" : "Text for your consultation") + '">' +
			reviewButton +
			'<div class="mt-4 flex border-b border-gray-200" role="tablist" aria-label="' + escapeHtml(language === "ja" ? "文章の用途" : "Choose a message") + '">' + tabs + "</div>" +
			'<div role="tabpanel" class="pt-3">' +
				'<button type="button" data-copy-message class="min-h-10 rounded-lg bg-navy-900 px-4 py-2 text-xs font-bold text-white hover:opacity-90">' + escapeHtml(language === "ja" ? "文章をコピー" : "Copy message") + "</button>" +
				'<p data-copy-status role="status" aria-live="polite" class="min-h-5 pt-2 text-xs text-gray-500">' + escapeHtml(copied) + "</p>" +
				'<textarea data-consultation-text readonly rows="12" aria-label="' + escapeHtml(labels[audience]) + '" class="mt-1 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-700"></textarea>' +
			"</div></section>";
	};

	const renderPreviousReview = (age: string, sections: PreviousReviewSection[]): string => {
		const previousAgeIndex = agesData.findIndex((entry) => entry.key === age) - 1;
		if (previousAgeIndex < 0 || sections.length === 0) return "";
		const previousAge = agesData[previousAgeIndex].key;
		const title = language === "ja"
			? ageLabel(previousAge, language) + "の項目も確認できます"
			: "You can also review the " + ageLabel(previousAge, language) + " milestones";
		const sectionMarkup = sections.map((section) => {
			const rows = section.items.map(({ id, item, answer }) => {
				const text = language === "ja" ? item.ja : item.en;
				return '<li class="grid gap-2 border-b border-gray-100 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">' +
					'<p class="text-sm leading-6 text-navy-900">' + escapeHtml(text) + "</p>" +
					answerButtons(previousAge, id, answer) +
				"</li>";
			}).join("");
			return '<section class="mt-4"><h3 class="border-b border-gray-200 pb-2 text-sm font-bold text-navy-900">' + escapeHtml(section.title) + '</h3><ul class="m-0 list-none p-0">' + rows + "</ul></section>";
		}).join("");
		return '<div class="fixed inset-0 z-[120] overflow-y-auto bg-black/30 p-4" data-review-overlay>' +
			'<section role="dialog" aria-modal="true" aria-labelledby="cdc-previous-review-title" class="mx-auto my-[4vh] max-h-[92vh] max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">' +
				'<div class="flex items-start justify-between gap-4"><div><h2 id="cdc-previous-review-title" class="text-lg font-bold text-navy-900">' + escapeHtml(title) + '</h2>' +
				'<p class="mt-2 text-xs leading-5 text-gray-500">' + escapeHtml(language === "ja" ? "現在の年齢で「まだできない」とした分野の項目です。未確認の項目は、できないと決めずにそのまま残してください。" : "These items are from categories marked “not yet” at the current age. Leave items unselected when they have not been checked.") + "</p></div>" +
				'<button type="button" data-close-review aria-label="' + escapeHtml(language === "ja" ? "閉じる" : "Close") + '" class="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600">' + escapeHtml(language === "ja" ? "閉じる" : "Close") + "</button></div>" +
				sectionMarkup +
				'<div class="mt-5 border-t border-gray-200 pt-4 text-right"><button type="button" data-close-review class="rounded-lg bg-navy-900 px-4 py-2 text-xs font-bold text-white">' + escapeHtml(language === "ja" ? "確認を終える" : "Done") + "</button></div>" +
			"</section></div>";
	};

	const render = (): void => {
		language = currentLanguage();
		const labels = copy();
		document.documentElement.lang = language;
		const age = storage.selectedAge;
		const options = agesData.map((entry) => {
			const selected = entry.key === age;
			return '<option value="' + escapeHtml(entry.key) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(ageLabel(entry.key, language)) + "</option>";
		}).join("");
		const viewTabs = (["checklist", "tips"] as const).map((value) => {
			const selected = view === value;
			const text = value === "checklist" ? labels.navChecklist : labels.navTips;
			return '<button type="button" data-view="' + value + '" aria-current="' + String(selected) + '" class="border-b-2 px-3 py-2 text-sm font-semibold transition-colors ' + (selected ? "border-mint-500 text-mint-600" : "border-transparent text-gray-500 hover:text-navy-900") + '">' + escapeHtml(text) + "</button>";
		}).join("");
		const languageSwitch = '<button type="button" data-language-switch class="hidden min-[900px]:inline-flex rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-mint-500 hover:text-mint-600" aria-label="' + escapeHtml(labels.switchLanguage) + '">' + escapeHtml(language === "ja" ? "English" : "日本語") + "</button>";
		const saveNotice = '<p data-save-notice role="status" class="mt-2 min-h-4 text-xs text-red-600">' + escapeHtml(saveAvailable ? "" : (language === "ja" ? "このブラウザーでは保存できません。ページを閉じると回答が消える場合があります。" : "This browser could not save your selections. They may be lost when you leave this page.")) + "</p>";
		const intro = language === "ja"
			? "米国疾病予防管理センター（CDC）が公開する発達マイルストーンを参考にした、非公式の日本語チェックリストです。CDCによる監修・承認は受けていません。発達の診断や評価の代わりにはなりません。"
			: "This unofficial checklist is based on developmental milestones published by the U.S. Centers for Disease Control and Prevention (CDC). It is not reviewed or endorsed by CDC and is not a diagnostic or developmental evaluation tool.";
		const support = language === "ja"
			? "項目は成長の目安としてお使いください。気になることがあれば、お住まいの地域の保健センターや小児科などにご相談ください。"
			: "Use these items as general milestones. If you have concerns, contact your local public health center or a healthcare professional.";
		const sourceLink = '<a class="font-semibold text-mint-600 underline underline-offset-2" href="' + ageSourceUrl(age) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(language === "ja" ? "この年齢のCDC公式ページ（英語）" : "CDC source for this age (English)") + "</a>";
		const viewContent = view === "checklist" ? renderChecklist(age) : renderTips(age);
		root.innerHTML =
			'<header class="border-b border-gray-200 pb-4">' +
				'<div class="flex flex-wrap items-center justify-between gap-3">' +
					'<div><p class="text-xs font-semibold text-mint-600">' + escapeHtml(language === "ja" ? "子どもの発達確認" : "Child development") + '</p><h1 class="mt-1 text-2xl font-bold tracking-tight text-navy-900">' + escapeHtml(language === "ja" ? "CDCチェック" : "CDC Checklist") + "</h1></div>" +
					languageSwitch +
				"</div>" +
				'<div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">' +
					'<label for="cdc-age" class="text-sm font-semibold text-navy-900">' + escapeHtml(labels.ageLabel) + "</label>" +
					'<select id="cdc-age" data-age-select class="min-h-10 min-w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-50">' + options + "</select>" +
					'<span class="text-xs text-gray-400">' + (language === "ja" ? "2か月〜5歳の12段階" : "12 ages from 2 months to 5 years") + "</span>" +
				"</div>" +
			"</header>" +
			'<nav class="mb-4 flex border-b border-gray-200" aria-label="' + escapeHtml(language === "ja" ? "表示内容" : "Content") + '">' + viewTabs + "</nav>" +
			viewContent + saveNotice +
			'<aside class="mt-8 border-t border-gray-200 pt-3 text-xs leading-5 text-gray-500" aria-label="' + escapeHtml(language === "ja" ? "出典と利用上の注意" : "Source and disclaimer") + '">' +
				'<p>' + escapeHtml(intro) + " " + escapeHtml(support) + "</p>" +
				'<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">' + sourceLink + '<span>' + escapeHtml(language === "ja" ? "回答・ヒントのチェック・表示言語はこのブラウザーに保存され、運営者には送信されません。" : "Answers, tip selections, and language are saved in this browser and are not sent to the site operator.") + "</span></div>" +
			"</aside>";

		const textField = root.querySelector<HTMLTextAreaElement>("[data-consultation-text]");
		if (textField) {
			textField.value = consultationText(age, ageLabel(age, language), resultCategories(age), language, audience);
			textField.style.height = "auto";
			textField.style.height = textField.scrollHeight + "px";
		}
		updateCategoryButtons();
	};

	const updateCategoryButtons = (): void => {
		root.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
			const selected = Number(button.dataset.category) === activeCategory;
			button.setAttribute("aria-current", String(selected));
			button.classList.toggle("border-mint-500", selected);
			button.classList.toggle("text-mint-600", selected);
			button.classList.toggle("border-transparent", !selected);
			button.classList.toggle("text-gray-500", !selected);
		});
	};

	const saveAndRender = (nextStorage: AppStorage, focusSelector?: string): void => {
		storage = nextStorage;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
			saveAvailable = true;
		} catch {
			saveAvailable = false;
		}
		render();
		if (focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
	};

	const selectView = (nextView: View): void => {
		view = nextView;
		showResults = false;
		showPreviousReview = false;
		const nextHash = "#" + nextView;
		if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
		render();
		window.scrollTo({ top: 0, behavior: "smooth" });
		root.querySelector<HTMLElement>('[data-view="' + nextView + '"]')?.focus({ preventScroll: true });
	};

	const onClick = (event: Event): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const button = target.closest<HTMLButtonElement>("button");
		if (!button || !root.contains(button)) return;
		if (button.dataset.view === "checklist" || button.dataset.view === "tips") {
			selectView(button.dataset.view);
			return;
		}
		if (button.hasAttribute("data-language-switch")) {
			saveAndRender({ ...storage, language: storage.language === "ja" ? "en" : "ja" }, "[data-language-switch]");
			return;
		}
		if (button.dataset.category !== undefined) {
			activeCategory = Number(button.dataset.category);
			updateCategoryButtons();
			root.querySelector("#cdc-category-" + activeCategory)?.scrollIntoView({ behavior: "smooth", block: "start" });
			return;
		}
		if (button.dataset.answerAge && button.dataset.answerId && button.dataset.answerValue) {
			const age = button.dataset.answerAge;
			const id = button.dataset.answerId;
			const answer = button.dataset.answerValue as Answer;
			const forAge = { ...(storage.milestoneAnswers[age] ?? {}) };
			if (forAge[id] === answer) delete forAge[id];
			else forAge[id] = answer;
			const milestoneAnswers = { ...storage.milestoneAnswers, [age]: forAge };
			saveAndRender({ ...storage, milestoneAnswers }, 'button[data-answer-age="' + age + '"][data-answer-id="' + id + '"][data-answer-value="' + answer + '"]');
			return;
		}
		if (button.dataset.tipIndex !== undefined) {
			const index = Number(button.dataset.tipIndex);
			const checked = storage.checkedTips[storage.selectedAge] ?? [];
			const next = checked.includes(index) ? checked.filter((value) => value !== index) : [...checked, index].sort((a, b) => a - b);
			saveAndRender({ ...storage, checkedTips: { ...storage.checkedTips, [storage.selectedAge]: next } }, 'button[data-tip-index="' + index + '"]');
			return;
		}
		if (button.dataset.tipsFilter === "unchecked" || button.dataset.tipsFilter === "all") {
			tipsFilter = button.dataset.tipsFilter;
			render();
			root.querySelector<HTMLElement>('[data-tips-filter="' + tipsFilter + '"]')?.focus({ preventScroll: true });
			return;
		}
		if (button.dataset.audience === "doctor" || button.dataset.audience === "ai") {
			audience = button.dataset.audience;
			copyStatus = "";
			render();
			root.querySelector<HTMLElement>('[data-audience="' + audience + '"]')?.focus({ preventScroll: true });
			return;
		}
		if (button.hasAttribute("data-toggle-results")) {
			showResults = !showResults;
			if (!showResults) showPreviousReview = false;
			else {
				const sections = previousReviewSections(storage.selectedAge);
				showPreviousReview = sections.some((section) => section.items.some(({ answer }) => answer !== "yes" && answer !== "notYet"));
			}
			render();
			root.querySelector<HTMLElement>("[data-toggle-results]")?.focus({ preventScroll: true });
			return;
		}
		if (button.hasAttribute("data-open-review")) {
			showPreviousReview = true;
			render();
			root.querySelector<HTMLElement>("[data-close-review]")?.focus({ preventScroll: true });
			return;
		}
		if (button.hasAttribute("data-close-review")) {
			showPreviousReview = false;
			render();
			root.querySelector<HTMLElement>("[data-open-review]")?.focus({ preventScroll: true });
			return;
		}
		if (button.hasAttribute("data-copy-message")) {
			const field = root.querySelector<HTMLTextAreaElement>("[data-consultation-text]");
			if (!field) return;
			if (!navigator.clipboard) {
				copyStatus = "failed";
				render();
				const textField = root.querySelector<HTMLTextAreaElement>("[data-consultation-text]");
				textField?.focus();
				textField?.select();
				return;
			}
			void navigator.clipboard.writeText(field.value).then(() => {
				copyStatus = "copied";
				render();
				root.querySelector<HTMLElement>("[data-copy-message]")?.focus({ preventScroll: true });
			}).catch(() => {
				copyStatus = "failed";
				render();
				const textField = root.querySelector<HTMLTextAreaElement>("[data-consultation-text]");
				textField?.focus();
				textField?.select();
			});
		}
	};

	const onChange = (event: Event): void => {
		const target = event.target;
		if (target instanceof HTMLSelectElement && target.matches("[data-age-select]")) {
			const selectedAge = target.value;
			if (!agesData.some((age) => age.key === selectedAge)) return;
			showResults = false;
			showPreviousReview = false;
			activeCategory = 0;
			copyStatus = "";
			saveAndRender({ ...storage, selectedAge }, "[data-age-select]");
		}
	};

	const onScroll = (): void => {
		if (view !== "checklist") return;
		let current = 0;
		const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-cdc-category]"));
		sections.forEach((section, index) => {
			if (section.getBoundingClientRect().top <= 105) current = index;
		});
		if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8 && sections.length > 0) current = sections.length - 1;
		if (activeCategory !== current) {
			activeCategory = current;
			updateCategoryButtons();
		}
	};

	const onHashChange = (): void => {
		const nextView = pageFromHash();
		if (nextView === view) return;
		view = nextView;
		showResults = false;
		showPreviousReview = false;
		render();
	};
	const onViewportChange = (): void => render();

	root.addEventListener("click", onClick);
	root.addEventListener("change", onChange);
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll);
	window.addEventListener("hashchange", onHashChange);
	window.addEventListener("popstate", onHashChange);
	desktopQuery.addEventListener("change", onViewportChange);
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
		} catch {
			saveAvailable = false;
		}
	render();

	return () => {
		root.removeEventListener("click", onClick);
		root.removeEventListener("change", onChange);
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onScroll);
		window.removeEventListener("hashchange", onHashChange);
		window.removeEventListener("popstate", onHashChange);
		desktopQuery.removeEventListener("change", onViewportChange);
	};
}

const cleanupByRoot = new WeakMap<HTMLElement, () => void>();

function mountCdcChecklist(): void {
	document.querySelectorAll<HTMLElement>("[data-cdc-checklist]").forEach((root) => {
		if (cleanupByRoot.has(root)) return;
		cleanupByRoot.set(root, initChecklist(root));
	});
}

document.addEventListener("astro:before-swap", () => {
	document.querySelectorAll<HTMLElement>("[data-cdc-checklist]").forEach((root) => {
		cleanupByRoot.get(root)?.();
		cleanupByRoot.delete(root);
	});
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountCdcChecklist, { once: true });
else mountCdcChecklist();
document.addEventListener("astro:page-load", mountCdcChecklist);
