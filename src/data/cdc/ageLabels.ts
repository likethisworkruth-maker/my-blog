import type { Language } from "./types";

const japaneseAgeLabels: Record<string, string> = {
  "2 mo": "2か月",
  "4 mo": "4か月",
  "6 mo": "6か月",
  "9 mo": "9か月",
  "1 year": "1歳",
  "15 mo": "1歳3か月",
  "18 mo": "1歳6か月",
  "2 years": "2歳",
  "30 mo": "2歳6か月",
  "3 years": "3歳",
  "4 years": "4歳",
  "5 years": "5歳",
};

export function ageLabel(age: string, language: Language): string {
  if (language === "ja") return japaneseAgeLabels[age] ?? age;
  const names: Record<string, string> = {
    "2 mo": "2 months",
    "4 mo": "4 months",
    "6 mo": "6 months",
    "9 mo": "9 months",
    "1 year": "1 year",
    "15 mo": "15 months",
    "18 mo": "18 months",
    "2 years": "2 years",
    "30 mo": "30 months",
    "3 years": "3 years",
    "4 years": "4 years",
    "5 years": "5 years",
  };
  return names[age] ?? age;
}
