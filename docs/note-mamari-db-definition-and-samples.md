# note／Mamari 研究DB定義・サンプル

更新日: 2026-08-23（JST）

## 1. この文書の範囲

この文書は、育児コンテンツ調査で使用している2つのSQLite DBについて、実装上の正本と実DBを照合し、次を1ファイルにまとめたものです。

- note有料育児コンテンツ調査DBの構造、主要制約、現行件数
- Mamari Q&A・口コミ大賞・分析／企画DBの構造、主要制約、現行件数
- テーブル間の代表的なリレーション
- 実データと同じ型・関係を持つ架空サンプル
- 安全な参照クエリ例

Mamariの質問本文・回答本文にはユーザー投稿が含まれるため、この文書には実際の本文を転載していません。サンプル値はすべて架空です。件数とステータス集計だけ、実DBを2026-08-23に読み取り専用で確認した値です。

## 2. 正本と実DB

| 対象 | 実DB | DB定義の正本 |
|---|---|---|
| note | `D:/mycode/childcare-data-aggregator-data/note-research.sqlite3` | `C:/Users/ルース/Documents/Hermes/plugins/childcare-data-aggregator/childcare_core/note_schema.py` |
| Mamari | `D:/HermesData/childcare-data-aggregator/childcare.sqlite3` | `mamari_qa_schema.py`、`mamari_qa_content_schema.py`、`mamari_award_schema.py`、`mamari_research_schema.py`、`mamari_problem_schema.py` |

共通の実装ルートは `C:/Users/ルース/Documents/Hermes/plugins/childcare-data-aggregator/childcare_core/` です。DB内の `archive_key` はHTML本体ではなく、`D:/mycode/childcare-data-aggregator-data/` 配下のRaw Archiveを参照します。

この文書は `sqlite_master` と `PRAGMA table_info` で実DBを確認したスナップショットです。今後のマイグレーション後は、上記Python定義を優先してください。

## 3. 全体像

```text
note
  discovery run/query/hit
        ↓
  candidate ─ candidate_hit
        ↓
  page ─ collection_run
        ↓
  creator + article/magazine/membership
        ↓
  price/metric/purchase/sales evidence

Mamari
  Q&A tag/page/question
        ↓
  question_content ─ answer ─ answer_reply
        ↓
  analysis/insight ─ content_candidate ─ evidence/review
        ↓
  problem pipeline (view → mention → cluster/group → brief/checklist)

  口コミ大賞 edition/page
        ↓
  department ─ placement ─ catalog_product ─ external_link
```

設計上の重要な境界は次のとおりです。

- `*_pages` は取得・アーカイブ・解析状態を管理する台帳です。
- `*_contents`、`articles`、`answers` などは解析後の構造化データです。
- 価格・指標・販売根拠は時点観測テーブルへ分離し、上書きで履歴を失わないようにしています。
- AI／ルール分析の結果は原文テーブルへ上書きせず、run・proposal・event・reviewとして版管理します。
- Mamari Q&Aは内部の需要シグナル／検証用です。公開記事への原文転載、言い換え、体験談化には使いません。

## 4. note DB

### 4.1 現行スナップショット

実DBには18テーブル、2ビューがあります。

| テーブル | 行数 |
|---|---:|
| `note_source_policy` | 1 |
| `note_discovery_runs` | 3 |
| `note_discovery_queries` | 68 |
| `note_discovery_hits` | 687 |
| `note_candidates` | 646 |
| `note_candidate_hits` | 687 |
| `note_collection_runs` | 6 |
| `note_pages` | 646 |
| `note_creators` | 84 |
| `note_articles` | 100 |
| `note_magazines` | 0 |
| `note_memberships` | 0 |
| `note_membership_plans` | 0 |
| `note_sales_evidence` | 1 |
| `note_price_observations` | 120 |
| `note_metric_observations` | 200 |
| `note_purchase_observations` | 100 |
| `note_parse_errors` | 0 |

状態内訳:

- 候補646件: `fetched` 100件、`excluded` 546件
- ページ646件: `fetched/parsed` 100件、`discovered/pending` 546件
- 記事100件: 全件 `is_paid=1`
- 収集run 6件: `completed` 5件、`paused` 1件
- ポリシー: `terms_status=allowed`、`robots_status=allowed`、`enabled=1`
- 許可パスは `/` を起点とし、`/api`、`/search`、`/login`、`/followers` などを拒否パスとして保持

### 4.2 テーブル定義

記号: `PK`=主キー、`FK`=外部キー、`UQ`=一意、`NN`=NOT NULL。SQLiteの真偽値は `INTEGER` の0/1です。日時はISO 8601形式の `TEXT` です。

#### ポリシー・発見

