# GitHub ActionsのAWS OIDC（アクセスキーなし）設定手順

コード側の設定（`.github/workflows/deploy.yml`）は完了し、アクセスキーの代わりに**OIDC**を使ってAWSと通信するように変更しました！

次に、AWS側で「このGitHubリポジトリ（`likethisworkruth-maker/my-blog`）からのアクセスを許可する」設定を行う必要があります。以下の手順に沿ってAWSコンソールで設定を行ってください。

---

## ステップ 1：IDプロバイダ（OIDC）の作成
AWSがGitHub Actionsを信頼できるように登録します。

1. [AWS IAMコンソール](https://console.aws.amazon.com/iamv2/home) を開く
2. 左メニューの **「ID プロバイダ (Identity providers)」** をクリックし、「プロバイダを追加」をクリック
3. 以下を入力して作成：
   - プロバイダのタイプ: **OpenID Connect**
   - プロバイダのURL: `https://token.actions.githubusercontent.com` （※「サムプリントを取得」ボタンを押す）
   - 対象者 (Audience): `sts.amazonaws.com`

---

## ステップ 2：デプロイ専用の「IAMロール」を作成
GitHub Actionsが一時的に被るための「権限の帽子（ロール）」を作ります。

1. IAMコンソールの左メニューから **「ロール (Roles)」** を開き、「ロールを作成」をクリック
2. 信頼されたエンティティの選択：
   - エンティティタイプ: **Web アイデンティティ (Web identity)**
   - アイデンティティプロバイダー: 手順1で作った `token.actions.githubusercontent.com` を選択
   - Audience: `sts.amazonaws.com` を選択
   - 「次へ」をクリック
3. **許可ポリシーを追加**:
   - `AmazonS3FullAccess` と `CloudFrontFullAccess` を付与します（※後で最小権限に絞るのがベストですが、まずはテスト用にこれらを選択します）。
4. ロール名を入力して作成（例: `GitHubActionsDeployRole`）

---

## ステップ 3：信頼関係（Trust Policy）の絞り込み（超重要！）
「どのリポジトリからでもアクセスできる」状態を防ぐため、**あなたのリポジトリのmainブランチからのみ**許可するように設定します。

1. 作成したロール（`GitHubActionsDeployRole`）の画面を開く
2. **「信頼関係 (Trust relationships)」** タブの「信頼ポリシーを編集」をクリック
3. 以下の内容に書き換えます（`StringEquals` と `StringLike` の部分を追加します）：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::【あなたのAWSアカウントID】:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:likethisworkruth-maker/my-blog:*"
        }
      }
    }
  ]
}
```
※これにより、`likethisworkruth-maker/my-blog` リポジトリからの命令しか受け付けなくなります。

---

## ステップ 4：GitHubに情報を登録

1. AWSで作成したロールの画面上部に表示されている **ARN（Amazon Resource Name）** をコピーします。（例: `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`）
2. GitHubのリポジトリ画面を開き、**Settings > Secrets and variables > Actions** を開く
3. 「New repository secret」から以下の3つを登録します：

- `AWS_ROLE_ARN` （コピーしたロールのARN）
- `S3_BUCKET_NAME` （アップロード先のバケット名、例: `likethis.work`）
- `CLOUDFRONT_DISTRIBUTION_ID` （CloudFrontのID、例: `E1A2B3C4D5E6F`）

※ `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` は**もう不要**ですので、もし以前に登録していれば削除してOKです！

---
以上でOIDCの設定は完了です！
この状態でGitHubにPush（またはGitHubのActionsタブから手動再実行）すると、アクセスキーを使わずに安全にS3へデプロイが行われます。

---

## ステップ 5：サブディレクトリ対策（CloudFront Functionsの設定）
Astroのような静的サイトジェネレーター（SSG）では、`/logs/` にアクセスした際、実際にはS3の `logs/index.html` を読み込む必要があります。しかし、CloudFront + S3 (OAC) の構成では自動で `index.html` が補完されないため、403/404エラーとなり、結果的にトップページへフォールバックしてしまいます。
これを防ぐため、CloudFront側でURLを自動補完する関数を設定します。

1. [CloudFront Functionsコンソール](https://console.aws.amazon.com/cloudfront/v3/home?#/functions) を開く
2. 「関数を作成」をクリック
3. 関数名に `AppendIndexHtml` と入力し、作成をクリック
4. 「関数コード」タブのエディタに以下のコードを貼り付け、変更を保存します：

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // 末尾が / で終わる場合は index.html を付与
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } 
    // 拡張子が含まれていない場合は /index.html を付与
    else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }
    
    return request;
}
```

5. 「発行 (Publish)」タブを開き、「関数を発行」ボタンをクリックします。
6. 発行後、同じ画面下部の「関連付けを追加 (Add association)」をクリックします。
7. 以下のように設定して関連付けます：
   - ディストリビューション: ご自身のCloudFrontディストリビューションを選択
   - イベントタイプ: **Viewer Request**
   - キャッシュビヘイビア: `Default (*)`
8. 「関連付けを追加」をクリックし、CloudFrontのデプロイが完了（数分かかります）すれば設定完了です！
これにより、`/logs/` や `/tools/` がそれぞれの正しいHTMLを返すようになります。
