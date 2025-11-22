import { Innertube } from "youtubei.js";
import { SearchFilters } from "youtubei.js/dist/src/types/index.js";
import { YoutubeSearchRequest } from "../types/index.js";
import Video from "youtubei.js/dist/src/parser/nodes/Video.js";

export class YoutubeService {
  private youtube: Innertube;

  private constructor(youtube: Innertube) {
    this.youtube = youtube;
  }

  static async create(): Promise<YoutubeService> {
    const youtube = await Innertube.create();
    return new YoutubeService(youtube);
  }

  async searchYoutubeVideos(
    request: YoutubeSearchRequest
  ): Promise<string[]> {
    const {
      requiredKeyword,
      optionalKeyword,
      resultsLength,
      searchOptions,
    } = request;

    // オプショナルキーワードを解析して、検索クエリのリストを作成
    const optionalKeywords = optionalKeyword.split(" ").map((keyword) => {
      return keyword.replace(/&&/g, " ");
    });

    const searchQueries = optionalKeywords.map(
      (optKeyword) => `${requiredKeyword} ${optKeyword}`
    );

    const searchFilters: SearchFilters = {
      features: ["subtitles"],
      upload_date: "all",
      sort_by: searchOptions?.sort_by || "relevance",
    };

    if (searchOptions?.duration === "short") {
      searchFilters.duration = "short";
    } else if (searchOptions?.duration === "long") {
      searchFilters.duration = "long";
    }

    const allVideoUrls: string[] = [];

    for (const query of searchQueries) {
      console.log(`Searching for: ${query}`);
      let searchResult = await this.youtube.search(query, searchFilters);
      let collectedVideos: Video[] = [];

      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      while (collectedVideos.length < resultsLength) {
        const filteredVideos = searchResult.videos.filter((video): video is Video => {
            if (!video.published) return false;
            const publishedDate = typeof video.published === "string" ? new Date(video.published) : video.published;
            return publishedDate >= fiveYearsAgo;
        });

        collectedVideos.push(...filteredVideos);

        if (collectedVideos.length >= resultsLength || !searchResult.has_continuation) {
          break;
        }

        searchResult = await searchResult.getContinuation();
      }

      const videoUrls = collectedVideos
        .slice(0, resultsLength)
        .map((video) => `https://www.youtube.com/watch?v=${video.id}`);

      allVideoUrls.push(...videoUrls);
    }

    // 重複を削除して返す
    return [...new Set(allVideoUrls)];
  }
}