| テーブル | 列 | 主な制約・役割 |
|---|---|---|
| `note_source_policy` | `id INTEGER PK`, `source_code TEXT`, `host TEXT`, `terms_url TEXT`, `robots_url TEXT`, `terms_status TEXT`, `robots_status TEXT`, `enabled INTEGER`, `reviewed_by TEXT`, `reviewed_at TEXT`, `terms_sha256 TEXT`, `robots_sha256 TEXT`, `allowed_paths_json TEXT`, `denied_paths_json TEXT`, `review_note TEXT`, `updated_at TEXT` | 常に `id=1`。規約・robotsの人手確認ゲート。両方allowedでなければ収集を有効化しない。 |
| `note_discovery_runs` | `id INTEGER PK`, `provider TEXT`, `config_json TEXT`, `status TEXT`, `hit_count INTEGER`, `candidate_count INTEGER`, `started_at TEXT`, `finished_at TEXT`, `error_message TEXT` | 発見処理1回の監査単位。statusはrunning/completed/partial/failed/cancelled。 |
| `note_discovery_queries` | `id INTEGER PK`, `run_id INTEGER FK`, `lane TEXT`, `query_text TEXT`, `config_hash TEXT`, `created_at TEXT` | `run_id → note_discovery_runs.id`。`(run_id, query_text)` UQ。 |
| `note_discovery_hits` | `id INTEGER PK`, `run_id INTEGER FK`, `query_id INTEGER FK`, `result_url TEXT`, `result_title TEXT`, `result_snippet TEXT`, `result_rank INTEGER`, `provider TEXT`, `discovered_at TEXT` | 検索結果を加工せず保存。run削除時CASCADE、query削除時SET NULL。 |
| `note_candidates` | `id INTEGER PK`, `canonical_url TEXT`, `page_type TEXT`, `creator_urlname TEXT`, `discovery_lane TEXT`, `priority_score INTEGER`, `policy_status TEXT`, `candidate_status TEXT`, `exclusion_reason TEXT`, `first_discovered_at TEXT`, `last_discovered_at TEXT`, `updated_at TEXT` | `canonical_url` UQ。page_typeはarticle/magazine/creator/membership/unknown。候補の正規化・除外・queue状態を保持。 |
| `note_candidate_hits` | `candidate_id INTEGER FK`, `hit_id INTEGER FK`, `lane TEXT`, `keyword TEXT` | `(candidate_id, hit_id)` PK。1候補が複数queryで発見された履歴を失わない。 |

#### 収集・構造化コンテンツ

| テーブル | 列 | 主な制約・役割 |
|---|---|---|
| `note_collection_runs` | `id INTEGER PK`, `mode TEXT`, `config_json TEXT`, `status TEXT`, `requested_count INTEGER`, `fetched_count INTEGER`, `parsed_count INTEGER`, `failed_count INTEGER`, `network_request_count INTEGER`, `started_at TEXT`, `finished_at TEXT`, `error_message TEXT` | modeはcrawl/retry/parse。件数は0以上。 |
| `note_pages` | `id INTEGER PK`, `candidate_id INTEGER FK`, `canonical_url TEXT`, `page_type TEXT`, `fetch_status TEXT`, `parse_status TEXT`, `attempt_count INTEGER`, `claimed_run_id INTEGER FK`, `archive_key TEXT`, `archive_metadata_key TEXT`, `raw_html_sha256 TEXT`, `http_status INTEGER`, `content_type TEXT`, `final_url TEXT`, `fetch_method TEXT`, `public_boundary_status TEXT`, `first_discovered_at TEXT`, `last_fetched_at TEXT`, `last_error TEXT`, `updated_at TEXT` | `candidate_id` と `canonical_url` は各UQ。Raw Archiveへの参照と取得／解析状態を管理。 |
| `note_creators` | `id INTEGER PK`, `urlname TEXT`, `canonical_url TEXT`, `display_name TEXT`, `profile_text TEXT`, `parent_role TEXT`, `occupation TEXT`, `credentials_claimed_json TEXT`, `followers_count INTEGER`, `following_count INTEGER`, `first_seen_at TEXT`, `last_checked_at TEXT`, `source_page_id INTEGER FK` | `urlname` と `canonical_url` は各UQ。自己申告資格はJSONで分離。 |
| `note_articles` | `id INTEGER PK`, `page_id INTEGER FK`, `creator_id INTEGER FK`, `canonical_url TEXT`, `title TEXT`, `description TEXT`, `published_at TEXT`, `updated_at_source TEXT`, `is_paid INTEGER`, `current_price INTEGER`, `likes_count INTEGER`, `comments_count INTEGER`, `public_text TEXT`, `headings_text TEXT`, `parser_version TEXT`, `source_html_sha256 TEXT`, `created_at TEXT`, `updated_at TEXT` | `page_id` と `canonical_url` は各UQ。公開境界内で取得できた本文・メタデータ。 |
| `note_magazines` | `id INTEGER PK`, `page_id INTEGER FK`, `creator_id INTEGER FK`, `canonical_url TEXT`, `title TEXT`, `description TEXT`, `is_paid INTEGER`, `current_price INTEGER`, `article_count INTEGER`, `public_text TEXT`, `parser_version TEXT`, `source_html_sha256 TEXT`, `created_at TEXT`, `updated_at TEXT` | マガジンの構造化データ。 |
| `note_memberships` | `id INTEGER PK`, `page_id INTEGER FK`, `creator_id INTEGER FK`, `canonical_url TEXT`, `title TEXT`, `description TEXT`, `participant_count INTEGER`, `public_text TEXT`, `parser_version TEXT`, `source_html_sha256 TEXT`, `created_at TEXT`, `updated_at TEXT` | メンバーシップの構造化データ。 |
| `note_membership_plans` | `id INTEGER PK`, `membership_id INTEGER FK`, `plan_name TEXT`, `monthly_price INTEGER`, `description TEXT` | `(membership_id, plan_name)` UQ。 |

