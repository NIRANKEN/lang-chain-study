# Scripts Directory - Usage Guide

## 🐳 Docker関連
- **`test-docker.sh`** - ローカルでDockerfileをテスト（推奨：常時保持）
- **`cleanup-docker.sh`** - Docker環境のクリーンアップ（推奨：常時保持）
- **`deploy-cloudrun.sh`** - Cloud Runデプロイ（推奨：常時保持）

## 🔧 開発支援
- **`setup.sh`** - 初期セットアップ（推奨：常時保持）
- **`lance-viewer.sh`** - LanceDB viewer起動（推奨：常時保持）

## 📦 ES Modules修正 (一時的)
- **`fix-imports.sh`** - 重複修正版（削除推奨）
- **`fix-imports-v2.sh`** - 正常動作版（条件付き保持）

### fix-imports-v2.sh の判断基準：

**保持する場合：**
- チーム開発を行う
- 頻繁にブランチ切り替えを行う
- TypeScript設定を変更する可能性がある

**削除する場合：**
- 個人開発のみ
- 設定が安定している
- ファイル数が少ない（現在の規模）

### 現在の推奨：
個人開発であれば削除OK。チーム開発なら保持を推奨。