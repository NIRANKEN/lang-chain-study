import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { Document } from "@langchain/core/documents";
import { getDatabase } from "../config/database";
import { embeddings, textSplitter } from "../config/models";
import {
  PDF_FILE_PATH,
  YOUTUBE_TEST_URL,
  TABLE_NAMES,
  DB_PATH,
} from "../config/constants";
import { DocumentProcessResult } from "../types";

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
    // 処理前に同じソースのドキュメントが存在するか確認
    if (await this.isSourceExists(TABLE_NAMES.TRAVEL_REPORTS, PDF_FILE_PATH)) {
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

    if (!tableNames.includes(TABLE_NAMES.TRAVEL_REPORTS)) {
      // テーブルが存在しない場合は、直接ドキュメントから作成
      console.log("travel_reportsテーブルが存在しないため、新しく作成します");
      await LanceDB.fromDocuments(allSplits, embeddings, {
        uri: DB_PATH,
        tableName: TABLE_NAMES.TRAVEL_REPORTS,
      });
      console.log("新しいテーブルを作成してドキュメントを追加しました");
    } else {
      // テーブルが存在する場合
      try {
        const dbTable = await db.openTable(TABLE_NAMES.TRAVEL_REPORTS);
        const rowCount = await dbTable.countRows();

        if (rowCount === 0) {
          // テーブルは存在するが空の場合、fromDocumentsで初期化
          console.log(
            "空のテーブルが存在するため、fromDocumentsで初期化します"
          );
          await LanceDB.fromDocuments(allSplits, embeddings, {
            uri: DB_PATH,
            tableName: TABLE_NAMES.TRAVEL_REPORTS,
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
          tableName: TABLE_NAMES.TRAVEL_REPORTS,
        });
      }
    }

    console.log(
      `${allSplits.length}個のドキュメントチャンクをベクトルストアに追加しました`
    );

    // 追加後のテーブル状態を確認
    const finalTable = await db.openTable(TABLE_NAMES.TRAVEL_REPORTS);
    const totalRows = await finalTable.countRows();
    console.log(`テーブル内の総行数: ${totalRows}`);

    return {
      message: "PDFファイルの処理が完了しました",
      totalChunks: allSplits.length,
      totalRowsInTable: totalRows,
    };
  }

  /**
   * YouTube動画を処理してベクトルストアに追加
   */
  async processYoutubeVideo(
    videoUrls?: string[]
  ): Promise<DocumentProcessResult> {
    const inputUrls =
      videoUrls && videoUrls.length > 0 ? videoUrls : [YOUTUBE_TEST_URL];
    const urlsToProcess: string[] = [];

    // 各URLが既に処理済みか確認
    for (const url of inputUrls) {
      if (await this.isSourceExists(TABLE_NAMES.YOUTUBE_VIDEOS, url)) {
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
      const docs = await ytLoader.load();

      // 各ドキュメントのメタデータに完全なURLをsourceとして設定
      docs.forEach((doc) => {
        doc.metadata.source = url;
      });

      allDocs = allDocs.concat(docs);
    }
    const allSplits = await textSplitter.splitDocuments(allDocs);
    console.log(`Split into ${allSplits.length} chunks.`);

    const db = getDatabase();
    const tableNames = await db.tableNames();

    if (!tableNames.includes(TABLE_NAMES.YOUTUBE_VIDEOS)) {
      // テーブルが存在しない場合は、直接ドキュメントから作成
      console.log("youtube_videosテーブルが存在しないため、新しく作成します");
      await LanceDB.fromDocuments(allSplits, embeddings, {
        uri: DB_PATH,
        tableName: TABLE_NAMES.YOUTUBE_VIDEOS,
      });
      console.log("新しいテーブルを作成してドキュメントを追加しました");
    } else {
      // テーブルが存在する場合
      const dbTable = await db.openTable(TABLE_NAMES.YOUTUBE_VIDEOS);
      const vectorStore = new LanceDB(embeddings, {
        table: dbTable,
      });
      await vectorStore.addDocuments(allSplits);
      console.log("既存のテーブルにドキュメントを追加しました");
    }

    return {
      message: `YouTube動画の処理が完了しました (新規${urlsToProcess.length}件 / 全${inputUrls.length}件)`,
      totalChunks: allSplits.length,
    };
  }
}