#### 観測・根拠・エラー

| テーブル | 列 | 主な制約・役割 |
|---|---|---|
| `note_sales_evidence` | `id INTEGER PK`, `page_id INTEGER FK`, `content_type TEXT`, `metric_type TEXT`, `value INTEGER`, `lower_bound INTEGER`, `upper_bound INTEGER`, `qualifier TEXT`, `evidence_type TEXT`, `evidence_text TEXT`, `evidence_hash TEXT`, `source_url TEXT`, `detected_at TEXT`, `extractor_version TEXT` | 数値と根拠spanをセットで保存。自己申告とnote公開表示を `evidence_type` で区別。 |
| `note_price_observations` | `id INTEGER PK`, `page_id INTEGER FK`, `price INTEGER`, `currency TEXT`, `observation_type TEXT`, `evidence_text TEXT`, `observed_at TEXT` | 価格の時系列。`(page_id, price, observation_type, observed_at)` UQ。 |
| `note_metric_observations` | `id INTEGER PK`, `page_id INTEGER FK`, `metric_type TEXT`, `metric_value INTEGER`, `evidence_text TEXT`, `observed_at TEXT` | likes/comments/followers/following/participantsの時系列。 |
| `note_purchase_observations` | `id INTEGER PK`, `page_id INTEGER FK`, `paywall_detected INTEGER`, `paywall_char_count INTEGER`, `price INTEGER`, `purchase_cta TEXT`, `payment_offer TEXT`, `high_rating_count INTEGER`, `high_rating_names TEXT`, `evidence_text TEXT`, `source_html_sha256 TEXT`, `observed_at TEXT`, `extractor_version TEXT` | `page_id` UQ。購入UIで公開表示された情報の観測。 |
| `note_parse_errors` | `id INTEGER PK`, `page_id INTEGER FK`, `canonical_url TEXT`, `parser_version TEXT`, `error_type TEXT`, `error_message TEXT`, `created_at TEXT`, `resolved_at TEXT` | 再解析可能なエラー台帳。page削除時はSET NULL。 |

### 4.3 ビュー

| ビュー | 内容 |
|---|---|
| `note_article_analysis_100` | fetched/parsedのarticleについて、記事ID・タイトル・スキ・価格・購入後高評価数・作者followers・URLを結合。名前の`100`は件数固定を意味せず、現行DDLには `LIMIT 100` はありません。 |
| `note_noncredentialed_parent_public_sales_100_plus` | 有料記事、`parent_role='general_parent'`、sales/purchasersの公開根拠が100以上、という条件を満たす記事。 |

### 4.4 架空サンプル

以下は実DBからコピーしたレコードではありません。

```json
{
  "note_candidates": {
    "id": 9001,
    "canonical_url": "https://note.com/sample_parent/n/n000000000000",
    "page_type": "article",
    "creator_urlname": "sample_parent",
    "discovery_lane": "paid_signal",
    "priority_score": 80,
    "policy_status": "allowed",
    "candidate_status": "fetched"
  },
  "note_pages": {
    "id": 9101,
    "candidate_id": 9001,
    "fetch_status": "fetched",
    "parse_status": "parsed",
    "http_status": 200,
    "fetch_method": "httpx",
    "public_boundary_status": "valid",
    "raw_html_sha256": "<64-hex>"
  },
  "note_creators": {
    "id": 9201,
    "urlname": "sample_parent",
    "display_name": "サンプル保護者",
    "parent_role": "general_parent",
    "credentials_claimed_json": "[]",
    "followers_count": 120
  },
  "note_articles": {
    "id": 9301,
    "page_id": 9101,
    "creator_id": 9201,
    "title": "【架空サンプル】朝の支度を見直した記録",
    "is_paid": 1,
    "current_price": 500,
    "likes_count": 24,
    "comments_count": 2,
    "parser_version": "note-public-v1",
    "source_html_sha256": "<64-hex>"
  },
  "note_price_observations": {
    "page_id": 9101,
    "price": 500,
    "currency": "JPY",
    "observation_type": "page_display",
    "observed_at": "2026-08-23T00:00:00+00:00"
  }
}
```

リレーションは `candidate 9001 → page 9101 → article 9301`、`creator 9201 → article 9301`、`page 9101 → price/metric/purchase/sales evidence` です。

## 5. Mamari DB

### 5.1 物理構成

実DBには `mamari_%` の物理テーブルが112、ビューが14あります。112テーブルには、FTS5が自動作成するshadow table 10個が含まれます。主要なデータ量は次のとおりです。

