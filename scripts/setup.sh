#!/bin/bash

# ローカル開発用のセットアップスクリプト

set -e

echo "🚀 LangChain Tutorial セットアップ"
echo "================================"
echo ""

# pnpm がインストールされているかチェック
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm がインストールされていません"
    echo "インストール方法: npm install -g pnpm"
    exit 1
fi

echo "✅ pnpm が見つかりました: $(pnpm --version)"
echo ""

# 依存関係のインストール
echo "📦 依存関係をインストールしています..."
pnpm install

# .env ファイルの確認
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  .env ファイルが見つかりません"
    echo "📝 .env.example から .env を作成しています..."
    cp .env.example .env
    echo ""
    echo "⚡ 重要: .env ファイルに Google API Key を設定してください"
    echo "   1. https://makersuite.google.com/app/apikey にアクセス"
    echo "   2. API Key を取得"
    echo "   3. .env ファイルの GOOGLE_API_KEY を更新"
    echo ""
else
    echo "✅ .env ファイルが見つかりました"
fi

# ビルドのテスト
echo ""
echo "🏗️  TypeScript をビルドしています..."
pnpm build

echo ""
echo "✨ セットアップが完了しました！"
echo ""
echo "次のステップ:"
echo "  1. .env ファイルに Google API Key を設定"
echo "  2. サーバーを起動: pnpm dev"
echo "  3. または CLI を実行: pnpm dev:cli"
echo ""
