# 開発環境セットアップ

## ホットリロード機能

このプロジェクトでは、ファイルを保存すると自動的にサーバーが再起動されるホットリロード機能が有効になっています。

### 開発サーバーの起動

```bash
# nodemonを使用（推奨）
pnpm dev

# または tsx --watchを使用
pnpm dev:tsx
```

### ホットリロードの特徴

- ✅ **src/**ディレクトリ内のファイル変更を自動検知
- ✅ TypeScript (.ts)、JavaScript (.js)、JSON (.json) ファイルをウォッチ
- ✅ 1秒のdelay付きで不要な再起動を防止
- ✅ node_modules、dist、dataディレクトリは除外
- ✅ グレースフルシャットダウン対応

### 開発フロー

1. `pnpm dev` でサーバーを起動
2. エディターでファイルを編集・保存
3. 自動的にサーバーが再起動
4. ブラウザやAPIクライアントで変更をテスト

### 便利なコマンド

```bash
# 開発サーバー起動（ホットリロード有効）
pnpm dev

# ビルド
pnpm build

# 本番環境での起動
pnpm start

# コードの検証
pnpm lint
pnpm lint:fix
```

### 設定ファイル

- `nodemon.json` - nodemonの設定
- `tsconfig.json` - TypeScriptの設定
- `eslint.config.mjs` - ESLintの設定

### 開発時の注意点

- データベースファイル (`data/`) は自動再読み込みされません
- 大きなファイルの変更時は再起動に時間がかかる場合があります
- 環境変数 (`.env`) の変更は手動での再起動が必要です