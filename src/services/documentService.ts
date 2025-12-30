import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { Document } from "@langchain/core/documents";
import { getDatabase } from "../config/database.js";
import { embeddings, textSplitter } from "../config/models.js";
import {
  PDF_FILE_PATH,
  YOUTUBE_TEST_URL,
  TABLE_NAMES,
  DB_PATH,
} from "../config/constants.js";
import { DocumentProcessResult } from "../types/index.js";
import { Innertube } from "youtubei.js";

/**
 * HTMLエンティティをデコード
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

/**
 * <p t="ms" d="ms">text</p> フォーマットをパース（Androidクライアント）
 */
function parsePTagFormat(xml: string): Array<{ text: string }> {
  const segments: Array<{ text: string }> = [];
  const pTagRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;

  let match = pTagRegex.exec(xml);
  while (match !== null) {
    const [, , , rawText] = match;
    if (rawText) {
      const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, "")).trim();
      if (text) {
        segments.push({ text });
      }
    }
    match = pTagRegex.exec(xml);
  }
  return segments;
}

/**
 * <text start="sec" dur="sec">text</text> フォーマットをパース
 */
function parseTextTagFormat(xml: string): Array<{ text: string }> {
  const segments: Array<{ text: string }> = [];
  const textTagRegex =
    /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;

  let match = textTagRegex.exec(xml);
  while (match !== null) {
    const [, , , rawText] = match;
    if (rawText) {
      const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, "")).trim();
      if (text) {
        segments.push({ text });
      }
    }
    match = textTagRegex.exec(xml);
  }
  return segments;
}

/**
 * timedtext XMLをパース
 */
function parseTimedTextXml(xml: string): string {
  // まず<p>タグフォーマットを試す
  const pSegments = parsePTagFormat(xml);
  if (pSegments.length > 0) {
    return pSegments.map((s) => s.text).join(" ");
  }
  // フォールバックとして<text>タグフォーマット
  const textSegments = parseTextTagFormat(xml);
  return textSegments.map((s) => s.text).join(" ");
}

/**
 * キャプショントラックからトランスクリプトを取得
 */
