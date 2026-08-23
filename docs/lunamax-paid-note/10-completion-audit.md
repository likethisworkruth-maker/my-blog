# LunaMAX 有料note制作 完了監査

監査日: 2026-08-23（JST）  
状態: `local_article_package_complete / 700yen_preview_added / unpublished / not_for_sale`

## 1. 完了判定

- **A：根拠付きの未公開有料note記事一式を生成する** — 完了
- **B：noteへ公開し、購入可能にする** — 未実施・未承認

Aには、ジャンル選定、対象、価格仮説、本文、無料／有料境界、付録4点、画像2点、レイアウト、5W1H・収益・安全レビュー、公式note分析のローカルDB保存、700円価値評価用HTMLを含む。

Bは今回の目標に含めない。note投稿、販売設定、デプロイ、外部への共有は行っていない。

## 2. 要求と成果物の対応

| 要求 | 実装・根拠 | 状態 |
|---|---|---|
| 進捗を記録しながら進める | [00-progress.md](./00-progress.md) | 完了 |
| チームの役割分離と過不足検討 | 市場、内部DB、Mamari、文章、画像／レイアウト、独立レビューを分離。医療監修・実利用テスター不在は公開前ゲートへ明記 | 完了 |
| Mamariを利用データにする | 0〜4か月8,755件の匿名集計を課題探索に利用。原文を転載・言い換えせず、購入意向には変換しない | 完了 |
| 有料noteを参考データにする | 内部100件の価格・テーマを参考にし、販売数欠損と非無作為性を明記 | 完了 |
| note公式約30万件分析を保存する | 構造化JSONと専用DB表へ保存し、`favorite=1`、`importance=5`、`verified_primary`を登録 | 完了 |
| ジャンル・対象・価格に根拠を付ける | [01-decision-ledger.md](./01-decision-ledger.md) と [08-price-and-audience-reassessment.md](./08-price-and-audience-reassessment.md) | 完了 |
| 有料記事を生成する | [02-paid-note-draft.md](./02-paid-note-draft.md) | 完了 |
| 実用品を同梱する | `kit/`のCSV 2点・Markdown 2点 | 完了 |
| 画像・レイアウトを作る | [03-layout-and-cover-brief.md](./03-layout-and-cover-brief.md)、[04-cover-image-record.md](./04-cover-image-record.md)、`assets/`のPNG 2点 | 完了 |
| 5W1H・収益・金額・検証日程を独立評価する | [09-final-independent-review.md](./09-final-independent-review.md) — 97/100、Aの重大指摘なし | 完了 |
| 700円で価値を判断できる最終プレビュー | [11-paid-note-preview.html](./11-paid-note-preview.html) | 完了 |
| 公開しない | 全成果物を`preview_only / unpublished`として保持 | 完了 |

## 3. 現行の商品判断

### ジャンル

睡眠改善ノウハウではなく、**生後1〜3か月ごろの夜間育児における「記録・引き継ぎ」の実用キット**とする。睡眠、夜泣き、授乳間隔、夫婦関係の改善は約束しない。

### 主対象

2人以上の養育者間で、夜間または翌朝に何らかの対応を引き継ぐ家庭。両方が育休中である必要はなく、片方が就労中の就寝前・早朝・休日の引き継ぎも含む。

2025年出生671,236人と生後1〜3か月の時点167,809人相当は人口学的TAM上限で、世帯数・note利用者・購入者数ではない。SAMは仮定による感度分析だけ、SOMは適格PVと実測CVRがないため算出不能とする。

### 価格

- チームの検証開始案: **500円**
- 次の独立コホート780円: 1,000適格PV、20購入以上、CVR 2%以上、返金5%以下、利用回答10件以上、開封90%以上、満足80%以上、5家庭使用性、安全・権利問題0件をすべて満たした場合だけ
- 300円: 500円で1,000適格PV後に購入5件未満、非購入理由10件以上の30%以上が価格を主因とした場合だけ
- **700円: ユーザーの主観的価値評価用シナリオ**。現行価格や実売価格へ変更していない

翌朝3分×7日＝21分は利用負荷の設計であり、価格算定の根拠にはしない。

### 第2商品「副業ケーススタディ」

保留する。第1商品を2コホート以上測定し、PV、CVR、価格、返金、手数料後収益、流入、制作・運用工数、失敗を開示できるまで生成・販売しない。

## 4. 700円価値評価HTML

[11-paid-note-preview.html](./11-paid-note-preview.html)は、次を一つのローカル画面にまとめた。

- 700円を仮定した評価用商品カード
- 現行500円判断との明示的な分離
- 無料部分の全文
- 有料境界と、決済を伴わない購入後全文の表示切替
- 付録4点へのローカルリンク
- 5項目の価値チェックと「買う／迷う／買わない」の主観判定UI
- `noindex,nofollow,noarchive`、外部スクリプトなし、入力の保存・送信なし

付録リンクは評価者が中身を確認できるよう常時アクセス可能で、このHTMLはアクセス制御された実paywallではない。公開販売面へ流用しない。

生成元は[generate_preview.py](./generate_preview.py)で、正本[02-paid-note-draft.md](./02-paid-note-draft.md)から再生成できる。管理ブラウザは`file://`直接表示を安全ポリシーで拒否したため、回避やサーバー起動をせず、HTML構造・リンク・原稿信号・UI要素を機械監査した。

## 5. 検証結果

### 成果物監査

```text
python -B docs/lunamax-paid-note/verify_lunamax.py
status: pass
69 / 69 checks passed
```

確認範囲は、価格ゲート、対象条件、安全情報の無料配置、有料境界、付録の名前・実サイズ・CSV行列、UTF-8、画像寸法・参照、HTMLの無料／有料／評価UI、公式分析DBとJSONのハッシュ・フラグである。

### 公式分析DB実装テスト

```text
python -B -m unittest tests.test_note_research tests.test_note_reference_sources -v
13 / 13 tests passed
```

- SQLite `integrity_check=ok`
- `foreign_key_check=0`
- 既存`note_articles=100`を維持
- 公式参考資料1件を追加

### 独立レビュー

[09-final-independent-review.md](./09-final-independent-review.md)は97/100、Aの重大指摘なし、B未承認。軽微指摘だったカバー内小アイコンについては、画像を変更せず、[04-cover-image-record.md](./04-cover-image-record.md)の「乳児を一切描いていない」という断定を実画像に合わせて修正した。

## 6. Article Managerの状態

GPT Article ManagerへNote出力だけを有効にした管理記事を作成し、原文は保持されている。記事IDは`e3cb30405c284a95a144c34b5008da9c`。

ただし`API_SERVER_KEY`未設定のため自動構造化は失敗した。外部API設定は勝手に変更していない。この失敗はローカル記事、付録、画像、HTMLを欠損させず、公開を意味しない。

## 7. 公開前に残る別工程

次はAの生成完了を妨げないが、将来Bへ進むなら必要である。

1. ユーザーから公開作業への明示承認を得る。
2. 5家庭程度で入力負荷、誤解、共有、安全、ファイル開封を確認する。
3. note下書きで価格、有料線、付録、返金、更新、問い合わせを設定する。
4. ログアウト表示、iPhone／Android相当、CSV／Markdown、画像の縮小表示を確認する。
5. 公的安全情報とnote手数料・返金・ファイル販売仕様を公開直前に再確認する。

これらを実施せず、現成果物は非公開・購入不可のまま保持する。
