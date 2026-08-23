# note育児系有料コンテンツ市場調査ツール

## 既存Mamari実装との比較・改善点・実装方針

- 作成日: 2026-08-20
- 対象指示書: `note育児系有料コンテンツ市場調査ツール｜Python実装指示書`
- 比較対象: `C:\Users\ルース\Documents\Hermes\plugins\childcare-data-aggregator`
- 本文書の範囲: 設計と実装順序。noteへの収集、DB変更、Hermes側コード変更は未実施。

## 1. 結論

note版は、Mamariツールを別プロジェクトへ丸ごとコピーするのではなく、既存の `childcare-data-aggregator` 内へ `note_*` 名前空間で追加する。

土台はMamari Award Collectorを採用する。特に、URL単位の原本アーカイブ、sidecar JSON、SHA-256、SQLite上のURLキュー、claim/checkpoint、再開、キャッシュ優先、403/429時の停止はそのまま活用できる。Mamari Q&Aからは、発見元と対象URLの多対多管理、収集とローカルHTML解析の分離、パーサー版と入力ハッシュによる冪等インポートを活用する。

ただし、note版では次を新規実装する必要がある。

- 外部検索APIまたは手動Seed CSVからのURL発見
- article / magazine / creator / membership のURL・ページ分類
- 公開範囲だけを扱うnote固有Parser
- 価格、スキ、参加人数、販売者自己申告の時点観測
- 販売数の根拠・数量表現・信頼度を分離したEvidenceモデル
- 一般親、専門家、テーマ、悩み、商品タイプ、`data_role` の版管理されたLLM分類
- CSV・集計View・市場カバレッジレポート
- 静的HTMLで不足したページだけに限定するPlaywright fallback

最優先の変更は、収集前のポリシーゲートである。Mamari固有Collectorは実行時に `robots.txt` を確認するが、企業記事MVPにある「利用規約とrobotsの双方を人間がレビューし、allowedにしたソースだけ収集する」DBゲートを通っていない。note版ではこの弱点を複製しない。

## 2. 確認した現在の実装

主な比較対象:

- `childcare_core/url_archive.py`
- `childcare_core/mamari_qa_fetcher.py`
- `childcare_core/mamari_qa_collector.py`
- `childcare_core/mamari_qa_store.py`
- `childcare_core/mamari_qa_content_importer.py`
- `childcare_core/mamari_award_collector.py`
- `childcare_core/mamari_award_store.py`
- `childcare_core/mamari_award_content_importer.py`
- `scripts/collect_mamari_qa.py`
- `scripts/collect_mamari_award.py`
- 関連するMamariテスト3モジュール

2026-08-20時点で、Mamari Award収集、Mamari Q&A収集、Q&AローカルHTMLインポートの対象テスト25件はすべて成功した。

この結果が保証するのは、fixtureとスタブHTTP上でのURL分類、アーカイブ、重複排除、再開、404停止、キャッシュ、冪等インポートである。noteの現行DOMに対応できることや、Mamari本番データの完全性を保証するものではない。

また、Hermesリポジトリには既存の未コミット変更が多数ある。note実装時は、変更中のMamari関連ファイルへ無条件にリファクタをかけず、まず追加ファイル中心で実装する。

## 3. 現行Mamari実装から流用するもの

| 領域 | 現行実装 | note版での扱い |
|---|---|---|
| 原本保存 | URL階層のHTML＋`.meta.json` | 流用。`note/<host>/...`へ保存 |
| 整合性 | SHA-256、URL、bodyの照合 | 流用 |
| URLキュー | discovered / fetching / fetched / failed等 | Award方式を基準に拡張 |
| 再開 | claim、checkpoint、interrupted run回収 | 流用 |
| キャッシュ | ローカル原本があればネットワーク不要 | 流用 |
| リクエスト制御 | 5〜10秒、同時接続1、403/429停止 | 初期値として流用 |
| 404制御 | 連続5件で停止 | 流用。ページ種別ごとに集計 |
| 発見元追跡 | Q&Aの質問×タグ多対多 | 検索Hit×query/keyword多対多へ応用 |
| 解析分離 | HTTP収集とローカルHTML解析を分離 | 必須で流用 |
| 冪等解析 | parser_version＋HTML hash | 流用 |
| Parse error | 行単位エラーと解消記録 | 流用 |
| dry-run/status | HTTPなしの計画・進捗確認 | 流用 |

