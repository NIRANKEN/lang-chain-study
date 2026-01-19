#!/bin/bash

# Docker環境での検証スクリプト
set -e

echo "🐳 Dockerfileの検証を開始します..."

# Docker デーモンの確認
if ! docker info > /dev/null 2>&1; then
  echo "❌ エラー: Docker デーモンが起動していません"
  echo "Docker Desktop を起動してください"
  exit 1
fi

# 環境変数の確認
if [ -z "$GOOGLE_API_KEY" ]; then
  echo "❌ エラー: GOOGLE_API_KEY が設定されていません"
  echo "使い方: export GOOGLE_API_KEY=your-api-key"
  exit 1
fi

# 既存のコンテナを停止・削除
echo "🧹 既存のコンテナをクリーンアップしています..."
if docker ps -a --format "table {{.Names}}" | grep -q "langchain-tutorial-test"; then
  echo "既存のコンテナを停止・削除しています..."
  docker stop langchain-tutorial-test > /dev/null 2>&1 || true
  docker rm langchain-tutorial-test > /dev/null 2>&1 || true
fi

# イメージのビルド
echo "📦 Dockerイメージをビルドしています..."
docker build -t langchain-tutorial-local .

# コンテナの起動
echo "🚀 コンテナを起動しています..."
docker run -d \
  --name langchain-tutorial-test \
  -p 8080:8080 \
  -e GOOGLE_API_KEY=$GOOGLE_API_KEY \
  -e NODE_ENV=production \
  langchain-tutorial-local

echo "⏳ アプリケーションの起動を待っています..."
sleep 5

# ヘルスチェック
echo "🔍 ヘルスチェックを実行しています..."
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
  echo "✅ アプリケーションが正常に起動しました！"
  echo "🌐 http://localhost:8080 でアクセスできます"
else
  echo "❌ アプリケーションの起動に失敗しました"
  echo "📋 ログを確認してください:"
  docker logs langchain-tutorial-test
fi

echo ""
echo "🛠️  便利なコマンド:"
echo "ログ確認: docker logs -f langchain-tutorial-test"
echo "コンテナ停止: docker stop langchain-tutorial-test"
echo "コンテナ削除: docker rm langchain-tutorial-test"
echo "クリーンアップ: docker stop langchain-tutorial-test && docker rm langchain-tutorial-test"