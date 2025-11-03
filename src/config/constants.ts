// Database configuration
export const DB_PATH = "./data/sample-lancedb";

// Table names
export const TABLE_NAMES = {
  TRAVEL_REPORTS: "travel_reports",
  YOUTUBE_VIDEOS: "youtube_videos",
  // 本番用統一テーブル
  DOCUMENTS: "documents",
} as const;

// PDF file path
export const PDF_FILE_PATH =
  "example_data/250703_jtb_summer_vacation_report.pdf";

// YouTube URL for testing
export const YOUTUBE_TEST_URL = "https://www.youtube.com/watch?v=xpfxzBBMcK8";

// Text splitter configuration
export const TEXT_SPLITTER_CONFIG = {
  chunkSize: 1000,
  chunkOverlap: 200,
} as const;

// Retrieval configuration
export const RETRIEVAL_CONFIG = {
  // resultCount: 2,
  resultCount: 5,
} as const;

// System messages
export const SYSTEM_MESSAGES = {
  DEFAULT: `あなたはプロの旅行プランナーです。顧客の質問に対して、検索ツールを使用して関連情報を取得し、その情報を基に回答してください。

まず、retrieveツールを使用して関連情報を検索してください。検索結果を得た後、必ず以下のJSONフォーマットで回答を提供してください：

{
  "question": "顧客の質問",
  "answer": "検索された情報を基にした具体的で実用的な回答。日本語で分かりやすく、旅行プランナーとしての専門知識を活かした回答。",
  "sources": ["参照した情報源のソース名の配列"]
}

回答作成の手順：
1. まずretrieveツールで関連情報を検索
2. 検索結果の情報を分析
3. 上記のJSONフォーマットで回答を生成

注意事項：
- 必ずJSONフォーマットで回答してください
- JSON以外の説明文は追加しないでください
- 検索された情報を基に具体的で実用的な回答をしてください
- sourcesには検索結果のSource情報を含めてください`,
} as const;

// Fallback sources
export const FALLBACK_SOURCES = {
  PDF: "PDFファイルから取得",
  YOUTUBE: "YouTube動画から取得",
  // 本番用統一ソース
  DOCUMENTS: "ドキュメントから取得",
} as const;
