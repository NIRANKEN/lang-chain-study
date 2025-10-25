# クイックスタートガイド

## 最速でアプリケーションを起動する

### 1. セットアップスクリプトの実行

```bash
bash scripts/setup.sh
```

このスクリプトが以下を実行します:
- 依存関係のインストール
- .env ファイルの作成（存在しない場合）
- TypeScript のビルド

### 2. Google API Key の設定

`.env` ファイルを編集:

```bash
GOOGLE_API_KEY=your_actual_google_api_key_here
PORT=8080
NODE_ENV=development
```

### 3. アプリケーションの起動

#### オプション A: サーバーモード

```bash
pnpm dev
```

ブラウザで http://localhost:8080 にアクセス

#### オプション B: CLI モード

```bash
pnpm dev:cli
```

## API の使用例

### ヘルスチェック

```bash
curl http://localhost:8080/health
```

### チャット（質問応答）

```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "LangChainについて教えてください"}'
```

### 翻訳

```bash
curl -X POST http://localhost:8080/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you?", "targetLang": "Japanese"}'
```

## トラブルシューティング

### pnpm がない場合

```bash
npm install -g pnpm
```

### 環境変数が読み込まれない場合

`.env` ファイルがプロジェクトルートに存在することを確認してください:

```bash
ls -la .env
```

### ポートが使用中の場合

`.env` ファイルで別のポートを指定:

```bash
PORT=3000
```

## Cloud Run へのデプロイ

### 準備

1. Google Cloud プロジェクトを作成
2. gcloud CLI をインストール
3. 認証を設定: `gcloud auth login`

### デプロイ

```bash
export PROJECT_ID=your-gcp-project-id
export SERVICE_NAME=langchain-tutorial
export REGION=asia-northeast1
export GOOGLE_API_KEY=your_google_api_key

bash scripts/deploy-cloudrun.sh
```

## 開発コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバーを起動 |
| `pnpm dev:cli` | CLI サンプルを実行 |
| `pnpm build` | TypeScript をビルド |
| `pnpm start` | 本番モードで起動 |
| `pnpm lint` | コードをチェック |
| `pnpm lint:fix` | コードを自動修正 |

## プロジェクト構成

```
lang-chain-study/
├── src/
│   ├── index.ts       # Express サーバー
│   └── cli.ts         # CLI サンプル
├── scripts/
│   ├── setup.sh       # セットアップスクリプト
│   └── deploy-cloudrun.sh  # デプロイスクリプト
├── .env.example       # 環境変数サンプル
├── Dockerfile         # Docker 設定
├── cloudrun.yaml      # Cloud Run 設定
└── README.md          # メインドキュメント
```

## 次のステップ

1. `src/index.ts` をカスタマイズして、独自のエンドポイントを追加
2. LangChain のドキュメントで高度な機能を学ぶ
3. Cloud Run にデプロイして本番環境で実行

詳細は [README.md](README.md) を参照してください。
