#!/bin/bash

# Docker環境のクリーンアップスクリプト
set -e

echo "🧹 Docker環境をクリーンアップしています..."

# テスト用コンテナの停止・削除
if docker ps -a --format "table {{.Names}}" | grep -q "langchain-tutorial-test"; then
  echo "テストコンテナを停止・削除しています..."
  docker stop langchain-tutorial-test > /dev/null 2>&1 || true
  docker rm langchain-tutorial-test > /dev/null 2>&1 || true
  echo "✅ テストコンテナを削除しました"
else
  echo "ℹ️  テストコンテナは見つかりませんでした"
fi

# テスト用イメージの削除（オプション）
if docker images --format "table {{.Repository}}" | grep -q "langchain-tutorial-local"; then
  read -p "🗑️  テストイメージ (langchain-tutorial-local) も削除しますか？ (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker rmi langchain-tutorial-local > /dev/null 2>&1 || true
    echo "✅ テストイメージを削除しました"
  fi
fi

echo ""
echo "✨ クリーンアップが完了しました！"