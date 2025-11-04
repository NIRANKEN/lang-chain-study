import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
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

    let allDocs: Document[] = [];
    for (const url of urlsToProcess) {
      console.log(`Processing YouTube URL: ${url}`);
      const ytLoader = YoutubeLoader.createFromUrl(url, {
        language: "ja",
        addVideoInfo: true,
      });
      try {
        const docs = await ytLoader.load();
        // 各ドキュメントのメタデータに完全なURLをsourceとして設定
        docs.forEach((doc) => {
          doc.metadata.source = url;
        });

        allDocs = allDocs.concat(docs);
      } catch (error) {
        console.error(`Error loading YouTube URL ${url}:`, error);
        continue; // エラーが発生した場合、そのURLの処理をスキップ
      }
    }

    // 処理できたドキュメントがない場合は早期リターン
    if (allDocs.length === 0) {
      return {
        message: "処理可能なYouTube動画が見つかりませんでした（トランスクリプトが利用できない可能性があります）",
        totalChunks: 0,
      };
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
      message: `YouTube動画の処理が完了しました (新規${urlsToProcess.length}件 / 全${inputUrls.length}件)`,
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
