# backlog2slack

Nulab Backlog の通知を Google Cloud Functions 経由で Slack に通知するスクリプト

## セットアップ

### Google Cloud Functions にコードをデプロイした上で、以下の環境変数を設定しておいてください

* BACKLOG_URL
  * backlog のドメイン。 ex.) `https://example.backlog.jp/`
* SLACK_WEBHOOK_URL
  * slack の incoming webhook URL。

### backlog の webhook に Fucntions の URL を登録してください

`プロジェクト設定` > `インテグレーション` > `Webhook` から以下の項目を登録してください

* WebHook URL
  * Functions の URL を設定してください 
* 通知するイベント
  * `課題の追加`, `課題の更新`, `課題にコメント`, `課題の削除`, `課題をまとめて更新` を有効にしてください 
