# LikeThis コンテンツ戦略・媒体振り分け仕様

- 版: 1.1-draft
- ステータス: 実装前の基準仕様
- 作成日: 2026-08-12
- 更新日: 2026-08-13
- 対象: Threads / Instagram / note / `likethis.work`
- 事業ゴール: 育児の困りごとを解決する便利グッズ・アプリのアフィリエイト収益
- 想定読者: 初めて育児をする、妊娠後期から1歳半ごろまでの家庭
- この文書の役割: DB、データ加工、記事生成、ブログ公開の共通契約

## 1. 結論

現行の「一つの候補から全媒体を生成する six-pack」方式は廃止する。

今後は次の順序で判定する。

1. データが何を示すものかを分類する
2. 作れるコンテンツの種類を決める
3. 権利・根拠・体験・安全性を検証する
4. 各媒体の適格性を個別判定する
5. `eligible` かつ人間が `requested` にした成果物だけを生成する

媒体はコンテンツ種別ではなく、承認済みコンテンツを届ける出力先である。

```text
第三者データ
  ↓ 需要・困りごとのシグナルだけを抽出
コンテンツ企画
  ↓ 公式情報・本人の実体験・現行の商品情報を追加
媒体別適格性判定
  ├─ Threads
  ├─ Instagram
  ├─ note
  └─ Blog
       ↓
  選び方・商品／アプリ記事
       ↓
  アフィリエイトリンク
```

フェーズ1では、アフィリエイトリンクをブログに集約する。Threads、Instagram、noteはブログへの入口と信頼形成に使い、媒体ごとの直接収益化は行わない。

## 2. 現状監査で確認した事実

### 2.1 データ

- ローカル原本は約67,000 HTML、QA本文62,697件、回答179,361件、返信162,424件
- SQLite自体は `quick_check=ok`、外部キー違反0件
- 現行の年齢分類は77.9%が不明
- 商品カテゴリは96.2%が不明
- アプリ固有情報は0件
- AI向け分類confidenceは全件0.72で、品質判定には使えない
- タグ収集は上限付きのため、件数を市場人気や検索需要とは解釈できない
- current six-pack候補15件はすべてdraftで、Content Studio適格候補は0件
- review/fact-check履歴は0件

### 2.2 生成パイプライン

- Research Bundleとsix-packの根拠・候補ID・版・媒体計画がimport時に失われる
- bundleは1本の `raw_content` に変換され、「Web原文」として扱われる
- 媒体を部分指定しても未指定媒体が既定ONになる
- `human_input_required` は表示上の注意であり、生成を止める技術的ゲートではない
- 記事型は `checklist / product_app / personal_blog` の3種類だけ
- 商品の選定ガイドと本人使用レビューを区別できない
- 媒体テンプレートはあるが、適格性はほぼ記事型一致だけで判定される
- 原文の短い抜粋を公開テンプレートへ出力する経路が残っている

### 2.3 ブログ

- 公開サイトとローカルでブランド、ルート、情報設計が異なる
- `knowhow` と `apps` にほぼ同一の「夫婦共有ログ」が重複している
- 一度だけ行う初期設定、毎回使うチェックリスト、記録テンプレート、アプリ記事が混在している
- アフィリエイト開示、`rel="sponsored"`、商品クリック計測、Product等の構造化データがない
- Instagramへの導線がない
- `/my-knowhow/` や空の絞り込みページがサイトマップへ大量に入る

### 2.4 監査中に判明したAPI副作用

`suggest` 系MCPは読み取り専用ではなく、候補をDBへ保存する。

監査時の呼び出しによって candidate ID 26〜54の29件が追加された。すべてdraft、未レビュー、未公開である。削除はせず、移行時に監査生成データとして凍結・判定する。

今後は次のAPIへ分ける。

- `preview_*`: 常に読み取り専用
- `create_*`: `persist=true` を明示した場合だけ保存

## 3. 事業導線の再定義

### 3.1 生産単位

生産単位を「記事」や「six-pack」ではなく、次の4要素を持つ問題クラスターとする。

```text
誰が      audience / life_stage
いつ      scene / trigger
何に困る  problem
何を終えたい completion_outcome
```

例:

```text
誰が: 生後0〜3か月の子を連れて短時間外出する家庭
いつ: 近所へ初めて外出する前
困りごと: 持ち物を増やしすぎず、忘れ物も避けたい
完了: 外出条件に合う持ち物だけを選び、バッグへ入れ終える
```

「生後1か月」「外出」「便利グッズ」のような単語の同居だけでは企画にしない。

### 3.2 収益ファネル

```text
1. 発見・共感
   Threads / Instagram
       ↓
2. 実用
   Blogのチェックリストまたは判断ガイド
       ↓
3. 必要条件の確定
   自分に必要な機能・条件・不要な条件を整理
       ↓
4. 選択
   商品／アプリの選び方、比較、本人レビュー
       ↓
5. 収益
   検証済みアフィリエイトCTA
```

チェックリストから特定商品へ直結させない。まず「必要な条件」を確定し、カテゴリ選定ガイドを経由してから商品を提示する。

### 3.3 noteの位置

noteは全企画の必須成果物ではない。本人の体験や編集判断がある場合だけ、次の役割を持つ。

- なぜそのチェックリストを作ったか
- 実際に試して、何が続かなかったか
- どの項目をなぜ入れ、なぜ外したか
- 公開後の反応から何を見直したか

Mamari投稿者の経験を運営者本人の経験として代用してはならない。

## 4. コンテンツ分類

媒体とは別に、全企画へ `content_kind` と `subject_type` を持たせる。

### 4.1 content_kind

| content_kind | 定義 | 主な成果物 |
|---|---|---|
| `problem_prompt` | 未知条件や困りごとを会話で集める問い | Threads |
| `action_checklist` | 複数の承認済み記事を束ねた、10項目以上の横断実行ツール | Blog、Instagram、Threads |
| `decision_guide` | 条件分岐を通して選択肢を絞るガイド | Blog、Instagram |
| `product_selection_guide` | 商品／アプリの選定軸を示す調査記事 | Blog、Instagram抜粋 |
| `first_hand_review` | 運営者本人が使用・検証したレビュー | Blog、note、SNS抜粋 |
| `evidence_explainer` | 公式情報を整理した背景・手順解説 | Blog、SNS抜粋 |
| `personal_story` | 本人の出来事、試行錯誤、学び | note、Blogログ、Threads |
| `update_notice` | 公開・改訂・検証結果の案内 | Threads |

