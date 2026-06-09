# youtube-cli

フォルダ内の動画を YouTube に一括アップロードし、設定した曜日または毎日の時刻スロットで予約投稿する CLI です。

## インストール

```bash
bun install -g github:hrdtbs/youtube-cli
```

`~/.bun/bin`（Windows: `%USERPROFILE%\.bun\bin`）が PATH に入っていることを確認してください。

## 更新

```bash
bun update -g youtube-cli --force
```

## 使い方

```bash
youtube upload --dir ./videos --dry-run
youtube upload --dir ./videos
youtube upload --dir ./videos --recursive
youtube auth status
youtube videos list
youtube videos list --limit 50
youtube categories list
youtube categories list --region JP --hl ja
```

`config.yaml` の `template.categoryId` に使う ID は次で確認できます（要 `auth login`）。

```bash
youtube categories list --region JP --hl ja
```

`config.example.yaml` を動画フォルダ内の `config.yaml` にコピーして編集してください。

予約投稿は `schedule.slots` で指定します。毎日同じ時刻にする場合は `daily: true`、特定曜日だけにする場合は `weekday`（0=日曜、6=土曜）を使います。

```yaml
schedule:
  timezone: Asia/Tokyo
  startDate: 2026-06-10
  slots:
    - daily: true
      time: "18:00"
    - weekday: 3
      time: "12:00"
```

再生リストへ自動追加する場合は `upload.playlistId` を指定します（プレイリスト ID または `?list=` 付き URL）。

```yaml
upload:
  playlistId: "PLxxxxxxxxxxxxxxxx"
```

## 認証

1. [Google Cloud Console](https://console.cloud.google.com/) で YouTube Data API v3 を有効化
2. OAuth クライアント ID（デスクトップアプリ）を作成し、JSON を `client_secret.json` として保存
3. 初回のみブラウザでログイン:

```bash
youtube auth login --client-secret ./client_secret.json
```

### ブランドアカウント（管理チャンネル）

アップロード先は OAuth 時に選んだチャンネルに固定されます。

#### オーナー（所有者）の場合

1. [Google アカウントのアクセス権](https://myaccount.google.com/permissions) でこのアプリの連携を一度削除
2. `youtube auth login` を再実行
3. まず **個人の Google アカウント** を選択
4. 次の **「アカウントまたはブランドアカウントを選択」** 画面で目的のブランドアカウントを選ぶ

#### 管理者の場合（重要）

**ブランドアカウントの管理者権限があっても、OAuth の選択画面に出てこないことがあります。** これは CLI の不具合ではなく、YouTube / Google OAuth の既知の制限です。

- 管理者は OAuth でブランドアカウントを選べない報告が複数ある
- YouTube Studio から付与された管理権限は、ブランドアカウントの権限管理から付与された場合と挙動が異なることがある
- この場合の現実的な対処:
  - **チャンネルオーナー** に `youtube auth login` を実行してもらい、発行された `token.json` を管理者 PC にコピーする
  - またはオーナー側でアップロードを実行する

認証後のチャンネル確認:

```bash
youtube auth channels
youtube auth status
```

**ブランドアカウントが表示されない場合（オーナーでも出ないとき）:**

- Google Cloud の OAuth 同意画面で、利用する Google アカウントを **テストユーザー** に追加する（公開前の「テスト」モードの場合）
- または同意画面を **本番環境** に移行する
- [OAuth Playground](https://developers.google.com/oauthplayground) で同じスコープ（`youtube.force-ssl`）を使い、ブランドアカウントが選べるか切り分ける
