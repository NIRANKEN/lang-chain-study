import * as lancedb from "@lancedb/lancedb";
import { mkdir } from "fs/promises";
import { DB_PATH } from "./constants.js";

let db: lancedb.Connection | null = null;

export async function initializeDatabase(): Promise<lancedb.Connection> {
  if (db) {
    return db;
  }

  try {
    await mkdir(DB_PATH, { recursive: true });
    console.log(`データディレクトリを作成/確認しました: ${DB_PATH}`);
  } catch {
    console.log(`ディレクトリは既に存在します: ${DB_PATH}`);
  }

  db = await lancedb.connect(DB_PATH);
  console.log(`LanceDB に接続しました: ${DB_PATH}`);
  
  return db;
}

export function getDatabase(): lancedb.Connection {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return db;
}