| レイヤー | テーブル | 行数 |
|---|---|---:|
| Q&A収集 | `mamari_qa_tags` | 116 |
| Q&A収集 | `mamari_qa_tag_pages` | 2,873 |
| Q&A収集 | `mamari_qa_questions` | 64,867 |
| Q&A収集 | `mamari_qa_question_tags` | 73,097 |
| Q&A本文 | `mamari_qa_question_contents` | 62,697 |
| Q&A本文 | `mamari_qa_answers` | 179,361 |
| Q&A本文 | `mamari_qa_answer_replies` | 162,424 |
| 口コミ大賞 | `mamari_award_editions` | 8 |
| 口コミ大賞 | `mamari_award_pages` | 1,631 |
| 口コミ大賞 | `mamari_award_catalog_products` | 1,121 |
| 口コミ大賞 | `mamari_award_departments` | 284 |
| 口コミ大賞 | `mamari_award_placements` | 1,121 |
| 口コミ大賞 | `mamari_award_external_links` | 2,027 |
| 旧分析／企画 | `mamari_analysis_runs` | 3 |
| 旧分析／企画 | `mamari_question_insights` | 125,486 |
| 旧分析／企画 | `mamari_content_candidates` | 44 |
| 旧分析／企画 | `mamari_candidate_evidence` | 265 |
| problem pipeline | `mamari_problem_runs` | 2 |
| problem pipeline | `mamari_problem_question_views` | 20,682 |
| problem pipeline | `mamari_problem_mentions` | 578 |
| problem pipeline | `mamari_problem_clusters` | 0 |
| problem pipeline | `mamari_problem_content_briefs` | 0 |
| problem pipeline | `mamari_problem_checklist_items` | 0 |

状態内訳:

- Q&A質問64,867件: `fetched/valid` 62,697件、`discovered/pending` 2,138件、`failed/invalid` 32件
- Q&Aタグ116件: `collected` 72件、`collecting` 2件、`not_started` 42件
- 口コミ大賞edition 8件: 全件 `collected`
- 口コミ大賞page 1,631件: `fetched/valid` 1,417件、`not_found/invalid` 214件
- 企画候補44件: 全件 `draft`。riskは `high` 25件、`normal` 19件
- problem schema migration: 1.0.0から2.5.0まで適用済み

### 5.2 Q&A収集・本文テーブル

| テーブル | 列 | 主な制約・役割 |
|---|---|---|
| `mamari_qa_collection_runs` | `id INTEGER PK`, `mode TEXT`, `requested_tag_db_ids_json TEXT`, `config_json TEXT`, `status TEXT`, `summary_json TEXT`, `network_request_count INTEGER`, `started_at TEXT`, `finished_at TEXT`, `error_message TEXT` | Q&A収集1回の監査単位。 |
| `mamari_qa_tags` | `id INTEGER PK`, `tag_id INTEGER`, `tag_name TEXT`, `canonical_url TEXT`, `parent_tag_id INTEGER FK`, `selected INTEGER`, `collection_status TEXT`, `question_count INTEGER`, `last_page INTEGER`, `created_at TEXT`, `updated_at TEXT`, `collection_target_count INTEGER`, `collection_fetched_count INTEGER`, `collection_progress INTEGER` | `tag_id` とURLは各UQ。親タグは同テーブルの `tag_id` を参照。progressは0〜100かつ10刻み。 |
| `mamari_qa_tag_pages` | `id INTEGER PK`, `tag_id INTEGER FK`, `page_number INTEGER`, `canonical_url TEXT`, `reported_question_count INTEGER`, `displayed_last_page INTEGER`, `card_count INTEGER`, `answered_card_count INTEGER`, `archive_key TEXT`, `archive_metadata_key TEXT`, `raw_html_sha256 TEXT`, `http_status INTEGER`, `fetched_at TEXT`, `first_recorded_at TEXT`, `updated_at TEXT` | `(tag_id, page_number)` UQ。タグ一覧ページの取得記録。 |
| `mamari_qa_questions` | `id INTEGER PK`, `question_id INTEGER`, `canonical_url TEXT`, `observed_answer_count INTEGER`, `max_observed_answer_count INTEGER`, `fetched_answer_count INTEGER`, `fetch_status TEXT`, `structure_status TEXT`, `archive_key TEXT`, `archive_metadata_key TEXT`, `raw_html_sha256 TEXT`, `last_http_status INTEGER`, `first_discovered_at TEXT`, `last_discovered_at TEXT`, `last_fetched_at TEXT`, `last_error TEXT`, `created_at TEXT`, `updated_at TEXT` | `question_id` とURLは各UQ。取得台帳であり本文は持たない。 |
| `mamari_qa_question_tags` | `id INTEGER PK`, `question_row_id INTEGER FK`, `tag_id INTEGER FK`, `observed_answer_count INTEGER`, `source_page INTEGER`, `first_seen_at TEXT`, `last_seen_at TEXT`, `first_seen_run_id INTEGER FK`, `last_seen_run_id INTEGER FK` | `(question_row_id, tag_id)` UQ。質問と複数タグの関係。 |
| `mamari_qa_question_contents` | `question_row_id INTEGER PK/FK`, `question_id INTEGER`, `canonical_url TEXT`, `category TEXT`, `title TEXT`, `body TEXT`, `source_updated_at TEXT`, `source_updated_display TEXT`, `page_tags_json TEXT`, `answer_count INTEGER`, `reply_count INTEGER`, `question_image_count INTEGER`, `source_html_sha256 TEXT`, `source_fetched_at TEXT`, `parser_version TEXT`, `pii_redacted INTEGER`, `imported_at TEXT`, `updated_at TEXT` | 質問本文の構造化正本。`pii_redacted` を必須で保持。 |
| `mamari_qa_answers` | `id INTEGER PK`, `question_row_id INTEGER FK`, `source_answer_id INTEGER`, `upvote_count INTEGER`, `position INTEGER`, `body TEXT`, `source_created_at TEXT`, `source_created_display TEXT`, `reply_count INTEGER`, `image_count INTEGER`, `created_at TEXT`, `updated_at TEXT`, `is_good_answer INTEGER` | `(question_row_id, source_answer_id)` と `(question_row_id, position)` は各UQ。 |
| `mamari_qa_answer_replies` | `id INTEGER PK`, `answer_row_id INTEGER FK`, `position INTEGER`, `body TEXT`, `source_created_at TEXT`, `source_created_display TEXT`, `image_count INTEGER`, `created_at TEXT`, `updated_at TEXT` | `(answer_row_id, position)` UQ。 |
| `mamari_qa_page_tag_catalog` | ページ内タグの正規化カタログ | 質問本文の `page_tags_json` をRDBで参照するためのマスター。 |
| `mamari_qa_page_tag_groups` | ページ内タグのグループ | ライフステージ等のタグ群を表現。 |
| `mamari_qa_page_tag_group_members` | groupとcatalog tagの中間 | 多対多の所属。 |
| `mamari_qa_question_page_tags` | `question_row_id`, `page_tag_id`, `tag_position`, hash・current・観測日時 | 質問とページ内タグの履歴付き中間テーブル。 |

