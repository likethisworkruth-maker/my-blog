export const NARAIBASE_MIN_RESPONSES = 20;
export const NARAIBASE_MIN_GENDER_RESPONSES = 10;
export const NARAIBASE_REASON_MAX_LENGTH = 500;

export const NARAIBASE_LESSONS = [
  { slug: 'piano', name: 'ピアノ' },
  { slug: 'swimming', name: '水泳' },
  { slug: 'soccer', name: 'サッカー' },
  { slug: 'baseball', name: '野球' },
  { slug: 'calligraphy', name: '習字' },
  { slug: 'abacus', name: 'そろばん' },
  { slug: 'english', name: '英会話' },
  { slug: 'dance', name: 'ダンス' },
  { slug: 'ballet', name: 'バレエ' },
  { slug: 'gymnastics', name: '体操' },
  { slug: 'martial_arts', name: '武道' },
  { slug: 'cram_school', name: '学習塾' },
  { slug: 'other', name: 'その他' },
] as const;

export type NaraibaseLessonSlug = typeof NARAIBASE_LESSONS[number]['slug'];

export function isNaraibaseLessonSlug(value: unknown): value is NaraibaseLessonSlug {
  return typeof value === 'string' && NARAIBASE_LESSONS.some((lesson) => lesson.slug === value);
}

export function naraibaseLessonName(slug: string) {
  return NARAIBASE_LESSONS.find((lesson) => lesson.slug === slug)?.name;
}

export const NARAIBASE_SOURCE_LABELS = {
  research_panel: '調査モニター回答',
  site: 'サイト利用者回答',
  campaign: 'キャンペーン回答',
} as const;
