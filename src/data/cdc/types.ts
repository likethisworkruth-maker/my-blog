export type Language = "ja" | "en";
export type Page = "checklist" | "tips";
export type Answer = "yes" | "notYet" | "unknown";
export type ConcernKey =
  | "regression"
  | "milestones"
  | "communication"
  | "play"
  | "movement"
  | "senses"
  | "other";

export interface AppStorage {
  version: 1;
  selectedAge: string;
  language: Language;
  milestoneAnswers: Record<string, Record<string, Answer>>;
  checkedTips: Record<string, number[]>;
  milestoneNotes: Record<string, Record<string, string>>;
  favoriteTips: string[];
  savedTips: string[];
  concerns: Record<string, ConcernKey[]>;
  concernNotes: Record<string, string>;
}