### 5.3 口コミ大賞テーブル

| テーブル | 列 | 主な制約・役割 |
|---|---|---|
| `mamari_award_editions` | `edition TEXT PK`, `start_url TEXT`, `collection_status TEXT`, `discovery_complete INTEGER`, `last_run_id INTEGER`, `created_at TEXT`, `updated_at TEXT` | 年度・版単位の収集状態。 |
| `mamari_award_collection_runs` | `id INTEGER PK`, `edition TEXT FK`, `mode TEXT`, `resumed_from_run_id INTEGER FK`, `config_json TEXT`, `status TEXT`, `summary_json TEXT`, `network_request_count INTEGER`, `current_url TEXT`, `last_checkpoint_at TEXT`, `heartbeat_at TEXT`, `stop_reason TEXT`, `error_message TEXT`, `started_at TEXT`, `finished_at TEXT` | 再開可能な収集run。 |
| `mamari_award_pages` | `id INTEGER PK`, `edition TEXT FK`, `page_type TEXT`, `canonical_url TEXT`, `external_id TEXT`, `title TEXT`, `fetch_status TEXT`, `structure_status TEXT`, `attempt_count INTEGER`, `claimed_run_id INTEGER FK`, archive/hash/http/timestamp/error列 | `(edition, canonical_url)` UQ。page_typeはtop/department/product。 |
| `mamari_award_catalog_products` | `id INTEGER PK`, `edition TEXT`, `product_external_id TEXT`, `product_name TEXT`, `manufacturer TEXT`, `canonical_url TEXT`, `source_page_id INTEGER FK`, archive/hash/parser/status/timestamp列 | `(edition, product_external_id)` UQ。商品カタログの正本。 |
| `mamari_award_departments` | `id INTEGER PK`, `edition TEXT`, `department_key TEXT`, `department_name TEXT`, `source_page_id INTEGER FK`, archive/hash/parser/status/timestamp列 | `(edition, department_key)` UQ。 |
| `mamari_award_placements` | `id INTEGER PK`, `department_id INTEGER FK`, `product_id INTEGER FK`, `display_order INTEGER`, `award_type TEXT`, `product_name_snapshot TEXT`, `manufacturer_snapshot TEXT`, `source_page_id INTEGER FK`, `parser_version TEXT`, timestamp列 | `(department_id, product_id)` UQ。順位・掲載関係を商品本体から分離。 |
| `mamari_award_external_links` | `id INTEGER PK`, `product_id INTEGER FK`, `placement_id INTEGER FK`, `source_page_id INTEGER FK`, `marketplace TEXT`, `raw_href TEXT`, `destination_url TEXT`, `link_kind TEXT`, `created_at TEXT` | 外部／affiliate／shortenedのリンクを保持。記事の推薦根拠には直接使わない。 |
| `mamari_award_page_links` | edition、from/to page、初回／最終run・日時 | 収集時のページ遷移グラフ。 |

`mamari_award_products` は旧形式の単純なaward商品表です。新規参照は `mamari_award_catalog_products`、`departments`、`placements`、`external_links` を使用します。

### 5.4 旧分析・企画テーブル

このレイヤーは現行DBに残っていますが、`mamari_question_insights.content_candidate_type` を最終判定として扱いません。新しい生成前処理は5.5のproblem pipelineを優先します。

