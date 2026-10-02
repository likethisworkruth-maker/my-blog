import type { Language } from "./types";

export interface Copy {
  brandSubtitle: string;
  navChecklist: string;
  navTips: string;
  ageLabel: string;
  checklistHeading: string;
  answered: string;
  total: string;
  progress: string;
  yes: string;
  notYet: string;
  emptyChecklist: string;
  emptyTips: string;
  switchLanguage: string;
  social: string;
  language: string;
  cognitive: string;
  movement: string;
  viewResults: string;
  hideResults: string;
}

export const translations: Record<Language, Copy> = {
  ja: {
    brandSubtitle: "米国疾病予防管理センター（CDC）の公開チェックリストを参考にした非公式サイトです。",
    navChecklist: "チェックリスト",
    navTips: "関わり方のヒント",
    ageLabel: "お子さんの年齢",
    checklistHeading: "の発達確認項目",
    answered: "確認済み",
    total: "合計",
    progress: "確認した項目",
    yes: "できる",
    notYet: "まだできない",
    emptyChecklist: "この年齢のチェック項目はありません。",
    emptyTips: "この年齢のヒントはありません。",
    switchLanguage: "言語を切り替える",
    social: "社会性・情緒",
    language: "ことば・コミュニケーション",
    cognitive: "認知・学習",
    movement: "運動・身体",
    viewResults: "結果を見る",
    hideResults: "結果を閉じる",
  },
  en: {
    brandSubtitle: "An unofficial site based on publicly available CDC milestone checklists.",
    navChecklist: "Milestones",
    navTips: "Advice",
    ageLabel: "Your child’s age",
    checklistHeading: " developmental checklist items",
    answered: "Reviewed",
    total: "Total",
    progress: "Items reviewed",
    yes: "Can do",
    notYet: "Not yet",
    emptyChecklist: "There are no checklist items for this age.",
    emptyTips: "There are no tips for this age.",
    switchLanguage: "Switch language",
    social: "Social & emotional",
    language: "Language & communication",
    cognitive: "Cognitive",
    movement: "Movement",
    viewResults: "View results",
    hideResults: "Hide results",
  },
};