## 4. 既存実装にも加えるべき改善

### 4.1 ポリシー承認をコードで強制する

`robots.txt` を取得時に読むだけでは不十分である。既存の汎用 `sources` ポリシーと同等に、次を満たさない限りnote Collectorを起動不可にする。

```text
source_code = note_public
terms_status = allowed
robots_status = allowed
enabled = true
```

各レビューには、確認URL、確認日時、確認者、内容hash、許可path、禁止path、理由を記録する。規約またはrobotsのhashが変わった場合は自動的に再レビュー待ちへ戻す。

### 4.2 Redirectと取得サイズを制限する

現行Fetcherは最終redirect先のhostを保存するが、各hopでの許可host検証と最大response bytesがない。note版では次を必須にする。

- redirectの各hopを `https://note.com` および明示許可hostへ限定
- private IP、userinfo付きURL、非標準portを拒否
- HTML最大bytesを設定
- Content-Typeを保存前に検証
- 5xx・接続失敗だけ指数バックオフ
- 403/429は自動連打せずRunを停止し、`Retry-After` を記録

### 4.3 時点観測を上書きしない

価格、スキ数、フォロワー数、参加人数は変化する。商品テーブルの `current_*` だけを更新すると履歴と根拠を失うため、`note_metric_observations` と `note_price_observations` に観測値を追記し、最新値はViewで算出する。

### 4.4 Playwrightを内部API取得手段にしない

Playwrightは公開ページの表示確認にだけ使う。Network interceptionでnote内部APIのpayloadを読む、ログインする、購入済み状態を使う、HTML内に偶然含まれる非表示の有料本文を抽出する、といった処理は禁止する。

## 5. 指示書に対する重要な改善点

### 5.1 `sales_count` を単一整数にしない

「累計1000部突破」「100人以上」「411名が参加中」は意味が異なる。次を別列で保持する。

```text
metric_type: sales / purchasers / subscribers / participants / unknown
value: 1000
qualifier: exact / at_least / approximately / range / unknown
lower_bound: 1000
upper_bound: NULL
evidence_type: note_public_display / creator_claim / third_party_claim / unknown
extraction_confidence: high / medium / low
source_reliability: platform_display / self_reported / third_party / unknown
```

`sales_count >= 100` は保存値ではなく、`metric_type` と `lower_bound` と根拠種別から作るViewの条件にする。参加人数を販売部数へ読み替えない。

### 5.2 自己申告と抽出精度を同じconfidenceにしない

正規表現が正しく「1000部」と読めたことと、その主張が公式に検証されたことは別である。`extraction_confidence` と `source_reliability` を分ける。販売者自己申告は明確な数値でも `self_reported` であり、note公式表示と同じ扱いにしない。

### 5.3 `is_general_parent` を分解する

「保育士・2児の母」は親であるが、今回の分析対象である非専門家親ではない。次の直交する軸に分ける。

```text
is_parent_claimed
parent_role
professional_type
credentials_claimed[]
credentials_verified: true / false / unknown
is_noncredentialed_parent_seller  # 上記から導出
```

プロフィールの自己申告から資格の真正性を検証済みにしてはいけない。

### 5.4 `free_text` の保存・出力範囲を制限する

公開無料エリアも著作物である。原本HTMLはアクセス制限されたローカルアーカイブに置き、構造化DBとCSVには市場分析に必要な最小限のメタデータを保存する。LLMへ送る場合も、タイトル、プロフィール、公開説明、必要な短い根拠spanに限定する。無料本文全文をCSVへ出力しない。