| グループ | テーブル | 役割 |
|---|---|---|
| 分析run | `mamari_analysis_runs`, `mamari_analysis_errors` | rule/host_ai/manual分析の版、scope、model、prompt、状態、エラー。 |
| 回答分析 | `mamari_answer_analysis`, `mamari_answer_topics`, `mamari_answer_items` | 回答ごとの要約、problem/action/result、topic、item mention。 |
| 質問分析 | `mamari_question_insights`, `mamari_question_age_state`, `mamari_question_age_evidence` | topic、pain point、intent、年齢根拠、risk、confidence。 |
| マスター | `mamari_topics`, `mamari_items`, `mamari_item_aliases`, `mamari_insight_entities` | topic／item／alias／entityの正規化。 |
| 企画候補 | `mamari_content_candidates`, `mamari_candidate_queries`, `mamari_candidate_evidence`, `mamari_candidate_risk_events` | 企画候補、検索query、出典行、risk変更履歴。 |
| 人手確認 | `mamari_fact_check_events`, `mamari_review_events` | fact checkとaccept/reject等のappend-only event。 |
| 6成果物案 | `mamari_six_pack_plans` | theme、audience、lane、signal数、必要根拠、asset plan、AI brief。 |
| 取込・エラー | `mamari_research_import_runs`, `mamari_research_parse_errors` | Research DBへのimport監査とparse error。 |

主要列:

- `mamari_analysis_runs`: `id PK`, `analysis_type`, `schema_version`, `model_name`, `prompt_hash`, `input_scope_json`, `status`, `summary_json`, `started_at`, `finished_at`, `error_message`, `scope_type`, `is_active`
- `mamari_question_insights`: `id PK`, `analysis_run_id FK`, `question_row_id FK`, `question_id`, `topic`, `subtopic`, `pain_point`, `intent`, `age_stage`, `pregnancy_stage`, `product_category`, `question_type`, `content_candidate_type`, `risk_level`, `confidence`, `method`, `created_at`
- `mamari_content_candidates`: `id PK`, `candidate_type`, `title`, `rationale`, `risk_level`, `status`, `human_review_required`, `query_json`, `candidate_key`, `candidate_revision`, timestamp列
- `mamari_candidate_evidence`: `id PK`, `candidate_id FK`, `source_type`, `source_row_id`, `relation`, `support_weight`, `candidate_query_id FK`
- `mamari_review_events`: `id PK`, `candidate_id FK`, `action`, `reason`, `reviewer`, `candidate_revision`, `review_channel`, `created_at`
- `mamari_six_pack_plans`: `candidate_id PK/FK`, `schema_version`, `source_query`, `theme`, `audience`, `life_stage`, `focus_pain_point`, `editorial_lane`, signal数、risk数、confidence、必要根拠flag、`product_needs_json`, `asset_plan_json`, `ai_brief`, timestamp列

### 5.5 problem pipeline（schema 2.5.0）

`mamari_problem_schema_migrations` には1.0.0、1.1.0、1.2.0、2.0.0、2.1.0、2.2.0、2.3.0、2.4.0、2.5.0が連続して記録されています。物理テーブルは処理段階ごとに次のように分かれます。

| 段階 | テーブル |
|---|---|
| schema・run・監査 | `mamari_problem_schema_migrations`, `mamari_problem_calibrations`, `mamari_problem_runs`, `mamari_problem_run_events`, `mamari_problem_stage_batches`, `mamari_problem_policy_approvals`, `mamari_problem_backup_manifests`, `mamari_problem_run_backups` |
| 入力snapshot・品質 | `mamari_problem_question_views`, `mamari_problem_quality_flags`, `mamari_problem_mentions`, `mamari_problem_content_kind_events`, `mamari_problem_candidate_signals` |
| 類似度・pair | `mamari_problem_embeddings`, `mamari_problem_ann_buckets`, `mamari_problem_candidate_pair_staging`, `mamari_problem_pair_evaluations`, `mamari_problem_pair_reviews` |
| cluster | `mamari_problem_clusters`, `mamari_problem_cluster_members`, `mamari_problem_cluster_audits`, `mamari_problem_cluster_reviews`, `mamari_problem_briefs` |
| disposition | `mamari_problem_question_dispositions`, `mamari_problem_question_disposition_events`, `mamari_problem_disposition_mentions` |
| 人手ラベル | `mamari_problem_question_human_labels`, `mamari_problem_answer_human_reviews`, `mamari_problem_question_human_label_events` |
| AI提案と自動判断 | `mamari_problem_ai_review_proposals`, `mamari_problem_ai_review_proposal_events`, `mamari_problem_ai_auto_decisions`, `mamari_problem_ai_auto_decision_events`, `mamari_problem_pilot_selections` |
| 年齢・entity・根拠 | `mamari_problem_age_targets`, `mamari_problem_age_target_evidence`, `mamari_problem_entities`, `mamari_problem_entity_aliases`, `mamari_problem_entity_sources`, `mamari_problem_mention_entities`, `mamari_problem_evidence_records` |
| group集計・優先度 | `mamari_problem_group_statistics`, `mamari_problem_group_answer_signals`, `mamari_problem_priority_scores` |
| 生成前brief | `mamari_problem_content_briefs`, `mamari_problem_content_brief_kind_events`, `mamari_problem_content_brief_reviews`, `mamari_problem_brief_age_targets`, `mamari_problem_brief_entities`, `mamari_problem_brief_evidence`, `mamari_problem_checklist_items` |

