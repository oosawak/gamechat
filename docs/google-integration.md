# Google 連携セットアップ

Google Forms の参加申請を Google Groups のメンバー登録へ変換する管理用フローです。チャット本文、音声、WebRTC のシグナリングは Google 側へ送信しません。

## 前提

- Google Workspace ドメインの管理者アカウント
- Google Form と回答先 Google Spreadsheet
- `community@example.com` などの Google Groups
- Apps Script プロジェクトを作成できる Google Drive

Google Groups のメンバー変更には Admin SDK Directory API を使います。Apps Script の Advanced Google Service と Google Cloud 側の Admin SDK API を有効にし、管理者アカウントで認可してください。

## Form の質問名

Apps Script は回答シートの質問名をキーとして読み取ります。次の名前を変更する場合は `apps-script/Code.gs` の `CONFIG` も変更してください。

- `Googleアカウントのメールアドレス`
- `表示名`
- `参加したいカテゴリー`
- `利用規約への同意`

カテゴリーは `game-dev`、`rust`、`wasm`、`3dcg` のいずれかを選びます。回答者は必ず `community` に登録され、選択カテゴリーのグループにも登録されます。

## Apps Script の設定

1. Form の回答先 Spreadsheet を開く。
2. 拡張機能から Apps Script を開く。
3. `apps-script/Code.gs` の内容を貼り付ける。
4. `CONFIG.groups` の `example.com` を自分の Google Workspace ドメインへ変更する。
5. 必要なら `allowedEmailDomain` を設定する。
6. Apps Script の「サービス」から Admin Directory API を追加する。
7. Google Cloud プロジェクトで Admin SDK API を有効にする。
8. `installTrigger` を一度実行し、権限を承認する。
9. テスト回答を送信し、回答シートの `GameChat処理結果` 列を確認する。

フォーム送信トリガーは installable trigger を使います。トリガー作成者の権限で実行されるため、Google Groups を管理できる管理者アカウントで `installTrigger` を実行してください。

## セキュリティ

- Apps Script は管理者アカウントの権限で Google Groups を変更するため、編集権限を必要最小限にする。
- `Code.gs` にサービスアカウント鍵や OAuth refresh token を保存しない。
- Form の回答スプレッドシートを公開しない。
- クライアントから Google Groups API を直接呼び出さない。
- Group 所属を参加資格としてシグナリングサーバーで検証する処理は次段階で実装する。
