# アーキテクチャ概要

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     ユーザー/クライアント                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP Request
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   Express.js Server                         │
│                   (src/index.ts)                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  GET /       │  │  GET /health │  │ POST /chat   │     │
│  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────┬───────┘     │
│                                               │             │
│  ┌──────────────┐                            │             │
│  │POST/translate│                            │             │
│  └──────┬───────┘                            │             │
│         │                                    │             │
│         │        ┌───────────────────────────┘             │
│         │        │                                         │
│         │        │                                         │
│  ┌──────▼────────▼──────┐                                 │
│  │   LangChain LCEL     │                                 │
│  │   (Chains & Prompts) │                                 │
│  └──────────┬────────────┘                                 │
│             │                                               │
└─────────────┼───────────────────────────────────────────────┘
              │
              │ API Call
              │
┌─────────────▼─────────────────────────────────────────────┐
│          Google Generative AI (Gemini Pro)                │
│          @langchain/google-genai                          │
└───────────────────────────────────────────────────────────┘
```

## データフロー

### チャットエンドポイント (/chat)

```
1. クライアント → Express Server
   POST /chat
   { "question": "LangChainとは？" }

2. Express Server → Prompt Template
   質問をプロンプトテンプレートに適用

3. Prompt Template → LangChain Chain
   LCEL (LangChain Expression Language) でチェーン構築

4. LangChain Chain → Google GenAI
   Gemini Pro API 呼び出し

5. Google GenAI → LangChain Chain
   AI生成レスポンス

6. LangChain Chain → Express Server
   レスポンスをパース

7. Express Server → クライアント
   { "question": "...", "answer": "..." }
```

### 翻訳エンドポイント (/translate)

```
1. クライアント → Express Server
   POST /translate
   { "text": "Hello", "targetLang": "Japanese" }

2. Express Server → Translation Chain
   翻訳専用のチェーン実行

3. Translation Chain → Google GenAI
   翻訳リクエスト

4. Google GenAI → Express Server
   翻訳結果

5. Express Server → クライアント
   { "originalText": "...", "translatedText": "..." }
```

## コンポーネント構成

### バックエンド層

```
┌──────────────────────────────────────┐
│        Application Layer             │
│  ┌────────────────────────────────┐  │
│  │   Express.js REST API          │  │
│  │   - Route Handlers             │  │
│  │   - Middleware                 │  │
│  │   - Error Handling             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│        Service Layer                 │
│  ┌────────────────────────────────┐  │
│  │   LangChain Integration        │  │
│  │   - Prompt Templates           │  │
│  │   - Chains (LCEL)              │  │
│  │   - Output Parsers             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│        External Services             │
│  ┌────────────────────────────────┐  │
│  │   Google GenAI (Gemini Pro)    │  │
│  │   - Chat Model                 │  │
│  │   - API Integration            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### デプロイメント構成

#### ローカル開発環境

```
┌─────────────────────────────────┐
│   Development Machine           │
│                                 │
│   ┌─────────────────────────┐   │
│   │   Node.js Runtime       │   │
│   │   (tsx for TypeScript)  │   │
│   │                         │   │
│   │   Express Server        │   │
│   │   Port: 8080            │   │
│   └─────────────────────────┘   │
│                                 │
│   Environment:                  │
│   - .env file                   │
│   - NODE_ENV=development        │
└─────────────────────────────────┘
```

#### Cloud Run 本番環境

```
┌───────────────────────────────────────────┐
│   Google Cloud Run                        │
│                                           │
│   ┌───────────────────────────────────┐   │
│   │   Container Instance              │   │
│   │                                   │   │
│   │   ┌───────────────────────────┐   │   │
│   │   │   Docker Container        │   │   │
│   │   │                           │   │   │
│   │   │   Node.js 20              │   │   │
│   │   │   Express Server          │   │   │
│   │   │   Port: 8080              │   │   │
│   │   │                           │   │   │
│   │   └───────────────────────────┘   │   │
│   │                                   │   │
│   │   Resources:                      │   │
│   │   - CPU: 1                        │   │
│   │   - Memory: 512Mi                 │   │
│   │   - Max Instances: 10             │   │
│   └───────────────────────────────────┘   │
│                                           │
│   Configuration:                          │
│   - Environment Variables                 │
│   - Auto-scaling                          │
│   - HTTPS Endpoint                        │
└───────────────────────────────────────────┘
```

## 技術スタック詳細

### コア技術

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| Runtime | Node.js | 20 | JavaScript実行環境 |
| 言語 | TypeScript | 5.9.3 | 型安全な開発 |
| パッケージマネージャ | pnpm | 10.19.0 | 依存関係管理 |
| Webフレームワーク | Express.js | 5.1.0 | REST API構築 |
| LLMフレームワーク | LangChain | 1.0.1 | LLM統合 |
| LLMプロバイダ | Google GenAI | 1.0.0 | Gemini Pro統合 |

### 開発ツール

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| Linter | ESLint | コード品質保証 |
| TypeScript実行 | tsx | 開発時の高速実行 |
| 環境変数 | dotenv | 設定管理 |

### デプロイメント

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| コンテナ化 | Docker | アプリケーションパッケージング |
| ホスティング | Cloud Run | サーバーレス実行環境 |
| CI/CD | Cloud Build | 自動ビルド |

## セキュリティ考慮事項

### 環境変数管理

```
.env (ローカル開発)
├── GOOGLE_API_KEY  # Git除外
├── PORT
└── NODE_ENV

Cloud Run (本番環境)
├── GOOGLE_API_KEY  # Secret Manager推奨
├── NODE_ENV=production
└── PORT=8080
```

### 推奨事項

1. **API キーの保護**
   - .env ファイルは Git にコミットしない
   - Cloud Run では Secret Manager を使用

2. **HTTPS の使用**
   - Cloud Run は自動的に HTTPS を提供

3. **レート制限**
   - 必要に応じて API レート制限を実装

4. **入力検証**
   - ユーザー入力のバリデーション実装

## 拡張性

### 水平スケーリング

Cloud Run の自動スケーリング機能により、トラフィックに応じて自動的にインスタンスが増減します。

### 機能拡張ポイント

1. **新しいエンドポイント**
   - `src/index.ts` にルートを追加

2. **新しい LangChain 機能**
   - メモリー機能の追加
   - ベクトルストアの統合
   - エージェントの実装

3. **データベース統合**
   - Cloud SQL や Firestore の追加

4. **認証・認可**
   - Firebase Auth や OAuth の統合

## 監視・ロギング

### Cloud Run での監視

```
Google Cloud Console
├── Cloud Logging      # アプリケーションログ
├── Cloud Monitoring   # メトリクス
└── Cloud Trace        # トレーシング
```

### ローカル開発での監視

```
Console Logging
├── サーバー起動ログ
├── リクエストログ
└── エラーログ
```
