export type MethodType = 'household_rule' | 'app' | 'item';

export interface TrialMethod {
  id: string;
  slug: string;
  methodType: MethodType;
  name: string;
  description: string;
  officialUrl?: string;
  pricingNote?: string;
  icon: string;
}

export const initialProblem = {
  id: '10000000-0000-4000-8000-000000000001',
  slug: 'vaccine-schedule-sharing',
  title: '予防接種・健診の予定共有',
  questionText: '予防接種・健診の予定を、家族でどう共有していますか？',
  description: '予定の伝え忘れや確認漏れを減らすために、各家庭で試した方法と結果を比べます。医療判断ではなく、予定共有の方法についての調査です。',
};

export const trialMethods: TrialMethod[] = [
  { id: '20000000-0000-4000-8000-000000000001', slug: 'family-verbal-reminder', methodType: 'household_rule', name: '口頭で声をかける', description: '予定が決まったときや前日に、家族へ直接伝える方法です。', icon: 'record_voice_over' },
  { id: '20000000-0000-4000-8000-000000000002', slug: 'paper-calendar', methodType: 'household_rule', name: '紙のカレンダー・予定表', description: '家族が見える場所へ予定を書いて共有する方法です。', icon: 'calendar_month' },
  { id: '20000000-0000-4000-8000-000000000003', slug: 'google-calendar', methodType: 'app', name: 'Google カレンダー', description: '共有カレンダーや予定への招待で家族と予定を共有します。', officialUrl: 'https://calendar.google.com/', pricingNote: '基本機能は無料。', icon: 'event' },
  { id: '20000000-0000-4000-8000-000000000004', slug: 'timetree', methodType: 'app', name: 'TimeTree', description: '家族用の共有カレンダーで予定とメモをまとめます。', officialUrl: 'https://timetreeapp.com/', pricingNote: '無料プランあり。', icon: 'calendar_month' },
  { id: '20000000-0000-4000-8000-000000000005', slug: 'line-message', methodType: 'app', name: 'LINE', description: 'トークやノートへ予定を残して共有します。', officialUrl: 'https://line.me/ja/', pricingNote: '基本機能は無料。', icon: 'chat' },
];

export const methodTypeLabels: Record<MethodType, string> = {
  household_rule: '家庭内の工夫', app: 'アプリ・サービス', item: '商品・道具',
};