`content_kind` の単位は `content_brief` であり、問題クラスターではない。

- 一つの `content_brief` は一つの主 `content_kind` だけを持つ
- 一つの問題クラスターから、目的の違う複数briefを作ってよい
- `action_checklist` だけは複数の承認済み詳細記事／briefを参照して作る上位briefとし、一つの記事または一つの問題クラスターから生成しない
- 媒体、商品名、データソース、キーワードだけで `content_kind` を決めない
- Instagramへ出すチェックリストも `action_checklist` のままであり、媒体によって型を変更しない
- 複数の型が同時に成立する場合は、無理に一つへ寄せずbriefを分割する
- 条件不足または競合を解消できない場合は、分類せず停止する

具体的な分類規則と例は「7.5 content_kind判定」を正本とする。

### 4.2 subject_type

```text
problem
checklist
physical_product
app
service
workflow
editorial_process
```

たとえば「アプリ」は記事型ではなくsubjectである。アプリについても、選定ガイド、本人レビュー、使い方解説を別コンテンツとして作れる。

### 4.3 evidence_mode

複数選択可能とする。

```text
aggregate_signal       第三者データを集計した需要シグナル
official_fact          公的機関・メーカー等の一次情報
owner_firsthand        運営者本人の使用・体験
current_product_fact   現行仕様・価格・提供条件
owned_audience_result  自サイト/SNSで自ら収集した回答・行動データ
```

`aggregate_signal` だけでは、具体的な推奨、効果、本人の感想を生成できない。

## 5. 各媒体のコンテンツ契約

### 5.1 Threads

#### 役割

- 困りごとの発見
- 共感と会話
- 未知条件の回収
- 公開・改訂の通知
- ブログへの入口

#### 投稿型

1. `problem_prompt`
   - 困りごとの一言
   - 条件を一つに絞った質問
   - 回答しやすい選択肢または自由回答
2. `micro_action`
   - 承認済みチェックリストから1〜3項目
   - ブログ完全版へのリンク
3. `editorial_insight`
   - 作成中に気づいた条件分岐
   - フォロワーへの確認
4. `update_notice`
   - 公開・更新点
   - 対象者と用途

#### eligible条件

- 一つの投稿に一つの困りごと
- 読者がセンシティブな個人情報を公開しなくても回答できる
- 「多くの人が」「普通は」等の一般化をしない
- 具体的手順を載せる場合は承認済みの核コンテンツがある
- リンク投稿の場合は公開済みの該当ブログURLがある

#### blocked条件

- 医療・安全上の緊急判断をコメントへ委ねる質問
- QA原文の言い換えだけの投稿
- 根拠のない人数、割合、ランキング
- 商品名だけを置いた薄い宣伝
- 運営者が経験していないのに体験談形式

#### 基本構成

```text
困りごと 1文
気づきまたは行動 1〜3点
条件を絞った質問 1問
必要な場合だけブログリンク
```

### 5.2 Instagram

#### 役割

- 保存される視覚的実用品
- 条件分岐や全体像の理解
- プロフィール・ブログへの遷移

#### 投稿型

- 保存版チェックリスト
- 条件別の持ち物・準備一覧
- 選び方の比較軸
- 手順またはタイムライン
- 本人レビューの「合う条件・合わない条件」

#### eligible条件

- 承認済みの核コンテンツがある
- 5〜9個の短い独立項目、または3つ以上の比較軸がある
- 1枚ごとに意味が一つ
- 長い例外説明なしでも誤解を生みにくい
- 画像・商品ロゴ・写真の利用権が確認済み
- 最後のスライドから該当ブログへ誘導できる

#### blocked条件

- 文章量が多く、例外を落とすと危険
- 高リスク情報を小さな注記だけで処理する
- 5項目未満を水増しする
- 元サイトの画面、写真、図表を再利用する
- 本人使用の裏付けがないbefore/afterやレビュー

#### カルーセル標準

```text
1枚目: 対象者 + 結論
2枚目: いつ使うか / 使わない条件
3〜7枚目: 項目または比較軸
8枚目: 条件分岐・注意点
9枚目: まとめ
10枚目: ブログ完全版へのCTA
```

項目数に合わせて枚数を減らしてよい。10枚を埋めることを目的にしない。

### 5.3 note

#### 役割

- 運営者の人柄と編集姿勢を伝える
- 一次体験、失敗、見直しを残す
- ブログの実用品に文脈を与える

#### 投稿型

- なぜ作ったか
- 使って分かったこと
- 続かなかった理由
- 項目の採否と編集判断
- 公開後の改善記録

#### eligible条件

次のどちらかを満たす。

1. 本人の一次体験
   - situation
   - tried
   - observed_result
   - weak_point
   - next_step
   - experience_period
2. 本人の編集プロセス
   - 企画の目的
   - 採用した条件
   - 除外した条件
   - 判断理由
   - 人間が見直した点

#### blocked条件

- Mamari投稿者の体験だけを材料にする
- AIが作った架空の失敗・感想・家族会話
- 一般情報を感情表現で膨らませただけの記事
- 商品リンクが本文価値の中心になる記事

#### CTA

本文の主目的は信頼形成とし、最後に関連するブログの実用品へ1回案内する。フェーズ1ではnoteへ商品アフィリエイトリンクを直接置かない。

### 5.4 Blog

#### 役割

- 検索流入
- 再利用できる実用資産
- 選択支援
- 収益の中心
- 全媒体の正規URL

#### A. アクションチェックリスト

必須条件:

```text
checklist_mode:
  one_time_setup | per_event | routine | packing | shopping | decision

problem_id
trigger
completion_outcome
audience
life_stage
scene_ids[]
prerequisites[]
not_for[]
```

各項目:

```text
action
completion_criterion
requiredness: required | recommended | optional
condition
frequency
rationale
evidence_refs[]
related_solution_refs[]
```

チェック項目は、読者が「終わった／終わっていない」を判定できるものだけにする。FAQ、見出し、説明、商品ページ、カテゴリ名をチェック項目にしない。

#### B. 商品／アプリ選定ガイド

本人使用がなくても、調査記事として明示し、公式情報と独自の選定軸があれば作成可能。

```text
article_scope: category_guide | comparison
problem_ids[]
solution_category
selection_criteria[]
comparison_subjects[]
official_fact_refs[]
limitations[]
not_for[]
alternatives[]
facts_checked_at
experience_basis: editorial_research
```

選定ガイドで「使ってよかった」「おすすめNo.1」等の本人評価は使わない。

#### C. 商品／アプリ本人レビュー