### 5.5 「売れている」と「発見できた」を区別する

外部検索で販売数表記を探す方法は、販売実績を公開したコンテンツへ強く偏る。さらにnoteの現行規約には、売上等を公開して購入を煽る行為に関する制限がある。したがって、本ツールが測れるのは「公開ページ上で販売実績を確認できたサンプル」であり、note育児市場全体の販売順位ではない。

以下の名称は変更する。

- `一般親 × 100部以上 TOP50` → `一般親・公開販売根拠100以上の発見サンプル`
- `商品タイプ別成功率` → `発見サンプル内の商品タイプ別・公開販売根拠保有率`
- `ジャンル別の販売数` → `ジャンル別の公開販売根拠集計`

母集団が不明なまま成功率、市場シェア、売上ランキングを表示しない。

### 5.6 AIの出力を事実列へ直接上書きしない

LLM結果は `note_classification_runs` と `note_classifications` へ版管理して保存する。入力hash、model、provider、schema version、prompt version、実行日時、confidence、根拠span、人間レビュー状態を持たせる。HTMLから決定的に取得した列と同じテーブルへ混ぜない。

## 6. noteの現行ポリシーから決まる設計

2026-08-20に公式ページを確認した時点で、`https://note.com/robots.txt` は少なくとも `/search`、`/api/*`、`/preview/*`、`/*/archives*`、`/*/followers`、`/*/followings`、`/*/magazines` などを一般User-Agentに対して禁止し、公開sitemapを示している。

したがって、次を固定する。

- note内検索ページは取得しない
- note内部APIは利用しない
- creator配下の `/magazines` 一覧を取得しない
- followers/followings一覧を取得しない
- 外部検索APIの結果、手動Seed、許可されたsitemapだけを発見元にする
- article、magazine、creator root、membershipの各pathは、実装前のpath別レビューで明示許可されたものだけ取得する
- robotsが許可していても、利用規約レビューがallowedになるまでは収集しない

note利用規約にはスクレイピングという語の明示的一律禁止は確認できない一方、デジタルコンテンツの利用範囲、サービス障害、サーバーへの過度な負荷に関する条項がある。この設計書だけで法的許可を確定せず、人間の規約レビューを必須とする。

## 7. 推奨アーキテクチャ

```text
手動Seed CSV / 外部検索API / 許可済みsitemap
                    ↓
          discovery query・hit保存
                    ↓
     URL正規化・host/path policy・重複排除
                    ↓
       SQLite URL queueへ先に登録
                    ↓
      robots・terms承認ゲートを再確認
                    ↓
      低速HTTP取得 → 原本＋sidecar保存
                    ↓
          DOM構造検証・公開範囲判定
                    ↓
   必須項目不足時だけPlaywright fallback
                    ↓
       ローカル原本から決定的Parser
                    ↓
   価格/販売根拠/metric観測を正規化保存
                    ↓
     承認された最小payloadだけLLM分類
                    ↓
       人間レビュー・版固定・集計View
                    ↓
         メタデータCSV・品質レポート
```

収集、Parser、LLM分類、exportを別Runにする。`run` コマンドはこれらを順に呼ぶだけにし、途中状態を失わない。

## 8. 実装先とファイル構成

新しい独立リポジトリではなく、次をHermesプラグインへ追加する。

```text
plugins/childcare-data-aggregator/
├── childcare_core/
│   ├── note_models.py
│   ├── note_schema.py
│   ├── note_store.py
│   ├── note_discovery.py
│   ├── note_fetcher.py
│   ├── note_collector.py
│   ├── note_content_models.py
│   ├── note_content_importer.py
│   ├── note_sales.py
│   ├── note_classification_models.py
│   ├── note_classifier.py
│   └── note_export.py
├── config/
│   └── note_keywords.yaml
├── scripts/
│   └── note_research.py
└── tests/
    ├── fixtures/note/
    ├── test_note_urls.py
    ├── test_note_collection.py
    ├── test_note_content.py
    ├── test_note_sales.py
    ├── test_note_classification.py
    └── test_note_export.py
```

