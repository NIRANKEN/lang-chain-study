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
   * PDFファイルをベクトルストアに追加
   */
  async inputPdfTest(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.documentService.processPdfDocument();
      res.json(result);
    } catch (error) {
      console.error("Error in input-test endpoint:", error);
      res.status(500).json({
        error: "PDFテスト処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  /**
   * YouTube動画をベクトルストアに追加
   */
  async inputYoutubeTest(req: Request, res: Response): Promise<void> {
    try {
      // リクエストボディからvideoUrlsを取得
      const { videoUrls } = req.body as YoutubeInputRequest;
      
      // バリデーション: videoUrlsが配列の場合、各要素がstring型かつYouTube URLかをチェック
      if (videoUrls) {
        if (!Array.isArray(videoUrls)) {
          res.status(400).json({
            error: "videoUrlsは配列である必要があります",
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
      }
      
      const result = await this.documentService.processYoutubeVideo(videoUrls);
      res.json(result);
    } catch (error) {
      console.error("Error in input-youtube-test endpoint:", error);
      res.status(500).json({
        error: "YouTube動画テスト処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }
}