```text
article_scope: single_review | first_hand_comparison
experience_basis: owner_used | owner_tested
experience_period
usage_scene
acquisition_method
pros[]
cons[]
suitable_for[]
not_suitable_for[]
observed_result
official_fact_refs[]
facts_checked_at
offer_ids[]
```

本人入力がなければ `blocked(firsthand_missing)` とする。選定ガイドへ型を変えることで公開できる場合は、人間へ提案する。

#### D. アプリ固有項目

```text
developer
platforms[]
pricing_model
official_urls[]
permissions[]
privacy_notes[]
setup_steps[]
tested_workflow
limitations[]
```

アプリは提携先がなければ収益記事ではなく、チェックリストを完了する支援策として扱う。

#### E. 育児ログ

運営者本人の一次体験に限定する。

```text
experience_basis: owner_firsthand
experience_period
problem_id
attempts[]
observed_result
limitations
what_changed
related_checklist_ids[]
related_item_ids[]
related_app_ids[]
```

## 6. データ利用区分

| データ | 許可する役割 | 直接作れるもの | 禁止するもの |
|---|---|---|---|
| Mamari QA本文・回答 | 内部の困りごと分析 | なし | 原文、言い換え記事、体験談、引用集 |
| Mamari集計シグナル | 企画発見、対象者・場面候補 | originalなThreads質問、content brief | 人気順位、効果、具体的助言の根拠 |
| Mamari口コミ大賞 | 商品カテゴリ・候補棚 | 内部shortlist | 自動推薦、現在のNo.1、本人評価 |
| 公的機関・公式情報 | 安全・制度・仕様の確認 | evidence explainer、checklist根拠 | 原文の大量転載 |
| メーカー公式情報 | 現行仕様の確認 | 比較表の事実部分 | メーカーコピーの流用、独立評価の代用 |
| 運営者本人の記録 | 一次体験 | review、note、log | 体験していない範囲への一般化 |
| 自サイト/SNS回答 | 自社オーディエンスの傾向 | 方法を明示した集計記事 | 少数回答の一般化、個人特定 |
| アフィリエイト提供情報 | 取引条件・リンク | Blog CTA | 編集評価、効果根拠 |

### 6.1 Mamariデータの固定ルール

```text
use_class = planning_only
public_quote_allowed = false
public_paraphrase_allowed = false
personal_experience_allowed = false
recommendation_evidence_allowed = false
```

公開する具体的な事実や行動は、別途公式情報または人間の一次情報で立て直す。AIによる言い換えだけを権利処理とみなさない。

## 7. 振り分けエンジン

### 7.1 先に適格性、後で優先度

現在のpriority/lane判定は、作れるかどうかと作りたいかどうかを混同している。次を分離する。

```text
eligibility_status:
  eligible
  blocked
  not_applicable

requested: true | false
priority_score: 0..100
```

- `blocked`: 必要入力や審査で将来eligibleになり得る
- `not_applicable`: その内容は媒体特性に合わない
- `requested`: 人間が今回生成するか選ぶ
- 未指定targetは `requested=false`。既定ONにしない

### 7.2 blocked reason code

```text
raw_source_only
rights_unreviewed
privacy_risk
insufficient_support
official_evidence_missing
firsthand_missing
current_facts_missing
commercial_readiness_missing
high_risk_unreviewed
not_visualizable
destination_missing
stale_facts
duplicate_content
experience_mismatch
```

### 7.3 グローバルゲート

全媒体の前に通す。

#### G0. 出典・権利

- source recordと取得時点が追跡できる
- 利用区分が設定済み
- 公開物に第三者原文を含めない
- 人間が類似性と独自性を確認する
- Mamariの利用規約・robots確認が未完了の間は内部分析専用

#### G1. プライバシー

- 個人、施設、時期の組み合わせで投稿者を推定できない
- 珍しい出来事やセンシティブな体験を再構成しない
- owned audience resultは集計最小数を満たす

#### G2. 根拠

- 事実・安全・仕様は一次情報へ接続する
- 商品・アプリ情報に確認日がある
- 高リスク主張には公式根拠と人間のfact-checkがある

#### G3. 独自価値

次のうち一つ以上がある。

- 独自の条件分岐
- 実行可能なチェック機能
- 本人の一次体験
- 独自の比較軸
- 自サイトで取得した反応・改善履歴

#### G4. 商用

アフィリエイトCTAを持つ場合:

- offerがactive
- 対象媒体が提携規約上許可される
- disclosure_textがある
- Blog linkに `rel="sponsored"` を付ける
- click event IDがある
- 商品・条件・遷移先を公開前に再確認する

### 7.4 企画候補の初期閾値

以下は市場人気ではなく、内部データで「繰り返し現れた」と判断するための初期値である。

```text
一般クラスター:
  distinct_questions >= 20

life-stageや狭い場面:
  distinct_questions >= 8

共通:
  2つ以上のタグ・期間・収集区分へ分散
  1区分への集中率 <= 0.80
  人間がランダムサンプルを確認
```

閾値未満でもThreadsで需要を聞くことはできる。ただし「よくある」と断定せず、純粋な質問として出す。

### 7.5 content_kind判定

#### 7.5.1 分類原則

`content_kind` は素材の単語ではなく、「読者が読み終えた時に何を完了できるか」で決める。

```text
primary_reader_outcome:
  collect_answer              未知条件を一つ回答する
  complete_task               一連の行動を完了する
  choose_path                 条件に合う方針・手段を一つ選ぶ
  choose_product_requirements 商品・アプリを選ぶ条件を持つ
  evaluate_used_subject       本人が使った対象の評価を理解する
  understand_evidence         根拠付きの事実・背景を理解する
  understand_experience       本人の出来事と学びを追体験する
  notice_change               公開・改訂・検証結果の変更点を知る
```

分類器が読む正規化フィールド:

```text
primary_reader_outcome
primary_subject_type
unresolved_question
trigger
completion_outcome
actions[]
decision_question
decision_paths[]
selection_criteria[]
comparison_subjects[]
owner_experience
claim_evidence[]
narrative_events[]
change_event
destination_content_id
```

`primary_reader_outcome` はbrief上で人間が確認する。AIがQA本文のキーワードだけから確定してはならない。

分類器が保存する結果:

```text
classification_status:
  classified
  ambiguous
  insufficient

content_kind
candidate_kinds[]
matched_rule_ids[]
rejected_reasons_json
missing_fields_json
classification_rule_version
human_confirmed_at
```

現行の全件同値な `confidence=0.72` は分類判定に使わない。booleanの必須条件と、満たさなかった理由を保存する。