既存の `UrlArchive` は共有する。HTTPクライアントは指示書に合わせて `httpx` を利用するが、最初のnote実装でMamariの `requests` 実装を一括置換しない。共通interfaceを定義し、Mamariの回帰を守ったまま後続で統合する。

CLIは既存プロジェクトとの一貫性を優先し、当初は `argparse` subcommandとする。SQLAlchemyも導入せず、既存の `sqlite3`、加算DDL、明示transaction/savepoint方式を使う。PydanticはLLM Schema境界に限定して導入する。

## 9. SQLite設計

### 9.1 運用・収集テーブル

```text
note_discovery_runs
note_discovery_queries
note_discovery_hits
note_hit_keywords
note_collection_runs
note_pages
note_page_relations
note_parse_errors
```

`note_pages` は最低限、次を持つ。

```text
id
page_type
canonical_url UNIQUE
external_id
creator_urlname
fetch_status
parse_status
attempt_count
claimed_run_id
archive_key
archive_metadata_key
raw_html_sha256
http_status
fetch_method: httpx / playwright
public_boundary_status: valid / uncertain / invalid
first_discovered_at
last_discovered_at
last_fetched_at
last_error
```

### 9.2 構造化コンテンツテーブル

```text
note_creators
note_articles
note_magazines
note_memberships
note_membership_plans
note_sales_evidence
note_price_observations
note_metric_observations
note_content_components
```

`note_sales_evidence` には数値だけでなく、短い原文span、span hash、source URL、検出位置、検出pattern version、claim時点が不明かを保存する。

`note_price_observations` はページ取得時に見えた現在価格を時系列で保存する。本文中の値上げ履歴は別の `claim_type=price_history_claim` として保存し、閾値との対応が明確な場合だけ構造化する。

### 9.3 AIテーブル

```text
note_classification_runs
note_classifications
note_classification_evidence
note_classification_reviews
```

記事分類とCreator分類は別recordにする。新しい分類は過去版を上書きせず、最新のreviewed版をViewで選ぶ。

### 9.4 分析View

```text
note_products_current
note_creator_current_classification
note_public_sales_evidence_current
note_noncredentialed_parent_products
note_noncredentialed_parent_public_sales_100_plus
note_market_summary
note_genre_summary
note_price_summary
note_data_role_summary
note_collection_coverage
```

`note_collection_coverage` には、検索query数、発見URL数、重複率、robots/policy除外数、取得成功率、Parser成功率、有料判定可能率、価格取得率、販売根拠保有率、AIレビュー済み率を出す。

## 10. URL発見と分類

### 10.1 最初の成果物: 収集対象候補台帳

最初に作るのは、note本文の取得結果ではなく `note_collection_candidates.csv` と対応するSQLite台帳である。外部検索結果または手動Seedを保存し、URLを正規化・分類・重複排除したうえで、実際に取得するURLだけをqueueへ送る。

台帳には最低限、次を含める。

```text
candidate_id
canonical_url
predicted_page_type
discovery_lane
discovery_provider
discovery_query
discovery_keyword
search_rank
search_title
search_snippet
creator_urlname_if_known
policy_status
candidate_status
exclusion_reason
priority_score
first_discovered_at
last_discovered_at
```

この段階では検索結果のtitle/snippetを発見と優先順位付けにだけ使い、育児系、有料、販売実績ありを確定しない。確定値は許可後に公開noteページを取得・解析してから保存する。

### 10.2 検索queryの組み立て

検索候補が「販売数を公表している記事」だけに偏らないよう、発見を4レーンに分ける。初期100件の標準配分は設定ファイルで変更可能にする。

