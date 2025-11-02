import { Request, Response } from "express";
import { VectorStoreService } from "../services/vectorService";
import { DocumentService } from "../services/documentService";
import { ErrorResponse, YoutubeInputRequest } from "../types";

export class VectorController {
  private vectorStoreService: VectorStoreService;
  private documentService: DocumentService;

  constructor() {
    this.vectorStoreService = new VectorStoreService();
    this.documentService = new DocumentService();
  }

  /**
   * ベクトルストアを初期化
   */
  async initializeVectorStore(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.vectorStoreService.initializeVectorStore();
      res.json(result);
    } catch (error) {
      console.error("Error in initialize-vector-store endpoint:", error);
      res.status(500).json({
        error: "ベクトルストア初期化中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  /**
   * 汎用的なドキュメント追加エンドポイント（本番用：統一テーブル使用）
   */
  async addDocuments(req: Request, res: Response): Promise<void> {
    try {
      // 本番用は統一テーブル名を使用してPDF処理
      const result = await this.documentService.processPdfDocument();
      res.json({
        success: true,
        message: "ドキュメントが正常にベクトルストアに追加されました",
        data: result
      });
    } catch (error) {
      console.error("Error in add documents endpoint:", error);
      res.status(500).json({
        error: "ドキュメント追加中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  /**
   * 汎用的なYouTube動画追加エンドポイント（本番用：統一テーブル使用）
   */
  async addYoutubeVideos(req: Request, res: Response): Promise<void> {
    try {
      const { videoUrls } = req.body as YoutubeInputRequest;
      
      if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
        res.status(400).json({
          error: "videoUrlsは空でない配列である必要があります",
        } as ErrorResponse);
        return;
      }
      
      const invalidUrls = videoUrls.filter(url => 
        typeof url !== 'string' || 
        (!url.includes('youtube.com/watch') && !url.includes('youtu.be/'))
      );
      
      if (invalidUrls.length > 0) {
        res.status(400).json({
          error: "無効なYouTube URLが含まれています",
          details: `無効なURL: ${invalidUrls.join(', ')}`,
        } as ErrorResponse);
        return;
      }
      
      // 本番用は統一テーブル名を使用してYouTube処理
      const result = await this.documentService.processYoutubeVideo(videoUrls);
      res.json({
        success: true,
        message: "YouTube動画が正常にベクトルストアに追加されました",
        processedVideos: videoUrls.length,
        data: result
      });
    } catch (error) {
      console.error("Error in add YouTube videos endpoint:", error);
      res.status(500).json({
        error: "YouTube動画追加中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }
}