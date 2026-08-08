# 回帰テストfixture

- `content/003-regression-checklist.md` と `content/regression-test.json` は、Markdownと原本JSONの1対1対応を検証するためのテスト専用データです。本番の `src/content` には投入しません。
- `auth/anonymous.storageState.json` は未ログインの空状態です。
- `auth/authenticated.storageState.json` は外部サービスに依存しない認証UI境界の再現用storageStateです。SupabaseのRLSや実API権限を検証するときは、実ログイン後に `npm run test:auth:setup` で保存したstateを `E2E_AUTH_STATE` で指定してください。
