#!/bin/bash

# ES Module import の修正スクリプト (nodenext版)
echo "🔧 ES Module imports を修正しています (TypeScript nodenext 準拠)..."

# 特定のファイルを順番に修正
echo "修正中: src/server.ts"
sed -i '' 's|from "./app"|from "./app.js"|g' src/server.ts

echo "修正中: src/app.ts"
sed -i '' 's|from "./routes"|from "./routes/index.js"|g' src/app.ts
sed -i '' 's|from "./config/database"|from "./config/database.js"|g' src/app.ts

echo "修正中: src/config/"
sed -i '' 's|from "./constants"|from "./constants.js"|g' src/config/database.ts
sed -i '' 's|from "./constants"|from "./constants.js"|g' src/config/models.ts

echo "修正中: src/controllers/"
sed -i '' 's|from "../config/models"|from "../config/models.js"|g' src/controllers/chatController.ts
sed -i '' 's|from "../types"|from "../types/index.js"|g' src/controllers/chatController.ts
sed -i '' 's|from "../types/index"|from "../types/index.js"|g' src/controllers/chatController.ts

sed -i '' 's|from "../services/ragService"|from "../services/ragService.js"|g' src/controllers/ragController.ts
sed -i '' 's|from "../services/vectorService"|from "../services/vectorService.js"|g' src/controllers/ragController.ts
sed -i '' 's|from "../config/constants"|from "../config/constants.js"|g' src/controllers/ragController.ts
sed -i '' 's|from "../types"|from "../types/index.js"|g' src/controllers/ragController.ts
sed -i '' 's|from "../types/index"|from "../types/index.js"|g' src/controllers/ragController.ts

sed -i '' 's|from "../services/vectorService"|from "../services/vectorService.js"|g' src/controllers/vectorController.ts
sed -i '' 's|from "../services/documentService"|from "../services/documentService.js"|g' src/controllers/vectorController.ts
sed -i '' 's|from "../types"|from "../types/index.js"|g' src/controllers/vectorController.ts
sed -i '' 's|from "../types/index"|from "../types/index.js"|g' src/controllers/vectorController.ts

echo "修正中: src/routes/"
sed -i '' 's|from "../controllers/chatController"|from "../controllers/chatController.js"|g' src/routes/index.ts
sed -i '' 's|from "../controllers/vectorController"|from "../controllers/vectorController.js"|g' src/routes/index.ts
sed -i '' 's|from "../controllers/ragController"|from "../controllers/ragController.js"|g' src/routes/index.ts

echo "修正中: src/services/"
sed -i '' 's|from "../config/database"|from "../config/database.js"|g' src/services/documentService.ts
sed -i '' 's|from "../config/models"|from "../config/models.js"|g' src/services/documentService.ts
sed -i '' 's|from "../config/constants"|from "../config/constants.js"|g' src/services/documentService.ts
sed -i '' 's|from "../types"|from "../types/index.js"|g' src/services/documentService.ts
sed -i '' 's|from "../types/index"|from "../types/index.js"|g' src/services/documentService.ts

sed -i '' 's|from "../config/database"|from "../config/database.js"|g' src/services/ragService.ts
sed -i '' 's|from "../config/models"|from "../config/models.js"|g' src/services/ragService.ts
sed -i '' 's|from "../config/constants"|from "../config/constants.js"|g' src/services/ragService.ts
sed -i '' 's|from "../types"|from "../types/index.js"|g' src/services/ragService.ts
sed -i '' 's|from "../types/index"|from "../types/index.js"|g' src/services/ragService.ts

sed -i '' 's|from "../config/database"|from "../config/database.js"|g' src/services/vectorService.ts
sed -i '' 's|from "../config/constants"|from "../config/constants.js"|g' src/services/vectorService.ts

echo "修正中: src/utils/"
sed -i '' 's|from "../types"|from "../types/index.js"|g' src/utils/errorHandler.ts
sed -i '' 's|from "../types/index"|from "../types/index.js"|g' src/utils/errorHandler.ts

echo "✅ ES Module imports の修正が完了しました"
echo "📦 TypeScript を再ビルドしています..."

pnpm build

if [ $? -eq 0 ]; then
  echo "✅ ビルドが成功しました！"
else
  echo "❌ ビルドに失敗しました"
  exit 1
fi