| lane | 標準枠 | query例 | 目的 |
|---|---:|---|---|
| `market_baseline` | 50件 | `site:note.com 育児` | 育児コンテンツ全体の候補母集団 |
| `paid_signal` | 25件 | `site:note.com 寝かしつけ 有料記事` | 有料商品の候補を厚くする |
| `sales_evidence` | 15件 | `site:note.com 育児 "100部"` | 公開販売根拠がある候補を探す |
| `data_format` | 10件 | `site:note.com 離乳食 テンプレート` | データ、実測、チェックリスト等を探す |

queryは次の設定群から決定的に生成する。

```text
parenting_keywords
paid_keywords
sales_keywords
data_format_keywords
content_type_hints
```

全キーワードの直積は作らない。`market_baseline` は全parenting keywordを1回ずつ、他レーンは優先parenting keywordと補助keywordの組合せをquery上限まで生成する。実行ごとにquery集合とconfig hashを保存し、同じ条件を再現できるようにする。

### 10.3 候補の正規化・除外・優先順位

外部検索Hitは、取得前に次の順で処理する。

1. 検索Hitを加工せず `note_discovery_hits` へ保存
2. URLを正規化し、同一canonical URLを統合
3. article / magazine / creator / membership / unknown を暫定分類
4. note外host、`/search`、`/api/*`、followers等の禁止pathを除外
5. 同じCreatorに候補が偏りすぎないよう、初期枠ではCreator当たりの上限を適用
6. lane別・page type別の枠を満たすよう、決定的score順にqueueへ送る

初期scoreは市場評価ではなく、取得順を決めるだけの値とする。

```text
parenting query由来     +40
paid_signal由来         +20
sales_evidence由来      +20
data_format由来         +10
未収集Creator           +10
禁止path・host          除外
既取得canonical URL     queue対象外
```

同じURLが複数レーンで見つかった場合はscoreを無制限に加算せず、該当レーンと全queryの関係を保存する。検索順位やsnippetは変動するため、scoreを「人気」「売上」「品質」として分析には使わない。

候補状態は次のようにする。

```text
discovered
normalized
blocked_policy
queued
excluded
fetched
```

`terms_status` または `robots_status` が未承認なら候補台帳までは作れるが、全件 `blocked_policy` のままにし、noteページへHTTPアクセスしない。

### 10.4 発見Provider

画面スクレイピングではなくinterface化したProviderを使う。

```text
SeedCsvDiscoveryProvider
ExternalSearchApiProvider
ApprovedSitemapProvider
```

MVPでは手動Seed CSVと外部検索APIの両方を候補台帳へ取り込めるようにする。最初のParser fixtureは手動Seedで固定し、100件の収集候補台帳は外部検索APIを主経路に作る。検索APIのprovider、query、rank、result URL、取得時刻を保存する。検索エンジンの画面自体はクロールせず、API keyやCookieはDB・ログへ保存しない。

### 10.5 URL正規化

- scheme/hostを固定
- fragment削除
- `utm_*`、`ref`、検索由来tracking parameterを削除
- canonical linkと入力URLの一致を検証
- trailing slashをpage typeごとの規則で統一
- Unicode/percent encodingを一意化
- 同一URLを複数queryから見つけた場合はhit関係だけ追加

URL pathだけで確定できない場合は `unknown` として保存し、HTMLのcanonical、JSON-LD、公開DOM構造で確定する。membershipのpath patternはサンプル確認前に推測で固定しない。

## 11. Parser方針

取得優先順位:

1. canonical、JSON-LD、Open Graph等の公開メタデータ
2. 公開DOM上の見出し、Creator、価格、スキ、公開説明
3. ページ種別固有の公開DOM
4. 必須項目が不足した場合だけPlaywright

禁止事項:

- `script` 内のpayloadを無条件に本文化しない
- 購入ボタン以降、購入者限定container、hidden nodeを本文へ含めない
- genericな `soup.get_text()` でページ全体を本文扱いしない
- DOM構造が不明な場合に「無料本文」と推測して保存しない

Parserは厳格に失敗させ、selector崩れを空文字や成功扱いにしない。`required_fields_missing` と `public_boundary_uncertain` を別エラーにする。

