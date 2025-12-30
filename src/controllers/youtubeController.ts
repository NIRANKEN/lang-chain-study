import { Request, Response } from "express";
import { YoutubeService } from "../services/youtubeService.js";
import { ErrorResponse, YoutubeSearchRequest } from "../types/index.js";

export class YoutubeController {
  private youtubeService: YoutubeService;

  private constructor(youtubeService: YoutubeService) {
    this.youtubeService = youtubeService;
  }

  static async create(): Promise<YoutubeController> {
    const youtubeService = await YoutubeService.create();
    return new YoutubeController(youtubeService);
  }

  async searchVideos(req: Request, res: Response): Promise<void> {
    try {
      const {
        requiredKeyword,
        optionalKeyword,
        resultsLength,
        searchOptions,
      } = req.body as YoutubeSearchRequest;

      if (
        !requiredKeyword ||
        !optionalKeyword ||
        resultsLength === undefined
      ) {
        res.status(400).json({
          error: "リクエストボディの形式が正しくありません。",
          details:
            "requiredKeyword, optionalKeyword, resultsLengthは必須です。",
        } as ErrorResponse);
        return;
      }

      const parsedResultsLength =
        typeof resultsLength === "string"
          ? parseInt(resultsLength, 10)
          : resultsLength;

      if (
        typeof parsedResultsLength !== "number" ||
        isNaN(parsedResultsLength) ||
        parsedResultsLength <= 0
      ) {
        res.status(400).json({
          error: "resultsLengthは正の数値である必要があります。",
        } as ErrorResponse);
        return;
      }

      if (searchOptions) {
        if (
          searchOptions.sort_by &&
          !["relevance", "rating", "upload_date", "view_count"].includes(
            searchOptions.sort_by
          )
        ) {
          res.status(400).json({
            error: "sort_byの値が不正です。",
          } as ErrorResponse);
          return;
        }
        if (
          searchOptions.duration &&
          !["short", "long"].includes(searchOptions.duration)
        ) {
          res.status(400).json({
            error: "durationの値が不正です。",
          } as ErrorResponse);
          return;
        }
      }

      const requestData: YoutubeSearchRequest = {
        requiredKeyword,
        optionalKeyword,
        resultsLength: parsedResultsLength,
        searchOptions,
      };

      const videoUrls = await this.youtubeService.searchYoutubeVideos(
        requestData
      );

      res.json({
        success: true,
        message: "YouTube動画の検索が完了しました。",
        searchCriteria: requestData,
        resultsCount: videoUrls.length,
        videoUrls: videoUrls,
      });
    } catch (error) {
      console.error("Error in YouTube search endpoint:", error);
      res.status(500).json({
        error: "YouTube動画の検索中にエラーが発生しました。",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }
}
