import { Request, Response } from "express";
import { chatChain } from "../config/models.js";
import { ChatRequest, ChatResponse, ErrorResponse, HealthResponse, ApiInfo } from "../types/index.js";

export class ChatController {
  /**
   * 基本的なチャット処理
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { question }: ChatRequest = req.body;

      if (!question) {
        res.status(400).json({ error: "質問が必要です" } as ErrorResponse);
        return;
      }

      console.log(`質問を受信: ${question}`);

      const response = await chatChain.invoke({ question });

      res.json({
        question,
        answer: response,
      } as ChatResponse);
    } catch (error) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({
        error: "チャット処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  /**
   * ヘルスチェック
   */
  healthCheck(req: Request, res: Response): void {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    } as HealthResponse);
  }

  /**
   * API情報とヘルプ
   */
  getApiInfo(req: Request, res: Response): void {
    res.json({
      message: "LangChain Tutorial API へようこそ！",
      endpoints: {
        "/": "このヘルプメッセージ",
        "/health": "ヘルスチェック",
        "POST /chat": '質問を送信 (body: { question: "your question" })',
        "POST /initialize-vector-store": "ベクトルストア用テーブルを初期化",
        "POST /input-test": "PDFファイルをベクトルストアに追加",
        "POST /input-youtube-test": 'YouTube動画をベクトルストアに追加 (body: { videoUrls?: ["url1", "url2"] })',
        "POST /output-test":
          'RAG検索とAI回答を取得 - 構造化されたJSON形式で回答 (body: { question: "your question" })',
        "POST /output-youtube-test":
          'YouTube動画データからRAG検索とAI回答を取得 - 構造化されたJSON形式で回答 (body: { question: "your question" })',
      },
      workflow: {
        "PDF workflow": {
          "1": "POST /initialize-vector-store で環境をクリア（オプション）",
          "2": "POST /input-test でPDFデータを追加（テーブル自動作成）",
          "3": "POST /output-test で質問と回答",
        },
        "YouTube workflow": {
          "1": "POST /input-youtube-test でYouTube動画データを追加（テーブル自動作成）",
          "2": "POST /output-youtube-test で動画内容について質問と回答",
        },
      },
    } as ApiInfo);
  }
}