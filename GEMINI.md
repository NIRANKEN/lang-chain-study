# Geminiワークスペース利用ガイド（旅行提案RAGアプリケーション）

このドキュメントは、Geminiワークスペース内で旅行提案RAG（Retrieval-Augmented Generation）アプリケーションを操作するための手順を説明します。

## プロジェクト概要

このアプリケーションは、旅行の提案を行うために構築されたRAGアプリケーションです。TypeScriptとNode.jsで開発されており、YouTube動画やPDFドキュメントなど、さまざまな情報ソースからデータを取得し、ベクトルストア（LanceDB）に格納します。そして、Google Generative AI（Gemini）モデルを活用し、取得した情報に基づいて回答を生成します。

## 利用開始までの流れ

プロジェクトをセットアップし、実行するまでの手順は以下の通りです。

1.  **依存関係のインストール:**
    ```bash
    pnpm install
    ```

2.  **環境変数の設定:**
    まず、サンプルファイルをコピーして`.env`ファイルを作成します。次に、お使いのGoogle APIキーをファイルに設定してください。
    ```bash
    cp .env.example .env
    ```
    作成した`.env`ファイルを編集し、`GOOGLE_API_KEY`にご自身のAPIキーを設定します。

## 利用方法

このアプリケーションは、ベクトルストアの管理や旅行提案の取得といった機能を持つAPIエンドポイントを公開するサーバーで構成されています。

1.  **サーバーの起動:**
    以下のコマンドを実行すると、ホットリロード（ファイルの変更を検知して自動的に再起動する機能）が有効な状態でサーバーが起動します。
    ```bash
    pnpm dev
    ```

2.  **ベクトルストアへのデータ追加:**
    旅行の提案を得るためには、まずベクトルストアに情報源となるデータを追加する必要があります。`POST /vector/add`エンドポイントを使用してデータを追加してください。

    **実行例（YouTube動画を追加する場合）:**
    ```bash
    curl -X POST http://localhost:8080/vector/add \
      -H "Content-Type: application/json" \
      -d '{
        "source": "youtube",
        "url": "https://www.youtube.com/watch?v=your_video_id"
      }'
    ```

3.  **旅行の提案を取得:**
    ベクトルストアにデータが追加されたら、`POST /rag`エンドポイントに質問を送信することで、旅行の提案を受け取ることができます。

    **実行例:**
    ```bash
    curl -X POST http://localhost:8080/rag \
      -H "Content-Type: application/json" \
      -d '{
        "question": "東京でおすすめの観光スポットは？"
      }'
    ```

## APIエンドポイント一覧(現状はまだ用意していない)

*   `POST /rag`: RAGモデルから旅行の提案を取得します。
*   `POST /vector/add`: YouTube動画やPDFなどのドキュメントをベクトルストアに追加します。
*   `DELETE /vector/delete`: ベクトルストアからコレクションを削除します。

## 主要なファイル

*   `src/services/ragService.ts`: RAG（Retrieval-Augmented Generation）のコアロジックが実装されています。
*   `src/services/vectorService.ts`: ベクトルストア（LanceDB）とのやり取りを管理します。
*   `src/services/documentService.ts`: さまざまな情報ソースからのドキュメントの読み込みと処理を担当します。
*   `src/controllers/ragController.ts`: `/rag`エンドポイントに対応するコントローラーです。
*   `src/controllers/vectorController.ts`: `/vector`関連エンドポイントのコントローラーです。
*   `src/routes/index.ts`: アプリケーションの全APIルートを定義しています。
*   `data/`: ベクトルストア（LanceDB）のファイルが格納されるディレクトリです。