#### 7.5.2 判定アルゴリズム

1. 8種類のルールをすべて独立に評価する
2. 必須条件をすべて満たし、禁止条件に当たらない型を `candidate_kinds` へ入れる
3. 候補0件なら `insufficient` とし、不足フィールドを返す
4. 候補1件なら `classified` とする
5. 候補が複数なら境界ルールで解決する
6. 一つのbriefに二つの完了状態が残る場合はbriefを分割する
7. 境界ルールでも解けなければ `ambiguous` とし、人間確認まで生成しない
8. `content_kind` 確定後にだけ媒体別eligibilityを判定する

最初に一致したキーワードや、旧 `mamari_question_insights.content_type` をそのまま正解にしない。

#### 7.5.3 8種類の判定契約

##### CK-P01 problem_prompt

読後の完了: 読者が安全に答えられる一問へ回答し、編集側が未知条件を一つ回収できる。

必須:

```text
primary_reader_outcome = collect_answer
unresolved_questionが一つ
一投稿で聞く条件軸が一つ
個人情報なしで回答可能
回答の利用目的が企画改善として説明可能
```

禁止:

- 既に答えが確定している内容を反応獲得目的だけで質問する
- 根拠なしに「みんな」「多くの家庭」と一般化する
- 医療・安全の緊急判断をコメントへ委ねる
- Mamariの質問文を言い換える

例:

> 生後0〜3か月で近所へ短時間出るとき、いちばん迷うのは「持ち物」「移動方法」「授乳の時間」のどれですか？

答えを教える記事ではなく、未知条件を回収するため `problem_prompt`。

##### CK-A01 action_checklist

読後の完了: 年齢・月齢または利用場面に対して、複数の記事を横断した10項目以上の判断・準備をすべて「完了／未完了」で判定できる。

必須:

```text
primary_reader_outcome = complete_task
triggerが一つ
completion_outcomeが一つ
独立actionが10件以上
全actionにcompletion_criterion
承認済みのsupporting_contentsが2件以上
全actionにsupporting_content_refsがあり、承認済み詳細記事／briefへ遷移できる
条件付き項目にcondition
事実を含む項目にevidence_refs
人間レビュー済み
```

禁止:

- 見出し、FAQ、商品名、カテゴリ名をチェック項目にする
- 一つの記事、一つの問題クラスター、一つのQA回答を膨らませて10項目にする
- 詳細記事への参照がない項目を数合わせで追加する
- 「確認する」「準備する」だけで完了基準がない
- 選択肢比較を無理に行動項目へ変える
- 個人の医療・金銭・家族助言を一般行動へ変える

例:

```text
trigger:
  子どもが生後3か月になるまで
completion_outcome:
  育児用品10カテゴリについて、購入する／待つ／不要を決め終える
supporting_contents:
  - ベビーカーのA型・B型・AB型を選ぶ記事
  - 抱っこ紐を利用場面で選ぶ記事
  - 授乳用品を授乳方法で選ぶ記事
  - ほか承認済み詳細記事
actions:
  - ベビーカーを今買う／B型まで待つ／購入前に試す、のどれかを決めた
  - 抱っこ紐が必要な利用場面を決めた
  - 授乳方法に合う授乳用品を決めた
  - ほか合計10項目以上
```

9項目以下は短い手順または個別記事の補助要素であり、独立した `action_checklist` として生成しない。項目数の上限は固定しないが、全項目が同じ月齢・場面と一つの完了状態に属することを必須とする。

##### CK-D01 decision_guide

読後の完了: 自分の条件に合う方針・手段・次の行動を一つ選べる。

必須:

```text
primary_reader_outcome = choose_path
decision_questionが一つ
decision_paths >= 2
全pathにbranch_conditions
全pathにterminal_outcomeまたはnext_action
条件が相互に区別可能
事実を使う分岐にevidence_refs
```

禁止:

- 行動を順番に完了するだけ
- 商品名を並べただけ
- どの条件でも同じ結論になる擬似分岐
- 高リスク判断を簡略化する

例:

```text
decision_question:
  短時間外出は抱っこ紐・ベビーカー・併用のどれにするか
paths:
  - 階段が多く滞在が短い → 抱っこ紐中心
  - 平坦で荷物が多い → ベビーカー中心
  - 移動距離と滞在時間が長い → 併用
```

個別商品ではなく移動方法を決めるため `decision_guide`。

##### CK-S01 product_selection_guide

読後の完了: 自分に必要な商品・アプリの条件を持ち、候補または代替策を絞れる。

必須:

```text
primary_reader_outcome = choose_product_requirements
primary_subject_type = physical_product | app | service
problemからsolution_categoryへの関係が説明可能
selection_criteria >= 3
comparison_subjectsまたはalternatives >= 2
全仕様をofficial_factで確認
facts_checked_at
limitationsとnot_for
experience_basis = editorial_research
```

禁止:

- 口コミ大賞の候補だけで推薦する
- affiliate提供情報を編集評価の根拠にする
- 本人使用なしで「使ってよかった」「一番おすすめ」と書く
- 価格・仕様・提供条件が未確認

例:

```text
テーマ:
  短時間外出用バッグの選び方
selection_criteria:
  - 片手で開閉できるか
  - 必要量を入れた時の総重量
  - 汚れた時の手入れ方法
alternatives:
  - トート型
  - リュック型
  - 小型ポーチを既存バッグへ追加
```

公式仕様と独自の選定軸で支援するため `product_selection_guide`。

##### CK-R01 first_hand_review

読後の完了: 本人の使用条件と観察結果を理解し、自分に合うかの判断材料を持てる。

必須:

```text
primary_reader_outcome = evaluate_used_subject
primary_subject_type = physical_product | app | service
experience_basis = owner_used | owner_tested
experience_period
usage_scene
acquisition_method
observed_result
pros >= 1
cons >= 1
suitable_for >= 1
not_suitable_for >= 1
official_fact_refs
facts_checked_at
本人が本文を確認
```

禁止:

- 第三者レビューを本人経験として使う
- メーカー仕様から使用感を生成する
- 弱点、合わない条件、使用期間のない宣伝文
- AIが架空の結果や家族会話を追加する

例:

> 外出用オーガナイザーを3週間、徒歩15分以内の外出で使った。片手で開けやすかったが、ベビーカーを畳む時は外す必要があった。

本人使用がなければ `first_hand_review` ではなく、条件が揃えば `product_selection_guide` とする。

##### CK-E01 evidence_explainer

