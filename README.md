# youtube-cli

フォルダ内の動画を YouTube に一括アップロードし、設定した曜日・時刻スロットで予約投稿する CLI です。

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
youtube categories list
youtube categories list --region JP --hl ja
```

`config.yaml` の `template.categoryId` に使う ID は次で確認できます（要 `auth login`）。

```bash
youtube categories list --region JP --hl ja
```

`config.example.yaml` を動画フォルダ内の `config.yaml` にコピーして編集してください。

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

アップロード先は OAuth 時に選んだチャンネルに固定されます。ブランドアカウントを選ぶには:

1. [Google アカウントのアクセス権](https://myaccount.google.com/permissions) でこのアプリの連携を一度削除
2. `youtube auth login` を再実行
3. Google アカウントを選んだあと、表示される **ブランドアカウント / チャンネル選択** で目的のチャンネルを選ぶ

認証後のチャンネル確認:

```bash
youtube auth channels
youtube auth status
```

**注意:** オーナーではなく「管理者」だけのチャンネルで、かつブランドアカウント化されていない場合は OAuth で選べません。YouTube 側の制限です。
