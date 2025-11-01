# Lance Data Viewer セットアップ

このディレクトリには、LanceDB データを閲覧するための Lance Data Viewer を簡単に起動できるファイルが含まれています。

## ファイル構成

- `docker-compose.lance-viewer.yml` - Docker Compose 設定ファイル
- `scripts/lance-viewer.sh` - 起動・停止用のスクリプト

## 前提条件

- Docker と Docker Compose がインストールされていること
- `data/sample-lancedb/` ディレクトリに Lance データが存在すること

## 使用方法

### 1. 簡単起動 (推奨)

```bash
# Lance Data Viewer を起動
./scripts/lance-viewer.sh start

# ブラウザで http://localhost:8090 にアクセス
```

### 2. レガシーバージョンを使用する場合

```bash
# LanceDB 0.16.0 用のビューアーを起動
./scripts/lance-viewer.sh start --legacy

# ブラウザで http://localhost:8091 にアクセス
```

### 3. その他のコマンド

```bash
# 状態確認
./scripts/lance-viewer.sh status

# ログ表示
./scripts/lance-viewer.sh logs

# 停止
./scripts/lance-viewer.sh stop

# 再起動
./scripts/lance-viewer.sh restart

# ヘルプ表示
./scripts/lance-viewer.sh help
```

### 4. Docker Compose を直接使用

```bash
# 起動
docker-compose -f docker-compose.lance-viewer.yml up -d

# 停止
docker-compose -f docker-compose.lance-viewer.yml down

# ログ表示
docker-compose -f docker-compose.lance-viewer.yml logs -f
```

## 利用可能なバージョン

| コンテナタグ | Lance バージョン | PyArrow | 用途 |
|-------------|-----------------|---------|------|
| lancedb-0.24.3 | 0.24.3 | 21.0.0 | 推奨 - モダンな安定版 |
| lancedb-0.16.0 | 0.16.0 | 16.1.0 | 古いデータセット用 |

## トラブルシューティング

### データが表示されない場合

1. データディレクトリの権限を確認:
   ```bash
   ls -la data/sample-lancedb/
   ```

2. 権限を修正:
   ```bash
   chmod -R o+rx data/sample-lancedb/
   ```

### 互換性エラーが発生する場合

Lance データの形式が古い場合は、レガシーバージョンを使用してください:

```bash
./scripts/lance-viewer.sh start --legacy
```

### ポートが使用中の場合

デフォルトのポート 8090 が使用中の場合は、Docker Compose ファイルのポート設定を変更してください:

```yaml
ports:
  - "9000:8080"  # 9000 に変更
```

## Lance Data Viewer の機能

- 📊 読み取り専用のブラウジング
- 🎯 ベクトル可視化 (CLIP埋め込み検出)
- 📋 スキーマ分析
- 📄 サーバーサイドページネーション
- 🔍 カラムフィルタリング
- 🛡️ エラーハンドリング
- 📱 レスポンシブレイアウト

## セキュリティ注意事項

- コンテナは非root権限で実行されます
- 認証機能はありません（開発環境での使用を想定）
- リードオンリーアクセスで誤った変更を防止します
- 本番環境では適切な認証とリバースプロキシの設定を行ってください

## API エンドポイント

Lance Data Viewer が起動したら、以下のAPIエンドポイントも利用可能です:

```bash
# ヘルスチェック
curl http://localhost:8090/healthz

# データセット一覧
curl http://localhost:8090/datasets

# データセットの行を取得
curl "http://localhost:8090/datasets/your-dataset/rows?limit=5"
```