読後の完了: 特定の言葉・仕様・制度・安全情報について、一次情報が示す範囲と限界を理解できる。

必須:

```text
primary_reader_outcome = understand_evidence
説明するquestionまたはclaimが一つ
official_fact_refs >= 1
全claimにevidence mapping
適用範囲とlimitations
facts_checked_at
```

禁止:

- 行動完了が主目的
- 商品の優劣や本人評価が主目的
- 第三者QAだけを事実根拠にする
- 公式文章や図表の並べ替えだけ

例:

> ベビーカーの「折りたたみサイズ」表記はどこを見ればよいか。メーカー公式仕様の幅・奥行き・高さと、利用先の制限値が示す範囲を整理する。

照合作業の完了が主目的なら `action_checklist`、意味と根拠の理解が主目的なら `evidence_explainer`。

##### CK-N01 personal_story

読後の完了: 本人の出来事・試行錯誤・学びを時間の流れと文脈ごと理解できる。

必須:

```text
primary_reader_outcome = understand_experience
evidence_mode = owner_firsthand | owner_editorial_process
narrative_events >= 3
situation
attempt
observed_result
learningまたはwhat_changed
experience_period
人間が事実関係を確認
```

禁止:

- 特定商品評価が主目的
- Mamari投稿者の体験を再構成する
- AIが失敗、感情、家族会話を足す
- 一般情報を一人称へ変換しただけ

例:

> 初外出で予備品を詰めすぎた。帰宅後に未使用品を記録し、次回は条件付き項目へ変えた。その編集過程から外出チェックリストv2を作った。

商品の評価ではなく、本人の過程と学びが中心なので `personal_story`。

##### CK-U01 update_notice

読後の完了: 何が、いつ、誰に対して変わったかを知り、更新後の正規コンテンツへ移動できる。

必須:

```text
primary_reader_outcome = notice_change
change_event_ref
beforeとafter
published_atまたはeffective_at
affected_audience
destination_content_id
更新後URLが公開済み
```

禁止:

- 更新対象の正規コンテンツがない
- evergreenな解説を更新と呼ぶ
- 変更点を示さない再投稿
- 未承認draftへのリンク

例:

> 短時間外出チェックリストをv2へ更新。天候別の持ち物を必須項目から条件付き項目へ変更しました。対象は生後0〜3か月の近所外出です。

#### 7.5.4 境界ルール

- `action_checklist` と `decision_guide`: 行動を完了するか、方針を一つ選ぶかで分ける。両方あるならbriefを二つに分け `precedes` で接続
- `product_selection_guide` と `first_hand_review`: 公式仕様と選定軸なら前者、本人の使用評価なら後者。商品がsubjectというだけでは分類しない
- `evidence_explainer` と `action_checklist`: 意味と適用範囲の理解なら前者、照合・設定・準備の完了なら後者
- `personal_story` と `first_hand_review`: 出来事と学びが主役なら前者、特定商品の使用評価が主役なら後者
- `update_notice`: 承認済みコンテンツの変更イベントからだけ作る。他の型を短くしたSNS投稿は元の `content_kind` を保持

#### 7.5.5 同一テーマを8種類へ分ける具体例

問題クラスター:

```text
audience: 生後0〜3か月の家庭
scene: 近所への短時間外出
problem: 忘れ物を避けたいが荷物を増やしたくない
completion_outcome: 外出条件に合う準備を終える
```

| 企画 | 読者が最後にできること | content_kind | 決め手 |
|---|---|---|---|
| 外出準備で一番迷う点を一問だけ聞く | 回答する | `problem_prompt` | 未知条件の回収 |
| 生後3か月までの育児用品10項目を、複数の詳細記事を見ながら判断する | 購入する／待つ／不要を決め終える | `action_checklist` | 10項目以上、完了基準、複数の承認済み詳細記事 |
| 抱っこ紐・ベビーカー・併用を条件で選ぶ | 移動方法を決める | `decision_guide` | 3つのdecision path |
| 短時間外出用バッグを3軸で比較する | 必要な商品条件を持つ | `product_selection_guide` | 選定軸、代替策、公式仕様 |
| 本人が3週間使ったバッグを評価する | 自分に合うか判断する | `first_hand_review` | 本人使用、期間、長所、弱点 |
| 折りたたみサイズ表記の読み方を整理する | 仕様の意味を理解する | `evidence_explainer` | claimと公式根拠 |
| 初外出で詰めすぎ、リストを直した経緯を書く | 試行錯誤を理解する | `personal_story` | 本人の時間軸と学び |
| 外出チェックリストv2の変更点を知らせる | 更新点を知り完全版へ移動する | `update_notice` | change eventと公開URL |

#### 7.5.6 分類してはいけない入力

| 入力 | 誤った分類 | 正しい処理 |
|---|---|---|
| Mamari回答を箇条書きにしたもの | `action_checklist` | `insufficient(raw_source_only)` |
| 口コミ大賞の商品名一覧 | `product_selection_guide` | shortlistのまま。公式仕様と選定軸を追加 |
| 「おむつ、ミルク、着替え」の名詞3件 | `action_checklist` | actionと完了基準がないため未分類 |
| 一つの商品記事を10項目へ水増し | `action_checklist` | 複数の承認済み詳細記事がないため未分類 |
| メーカー仕様表だけ | `first_hand_review` | `evidence_explainer`候補または内部evidence |
| 第三者の使用感をAIで一人称化 | `personal_story` | 公開不可 |
| 一つのbriefに移動方法の選択と荷造り完了 | どちらかを先勝ち | briefを二つへ分割 |
| どのルールにも完全一致しない | 一番近い型へ強制 | `insufficient`で停止 |
| 複数ルールが残る | 固定優先順で決定 | `ambiguous`で停止またはbrief分割 |

#### 7.5.7 保存例

```json
{
  "classification_rule_version": "1.1.0",
  "classification_status": "classified",
  "content_kind": "action_checklist",
  "candidate_kinds": ["action_checklist"],
  "matched_rule_ids": ["CK-A01"],
  "rejected_reasons": {
    "decision_guide": ["decision_pathsがない"],
    "product_selection_guide": ["selection_criteriaがない"],
    "first_hand_review": ["owner_experienceがない"]
  },
  "missing_fields": [],
  "human_confirmed_at": "2026-08-13T00:00:00+09:00"
}
```

未確定の例:

```json
{
  "classification_rule_version": "1.0.0",
  "classification_status": "ambiguous",
  "content_kind": null,
  "candidate_kinds": ["action_checklist", "decision_guide"],
  "required_action": "split_brief",
  "generation_allowed": false
}
```

