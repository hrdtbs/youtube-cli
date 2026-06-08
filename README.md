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

再生リスト機能を使う場合、以前 `auth login` 済みなら権限追加のため再ログインが必要です。

```bash
youtube auth login --client-secret ./client_secret.json
```

トークンは次に保存されます。

- Windows: `%APPDATA%/youtube-cli/token.json`
- macOS / Linux: `~/.config/youtube-cli/token.json`
