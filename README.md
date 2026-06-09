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

## コマンド一覧

コマンドは操作対象（ドメイン）ごとにグループ化されています。

```
youtube
├── auth        # 認証
├── videos      # チャンネル上の動画
├── playlists   # 再生リスト
├── categories  # 設定用参照データ
└── upload      # 一括アップロード
```

### 認証 (`auth`)

```bash
youtube auth login --client-secret ./client_secret.json
youtube auth status
youtube auth channels
```

### 動画 (`videos`)

```bash
youtube videos list
youtube videos list --limit 50
```

チャンネルに登録済みの動画を一覧表示します（要 `auth login`）。

### 再生リスト (`playlists`)

```bash
youtube playlists add
youtube playlists add --playlist PLxxxxxxxxxxxxxxxx
youtube playlists add --limit 50 --playlist "https://www.youtube.com/playlist?list=PLxxx"
```

登録済み動画を対話形式で選択し、指定した再生リストに追加します（要 `auth login`）。

| オプション | 説明 |
|------------|------|
| `--playlist` | 再生リスト ID（`PL...`）または `?list=` 付き URL。未指定時は `config.yaml` の `upload.playlistId` を使用 |
| `--config` | フォールバック用 config.yaml のパス（未指定時は [設定ファイルの場所](#設定ファイルの場所) の順で探索） |
| `--limit` | 選択候補として表示する最大件数（デフォルト 20、最大 500） |

### アップロード (`upload`)

```bash
youtube upload --dir ./videos --dry-run
youtube upload --dir ./videos
youtube upload --dir ./videos --recursive
```

### カテゴリ (`categories`)

```bash
youtube categories list
youtube categories list --region JP --hl ja
```

`config.example.yaml` を動画フォルダ内の `config.yaml` にコピーして編集してください。各項目の説明は [config.yaml の設定](#configyaml-の設定) を参照してください。

## config.yaml の設定

### 設定ファイルの場所

`youtube upload` と `youtube playlists add`（`--playlist` 未指定時）は、次の順で `config.yaml` を探します。

1. `--config` で指定したパス
2. カレントディレクトリの `config.yaml`（プロジェクトルートなど）
3. 動画フォルダ内の `config.yaml`（`upload` は `--dir`、`playlists add` はデフォルト `./videos`）
4. ユーザ設定ディレクトリの `config.yaml`
   - Windows: `%APPDATA%\youtube-cli\config.yaml`
   - macOS / Linux: `~/.config/youtube-cli/config.yaml`

### 全体像

```yaml
template:   # 動画のメタデータ（必須）
schedule:   # 予約投稿スケジュール（必須）
upload:     # アップロード後の処理（任意）
```

### template — 動画メタデータ

各動画ファイルに適用されるタイトル・説明・タグなどを定義します。

| 項目 | 必須 | 説明 |
|------|------|------|
| `title` | 任意 | タイトルのテンプレート。省略時はファイル名（拡張子なし）がそのまま使われます |
| `description` | 必須 | 説明文。複数行の YAML リテラル（`\|`）が使えます |
| `tags` | 必須 | タグの配列 |
| `categoryId` | 任意 | YouTube のカテゴリ ID。省略時は `"22"`（People & Blogs） |
| `defaultLanguage` | 任意 | デフォルト言語。省略時は `ja` |

`title` と `description` では `{{title}}` がファイル名（拡張子なし）に置き換わります。

```yaml
template:
  title: "【新曲】{{title}}"
  description: |
    {{title}} をお楽しみください。

    チャンネル登録・高評価お願いします。
    #music #original
  tags:
    - music
    - original
  categoryId: "10"
  defaultLanguage: ja
```

`categoryId` に使える ID は次のコマンドで確認できます（要 `auth login`）。

```bash
youtube categories list --region JP --hl ja
```

### schedule — 予約投稿スケジュール

| 項目 | 必須 | 説明 |
|------|------|------|
| `timezone` | 必須 | タイムゾーン（IANA 形式。例: `Asia/Tokyo`） |
| `startDate` | 必須 | スケジュール開始日。`YYYY-MM-DD` または `auto` |
| `slots` | 必須 | 投稿スロットの配列（1件以上） |

#### startDate

- **固定日付**（`2026-06-10` など）: この日以降のスロットから予約を割り当てます
- **`auto`**: 最新の投稿日の翌日を自動で開始日にします
  - ローカルの `.youtube-cli-index.json`（この CLI でアップロードした動画の `publishAt`）
  - 認証済みの場合は YouTube チャンネルの直近 50 件（予約投稿は `publishAt`、公開済みは `uploadedAt`）
  - 上記のうち最も新しい日時を基準に、タイムゾーンの日付で +1 日
  - 投稿履歴がない場合は当日を開始日にします

`auto` は連続してバッチアップロードする際に、前回の予約枠と重ならないよう開始日を決めるのに便利です。

#### slots — 投稿スロット

各スロットは「いつ投稿するか」の 1 枠を表します。動画はフォルダ内の順に、スロットの時系列順で 1 本ずつ割り当てられます。

| 項目 | 必須 | 説明 |
|------|------|------|
| `time` | 必須 | 投稿時刻（24 時間制 `HH:mm`。例: `"18:00"`） |
| `daily` | 条件付き | `true` のとき毎日この時刻に投稿。`weekday` と併用不可 |
| `weekday` | 条件付き | 曜日（`0`=日曜 … `6`=土曜）。`daily` と併用不可 |

`daily` と `weekday` のどちらか一方が必須です。

```yaml
schedule:
  timezone: Asia/Tokyo
  startDate: auto
  slots:
    # 毎日 18:00
    - daily: true
      time: "18:00"
    # 水曜 12:00 のみ
    - weekday: 3
      time: "12:00"
```

**スロットの割り当て順**: 曜日 → 時刻の順にソートされ、`startDate` 以降の週を順に走査して空き枠を埋めます。同じ曜日に複数スロットがある場合は時刻の早い順です。

**その他の制約**:

- 予約時刻は実行時刻から少なくとも 15 分後である必要があります（YouTube API の制限に合わせたもの）
- 割り当て可能な枠が足りない場合はエラーになります

### upload — アップロード後の処理（任意）

| 項目 | 必須 | 説明 |
|------|------|------|
| `playlistId` | 任意 | アップロード後に動画を追加する再生リスト。プレイリスト ID（`PL...`）または `?list=` 付き URL。`playlists add` で `--playlist` 未指定時のフォールバック先にもなります |

```yaml
upload:
  playlistId: "PLxxxxxxxxxxxxxxxx"
```

`upload` セクション自体は省略できます。`playlistId` も未指定なら、アップロード後の自動追加と `playlists add` のフォールバックは行いません。

### 設定例（まとめ）

リポジトリの `config.example.yaml` と同等の例です。

```yaml
template:
  description: |
    {{title}} をお楽しみください。

    チャンネル登録・高評価お願いします。
    #music #original
  tags:
    - music
    - original
  categoryId: "10"
  defaultLanguage: ja

upload:
  playlistId: "PLxxxxxxxxxxxxxxxx"

schedule:
  timezone: Asia/Tokyo
  startDate: auto
  slots:
    - daily: true
      time: "18:00"
    - weekday: 3
      time: "12:00"
```

## 認証のセットアップ

1. [Google Cloud Console](https://console.cloud.google.com/) で YouTube Data API v3 を有効化
2. OAuth クライアント ID（デスクトップアプリ）を作成し、JSON を `client_secret.json` として保存
3. 初回のみブラウザでログイン（詳細は [認証 (`auth`)](#認証-auth) を参照）:

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