#### 7.5.8 現行データからの候補提案

データソースは `content_kind` を直接決定しない。データから作れるのは `kind_proposal` までであり、7.5.3の必須フィールドが揃って初めて `classified` になる。

```text
proposal_status:
  proposed     editorial briefの候補を作れる
  support_only 他のbriefの根拠・subject・商用条件だけ
  forbidden    そのkindの根拠には使えない
```

| 現行データ | 提案できるkind | support_only | 提案・確定してはいけないもの |
|---|---|---|---|
| Mamari集計シグナル | `problem_prompt` | 他kindのproblem / audience / scene候補 | checklistのaction、商品推薦、本人review、personal_story |
| Mamari QA本文・回答 | なし | 人間が集計ルールを検証する内部サンプル | 全公開kindの本文、原文引用、言い換え |
| Mamari口コミ大賞 | なし | `product_selection_guide` のsubject shortlist | 現在の順位、推奨、本人評価 |
| 公的機関・公式情報 | `evidence_explainer` | checklist、decision、selection、reviewのfact | owner experience |
| メーカー現行仕様 | なし | selection / review / explainerのfact | 独立評価、使用感 |
| 運営者本人の使用記録 | `first_hand_review` または `personal_story` | checklistのoriginal insight | 未経験範囲への一般化 |
| 運営者の編集記録 | `personal_story` | updateの変更理由 | 商品使用review |
| approved成果物のchange event | `update_notice` | なし | 新規evergreen解説 |
| active affiliate offer | なし | Blog CTAのcommercial readiness | selection criteria、効果根拠 |

例:

```text
Mamari集計で「短時間外出 × 持ち物迷い」を発見
  → problem_promptのproposalは作れる
  → action_checklistのproblem候補にはなる
  → しかしtrigger / actions / completion criteriaは存在しない
  → checklistとしては insufficient のまま
  → 公式情報と人間の編集設計を追加して初めて再判定
```

口コミ大賞の商品候補が存在しても、`product_selection_guide` へ自動分類しない。`selection_criteria`、代替策、現行公式仕様、確認日が揃うまでshortlistである。

#### 7.5.9 分類器の必須テスト

| Test ID | 入力 | 期待結果 |
|---|---|---|
| CKT-001 | action 10件、triggerなし | `insufficient` / `missing_fields=["trigger"]` |
| CKT-002 | triggerあり、action 10件が名詞だけ | `insufficient` / completion criterion不足 |
| CKT-003 | decision path 3件、各条件と終点あり | `classified(decision_guide)` |
| CKT-004 | 商品subject、選定軸2件 | `insufficient`。reviewへfallbackしない |
| CKT-005 | 公式仕様あり、owner_used=false | `first_hand_review` を候補にしない |
| CKT-006 | owner_used=trueだがconsなし | `insufficient` / `missing_fields=["cons"]` |
| CKT-007 | action完了とpath選択が同じbriefの主目的 | `ambiguous` / `required_action="split_brief"` |
| CKT-008 | Mamari回答の箇条書きだけ | `insufficient(raw_source_only)` |
| CKT-009 | updateのbefore/afterあり、公開URLなし | `insufficient` / destination不足 |
| CKT-010 | 候補が1件で人間未確認 | 分類結果は保存できるが生成不可 |
| CKT-011 | 完了基準のあるactionが9件 | `insufficient` / 10項目未満 |
| CKT-012 | action 10件を一つの記事だけで支持 | `insufficient` / 複数の承認済み詳細記事不足 |
| CKT-013 | action 10件、承認済み詳細記事2件以上、全項目に参照あり | `classified(action_checklist)` |

実装はこの10ケースをfixture化し、rule version更新時の回帰テストへ含める。

### 7.6 媒体別判定表

| content_kind | Threads | Instagram | note | Blog |
|---|---:|---:|---:|---:|
| problem_prompt | eligible | not_applicable | not_applicable | internal only |
| action_checklist | 1〜3項目の抜粋 | 10項目以上を1枚で読める場合だけeligible | 編集背景があればeligible | 複数の詳細記事を束ねるハブが主成果物 |
| decision_guide | 質問・気づき | 視覚化できればeligible | 編集判断があればeligible | 主成果物 |
| product_selection_guide | 抜粋のみ | 3軸以上ならeligible | 原則not_applicable | 主成果物 |
| first_hand_review | 抜粋 | 視覚素材があればeligible | eligible | 主成果物 |
| evidence_explainer | 短い注意点 | 誤解なく短縮可能ならeligible | 人間の論考があればeligible | 主成果物 |
| personal_story | 抜粋 | 視覚素材があればeligible | 主成果物 | logとして任意 |
| update_notice | 主成果物 | 原則not_applicable | 任意 | not_applicable |

### 7.7 優先度スコア

eligibleになった後だけ計算する。

```text
need_recurrence       0..25
actionability         0..20
evidence_readiness    0..20
revenue_readiness     0..20
original_value        0..10
freshness             0..5
risk_penalty          0..-20
production_penalty    0..-10
```

`related_questions`だけで順位を作らない。収集上限とタグ偏りがあるため、need_recurrenceは最大25点中15点までに制限し、人間の判断、Search Console、SNS実績が揃った後に上限を解放する。

## 8. editorial lane

laneは媒体セットではなく、企画の事業目的を示す。

### revenue

```text
低〜中リスク
明確なsolution category
選定軸が作れる
公式仕様が揃う
有効なaffiliate offerがある
```

### trust

```text
本人の一次体験または編集過程がある
すぐに商品へつなげる必要がない
```

### hybrid

revenueとtrustの両方を満たす。ただし同じ記事の中で混ぜず、選定ガイドと体験記事を分けて相互リンクする。

### no-commercial

高リスク、収益との自然な関係がない、またはofferがない。必要なら公共的な情報として公開するが、アフィリエイトCTAを置かない。

## 9. RDBの再構成

### 9.1 物理的に3層へ分ける

```text
Raw Archive
  childcare-data-aggregator-data
  HTML / metadata / hash。原本を変更しない

Research DB
  第三者データの解析、集計、source lineage
  公開本文を持たない

Editorial DB
  人間が採用した企画、根拠参照、媒体適格性、成果物、審査
  raw QA本文を持たない

Publication Manifest
  approvedな公開データだけをmy-blogへexport
```

HermesからResearch DBを直接読んで文章を作らない。Research DBから採用したIDだけをEditorial DBへ参照し、必要な一次情報を追加してから生成する。