2.4.0以降の重要な契約:

- `mamari_problem_ai_review_proposals` はAIの提案を保存し、人間の承認とは分離する。
- proposalはinput/promptのSHA-256、provider、model、attempt、JSON、statusを持つ。
- 人間はproposal内容を直接編集せず、approve／retry／excludeをeventとして残す。
- 2.5.0の `mamari_problem_ai_auto_decisions` はmachine-onlyのuse/hold/exclude判断であり、人間承認を意味しない。
- 同テーブルはdecision、priority、policy_version、reason/signals JSON、answer評価件数、decided_atを持ち、再計算履歴をeventへ追記する。

### 5.6 Q&A distillationとFTS

| 種類 | テーブル／ビュー | 役割 |
|---|---|---|
| distillation | `mamari_qa_distillation_runs`, `mamari_qa_distillation_questions`, `mamari_qa_distillations`, `mamari_qa_distillation_claims`, `mamari_qa_distillation_checklist_items`, `mamari_qa_distillation_risks`, `mamari_qa_distillation_errors` | Q&Aから内部検証用のclaim／checklist候補／riskを抽出し、run単位で保持。 |
| Q&A FTS | `mamari_qa_fts` | Q&A検索用FTS5 virtual table。shadow tableは `mamari_qa_fts_config`, `mamari_qa_fts_content`, `mamari_qa_fts_data`, `mamari_qa_fts_docsize`, `mamari_qa_fts_idx`。直接更新しない。 |
| insight FTS | `mamari_insight_fts` | insight検索用FTS5 virtual table。shadow tableは `mamari_insight_fts_config`, `mamari_insight_fts_content`, `mamari_insight_fts_data`, `mamari_insight_fts_docsize`, `mamari_insight_fts_idx`。直接更新しない。 |

### 5.7 ビュー一覧

| ビュー | 用途 |
|---|---|
| `mamari_answer_analysis_pilot_candidates` | 回答分析pilot候補 |
| `mamari_answer_analysis_review` | 回答分析レビュー |
| `mamari_qa_distillation_review` | distillationレビュー |
| `mamari_six_pack_candidates` | 6成果物候補 |
| `mamari_six_pack_opportunities` | 企画機会の集計 |
| `mamari_six_pack_product_shortlist` | 商品候補shortlist |
| `mamari_problem_age_content_summary` | 年齢×content集計 |
| `mamari_problem_approved_briefs` | 承認済みbrief |
| `mamari_problem_checklist_readiness` | checklist生成準備状態 |
| `mamari_problem_disposition_progress` | disposition進捗 |
| `mamari_problem_entity_search` | entity検索 |
| `mamari_problem_generation_readiness` | 生成前ゲート状態 |
| `mamari_problem_group_summary` | group単位集計 |
| `mamari_problem_unassigned_mentions` | group未割当mention |

### 5.8 架空サンプル

#### Q&Aの親子関係

```json
{
  "mamari_qa_questions": {
    "id": 70001,
    "question_id": 90000001,
    "canonical_url": "https://qa.mamari.jp/question/90000001",
    "observed_answer_count": 2,
    "fetched_answer_count": 2,
    "fetch_status": "fetched",
    "structure_status": "valid"
  },
  "mamari_qa_question_contents": {
    "question_row_id": 70001,
    "question_id": 90000001,
    "category": "お出かけ",
    "title": "【架空】短時間の外出準備について",
    "body": "【架空本文】個人情報を含まない検証用テキストです。",
    "answer_count": 2,
    "reply_count": 1,
    "question_image_count": 0,
    "pii_redacted": 1,
    "parser_version": "mamari-qa-content-v1"
  },
  "mamari_qa_answers": [
    {
      "id": 80001,
      "question_row_id": 70001,
      "source_answer_id": 91000001,
      "position": 1,
      "body": "【架空回答】検証用の回答です。",
      "reply_count": 1,
      "is_good_answer": 1
    },
    {
      "id": 80002,
      "question_row_id": 70001,
      "source_answer_id": 91000002,
      "position": 2,
      "body": "【架空回答】別の検証用回答です。",
      "reply_count": 0,
      "is_good_answer": 0
    }
  ],
  "mamari_qa_answer_replies": {
    "answer_row_id": 80001,
    "position": 1,
    "body": "【架空返信】補足の検証用テキストです。",
    "image_count": 0
  }
}
```

#### 口コミ大賞の親子関係

```json
{
  "mamari_award_editions": {
    "edition": "2099",
    "start_url": "https://award.mamari.jp/sample/2099",
    "collection_status": "collected",
    "discovery_complete": 1
  },
  "mamari_award_departments": {
    "id": 501,
    "edition": "2099",
    "department_key": "sample-outing",
    "department_name": "【架空】お出かけ部門",
    "parse_status": "valid"
  },
  "mamari_award_catalog_products": {
    "id": 601,
    "edition": "2099",
    "product_external_id": "sample-001",
    "product_name": "【架空】サンプルバッグ",
    "manufacturer": "サンプル株式会社",
    "canonical_url": "https://award.mamari.jp/sample/product/sample-001",
    "parse_status": "valid"
  },
  "mamari_award_placements": {
    "department_id": 501,
    "product_id": 601,
    "display_order": 1,
    "award_type": "sample"
  }
}
```