## 12. 販売根拠の抽出

正規表現は二段階にする。

1. 数量表現の候補を広く検出
2. 前後文脈、単位、動詞、否定、価格表現、目標表現を検証

「購入」「購読」だけでは販売根拠にしない。「目標100部」「100部売れたら」「100人に届けたい」などは除外する。1件のEvidenceにつき短い前後spanを保存し、LLMは販売数を発明・補完しない。

代表的な判定:

| 表記 | 保存 |
|---|---|
| 300部完売 | metric=sales, qualifier=exact, lower=300, creator_claim |
| 100人以上が購入 | metric=purchasers, qualifier=at_least, lower=100, creator_claim |
| 411名が参加中 | metric=participants, qualifier=exact, lower=411, note_public_display |
| 100部を目指します | reject |
| 100スキ | likes観測。sales evidenceにはしない |

## 13. LLM分類

収集・URL分類・価格抽出・販売数候補抽出にはLLMを使わない。決定的Parserが完了したrecordだけを分類対象にする。

LLM入力:

- title
- public description
- 公開見出し
- Creator profileの必要部分
- 決定的Parserが抽出した短いEvidence span
- 取得元IDと入力hash

LLM出力:

- `is_parenting`
- 親・専門家属性の分解フィールド
- main/sub genre
- target age/parent
- problem/desired outcome
- product type
- promise/hook/title pattern
- experience based / real data
- `data_role`
- content components
- 各判断のevidence references
- confidence / review_required

Provider adapterは `classify(batch, schema, model_config)` のinterfaceにする。外部LLMへ公開テキストを送る前に、provider、model、データ取扱い、送信項目について明示承認を要求する。既存Mamari AI処理と同様、`--allow-ai-data-transfer` のない実行は停止する。

## 14. CLI

```powershell
python plugins\childcare-data-aggregator\scripts\note_research.py policy-status
python plugins\childcare-data-aggregator\scripts\note_research.py discover --seed-csv <path> --dry-run
python plugins\childcare-data-aggregator\scripts\note_research.py discover --keyword "育児" --provider <provider> --dry-run
python plugins\childcare-data-aggregator\scripts\note_research.py crawl --limit 100 --dry-run
python plugins\childcare-data-aggregator\scripts\note_research.py parse --limit 100 --dry-run
python plugins\childcare-data-aggregator\scripts\note_research.py classify --limit 30 --dry-run
python plugins\childcare-data-aggregator\scripts\note_research.py export --output <dir>
python plugins\childcare-data-aggregator\scripts\note_research.py report
python plugins\childcare-data-aggregator\scripts\note_research.py status
python plugins\childcare-data-aggregator\scripts\note_research.py resume
python plugins\childcare-data-aggregator\scripts\note_research.py retry --failed-only
```

全コマンドは最初に実行計画、policy状態、対象件数、ネットワーク上限、書込DB、archive rootを表示する。`status` と `dry-run` はHTTPリクエストを送らない。

## 15. 実装フェーズ

### Phase 0: ポリシーと検証用サンプル

- note利用規約とrobotsを人間がレビュー
- path別allow/deny表を保存
- 4ページ種別、有料/無料、販売主張あり/なしのfixture候補を人間が選定
- 外部LLMへ送るpayload policyを決定

完了条件: `terms_status=allowed` と `robots_status=allowed` が記録されるまで、live crawlは0件。

### Phase 1: 基盤

- note schema、store、run、page queue
- URL正規化・分類
- Seed CSV・外部検索API discovery
- 4レーンで `note_collection_candidates.csv` を作成
- 重複、禁止path、Creator偏重を除外して取得queueを確定
- `UrlArchive`連携
- dry-run/status/resume/retry

完了条件: 100件以上の収集候補台帳をquery・lane・除外理由付きで作成できる。同じURLを複数keywordから投入しても `note_pages` は1件、hit関係はすべて残る。ポリシー未承認時は候補作成後に全件停止する。