### 9.2 Research DBで正本として残すもの

QA:

```text
mamari_qa_questions
mamari_qa_question_contents
mamari_qa_answers
mamari_qa_answer_replies
tag / age evidence
```

Award:

```text
mamari_award_catalog_products
mamari_award_departments
mamari_award_placements
mamari_award_external_links
```

Analysis:

```text
mamari_analysis_runs
active-run限定のproblem signals
signalとsource IDの対応
```

insight件数は全runの合計を表示せず、active run viewを正規の読取口とする。

### 9.3 Editorial DBの最小10テーブル

#### 1. evidence_units

公開判断に使う最小単位。第三者原文ではなく正規化された事実・シグナル・本人入力を保持する。

```text
id
evidence_mode
canonical_statement
risk_level
public_use_class
fresh_until
status
created_at
```

#### 2. evidence_sources

```text
evidence_id
source_system
source_record_type
source_record_id
official_url
retrieved_at
content_hash
```

#### 3. content_briefs

```text
id
schema_version
primary_reader_outcome
classification_status: classified | ambiguous | insufficient
content_kind nullable
candidate_kinds_json
matched_rule_ids_json
classification_reasons_json
missing_fields_json
classification_rule_version
human_confirmed_at
subject_type
problem_id
audience
life_stage
scene
trigger
completion_outcome
editorial_lane
risk_level
status
revision
created_by
```

#### 4. brief_evidence

```text
brief_id
evidence_id
role: demand | claim | condition | experience | commercial
```

#### 5. artifact_plans

媒体別判定の正本。

```text
id
brief_id
target: threads | instagram | note | blog
content_kind
eligibility_status
requested
blocked_reasons_json
required_inputs_json
template_id
decision_version
```

#### 6. artifacts

```text
id
artifact_plan_id
revision
body_json
rendered_text
status
generated_at
approved_at
content_hash
```

#### 7. entities

```text
id
entity_type: product | app | service | workflow
name
manufacturer_or_developer
official_url
facts_json
facts_checked_at
```

#### 8. offers

```text
id
entity_id
merchant
affiliate_program
destination_url
target_channels_json
status
verified_at
disclosure_text
tracking_code
```

#### 9. content_relations

```text
from_content_id
to_content_id
relation_type:
  solves | explains | compares | uses | alternative | related_checklist
sort_order
```

#### 10. review_events

```text
id
object_type
object_id
review_type:
  rights | privacy | fact | experience | editorial | commercial | publish
verdict
reason
reviewer
created_at
```

review/fact-check tableは0件でも削除しない。公開ゲートに必要な恒久スキーマである。

### 9.4 廃止・隔離候補

すぐにDROPせず、バックアップと参照確認後に隔離する。

- 旧 `mamari_award_products`
- 空のanswer analysis系7テーブル
- 空のgeneric article collection系テーブル
- 現行のcandidate/six-pack tablesは移行元としてread-only化
- 根拠1件ごとにcandidate revisionを増やす現行仕様

revisionは企画内容・判断・成果物が変わった時だけ増やす。根拠集合はhashまたは別versionで管理する。

## 10. Publication Manifest

my-blogはResearch DBやHermesのposts.jsonを直接読まない。次の条件を満たすmanifestだけをビルド対象にする。

```yaml
schema_version: "1.0"
content_id: "..."
content_kind: "action_checklist"
subject_type: "checklist"
status: "approved"
visibility: "public"

title: "..."
summary: "..."
problem_ids: []
scene_ids: []
audience: "..."
life_stage: "..."

experience_basis: "none"
evidence_refs: []
rights_status: "approved"
privacy_status: "approved"
fact_status: "approved"
medical_safety_status: "not_applicable"
human_reviewer: "..."
fact_checked_at: "2026-08-12"

canonical_url: "..."
published_at: "..."
updated_at: "..."
author: "..."

related_content: []
ctas: []
distribution_variants: []
raw_source_text_present: false
```

### 10.1 Blogビルド拒否条件

- `status != approved`
- `rights_status != approved`
- 人間のeditorial reviewがない
- raw source textを含む
- evidence_modeと体験表現が矛盾する
- 高リスク主張が未確認
- 商品・アプリのfactが期限切れ
- affiliate CTAにoffer、開示、計測IDがない
- `experience_basis != owner_*` なのに本人感想を含む

## 11. アフィリエイトCTA契約

```text
cta_id
content_id
target_kind: related_article | product_offer | app_store
target_id
offer_id
placement: hero | inline | checklist_item | comparison | footer
affiliate: boolean
disclosure_text
rel_values
campaign_id
```

フェーズ1の媒体ポリシー:

| 媒体 | 直接affiliate | 導線 |
|---|---:|---|
| Threads | しない | Blogへ |
| Instagram | しない | profile / Blogへ |
| note | しない | Blogへ |
| Blog | する | 検証済みofferへ |

ブログのアフィリエイトリンクには `rel="sponsored noopener noreferrer"` を使用する。記事冒頭の開示に加え、誤認しやすいCTAの近くにも広告であることを明示する。

## 12. 計測

### 12.1 イベント

```text
checklist_view
checklist_start
checklist_complete
related_content_click
affiliate_click
app_outbound_click
```

共通パラメータ:

```text
content_id
content_kind
cta_id
offer_id
placement
outbound_domain
campaign_id
utm_source
utm_medium
utm_content
```

### 12.2 媒体別KPI

| 媒体 | 主KPI | 補助KPI |
|---|---|---|
| Threads | 意味のある返信、ブログ遷移 | 反応から得た新条件数 |
| Instagram | 保存率、プロフィール遷移 | ブログ遷移 |
| note | 読了、ブログ遷移 | フォロー、スキ |
| Blog checklist | start率、complete率 | 関連記事遷移 |
| Blog selection/review | affiliate click率 | 比較表到達、離脱 |
| 事業 | 成約、収益/1000 session | offer別CVR |

フォロワー数や表示回数だけで企画の成否を判定しない。

## 13. ディレクトリごとの役割

### D:/mycode/childcare-data-aggregator-data

- immutable raw archive
- HTML、metadata、hash、取得ログ
- 公開原稿、AI下書き、媒体判定を置かない

### D:/mycode/datassette_gpt_plugin

- Research DBの読み取り・監査
- source lineageの確認
- preview query
- `suggest` で暗黙に書き込まない

### C:/Users/ルース/Documents/Hermes

- Editorial DBと人間レビューUI
- bundle-native import
- evidence refsとartifact plansを保持
- blocked/required_inputsを保存し、GO時にも再検証
- eligibleかつrequestedな成果物だけ生成
- 公開は行わない

