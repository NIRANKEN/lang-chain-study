import { getDatabase } from "../config/database";
import { TABLE_NAMES } from "../config/constants";

export class VectorStoreService {
  /**
   * ベクトルストアを初期化（既存テーブルをクリア）
   */
  async initializeVectorStore(): Promise<{ message: string; tables: string[]; nextStep: string }> {
    const db = getDatabase();

    // 既存のテーブルを削除（クリーンな状態から開始）
    try {
      const existingTables = await db.tableNames();
      if (existingTables.includes(TABLE_NAMES.TRAVEL_REPORTS)) {
        await db.dropTable(TABLE_NAMES.TRAVEL_REPORTS);
        console.log("既存の travel_reports テーブルを削除しました");
      }
    } catch {
      console.log(
        "テーブル削除をスキップ（テーブルが存在しない可能性があります）"
      );
    }

    console.log("ベクトルストア用ディレクトリを準備しました");

    // テーブルの実際の作成は /input-test で最初のドキュメント追加時に行われる
    const tableNames = await db.tableNames();
    console.log("利用可能なテーブル:", tableNames);

    return {
      message:
        "ベクトルストアが初期化されました。最初のドキュメント追加時にテーブルが作成されます。",
      tables: tableNames,
      nextStep: "POST /input-test を呼び出してPDFデータを追加してください",
    };
  }

  /**
   * 利用可能なテーブル一覧を取得
   */
  async getAvailableTables(): Promise<string[]> {
    const db = getDatabase();
    return await db.tableNames();
  }

  /**
   * 指定されたテーブルが存在するかチェック
   */
  async tableExists(tableName: string): Promise<boolean> {
    const tables = await this.getAvailableTables();
    return tables.includes(tableName);
  }
}