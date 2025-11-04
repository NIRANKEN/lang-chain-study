#!/bin/bash

# .js拡張子を削除して通常のTypeScript importに戻すスクリプト
echo "🔧 TypeScript imports を通常形式に戻しています..."

# .js拡張子を削除
find src -name "*.ts" -type f -exec sed -i '' 's|from "\./\([^"]*\)\.js";|from "./\1";|g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's|from "\.\./\([^"]*\)\.js";|from "../\1";|g' {} \;

# index.js の特別な処理
find src -name "*.ts" -type f -exec sed -i '' 's|from "\./routes";|from "./routes";|g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's|from "\.\./types";|from "../types";|g' {} \;

echo "✅ TypeScript imports の修正が完了しました"
echo "📦 TypeScript を再ビルドしています..."

pnpm build

if [ $? -eq 0 ]; then
  echo "✅ ビルドが成功しました！"
else
  echo "❌ ビルドに失敗しました"
  exit 1
fi