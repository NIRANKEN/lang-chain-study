import { Innertube } from "youtubei.js";
import { YoutubeSearchRequest } from "../types/index.js";

// Innertube.searchの第二引数の型を取得
type SearchFilters = Parameters<Innertube["search"]>[1];

// youtubei.jsのVideoクラスがトップレベルでエクスポートされていないため、
// 必要なプロパティを持つローカルなインターフェースを定義する
interface IVideo {
  id: string;
  published: Date | string;
}

/**
 * 相対的な日付文字列（例: "2 years ago", "10 months ago", "Streamed 1 year ago"）を
 * Dateオブジェクトに変換する
 */
function parseRelativeDate(dateString: string): Date | null {
  const now = new Date();
  
  // "Streamed " プレフィックスを削除
  const cleanString = dateString.replace(/^Streamed\s+/i, "").trim();
  
  // 数値と単位を抽出
  const match = cleanString.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  
  if (!match) {
    return null;
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  const result = new Date(now);
  
  switch (unit) {
    case "second":
      result.setSeconds(result.getSeconds() - value);
      break;
    case "minute":
      result.setMinutes(result.getMinutes() - value);
      break;
    case "hour":
      result.setHours(result.getHours() - value);
      break;
    case "day":
      result.setDate(result.getDate() - value);
      break;
    case "week":
      result.setDate(result.getDate() - value * 7);
      break;
    case "month":
      result.setMonth(result.getMonth() - value);
      break;
    case "year":
      result.setFullYear(result.getFullYear() - value);
      break;
    default:
      return null;
  }
  
  return result;
}

export class YoutubeService {
  private youtube: Innertube;

  private constructor(youtube: Innertube) {
    this.youtube = youtube;
  }

  static async create(): Promise<YoutubeService> {
    const youtube = await Innertube.create();
    return new YoutubeService(youtube);
  }

  async searchYoutubeVideos(request: YoutubeSearchRequest): Promise<string[]> {
    const { requiredKeyword, optionalKeyword, resultsLength, searchOptions } =
      request;

    // オプショナルキーワードを解析して、OR演算子で結合した1つのクエリを作成
    const optionalKeywords = optionalKeyword
      .trim()
      .split(/\s+/)
      .map((keyword) => {
        const processed = keyword.replace(/&&/g, " ");
        // 複数の単語が含まれる場合は括弧でグループ化
        return processed.includes(" ") ? `(${processed})` : processed;
      });

    // OR演算子で結合して1つのクエリにする
    const query = `${requiredKeyword} ${optionalKeywords.join(" OR ")}`;

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

    console.log(`Searching for: ${query}`);
    let searchResult = await this.youtube.search(query, searchFilters);
    console.log(`Total results found: ${searchResult.videos.length}`);

    let collectedVideos: IVideo[] = [];

    // yearsBackオプションから対象期間を設定（デフォルトは3年）
    const yearsBack = searchOptions?.yearsBack ?? 3;
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() - yearsBack);

    const maxAttempts = 10; // 無限ループ防止のための最大試行回数
    let attempts = 0;
    while (collectedVideos.length < resultsLength && attempts < maxAttempts) {
        const videos = searchResult.videos.filter(
          (video) => video.constructor.name === "Video"
        ) as unknown as IVideo[];

        const filteredVideos = videos.filter((video) => {
          if (!video.published) return false;
          
          let publishedDate: Date | null = null;
          
          if (typeof video.published === "string") {
            // 相対的な日付文字列を解析
            publishedDate = parseRelativeDate(video.published);
            if (!publishedDate) {
              // 解析できない場合は標準のDate()を試す
              const attemptedDate = new Date(video.published);
              if (!isNaN(attemptedDate.getTime())) {
                publishedDate = attemptedDate;
              }
            }
          } else if (video.published instanceof Date) {
            publishedDate = video.published;
          } else {
            // Dateオブジェクトでない場合、文字列に変換して解析を試みる
            const dateStr = String(video.published);
            publishedDate = parseRelativeDate(dateStr);
            if (!publishedDate) {
              const attemptedDate = new Date(dateStr);
              if (!isNaN(attemptedDate.getTime())) {
                publishedDate = attemptedDate;
              }
            }
          }
          
          console.log(`Video published date (original): ${video.published}, parsed: ${publishedDate}`);
          
          // 無効な日付をフィルタリング
          if (!publishedDate || !(publishedDate instanceof Date) || isNaN(publishedDate.getTime())) {
            return false;
          }
          
          return publishedDate >= targetDate;
        });

        collectedVideos.push(...filteredVideos);

        if (
          collectedVideos.length >= resultsLength ||
          !searchResult.has_continuation
        ) {
          break;
        }

        searchResult = await searchResult.getContinuation();
        attempts++;
      }

    const videoUrls = collectedVideos
      .slice(0, resultsLength)
      .map((video) => `https://www.youtube.com/watch?v=${video.id}`);

    // 重複を削除して返す
    return [...new Set(videoUrls)];
  }
}
