import { agesData } from "../data/cdc/cdcData";
import { ageLabel } from "../data/cdc/ageLabels";
import { milestoneCategoryCounts, detailedMilestonesData, type MilestoneItem } from "../data/cdc/milestonesData";
import { detailedTipsData } from "../data/cdc/tipsData";
import { consultationText, type ConsultationCategory } from "../data/cdc/consultationText";
import { translations } from "../data/cdc/i18n";
import type { Answer, AppStorage, Language } from "../data/cdc/types";
import { getSupabaseClient } from "./supabase-client";
import {
	createSupabaseCdcCloudAdapter,
	deactivateCdcStorageUser,
	restoreCdcStorageForUser,
	saveCdcStorageForUser,
	saveCdcStorageLocally,
	type CdcSyncResult,
} from "./cdc-user-storage";

const STORAGE_KEY = "kids-growth-memo-app-storage-v1";
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
	let cloudSaveStatus: "idle" | "saving" | "saved" | "failed" | "switching" = "idle";
	let activeAccountUserId: string | null = null;
	let authReady = false;
	let accountSwitching = false;
	let authGeneration = 0;
	let uiRevision = 0;
	let disposed = false;
	let language: Language = storage.language;
	const supabase = getSupabaseClient();
	const cdcCloud = supabase ? createSupabaseCdcCloudAdapter(supabase) : undefined;

	const currentAnswers = (age: string) => storage.milestoneAnswers[age] ?? {};
	const currentLanguage = () => storage.language;
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
		return '<div class="grid w-full grid-cols-2 gap-3" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%" role="group" aria-label="' + escapeHtml(language === "ja" ? "項目の回答" : "Milestone answer") + '">' +
			(["yes", "notYet"] as const).map((value) => {
				const selected = answer === value;
				const text = value === "yes" ? labels.yes : labels.notYet;
				const style = selected
					? "border-mint-500 bg-mint-50 text-mint-600"
					: "border-gray-300 bg-white text-gray-600 hover:bg-gray-50";
				return '<button type="button" data-answer-age="' + escapeHtml(age) + '" data-answer-id="' + escapeHtml(id) + '" data-answer-value="' + value + '" aria-pressed="' + String(selected) + '" class="min-h-12 w-full rounded-xl border px-3 py-2 text-sm font-bold transition-colors ' + style + '" style="min-height:48px">' + escapeHtml(text) + "</button>";
			}).join("") +
		"</div>";
	};

	const renderCategoryNavigation = (age: string): string => {
		const names = categories();
		const shortNames = language === "ja" ? ["社会性", "ことば", "認知", "運動"] : ["Social", "Lang.", "Cog.", "Move"];
		return '<nav class="sticky top-0 z-20 -mx-4 grid grid-cols-4 gap-1.5 bg-white/95 px-4 py-1.5 backdrop-blur sm:mx-0 sm:px-0 lg:top-[72px]" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px" aria-label="' + escapeHtml(language === "ja" ? "発達カテゴリ" : "Milestone categories") + '">' +
			groupsForAge(age).map((group) => {
				const selected = group.index === activeCategory;
				const style = selected
					? "border-mint-500 bg-mint-50 text-mint-600"
					: "border-gray-200 bg-white text-navy-900 hover:border-gray-300";
				const accessibleName = language === "ja"
					? names[group.index] + " " + group.items.length + "項目"
					: names[group.index] + ": " + group.items.length + (group.items.length === 1 ? " item" : " items");
				return '<button type="button" data-category="' + group.index + '" aria-label="' + escapeHtml(accessibleName) + '" aria-current="' + (selected ? "true" : "false") + '" class="relative flex min-h-14 min-w-0 items-center justify-center rounded-2xl border py-1 font-bold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 ' + style + '" style="display:flex;min-height:56px;align-items:center;justify-content:center;position:relative;gap:clamp(2px,0.75vw,3px);padding-left:0;padding-right:0"><span style="white-space:nowrap;font-size:clamp(12px,3.5vw,14px);line-height:1.25">' + escapeHtml(shortNames[group.index]) + '</span><span data-category-count aria-hidden="true" class="inline-flex items-center font-semibold" style="font-size:clamp(10px,3vw,12px);line-height:1">' + group.items.length + '</span></button>';
			}).join("") +
		"</nav>";
	};

	const renderAgeChips = (selectedAge: string): string => {
		return '<div id="cdc-age-options" class="cdc-age-chip-viewport -mx-4 mt-2 overflow-hidden px-4 pb-1 sm:mx-0 sm:px-0" style="overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab" role="group" aria-label="' + escapeHtml(language === "ja" ? "チェックする年齢" : copy().ageLabel) + '"><div data-age-track class="flex w-max flex-nowrap gap-2" style="display:flex;flex-wrap:nowrap;gap:8px;width:max-content;position:relative;transform:translate3d(0,0,0);transition:transform 220ms ease-out">' +
			agesData.map((age) => {
				const selected = selectedAge === age.key;
				const style = selected
					? "border-mint-500 bg-mint-50 text-mint-600"
					: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";
				const fullAgeLabel = ageLabel(age.key, language);
				let visibleAgeParts = [fullAgeLabel];
				if (language === "ja" && age.key === "15 mo") visibleAgeParts = ["1歳", "3か月"];
				else if (language === "ja" && age.key === "18 mo") visibleAgeParts = ["1歳", "6か月"];
				else if (language === "ja" && age.key === "30 mo") visibleAgeParts = ["2歳", "6か月"];
				else if (language === "en" && age.key.endsWith("mo")) visibleAgeParts = [fullAgeLabel.split(" ")[0], "months"];
				const visibleAgeMarkup = visibleAgeParts.map((part) => '<span class="block leading-4">' + escapeHtml(part) + "</span>").join("");
				return '<button type="button" data-age-option="' + escapeHtml(age.key) + '" aria-label="' + escapeHtml(fullAgeLabel) + '" aria-pressed="' + String(selected) + '" class="inline-flex h-20 min-h-20 w-20 min-w-20 max-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 ' + style + '" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:80px;min-width:80px;max-width:80px;height:80px;min-height:80px;box-sizing:border-box;text-align:center;user-select:none;-webkit-user-select:none">' + visibleAgeMarkup + "</button>";
			}).join("") +
		"</div></div>";
	};

	let ageTrackOffset = 0;
	let ageDragState: { pointerId: number; startX: number; startOffset: number; moved: boolean; viewport: HTMLElement; track: HTMLElement } | null = null;
	let suppressNextAgeClick = false;
	let suppressAgeClickTimer = 0;
	let keyboardNavigation = false;

	const setAgeTrackOffset = (offset: number, smooth = false): void => {
		const viewport = root.querySelector<HTMLElement>("#cdc-age-options");
		const track = viewport?.querySelector<HTMLElement>("[data-age-track]");
		if (!viewport || !track) return;
		const styles = window.getComputedStyle(viewport);
		const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
		const minOffset = Math.min(0, viewport.clientWidth - paddingLeft - paddingRight - track.scrollWidth);
		ageTrackOffset = Math.max(minOffset, Math.min(0, offset));
		track.style.transition = smooth ? "transform 220ms ease-out" : "none";
		track.style.transform = "translate3d(" + ageTrackOffset + "px,0,0)";
	};

	const centerAgeChip = (ageKey: string, smooth = false): void => {
		const viewport = root.querySelector<HTMLElement>("#cdc-age-options");
		const track = viewport?.querySelector<HTMLElement>("[data-age-track]");
		const chip = track && Array.from(track.querySelectorAll<HTMLButtonElement>("[data-age-option]"))
			.find((button) => button.dataset.ageOption === ageKey);
		if (!viewport || !track || !chip) return;
		const paddingLeft = Number.parseFloat(window.getComputedStyle(viewport).paddingLeft) || 0;
		setAgeTrackOffset(viewport.clientWidth / 2 - paddingLeft - (chip.offsetLeft + chip.offsetWidth / 2), smooth);
	};

	const centerSelectedAgeChip = (smooth = false): void => centerAgeChip(storage.selectedAge, smooth);

	const onAgePointerDown = (event: PointerEvent): void => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const target = event.target;
		if (!(target instanceof Element) || !target.closest("[data-age-option]")) return;
		const viewport = root.querySelector<HTMLElement>("#cdc-age-options");
		const track = viewport?.querySelector<HTMLElement>("[data-age-track]");
		if (!viewport || !track) return;
		keyboardNavigation = false;
		ageDragState = { pointerId: event.pointerId, startX: event.clientX, startOffset: ageTrackOffset, moved: false, viewport, track };
	};

	const onAgePointerMove = (event: PointerEvent): void => {
		const drag = ageDragState;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const distance = event.clientX - drag.startX;
		if (!drag.moved && Math.abs(distance) > 6) {
			drag.moved = true;
			drag.viewport.style.cursor = "grabbing";
			drag.track.style.transition = "none";
		}
		if (!drag.moved) return;
		event.preventDefault();
		setAgeTrackOffset(drag.startOffset + distance);
	};

	const onAgePointerUp = (event: PointerEvent): void => {
		const drag = ageDragState;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.moved) {
			drag.viewport.style.cursor = "grab";
			drag.track.style.transition = "transform 220ms ease-out";
			suppressNextAgeClick = true;
			window.clearTimeout(suppressAgeClickTimer);
			suppressAgeClickTimer = window.setTimeout(() => { suppressNextAgeClick = false; }, 0);
		}
		ageDragState = null;
	};

	const onAgePointerCancel = (event: PointerEvent): void => {
		if (!ageDragState || ageDragState.pointerId !== event.pointerId) return;
		ageDragState.viewport.style.cursor = "grab";
		ageDragState.track.style.transition = "transform 220ms ease-out";
		ageDragState = null;
	};

	const onAgeKeyDown = (event: KeyboardEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const current = target.closest<HTMLButtonElement>("button[data-age-option]");
		if (!current) return;
		const chips = Array.from(root.querySelectorAll<HTMLButtonElement>("button[data-age-option]"));
		const index = chips.indexOf(current);
		let nextIndex = index;
		if (event.key === "ArrowRight") nextIndex = Math.min(chips.length - 1, index + 1);
		else if (event.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = chips.length - 1;
		else return;
		event.preventDefault();
		keyboardNavigation = true;
		chips[nextIndex]?.focus();
	};

	const onAgeFocusIn = (event: FocusEvent): void => {
		if (!keyboardNavigation) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		const chip = target.closest<HTMLButtonElement>("button[data-age-option]");
		if (chip?.dataset.ageOption) centerAgeChip(chip.dataset.ageOption, true);
	};

	const onKeyboardActivity = (event: KeyboardEvent): void => {
		if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") keyboardNavigation = true;
	};

	const onPointerActivity = (): void => {
		keyboardNavigation = false;
	};

	const renderProgressSummary = (age: string): string => {
		const items = detailedMilestonesData[age] ?? [];
		const answers = currentAnswers(age);
		const answered = items.reduce((sum, _item, index) => {
			const value = answers[String(index)];
			return sum + (value === "yes" || value === "notYet" ? 1 : 0);
		}, 0);
		const percent = items.length > 0 ? Math.round(answered / items.length * 100) : 0;
		return '<section class="mt-4 pb-2" aria-labelledby="cdc-checklist-heading">' +
			'<h2 id="cdc-checklist-heading" class="text-xl font-bold text-navy-900">' + escapeHtml(ageLabel(age, language) + " " + answered + " / " + items.length + (language === "ja" ? "項目" : " items")) + "</h2>" +
			'<div class="mt-2 h-3 overflow-hidden rounded-full bg-gray-100" style="height:12px;border-radius:9999px;overflow:hidden" role="progressbar" aria-label="' + escapeHtml(language === "ja" ? ageLabel(age, language) + "の確認済み項目" : "Milestones reviewed for " + ageLabel(age, language)) + '" aria-valuemin="0" aria-valuemax="' + items.length + '" aria-valuenow="' + answered + '">' +
					'<span class="block h-full rounded-full bg-mint-500 transition-[width]" style="height:100%;width:' + percent + '%;border-radius:9999px"></span>' +
			"</div></section>";
	};

	const renderChecklist = (age: string): string => {
		const labels = copy();
		const groups = groupsForAge(age);
		const items = detailedMilestonesData[age] ?? [];
		const answers = currentAnswers(age);
		const sections = groups.map((group) => {
			const rows = group.items.map((item, localIndex) => {
				const index = group.start + localIndex;
				const text = language === "ja" ? item.ja : item.en;
				return '<li class="grid gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style="display:grid;grid-template-columns:minmax(0,1fr);gap:16px">' +
					'<p class="text-base leading-7 text-navy-900">' + escapeHtml(text) + "</p>" +
					answerButtons(age, String(index), answers[String(index)]) +
				"</li>";
			}).join("");
			return '<section id="cdc-category-' + group.index + '" data-cdc-category class="scroll-mt-24 pt-5">' +
				'<h3 class="mb-2 flex items-baseline justify-between gap-3 text-xl font-bold text-navy-900"><span>' + escapeHtml(categories()[group.index]) + '</span><span class="text-sm font-semibold text-gray-500">' + group.items.length + (language === "ja" ? "項目" : " items") + "</span></h3>" +
				'<ul class="m-0 list-none space-y-3 p-0">' + rows + "</ul></section>";
		}).join("");
		const empty = items.length === 0 ? '<p class="py-6 text-sm text-gray-500">' + escapeHtml(labels.emptyChecklist) + "</p>" : "";
		const reviewSections = previousReviewSections(age);
		const buttonText = showResults ? (language === "ja" ? "結果を閉じる" : "Hide results") : labels.viewResults;
		const resultButton = items.length > 0
			? '<button type="button" data-toggle-results aria-expanded="' + String(showResults) + '" class="mt-5 w-full border-y border-gray-200 py-3 text-sm font-bold text-navy-900 hover:text-mint-600">' + escapeHtml(buttonText) + "</button>"
			: "";
		const results = showResults && items.length > 0 ? renderResults(age, reviewSections) : "";
		const dialog = showPreviousReview ? renderPreviousReview(age, reviewSections) : "";
		return renderCategoryNavigation(age) + sections + empty + resultButton + results + dialog;
	};

	const renderTips = (age: string): string => {
		const labels = copy();
		const tips = detailedTipsData[age] ?? [];
		const checked = storage.checkedTips[age] ?? [];
		const visible = tips.map((tip, index) => ({ tip, index })).filter(({ index }) => tipsFilter === "all" || !checked.includes(index));
		const filterButtons = (["unchecked", "all"] as const).map((value) => {
			const selected = tipsFilter === value;
			const text = value === "unchecked" ? (language === "ja" ? "チェックなし" : "Unchecked") : (language === "ja" ? "全部" : "All");
			return '<button type="button" data-tips-filter="' + value + '" aria-pressed="' + String(selected) + '" class="min-h-11 border px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 ' + (selected ? "border-mint-500 bg-mint-50 text-mint-600" : "border-gray-300 text-gray-600 hover:bg-gray-50") + '" style="min-height:44px;font-size:14px">' + escapeHtml(text) + "</button>";
		}).join("");
		const rows = visible.map(({ tip, index }) => {
			const selected = checked.includes(index);
			const text = language === "ja" ? tip.ja : tip.en;
			const stateLabel = selected ? (language === "ja" ? "チェック済み" : "Checked") : (language === "ja" ? "チェックする" : "Check");
			return '<li class="grid gap-3 border-b border-gray-100 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" style="display:grid;gap:12px;padding-top:16px;padding-bottom:16px">' +
				'<p class="min-w-0 text-base leading-7 text-navy-900">' + escapeHtml(text) + "</p>" +
				'<button type="button" data-tip-index="' + index + '" aria-pressed="' + String(selected) + '" aria-label="' + escapeHtml(stateLabel) + '" class="min-h-12 w-full rounded-xl border px-4 py-3 text-base font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 sm:w-auto sm:min-w-40 ' + (selected ? "border-mint-500 bg-mint-50 text-mint-600" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50") + '" style="min-height:48px;font-size:16px">' + escapeHtml(stateLabel) + "</button>" +
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
		const message = consultationText(age, ageLabel(age, language), resultCategories(age), language, audience);
		const tabs = (["doctor", "ai"] as const).map((value) => {
			const selected = audience === value;
			return '<button type="button" data-audience="' + value + '" role="tab" aria-selected="' + String(selected) + '" class="min-h-14 w-full rounded-xl px-2 py-3 text-center text-lg font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 ' + (selected ? "bg-mint-50 text-mint-600" : "text-gray-600 hover:text-navy-900") + '" style="min-height:56px;font-size:clamp(15px,4.6vw,18px)">' + labels[value] + "</button>";
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
			'<div class="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-gray-50 p-1" role="tablist" aria-label="' + escapeHtml(language === "ja" ? "文章の用途" : "Choose a message") + '">' + tabs + "</div>" +
			'<div role="tabpanel" class="pt-3">' +
				'<button type="button" data-copy-message class="min-h-12 w-full rounded-xl bg-navy-900 px-5 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 sm:w-auto" style="min-height:48px;font-size:16px">' + escapeHtml(language === "ja" ? "文章をコピー" : "Copy message") + "</button>" +
				'<p data-copy-status role="status" aria-live="polite" class="min-h-5 pt-2 text-xs text-gray-500">' + escapeHtml(copied) + "</p>" +
				'<div data-consultation-text role="textbox" aria-readonly="true" tabindex="0" aria-label="' + escapeHtml(labels[audience]) + '" class="mt-1 w-full select-text whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500" style="white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text">' + escapeHtml(message) + "</div>" +
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
				return '<li class="grid gap-3 rounded-xl border border-gray-100 bg-white p-3" style="display:grid;grid-template-columns:minmax(0,1fr);gap:12px">' +
					'<p class="text-base leading-7 text-navy-900">' + escapeHtml(text) + "</p>" +
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
		if (!authReady) {
			const message = document.documentElement.lang.startsWith("en") ? "Checking sign-in status…" : "ログイン状態を確認しています…";
			root.innerHTML = '<p role="status" aria-live="polite" class="py-8 text-center text-sm text-gray-500">' + escapeHtml(message) + "</p>";
			return;
		}
		language = currentLanguage();
		const labels = copy();
		document.documentElement.lang = language;
		const age = storage.selectedAge;
		const viewTabs = (["checklist", "tips"] as const).map((value) => {
			const selected = view === value;
			const text = value === "checklist" ? labels.navChecklist : labels.navTips;
			return '<button type="button" data-view="' + value + '" aria-current="' + String(selected) + '" class="min-h-14 w-full rounded-xl px-2 py-3 text-center text-lg font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 ' + (selected ? "bg-mint-50 text-mint-600" : "text-gray-600 hover:bg-gray-50 hover:text-navy-900") + '" style="min-height:56px;font-size:clamp(15px,4.6vw,18px)">' + escapeHtml(text) + "</button>";
		}).join("");
		const localSaveError = language === "ja"
			? "このブラウザーでは保存できません。ページを閉じると回答が消える場合があります。"
			: "This browser could not save your selections. They may be lost when you leave this page.";
		const cloudSaveMessage = cloudSaveStatus === "failed"
			? (language === "ja" ? "アカウントへの保存に失敗しました。端末には保存済みです。通信が戻ったら再試行してください。" : "Could not save to your account. Your device copy is safe; try again when connected.")
			: cloudSaveStatus === "saving"
				? (language === "ja" ? "アカウントに保存中…" : "Saving to your account…")
				: cloudSaveStatus === "saved"
					? (language === "ja" ? "アカウントに保存しました。" : "Saved to your account.")
					: cloudSaveStatus === "switching"
						? (language === "ja" ? "アカウントのデータを読み込み中…" : "Loading account data…")
						: "";
		const noticeMessage = saveAvailable ? cloudSaveMessage : localSaveError;
		const noticeClass = !saveAvailable || cloudSaveStatus === "failed" ? "text-red-600" : "text-gray-500";
		const saveNotice = '<p data-save-notice role="status" aria-live="polite" class="mt-2 min-h-4 text-xs ' + noticeClass + '">' + escapeHtml(noticeMessage) + "</p>";
		const viewContent = view === "checklist" ? renderChecklist(age) : renderTips(age);
		root.innerHTML =
			'<header>' +
				'<h1 class="sr-only">' + escapeHtml(language === "ja" ? "CDC発達チェック" : "CDC Developmental Checklist") + "</h1>" +
				renderAgeChips(age) +
					renderProgressSummary(age) +
			"</header>" +
			'<nav class="mt-3 mb-4 grid grid-cols-2 gap-2" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px" aria-label="' + escapeHtml(language === "ja" ? "表示内容" : "Content") + '">' + viewTabs + "</nav>" +
			viewContent + saveNotice;
		updateCategoryButtons();
		centerSelectedAgeChip();
	};

	const updateCategoryButtons = (): void => {
		root.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
			const selected = Number(button.dataset.category) === activeCategory;
			button.setAttribute("aria-current", String(selected));
			button.classList.toggle("border-mint-500", selected);
			button.classList.toggle("bg-mint-50", selected);
			button.classList.toggle("text-mint-600", selected);
			button.classList.toggle("border-gray-200", !selected);
			button.classList.toggle("bg-white", !selected);
			button.classList.toggle("text-navy-900", !selected);
			button.classList.toggle("hover:border-gray-300", !selected);
		});
	};

	const applySyncResult = (result: CdcSyncResult, userId: string, revision: number): void => {
		if (disposed || activeAccountUserId !== userId || uiRevision !== revision) return;
		if (result.status === "synced") {
			saveAvailable = true;
			cloudSaveStatus = "saved";
			if (JSON.stringify(storage) !== JSON.stringify(result.state)) {
				storage = result.state;
				render();
			}
		} else if (result.status === "pending" || result.status === "account-mismatch") {
			cloudSaveStatus = "failed";
		} else {
			cloudSaveStatus = "idle";
		}
		render();
	};

	const persistCurrentStorage = (revision: number): void => {
		if (authReady && activeAccountUserId) {
			const userId = activeAccountUserId;
			cloudSaveStatus = "saving";
			void saveCdcStorageForUser(userId, storage, { storage: window.localStorage, cloud: cdcCloud })
				.then((result) => applySyncResult(result, userId, revision))
				.catch(() => {
					if (disposed || activeAccountUserId !== userId || uiRevision !== revision) return;
					saveAvailable = false;
					cloudSaveStatus = "failed";
					render();
				});
			return;
		}
		try {
			saveCdcStorageLocally(storage, { storage: window.localStorage });
			saveAvailable = true;
		} catch {
			saveAvailable = false;
		}
	};

	const saveAndRender = (nextStorage: AppStorage, focusSelector?: string): void => {
		storage = nextStorage;
		uiRevision += 1;
		persistCurrentStorage(uiRevision);
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

	const selectConsultationText = (): void => {
		const field = root.querySelector<HTMLElement>("[data-consultation-text]");
		if (!field) return;
		field.focus({ preventScroll: true });
		const range = document.createRange();
		range.selectNodeContents(field);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	};

	const onClick = (event: Event): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const button = target.closest<HTMLButtonElement>("button");
		if (!button || !root.contains(button)) return;
		const editsCdcData = button.dataset.ageOption !== undefined || button.dataset.answerAge !== undefined || button.dataset.tipIndex !== undefined;
		if ((!authReady || accountSwitching) && editsCdcData) return;
		if (button.dataset.ageOption !== undefined && suppressNextAgeClick) {
			event.preventDefault();
			event.stopPropagation();
			suppressNextAgeClick = false;
			window.clearTimeout(suppressAgeClickTimer);
			return;
		}
		if (button.dataset.view === "checklist" || button.dataset.view === "tips") {
			selectView(button.dataset.view);
			return;
		}
		if (button.dataset.ageOption !== undefined) {
			const selectedAge = button.dataset.ageOption;
			if (!agesData.some((age) => age.key === selectedAge)) return;
			showResults = false;
			showPreviousReview = false;
			activeCategory = 0;
			copyStatus = "";
			saveAndRender({ ...storage, selectedAge }, 'button[data-age-option="' + selectedAge + '"]');
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
			const field = root.querySelector<HTMLElement>("[data-consultation-text]");
			if (!field) return;
			const message = field.textContent ?? "";
			if (!navigator.clipboard) {
				copyStatus = "failed";
				render();
				selectConsultationText();
				return;
			}
			void navigator.clipboard.writeText(message).then(() => {
				copyStatus = "copied";
				render();
				root.querySelector<HTMLElement>("[data-copy-message]")?.focus({ preventScroll: true });
			}).catch(() => {
				copyStatus = "failed";
				render();
				selectConsultationText();
			});
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

	const onResize = (): void => {
		onScroll();
		centerSelectedAgeChip();
	};

	const onHashChange = (): void => {
		const nextView = pageFromHash();
		if (nextView === view) return;
		view = nextView;
		showResults = false;
		showPreviousReview = false;
		render();
	};
	const handleAuthSession = async (userId: string | null): Promise<void> => {
		if (disposed) return;
		if (authReady && activeAccountUserId === userId) return;
		const generation = ++authGeneration;
		const revisionAtStart = uiRevision;
		const previousUserId = activeAccountUserId;
		if (!userId) {
			authReady = true;
			activeAccountUserId = null;
			accountSwitching = false;
			cloudSaveStatus = "idle";
			try {
				const guestState = deactivateCdcStorageUser({ storage: window.localStorage, initialState: storage });
				if (JSON.stringify(storage) !== JSON.stringify(guestState)) {
					storage = guestState;
					uiRevision += 1;
				}
				saveAvailable = true;
			} catch {
				saveAvailable = false;
			}
			render();
			return;
		}

		authReady = true;
		activeAccountUserId = userId;
		accountSwitching = Boolean(previousUserId && previousUserId !== userId);
		cloudSaveStatus = accountSwitching ? "switching" : "saving";
		try {
			const restore = restoreCdcStorageForUser(userId, { storage: window.localStorage, cloud: cdcCloud, initialState: storage });
			storage = loadStorage();
			render();
			const result = await restore;
			if (disposed || generation !== authGeneration || activeAccountUserId !== userId) return;
			accountSwitching = false;
			if (uiRevision === revisionAtStart && JSON.stringify(storage) !== JSON.stringify(result.state)) {
				storage = result.state;
				uiRevision += 1;
			}
			saveAvailable = true;
			cloudSaveStatus = result.status === "pending" || result.status === "account-mismatch"
				? "failed"
				: result.status === "synced" ? "saved" : "idle";
			render();
		} catch {
			if (disposed || generation !== authGeneration || activeAccountUserId !== userId) return;
			storage = emptyStorage;
			accountSwitching = false;
			cloudSaveStatus = "failed";
			saveAvailable = false;
			render();
		}
	};
	const onOnline = (): void => {
		if (authReady && activeAccountUserId && !accountSwitching) persistCurrentStorage(uiRevision);
	};
	const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
		const userId = session?.user.id ?? null;
		// Auth callbacks run under Supabase's auth lock; queue data requests after the callback returns.
		window.setTimeout(() => { void handleAuthSession(userId); }, 0);
	});
	if (!supabase) {
		authReady = true;
		try {
			storage = deactivateCdcStorageUser({ storage: window.localStorage, initialState: storage });
		} catch {
			saveAvailable = false;
		}
	}
	window.addEventListener("online", onOnline);
	root.addEventListener("click", onClick);
	root.addEventListener("pointerdown", onAgePointerDown);
	root.addEventListener("keydown", onAgeKeyDown);
	root.addEventListener("focusin", onAgeFocusIn);
	window.addEventListener("pointerdown", onPointerActivity, true);
	window.addEventListener("pointermove", onAgePointerMove, { passive: false });
	window.addEventListener("pointerup", onAgePointerUp);
	window.addEventListener("pointercancel", onAgePointerCancel);
	window.addEventListener("keydown", onKeyboardActivity, true);
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onResize);
	window.addEventListener("hashchange", onHashChange);
	window.addEventListener("popstate", onHashChange);
	render();

	return () => {
		disposed = true;
		authGeneration += 1;
		authListener?.data.subscription.unsubscribe();
		window.removeEventListener("online", onOnline);
		root.removeEventListener("click", onClick);
		root.removeEventListener("pointerdown", onAgePointerDown);
		root.removeEventListener("keydown", onAgeKeyDown);
		root.removeEventListener("focusin", onAgeFocusIn);
		window.removeEventListener("pointerdown", onPointerActivity, true);
		window.removeEventListener("pointermove", onAgePointerMove);
		window.removeEventListener("pointerup", onAgePointerUp);
		window.removeEventListener("pointercancel", onAgePointerCancel);
		window.removeEventListener("keydown", onKeyboardActivity, true);
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onResize);
		window.removeEventListener("hashchange", onHashChange);
		window.removeEventListener("popstate", onHashChange);
		window.clearTimeout(suppressAgeClickTimer);
		ageDragState = null;
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