#### 企画候補と根拠の関係

```json
{
  "mamari_content_candidates": {
    "id": 301,
    "candidate_type": "checklist",
    "title": "【架空】短時間外出の準備チェック",
    "rationale": "複数の質問で準備の迷いが観測されたという内部シグナル",
    "risk_level": "normal",
    "status": "draft",
    "human_review_required": 1,
    "candidate_key": "sample-short-outing",
    "candidate_revision": 1
  },
  "mamari_candidate_evidence": [
    {
      "candidate_id": 301,
      "source_type": "qa_question",
      "source_row_id": 70001,
      "relation": "related",
      "support_weight": 1.0
    },
    {
      "candidate_id": 301,
      "source_type": "award_product",
      "source_row_id": 601,
      "relation": "related",
      "support_weight": 0.5
    }
  ]
}
```

この例の `qa_question` は問題の存在を示す内部シグナル、`award_product` は候補棚です。どちらも単独では公開記事の具体的助言、効果、推奨順位、運営者本人の評価を証明しません。

## 6. 参照クエリ例

すべて読み取り専用の例です。本文列を不用意に出力しないよう、最初はID・状態・件数だけ確認します。

### 6.1 note: 取得・解析状態

```sql
SELECT fetch_status, parse_status, COUNT(*) AS page_count
FROM note_pages
GROUP BY fetch_status, parse_status
ORDER BY fetch_status, parse_status;
```

### 6.2 note: 記事と最新価格観測

```sql
SELECT
  a.id,
  a.title,
  a.is_paid,
  p.price,
  p.currency,
  p.observed_at
FROM note_articles AS a
LEFT JOIN note_price_observations AS p
  ON p.id = (
    SELECT p2.id
    FROM note_price_observations AS p2
    WHERE p2.page_id = a.page_id
    ORDER BY p2.observed_at DESC, p2.id DESC
    LIMIT 1
  )
ORDER BY a.id
LIMIT 20;
```

### 6.3 Mamari: Q&Aの収集状態

```sql
SELECT fetch_status, structure_status, COUNT(*) AS question_count
FROM mamari_qa_questions
GROUP BY fetch_status, structure_status
ORDER BY fetch_status, structure_status;
```

### 6.4 Mamari: 本文を出さずに回答数を確認

```sql
SELECT
  q.id AS question_row_id,
  q.question_id,
  q.fetch_status,
  COUNT(a.id) AS stored_answer_count
FROM mamari_qa_questions AS q
LEFT JOIN mamari_qa_answers AS a
  ON a.question_row_id = q.id
GROUP BY q.id, q.question_id, q.fetch_status
ORDER BY q.id
LIMIT 20;
```

### 6.5 Mamari: 企画候補と根拠件数

```sql
SELECT
  c.id,
  c.candidate_type,
  c.title,
  c.risk_level,
  c.status,
  COUNT(e.id) AS evidence_count
FROM mamari_content_candidates AS c
LEFT JOIN mamari_candidate_evidence AS e
  ON e.candidate_id = c.id
GROUP BY c.id
ORDER BY c.id;
```

### 6.6 Mamari: problem schema version

```sql
SELECT version, ddl_sha256, applied_at, applied_by
FROM mamari_problem_schema_migrations
ORDER BY rowid;
```

## 7. 運用上の注意

- 実DBを開くときは `PRAGMA foreign_keys = ON` を有効にします。
- 収集中のDBにはWALがあるため、`.sqlite3` 本体だけをコピーせずSQLite backup APIを使います。
- `*_fts_config/content/data/docsize/idx` はFTS5 shadow tableです。直接INSERT／UPDATE／DELETEしません。
- `archive_key`、hash、parser versionを保持し、解析結果から取得元へ追跡できる状態を維持します。
- noteの価格・likes・followers・販売表示は変化するため、観測テーブルへ追記します。
- AI結果は事実列へ上書きせず、run／proposal／event／reviewへ保存します。
- Mamari本文を外部AIへ送る処理は、明示的なデータ転送許可がある場合だけ実行します。
- Mamariの実本文をログ、サンプル、公開記事、SNS原稿へコピーしません。
- 旧 `mamari_award_products` と旧 `mamari_question_insights.content_candidate_type` は新規処理の正本にしません。

## 8. 更新チェックリスト

DB定義を変更したら、この文書も次の順で更新します。

1. Python schema定義とmigration versionを確認する。
2. 実DBの `sqlite_master`、`PRAGMA table_info`、`PRAGMA foreign_key_list` を確認する。
3. テーブル／ビュー数、主要行数、状態内訳を読み取り専用で再集計する。
4. サンプルが架空値のままで、実投稿本文や個人情報を含まないことを確認する。
5. 廃止テーブル、現行正本、FTS shadow tableを明示する。
