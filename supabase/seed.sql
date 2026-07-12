begin;

insert into public.problems (id, slug, title, question_text, description, status, display_order, answer_opened_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'vaccine-schedule-sharing',
  '予防接種・健診の予定共有',
  '予防接種・健診の予定を、家族でどう共有していますか？',
  '予定の伝え忘れや確認漏れを減らすために、各家庭で試した方法と結果を比べます。医療判断ではなく、予定共有の方法についての調査です。',
  'published', 10, now()
)
on conflict (id) do update set title = excluded.title, question_text = excluded.question_text,
description = excluded.description, status = excluded.status, display_order = excluded.display_order;

insert into public.methods (id, slug, method_type, name, description, official_url, platforms, pricing_model_note, status, verified_at)
values
('20000000-0000-4000-8000-000000000001','family-verbal-reminder','household_rule','口頭で声をかける','予定が決まったときや前日に、家族へ直接伝える方法です。',null,null,null,'published','2026-07-11'),
('20000000-0000-4000-8000-000000000002','paper-calendar','household_rule','紙のカレンダー・予定表','家族が見える場所へ予定を書いて共有する方法です。',null,null,null,'published','2026-07-11'),
('20000000-0000-4000-8000-000000000003','google-calendar','app','Google カレンダー','共有カレンダーや予定への招待で家族と予定を共有します。','https://calendar.google.com/',array['Web','iOS','Android'],'基本機能は無料。最新情報は公式サイトで確認してください。','published','2026-07-11'),
('20000000-0000-4000-8000-000000000004','timetree','app','TimeTree','家族用の共有カレンダーで予定とメモをまとめます。','https://timetreeapp.com/',array['Web','iOS','Android'],'無料プランあり。最新情報は公式サイトで確認してください。','published','2026-07-11'),
('20000000-0000-4000-8000-000000000005','line-message','app','LINE','トークやノートへ予定を残して共有します。','https://line.me/ja/',array['iOS','Android'],'基本機能は無料。通信料等を除きます。','published','2026-07-11');

insert into public.problem_methods(problem_id, method_id, display_order, is_featured)
select '10000000-0000-4000-8000-000000000001', id,
  row_number() over (order by case method_type when 'household_rule' then 1 when 'app' then 2 else 3 end, name), true
from public.methods where id::text like '20000000-0000-4000-8000-00000000000%'
on conflict (problem_id, method_id) do update set display_order = excluded.display_order, is_featured = excluded.is_featured;

insert into public.campaigns(id, code, problem_id, channel, label)
values ('30000000-0000-4000-8000-000000000001','direct_vaccine_initial','10000000-0000-4000-8000-000000000001','direct','初期サイト導線')
on conflict (id) do update set label = excluded.label;

commit;