async function fetchCaptionTrack(captionUrl: string): Promise<string> {
  const response = await fetch(captionUrl, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch caption track: ${response.status}`);
  }

  const xml = await response.text();
  if (!xml || xml.length === 0) {
    throw new Error("Empty caption track response");
  }

  return parseTimedTextXml(xml);
}

export class DocumentService {
  /**
   * 指定されたソースがテーブルに既に存在するかを確認
   */
  private async isSourceExists(
    tableName: string,
    source: string
  ): Promise<boolean> {
    const db = getDatabase();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      return false;
    }

    const table = await db.openTable(tableName);
    // metadata.source を SQLライクな `where` 句でフィルタリングして件数をカウント
    const count = await table.countRows(`source = '${source}'`);
    return count > 0;
  }

  /**
   * PDFファイルを処理してベクトルストアに追加
   */
  async processPdfDocument(): Promise<DocumentProcessResult> {
    // 本番用は統一テーブルを使用
    const tableName = TABLE_NAMES.DOCUMENTS;

    // 処理前に同じソースのドキュメントが存在するか確認
    if (await this.isSourceExists(tableName, PDF_FILE_PATH)) {
      console.log(
        `ソース ${PDF_FILE_PATH} は既に処理済みのため、スキップします`
      );
      return {
        message: "指定されたPDFファイルは既に処理済みです",
        totalChunks: 0,
      };
    }

    const pdfLoader = new PDFLoader(PDF_FILE_PATH);
    const data = await pdfLoader.load();
    const allSplits = await textSplitter.splitDocuments(data);
    console.log(`Split into ${allSplits.length} chunks.`);

    const db = getDatabase();
    const tableNames = await db.tableNames();

    if (!tableNames.includes(tableName)) {
      // テーブルが存在しない場合は、直接ドキュメントから作成
      console.log(`${tableName}テーブルが存在しないため、新しく作成します`);
      await LanceDB.fromDocuments(allSplits, embeddings, {
        uri: DB_PATH,
        tableName: tableName,
      });
      console.log("新しいテーブルを作成してドキュメントを追加しました");
    } else {
      // テーブルが存在する場合
      try {
        const dbTable = await db.openTable(tableName);
        const rowCount = await dbTable.countRows();

        if (rowCount === 0) {
          // テーブルは存在するが空の場合、fromDocumentsで初期化
          console.log(
            "空のテーブルが存在するため、fromDocumentsで初期化します"
          );
          await LanceDB.fromDocuments(allSplits, embeddings, {
            uri: DB_PATH,
            tableName: tableName,
          });
        } else {
          // テーブルにデータが存在する場合、通常の追加処理
          console.log("既存のテーブルにドキュメントを追加します");
          const vectorStore = new LanceDB(embeddings, {
            table: dbTable,
          });
          await vectorStore.addDocuments(allSplits);
        }
      } catch {
        console.log("テーブル操作でエラーが発生、fromDocumentsで再作成します");
        await LanceDB.fromDocuments(allSplits, embeddings, {
          uri: DB_PATH,
          tableName: tableName,
        });
      }
    }

    console.log(
      `${allSplits.length}個のドキュメントチャンクをベクトルストアに追加しました`
    );

    // 追加後のテーブル状態を確認
    const finalTable = await db.openTable(tableName);
    const totalRows = await finalTable.countRows();
    console.log(`テーブル内の総行数: ${totalRows}`);

    return {
      message: "PDFファイルの処理が完了しました",
      totalChunks: allSplits.length,
      totalRowsInTable: totalRows,
    };
  }

  /**
   * YouTube動画を処理してベクトルストアに追加（本番用：統一テーブル使用）
   */
  async processYoutubeVideo(
    videoUrls?: string[]
  ): Promise<DocumentProcessResult> {
    // 本番用は統一テーブルを使用
    const tableName = TABLE_NAMES.DOCUMENTS;
    const inputUrls =
      videoUrls && videoUrls.length > 0 ? videoUrls : [YOUTUBE_TEST_URL];
    const urlsToProcess: string[] = [];

    // 各URLが既に処理済みか確認
    for (const url of inputUrls) {
      if (await this.isSourceExists(tableName, url)) {
        console.log(`URL ${url} は既に処理済みのため、スキップします`);
      } else {
        urlsToProcess.push(url);
      }
    }

    if (urlsToProcess.length === 0) {
      return {
        message: "指定されたYouTube動画はすべて処理済みです",
        totalChunks: 0,
      };
    }

    // Innertubeクライアントを作成（ボット検出回避のための設定）
    const youtube = await Innertube.create({
      generate_session_locally: true,
      lang: "ja",
      location: "JP",
      retrieve_player: false,
    });

    let allDocs: Document[] = [];
    for (const url of urlsToProcess) {
      console.log(`Processing YouTube URL: ${url}`);
      
      // URLから動画IDを抽出
      let videoId: string;
      try {
        const urlObj = new URL(url);
        const vParam = urlObj.searchParams.get("v");
        if (!vParam) {
          throw new Error("動画IDが見つかりません");
        }
        videoId = vParam;
      } catch {
        // URLパースに失敗した場合、従来のsplit方式をフォールバック
        const splitResult = url.split("v=")[1];
        if (!splitResult) {
          console.error(`Invalid YouTube URL: ${url}`);
          continue;
        }
        videoId = splitResult.split(/[&#]/)[0];
      }

      try {
        // getBasicInfoを使用してキャプショントラックを取得
        const info = await youtube.getBasicInfo(videoId);
        const captionTracks = info.captions?.caption_tracks;

        if (!captionTracks || captionTracks.length === 0) {
          console.error(
            `No caption tracks found for ${url}. Skipping...`
          );
          continue;
        }

        // 日本語または英語のキャプショントラックを探す（自動生成以外を優先）
        const jaTrack =
          captionTracks.find((t) => t.language_code === "ja" && t.kind !== "asr") ||
          captionTracks.find((t) => t.language_code?.startsWith("ja"));
        
        const enTrack =
          captionTracks.find((t) => t.language_code === "en" && t.kind !== "asr") ||
          captionTracks.find((t) => t.language_code?.startsWith("en"));

        const selectedTrack = jaTrack || enTrack || captionTracks[0];

        if (!selectedTrack?.base_url) {
          console.error(`No valid caption URL found for ${url}. Skipping...`);
          continue;
        }

        console.log(
          `Using caption track: ${selectedTrack.language_code} (${selectedTrack.kind || "manual"})`
        );

        // キャプショントラックを取得
        const transcriptText = await fetchCaptionTrack(selectedTrack.base_url);

        if (!transcriptText || transcriptText.trim().length === 0) {
          console.error(`Empty transcript for ${url}. Skipping...`);
          continue;
        }

        // メタデータを含むDocumentを作成
        // 既存のテーブルスキーマと互換性を保つため、sourceフィールドのみを使用
        const doc = new Document({
          pageContent: transcriptText,
          metadata: {
            source: url,
          },
        });

        allDocs.push(doc);
        console.log(`Successfully processed ${url}`);
      } catch (error) {
        console.error(`Error loading YouTube URL ${url}:`, error);
        continue; // エラーが発生した場合、そのURLの処理をスキップ
      }
    }

    // 処理できたドキュメントがない場合は早期リターン
    if (allDocs.length === 0) {
      return {
        message:
          "処理可能なYouTube動画が見つかりませんでした（キャプションが利用できない可能性があります）",
        totalChunks: 0,
      };
    }
    for (const doc of allDocs) {
      console.log(`Document contents: ${doc.pageContent.substring(0, 100)}...`);
    }
    const allSplits = await textSplitter.splitDocuments(allDocs);
    console.log(`Split into ${allSplits.length} chunks.`);

    // 分割後のチャンクが空の場合も早期リターン
    if (allSplits.length === 0) {
      return {
        message: "ドキュメントの分割処理後にチャンクが生成されませんでした",
        totalChunks: 0,
      };
    }

    const db = getDatabase();
    const tableNames = await db.tableNames();

    if (!tableNames.includes(tableName)) {
      // テーブルが存在しない場合は、直接ドキュメントから作成
      console.log(`${tableName}テーブルが存在しないため、新しく作成します`);
      await LanceDB.fromDocuments(allSplits, embeddings, {
        uri: DB_PATH,
        tableName: tableName,
      });
      console.log("新しいテーブルを作成してドキュメントを追加しました");
    } else {
      // テーブルが存在する場合
      const dbTable = await db.openTable(tableName);
      const vectorStore = new LanceDB(embeddings, {
        table: dbTable,
      });
      await vectorStore.addDocuments(allSplits);
      console.log("既存のテーブルにドキュメントを追加しました");
    }

    // 追加後のテーブル状態を確認
    const finalTable = await db.openTable(tableName);
    const totalRows = await finalTable.countRows();
    console.log(`テーブル内の総行数: ${totalRows}`);

    return {
      message: `YouTube動画の処理が完了しました (新規${allDocs.length}件 / 全${inputUrls.length}件)`,
      totalChunks: allSplits.length,
      totalRowsInTable: totalRows,
    };
  }

  /**
   * YouTubeプレイリストを処理してベクトルストアに追加
   */
  async processYoutubePlaylist(
    playlistUrl: string
  ): Promise<DocumentProcessResult> {
    try {
      const youtube = await Innertube.create({
        lang: "ja",
        retrieve_player: false,
      });

      // URLからプレイリストIDを安全に抽出
      let playlistId: string;
      try {
        const url = new URL(playlistUrl);
        const listParam = url.searchParams.get("list");
        if (!listParam) {
          throw new Error("プレイリストIDが見つかりません");
        }
        playlistId = listParam;
      } catch {
        // URLパースに失敗した場合、従来のsplit方式をフォールバック
        const splitResult = playlistUrl.split("list=")[1];
        if (!splitResult) {
          throw new Error("無効なプレイリストURLです");
        }
        // URLパラメータの境界文字（&や#）で区切る
        playlistId = splitResult.split(/[&#]/)[0];
      }

      if (!playlistId) {
        throw new Error("無効なプレイリストURLです");
      }
      const playlist = await youtube.getPlaylist(playlistId);

      if (!playlist || !playlist.videos) {
        return {
          message: "プレイリストが見つからないか、動画が含まれていません",
          totalChunks: 0,
        };
      }
      const videoUrls = playlist.videos
        .map((video) => {
          const videoId =
            "id" in video ? (video as { id?: string }).id : undefined;
          return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
        })
        .filter((url): url is string => url !== null);

      if (videoUrls.length === 0) {
        return {
          message: "プレイリストに動画が見つかりませんでした",
          totalChunks: 0,
        };
      }

      return await this.processYoutubeVideo(videoUrls);
    } catch (error) {
      console.error("Error processing YouTube playlist:", error);
      throw new Error("YouTubeプレイリストの処理中にエラーが発生しました");
    }
  }
}
