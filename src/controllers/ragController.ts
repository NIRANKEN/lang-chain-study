import { Request, Response } from "express";
import { RagService } from "../services/ragService.js";
import { VectorStoreService } from "../services/vectorService.js";
import {
  TABLE_NAMES,
  SYSTEM_MESSAGES,
  FALLBACK_SOURCES,
} from "../config/constants.js";
import { ChatRequest, ErrorResponse } from "../types/index.js";

export class RagController {
  private ragService: RagService;
  private vectorStoreService: VectorStoreService;

  constructor() {
    this.ragService = new RagService();
    this.vectorStoreService = new VectorStoreService();
  }

  /**
   * 統一RAG検索エンドポイント（本番用：1つのテーブルを使用）
   */
  async search(req: Request, res: Response): Promise<void> {
    const { question }: ChatRequest = req.body;
    
    try {
      if (!question) {
        res.status(400).json({ 
          error: "質問が必要です",
          message: "リクエストボディに 'question' フィールドを含めてください"
        } as ErrorResponse);
        return;
      }

      // 本番用は統一テーブルを使用
      const config = {
        tableName: TABLE_NAMES.DOCUMENTS,
        systemMessage: SYSTEM_MESSAGES.DEFAULT,
        dataSourceName: "documents",
        logPrefix: "Documents",
        fallbackSource: FALLBACK_SOURCES.DOCUMENTS,
      };

      const result = await this.ragService.processOutputTest(question, config);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error("Error in RAG search endpoint:", error);

      // テーブルが存在しない場合の特別な処理
      if (error instanceof Error && error.message.includes("テーブルが存在しません")) {
        const tableNames = await this.vectorStoreService.getAvailableTables();
        res.status(400).json({
          error: "ドキュメントテーブルが存在しません",
          message: "先にベクトルストアにデータを追加してください",
          availableTables: tableNames,
          suggestion: "ドキュメントを追加するには /vector/documents または /vector/youtube エンドポイントを使用してください"
        } as ErrorResponse);
        return;
      }

      res.status(500).json({
        error: "RAG検索中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }


}
