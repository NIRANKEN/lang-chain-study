import { Request, Response } from "express";
import { RagService } from "../services/ragService";
import { VectorStoreService } from "../services/vectorService";
import {
  TABLE_NAMES,
  SYSTEM_MESSAGES,
  FALLBACK_SOURCES,
} from "../config/constants";
import { ChatRequest, ErrorResponse } from "../types";

export class RagController {
  private ragService: RagService;
  private vectorStoreService: VectorStoreService;

  constructor() {
    this.ragService = new RagService();
    this.vectorStoreService = new VectorStoreService();
  }

  /**
   * PDF文書からRAG検索と回答生成
   */
  async outputTest(req: Request, res: Response): Promise<void> {
    const { question }: ChatRequest = req.body;
    try {
      // 質問が提供されているかチェック
      if (!question) {
        res.status(400).json({ error: "質問が必要です" } as ErrorResponse);
        return;
      }

      // 共通関数を使用してPDF用の処理を実行
      const result = await this.ragService.processOutputTest(question, {
        tableName: TABLE_NAMES.TRAVEL_REPORTS,
        systemMessage: SYSTEM_MESSAGES.DEFAULT,
        dataSourceName: "PDF documents",
        logPrefix: "PDF",
        fallbackSource: FALLBACK_SOURCES.PDF,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in output-test endpoint:", error);

      // テーブルが存在しない場合の特別な処理
      if (
        error instanceof Error &&
        error.message.includes("travel_reportsテーブルが存在しません")
      ) {
        const tableNames = await this.vectorStoreService.getAvailableTables();
        res.status(400).json({
          error: "travel_reportsテーブルが存在しません",
          message:
            "先に /initialize-vector-store と /input-test エンドポイントを呼び出してデータを追加してください",
          availableTables: tableNames,
        } as ErrorResponse);
        return;
      }

      res.status(500).json({
        error: "出力テスト処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  /**
   * YouTube動画からRAG検索と回答生成
   */
  async outputYoutubeTest(req: Request, res: Response): Promise<void> {
    const { question }: ChatRequest = req.body;
    try {
      // 質問が提供されているかチェック
      if (!question) {
        res.status(400).json({ error: "質問が必要です" } as ErrorResponse);
        return;
      }

      // 共通関数を使用してYouTube用の処理を実行
      const result = await this.ragService.processOutputTest(question, {
        tableName: TABLE_NAMES.YOUTUBE_VIDEOS,
        systemMessage: SYSTEM_MESSAGES.DEFAULT,
        dataSourceName: "YouTube videos",
        logPrefix: "YouTube",
        fallbackSource: FALLBACK_SOURCES.YOUTUBE,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in output-youtube-test endpoint:", error);

      // テーブルが存在しない場合の特別な処理
      if (
        error instanceof Error &&
        error.message.includes("youtube_videosテーブルが存在しません")
      ) {
        const tableNames = await this.vectorStoreService.getAvailableTables();
        res.status(400).json({
          error: "youtube_videosテーブルが存在しません",
          message:
            "先に /input-youtube-test エンドポイントを呼び出してYouTube動画データを追加してください",
          availableTables: tableNames,
        } as ErrorResponse);
        return;
      }

      res.status(500).json({
        error: "YouTube出力テスト処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }
}