### D:/mycode/my-blog

- approved Publication Manifestの検証と表示
- checklist、選定ガイド、レビュー、ログを別契約で描画
- affiliate開示、CTA、計測、構造化データ
- canonical、noindex、sitemapを正規化

## 14. 実装順序

### Phase 0. 凍結と棚卸し

1. DBバックアップ
2. `suggest` APIをpreview/persistへ分離
3. candidate ID 26〜54を監査生成として凍結
4. 長時間runningのimport run 8を調査
5. current candidate/six-packへの新規書き込みを止める
6. 公開版、ローカル版、正規IAを一本化

### Phase 1. 契約

1. content_kind / subject_type / evidence_modeを実装
2. content_kind rule 1.0.0と `classified / ambiguous / insufficient` を実装
3. CKT-001〜010をfixture化する
4. Editorial DB最小10テーブルを作る
5. artifact_plansとeligibility reason codeを実装
6. Publication Manifest schemaとvalidatorを作る

### Phase 2. 振り分け

1. 問題クラスター生成をtopic/life-stage/sceneで層化
2. 空白検索を全ORにする現行検索を修正
3. age evidenceを分類へ利用
4. source別に `proposed / support_only / forbidden` を判定
5. primary_reader_outcomeを人間が確認
6. 8ルールを全件評価し、0件・複数件を停止
7. classified後だけ媒体別eligibilityを保存

### Phase 3. Hermes

1. Research Bundle/six-packのlossy text adapterを廃止
2. brief、evidence、artifact planをそのままimport
3. 未指定targetをfalseにする
4. `firsthand_missing` などのblockをGO時に再検証
5. 原文抜粋を公開テンプレートへ出さない
6. 選定ガイドと本人レビューを別型にする

### Phase 4. Blog

1. Manifest validatorをbuild gateへ追加
2. 重複コンテンツを再分類
3. checklist → selection guide → offer関係を実装
4. affiliate disclosure、`rel=sponsored`、クリック計測
5. Article / Product / SoftwareApplication / BreadcrumbListを内容に応じて追加
6. `/my-knowhow/` と空filterをnoindex/sitemap除外

### Phase 5. パイロット

最初は低リスクで商品との関係が自然な一テーマだけを使う。

候補:

```text
生後0〜3か月の短時間外出
```

作る可能性がある成果物:

```text
Blog action_checklist
Blog product_selection_guide
Instagram checklist carousel
Threads problem_prompt + 公開通知
noteは本人の外出体験が入力された場合だけ
商品reviewは本人使用記録がある商品だけ
```

パイロットで媒体数を埋めることを目標にしない。

## 15. 受入条件

以下を自動テストと人間レビューで確認する。

1. QA原文を含むmanifestはexportできない
2. aggregate signalだけではreview/personal_storyを生成できない
3. 本人入力がなければnoteとfirst-hand reviewがblockedになる
4. 商品選定ガイドは本人レビュー表現を使わない
5. 未指定targetはrequested=falseのまま
6. blocked artifactはGOしても生成されない
7. high-risk claimは公式根拠なしでapprovedにならない
8. affiliate CTAはoffer、開示、`rel=sponsored`、event IDなしでbuildできない
9. 一つのbriefから必要な媒体だけを生成できる
10. bundle import後もcandidate ID、revision、evidence refs、eligibilityが保持される
11. revisionは根拠行数ではなく判断・内容変更で増える
12. 公開ページに「使った」と書く場合、owner_firsthand evidenceがある
13. content_kindはキーワード先勝ちや固定優先順で確定しない
14. 候補0件はinsufficient、候補複数はambiguousとなり生成されない
15. action_checklistとdecision_guideが同格ならbrief分割を要求する
16. 商品subjectだけではselection guideまたはreviewに分類されない
17. CKT-001〜010がrule version更新後もすべて通る

## 16. 現行コンテンツの暫定再分類

### 夜泣き対応メモ

現行JSONの実体が初期設定中心なら:

- `one_time_setup` の導入チェックリスト
- 毎回の夜泣き対応チェックリストとは分離

### 夫婦共有ログ

- 本体: `workflow` またはアプリ活用ガイド
- checklist側: 共有ログの導入準備だけ
- knowhow/appsの重複本文を一つにし、関係リンクで接続

### サンプルアイテム

- 商品ID、根拠、offerがないためdraftのまま
- 公開不可

### 育児ログ

- 本人の一次体験ならowner_firsthand evidenceを付けて保持
- Mamari由来なら公開ログにせずproblem signalへ戻す

## 17. 権利・広告に関する運用メモ

これは法的助言ではない。公開前に必要に応じて専門家へ確認する。

- AIで言い換えただけでは、既存著作物との類似性・依拠性の問題が自動的に解消されるわけではない
- Mamari利用規約上、投稿者は権利を保持し、同社・提携先へ利用を許諾している。LikeThisへの再利用許諾を示すものではないため、原文は公開利用しない
- アフィリエイト表示は、ページ冒頭に一文置くだけでなく、一般消費者に明瞭である必要がある
- Instagramでaffiliate linkを含むコンテンツはMeta上のブランドコンテンツとしてラベル対象になる
- Threadsのブランドコンテンツは有料プロモーションであることを本文・ハッシュタグ等で示す
- Googleはaffiliate linkに `rel="sponsored"` を推奨している

参考:

- 文化庁「AIと著作権に関する考え方について」  
  https://www.bunka.go.jp/seisaku/bunkashingikai/chosakuken/pdf/94037901_01.pdf
- ママリ利用規約  
  https://mamari.jp/terms
- 消費者庁「ステルスマーケティングに関するQ&A」  
  https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing/
- Instagram Help Center「What is considered branded content」  
  https://www.facebook.com/help/instagram/616901995832907/
- Threads Help Center「Start a new thread on Threads」  
  https://www.facebook.com/help/instagram/1217144552251333/
- Google Search Central「Qualify outbound links」  
  https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links

## 18. この仕様で最初に固定する決定

1. Mamariは `community_need_signal` 専用
2. Mamari Awardは `discovery_shortlist` 専用
3. 公式情報は `claim evidence` 専用
4. 本人経験は本人入力からのみ作る
5. six-packは必須セットではない
6. noteは本人経験・編集判断がある時だけ
7. 商品本人レビューと商品選定ガイドを分ける
8. affiliate linkはフェーズ1ではBlogだけ
9. Blogはapproved manifestだけを受け取る
10. 人間レビューなしで公開しない
