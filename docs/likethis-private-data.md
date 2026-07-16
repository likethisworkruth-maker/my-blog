# LikeThis privateデータ実装メモ

## 保存経路

```text
チェック・追加項目・非表示・並び順・privateメモ
                    │
                    ▼
        IndexedDB: likethis-private
        ├─ runs（データの正本）
        ├─ settings（端末ID・Drive状態）
        └─ backupQueue（Drive未反映run）
                    │
                    └─ Googleログイン中
                                      ▼
                 Google Drive appDataFolder
                 likethis-private-backup-v1.json

公開コメント・公開いいね ──► Supabase
Googleログイン + Drive同意 ──► Supabase Auth OAuth
                                 └─ provider_tokenで本人のappDataFolderへ接続
```

private文字列をSupabase、Analytics、URL、DOM属性、consoleへ送らない。Service Workerは静的ビルド成果物だけをCacheStorageへ保存し、IndexedDBやDriveアクセストークンには触れない。

## 旧データ移行

- 移行元: `localStorage["likethis:checklist-runs:v1"]`
- IndexedDBの初期化時に、スキーマ検証できたrunだけを一方向に移行する。
- IndexedDBへのtransaction完了後にMigration済み設定を保存する。
- 旧キーは1リリース分の読み取りfallbackとして残す。
- 利用者が「この端末のチェックリストデータを削除」を実行した場合だけ、IndexedDBのrun・queueと旧キーを削除する。

旧Supabaseテーブル（`checklist_runs`、`checklist_run_items`、`checklist_item_feedback`）は今回削除しない。クライアントからのprivateデータ書き込み・読み戻しコードだけを停止した。テーブル削除やRLS変更は、移行実績を確認した別Migrationで行う。

## Google Cloud Consoleで必要な設定

1. 対象プロジェクトでGoogle Drive APIを有効にする。
2. OAuth同意画面にアプリ情報・プライバシーポリシーURLを設定する。
3. 許可スコープへ`https://www.googleapis.com/auth/drive.appdata`だけを追加する。
4. SupabaseのGoogle Providerに設定済みのOAuthウェブクライアントを使用する。
5. Google Cloud側の承認済みリダイレクトURIに、Supabase Dashboardが示すcallback URLを設定する。
6. SupabaseのSite URLとRedirect URLへ本番URLとローカル確認URLを設定する。

参考:

- [Google Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Google Drive APIのスコープ](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 環境変数

Drive専用の環境変数は使用しない。既存の`PUBLIC_SUPABASE_URL`と`PUBLIC_SUPABASE_ANON_KEY`を使用し、Google OAuthクライアントはSupabase Dashboard側で管理する。

Googleログイン時に`drive.appdata`を追加スコープとして要求し、同じOAuth結果で返るSupabase Sessionの`provider_token`をDrive APIへ使用する。アプリ独自のlocalStorageやIndexedDBへprovider tokenを複製保存しない。

Googleのprovider tokenはSupabaseが自動更新しない。今回はprovider refresh tokenを要求・保存せず、期限切れ時はGoogleへの再ログインを案内する。認可後はDrive APIの`about.get`でDrive側メールを照合し、不一致・メール取得不可の場合はバックアップを開始しない。

## 手動確認

- 未ログインでも開始、編集、再読み込み復元ができる。
- 公開URLでは「説明・みんなのコメント」だけが表示される。
- `?mode=my#progress`では「説明・進捗・メモ」だけが表示される。
- privateメモの固有文字列がSupabase・Analyticsのrequest payloadへ含まれない。
- オフライン中に進捗とメモを更新でき、オンライン復帰後も端末データが残る。
- Googleログイン画面でログインと`drive.appdata`の同意が一度に行われる。
- ログイン直後の初回アップロード、復元、競合3択、provider token期限切れ後の再ログインを確認する。
- Drive障害時にも「端末に保存済み」とDriveエラーを混同しない。
- 端末データ削除後に旧localStorageからデータが復活しない。

## ロールバック

- Drive障害時はDriveバックアップUIを一時的に無効化しても、IndexedDB保存を残す。
- IndexedDBのrunは削除しない。
- 旧Supabaseテーブルと旧localStorageキーは移行確認が終わるまで削除しない。
