# コメント・いいね保存仕様

## 保存先と本人判定

| 操作           | 未ログイン                                    | Googleログイン中                                     |
| -------------- | --------------------------------------------- | ---------------------------------------------------- |
| コメント投稿   | `comments.user_id = null`、`status = pending` | `comments.user_id = auth.uid()`、`status = approved` |
| コメント削除   | 画面・RPCとも不可                             | `comments.user_id = auth.uid()`の行だけ削除可        |
| いいね履歴     | `like_records.anonymous_token_hash`           | `like_records.user_id = auth.uid()`                  |
| いいね済み判定 | IndexedDBの`article_likes`                    | Supabaseの`like_records`                             |

コメントといいねは、ブラウザーからテーブルを直接更新しない。`SECURITY DEFINER` RPCの`search_path`を空にし、参照テーブルをスキーマ修飾する。関数の既定`PUBLIC`実行権限を剥奪し、必要な`anon`または`authenticated`ロールだけに付与する。

## コメントRPC

- `submit_comment(text, text)`：`anon`、`authenticated`
- `get_approved_comments(text, integer, integer)`：`anon`、`authenticated`
- `delete_my_comment(uuid)`：`authenticated`

公開コメント取得RPCは`user_id`や保存済みの投稿者名を返さず、表示名を常に`匿名さん`へ固定する。現在の`auth.uid()`との比較結果だけを`is_mine`として返す。ページングのため、コメント配列と`total_count`をJSONで返す。

## いいねRPC

- `add_anonymous_like(text, text)`：`anon`
- `remove_anonymous_like(text, text)`：`anon`
- `set_authenticated_like(text, boolean)`：`authenticated`
- `get_authenticated_like_state(text)`：`authenticated`
- `get_authenticated_like_slugs(text[])`：`authenticated`
- `claim_anonymous_like(text, text)`：`authenticated`

匿名トークンはブラウザーでWeb Crypto APIから32バイト生成する。SupabaseへはRPC引数としてHTTPS送信するが、DBにはSHA-256ハッシュだけを保存する。記事ごとに別トークンを使用する。

`like_records`のINSERT・DELETEトリガーが、既存の`likes.like_count`を増減する。既存の合計数は移行時に変更せず、新方式の操作分だけ加減する。旧`increment_likes`、`decrement_likes`は残すが、`PUBLIC`、`anon`、`authenticated`からの実行権限を剥奪する。

## IndexedDB

- DB名：`likethis-private`
- 旧バージョン：1
- 新バージョン：2
- 追加ストア：`article_likes`（キー：`slug`）

既存の`runs`、`settings`、`backupQueue`は保持する。`article_likes`はチェックリスト削除処理とGoogle Driveバックアップの対象外とする。

旧`localStorage`の`liked:*`はトークンを持たず、本人による取り下げを安全に証明できない。そのため新実装では参照・移行しない。旧いいね数は`likes.like_count`に残り、新しくいいねした時点からIndexedDBまたは`auth.uid()`で本人状態を管理する。

## 適用順序

フロントエンドは新RPCを前提にするため、`20260716000000_auth_comments_likes.sql`をSupabaseへ適用してから新しい静的サイトを公開する。

匿名RPCは公開anon keyから利用できるため、新しいトークンを大量生成する攻撃そのものはDBだけでは完全に防げない。必要になった場合はCAPTCHA、Edge Function、短時間レート制限を追加する。