### Phase 2: 静的HTML CollectorとArticle Parser

- `httpx`低速Fetcher
- robots/path policy
- 公開Articleのメタデータ、価格、スキ、Creator紐付け
- 公開/有料境界の厳格検証

完了条件: fixture上で有料本文の混入0件。構造不明ページは成功扱いにしない。

### Phase 3: Creator / Magazine / Membership

- page type別Parser
- Creatorと商品関係
- membership plans
- 規約・robotsで禁止された一覧pathを使わない発見経路

完了条件: 4種を同一URLキューで管理でき、unknownも安全に保留できる。

### Phase 4: 販売・価格Evidence

- Regex＋文脈validator
- price/metric observation
- evidence/source reliabilityモデル
- 100以上View

完了条件: 目標値、スキ数、価格を販売数へ誤分類しない。

### Phase 5: LLM分類

- Pydantic schema
- Provider adapter
- 入力hash、prompt/model/schema version
- 人間レビューqueue

完了条件: 同じ版・同じ入力を再送しない。低confidenceは自動採用しない。

### Phase 6: Exportと市場レポート

- 指示書のCSVを生成
- coverageとbiasの注記
- 根拠URL・取得日時・分類版を付与
- raw HTML、全文、秘密情報をexportしない

### Phase 7: Playwrightと1,000件拡張

- 静的取得不足ページだけfallback
- browser contextは非ログイン・Cookieなし
- fallback率と成功率を計測
- 100件の人間レビュー後に1,000件へ拡張

Playwright導入前に、静的HTMLで足りないfieldを実データで列挙する。最初から全ページへ使わない。

## 16. MVP合格条件

指示書の件数条件に加え、品質条件を設定する。

- 100件以上の重複しない育児関連候補URLを、発見query付きで保存
- robots/policy違反URLの取得0件
- 有料本文・購入者限定本文の保存0件
- URL分類fixtureの期待一致100%。未確定は `unknown` が正解
- paid判定precision 98%以上
- 価格抽出precision 95%以上
- 販売Evidence precision 95%以上
- canonical重複0件
- 中断・再開で二重取得0件
- Parser failureを成功件数へ含めない
- `一般親×公開販売根拠100以上` を根拠URL、短いspan、取得日時付きで抽出可能
- 全CSVにrun ID、取得日時、分類versionを付与
- coverage reportで、取得不能・販売数不明・AI未確認を明示

販売Evidenceのrecallや市場全体の網羅率は、真の母集団がないためMVP合格指標にしない。

## 17. 実装時の優先順位

1. ポリシー承認ゲート
2. URL inventory・原本アーカイブ・再開
3. 有料境界を守るArticle Parser
4. Evidence中心の販売数・価格モデル
5. Creator属性の分解
6. LLM分類と人間レビュー
7. CSV・集計
8. Playwright
9. 1,000件拡張

この順序なら、途中段階でも「何を取得したか」「なぜその数値になったか」「どこまで公開情報か」を追跡できる。LLMやPlaywrightを先に入れて取得境界と根拠が曖昧になることを避けられる。

## 18. 実装開始前に確定が必要な事項

- 人間によるnote利用規約レビューの判定と記録
- 許可するnote pathの確定
- 外部検索API providerと利用規約
- 外部LLM providerへ送信してよい公開項目
- raw archiveとSQLiteの正式保存先
- 「資格なし」の運用定義。未記載を資格なしとみなすか、unknownとするか

推奨は、資格記載がないCreatorを自動的に「資格なし」とせず `unknown` にすること。明示根拠がある場合だけ `is_noncredentialed_parent_seller=true` にする。

## 19. 公式確認先

- [note ご利用規約](https://note.com/terms)
- [note robots.txt](https://note.com/robots.txt)
- [note 収益化のヒント](https://note.com/help/pg/monetize)
- [note メンバーシップ運営ガイド](https://note.com/help/pg/membership)

これらは2026-08-20時点の確認先であり、実行時には再確認する。
