import express, { Request, Response, Application } from "express";
import dotenv from "dotenv";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
// import { JSONLoader } from "@langchain/classic/document_loaders/fs/json";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { mkdir } from "fs/promises";

// import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import * as z from "zod";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import * as lancedb from "@lancedb/lancedb";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.GOOGLE_API_KEY) {
  throw new Error(
    "GOOGLE_API_KEY environment variable is required. Please set it in your .env file."
  );
}

const app: Application = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// lanceDB - データディレクトリを作成（存在しない場合）
const dbPath = "./data/sample-lancedb";
try {
  await mkdir(dbPath, { recursive: true });
  console.log(`データディレクトリを作成/確認しました: ${dbPath}`);
} catch {
  console.log(`ディレクトリは既に存在します: ${dbPath}`);
}
const db = await lancedb.connect(dbPath);
console.log(`LanceDB に接続しました: ${dbPath}`);

// Initialize Google GenAI model
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.7,
});

// Create a prompt template
const promptTemplate = PromptTemplate.fromTemplate(
  "あなたは親切なアシスタントです。以下の質問に日本語で答えてください: {question}"
);

// Create chain with LCEL (LangChain Expression Language)
const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());

// Initialize text splitter and embeddings (must be before endpoints)
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
console.log("テキストスプリッターが初期化されました。");

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
});
console.log("埋め込みモデルが初期化されました。");

// Routes
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "LangChain Tutorial API へようこそ！",
    endpoints: {
      "/": "このヘルプメッセージ",
      "/health": "ヘルスチェック",
      "POST /chat": '質問を送信 (body: { question: "your question" })',
      "POST /initialize-vector-store": "ベクトルストア用テーブルを初期化",
      "POST /input-test": "PDFファイルをベクトルストアに追加",
      "POST /output-test": 'RAG検索とAI回答を取得 - 構造化されたJSON形式で回答 (body: { question: "your question" })'
    },
    workflow: {
      "1": "POST /initialize-vector-store で環境をクリア（オプション）",
      "2": "POST /input-test でPDFデータを追加（テーブル自動作成）", 
      "3": "POST /output-test で質問と回答"
    }
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post("/chat", async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "質問が必要です" });
    }

    console.log(`質問を受信: ${question}`);

    const response = await chain.invoke({ question });

    res.json({
      question,
      answer: response,
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    res.status(500).json({
      error: "チャット処理中にエラーが発生しました",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// // Translation endpoint
// app.post("/translate", async (req: Request, res: Response) => {
//   try {
//     const { text, targetLang = "ja" } = req.body;

//     if (!text) {
//       return res.status(400).json({ error: "テキストが必要です" });
//     }

//     const translatePrompt = PromptTemplate.fromTemplate(
//       "Translate the following text to {targetLang}: {text}"
//     );

//     const translateChain = translatePrompt
//       .pipe(model)
//       .pipe(new StringOutputParser());

//     const translation = await translateChain.invoke({ text, targetLang });

//     res.json({
//       originalText: text,
//       translatedText: translation,
//       targetLanguage: targetLang,
//     });
//   } catch (error) {
//     console.error("Error in translate endpoint:", error);
//     res.status(500).json({
//       error: "翻訳処理中にエラーが発生しました",
//       details: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

app.post("/initialize-vector-store", async (req: Request, res: Response) => {
  try {
    // 既存のテーブルを削除（クリーンな状態から開始）
    try {
      const existingTables = await db.tableNames();
      if (existingTables.includes("travel_reports")) {
        await db.dropTable("travel_reports");
        console.log("既存の travel_reports テーブルを削除しました");
      }
    } catch {
      console.log("テーブル削除をスキップ（テーブルが存在しない可能性があります）");
    }

    console.log("ベクトルストア用ディレクトリを準備しました");
    
    // テーブルの実際の作成は /input-test で最初のドキュメント追加時に行われる
    const tableNames = await db.tableNames();
    console.log("利用可能なテーブル:", tableNames);

    res.json({ 
      message: "ベクトルストアが初期化されました。最初のドキュメント追加時にテーブルが作成されます。",
      tables: tableNames,
      nextStep: "POST /input-test を呼び出してPDFデータを追加してください"
    });
  } catch (error) {
    console.error("Error in initialize-vector-store endpoint:", error);
    res.status(500).json({
      error: "ベクトルストア初期化中にエラーが発生しました",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// const loader = new JSONLoader("example_data/example.json");
// Text splitter and embeddings are now initialized earlier in the code
console.log("メモリベクトルストアが初期化されました。");

// app.post("/json-input-test", async (req: Request, res: Response) => {
//   try {
//     // initialize vector store
//     const data = await loader.load();
//     const allSplits = await textSplitter.splitDocuments(data);
//     console.log(`Split into ${allSplits.length} chunks.`);
//     await vectorStore.addDocuments(allSplits);

//     res.json(data);
//   } catch (error) {
//     console.error("Error in json-test endpoint:", error);
//     res.status(500).json({
//       error: "JSONテスト処理中にエラーが発生しました",
//       details: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

const pdfLoader = new PDFLoader(
  "example_data/250703_jtb_summer_vacation_report.pdf"
);
console.log("PDFローダーが初期化されました。");
app.post("/input-test", async (req: Request, res: Response) => {
  try {
    // PDFファイルを読み込み、チャンクに分割
    const data = await pdfLoader.load();
    const allSplits = await textSplitter.splitDocuments(data);
    console.log(`Split into ${allSplits.length} chunks.`);

    // テーブルが存在するかチェック
    const tableNames = await db.tableNames();
    if (!tableNames.includes("travel_reports")) {
      // テーブルが存在しない場合は、直接ドキュメントから作成
      console.log("travel_reportsテーブルが存在しないため、新しく作成します");
      await LanceDB.fromDocuments(allSplits, embeddings, {
        uri: "./data/sample-lancedb",
        tableName: "travel_reports"
      });
      console.log("新しいテーブルを作成してドキュメントを追加しました");
    } else {
      // テーブルが存在する場合
      try {
        const dbTable: lancedb.Table = await db.openTable("travel_reports");
        const rowCount = await dbTable.countRows();
        
        if (rowCount === 0) {
          // テーブルは存在するが空の場合、fromDocumentsで初期化
          console.log("空のテーブルが存在するため、fromDocumentsで初期化します");
          await LanceDB.fromDocuments(allSplits, embeddings, {
            uri: "./data/sample-lancedb",
            tableName: "travel_reports"
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
          uri: "./data/sample-lancedb",
          tableName: "travel_reports"
        });
      }
    }
    console.log(`${allSplits.length}個のドキュメントチャンクをベクトルストアに追加しました`);

    // 追加後のテーブル状態を確認
    const finalTable = await db.openTable("travel_reports");
    const totalRows = await finalTable.countRows();
    console.log(`テーブル内の総行数: ${totalRows}`);

    const result = {
      message: "PDFファイルの処理が完了しました",
      totalChunks: allSplits.length,
      totalRowsInTable: totalRows,
    };

    res.json(result);
  } catch (error) {
    console.error("Error in input-test endpoint:", error);
    res.status(500).json({
      error: "PDFテスト処理中にエラーが発生しました",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const retrieveSchema = z.object({ query: z.string() });

const systemMessage = `
あなたはプロの旅行プランナーです。顧客の質問に対して、提供された関連情報を基に回答してください。

**重要**: 回答は必ず以下のJSONフォーマットで出力してください。他の形式やテキストは一切含めないでください。

{
  "question": "顧客の質問をここに記載",
  "answer": "提供された情報を基にした具体的で実用的な回答をここに記載。日本語で分かりやすく、旅行プランナーとしての専門知識を活かした回答をしてください。",
  "sources": ["参照した情報源のファイル名やソース名の配列"]
}

回答作成時の注意点：
1. 提供された情報を基に具体的で実用的な回答をしてください
2. 回答の根拠となった情報源を必ずsources配列に含めてください
3. 日本語で分かりやすく回答してください
4. 旅行プランナーとしての専門知識を活かしてアドバイスしてください
5. JSONフォーマット以外の文章や説明は一切追加しないでください

質問に対して、関連する情報を検索し、上記のJSONフォーマットで回答を提供してください。
`;
app.post("/output-test", async (req: Request, res: Response) => {
  const { question } = req.body;
  try {
    // 質問が提供されているかチェック
    if (!question) {
      return res.status(400).json({ error: "質問が必要です" });
    }

    // テーブルが存在するかチェック
    const tableNames = await db.tableNames();
    if (!tableNames.includes("travel_reports")) {
      return res.status(400).json({
        error: "travel_reportsテーブルが存在しません",
        message: "先に /initialize-vector-store と /input-test エンドポイントを呼び出してデータを追加してください",
        availableTables: tableNames
      });
    }

    const retrieve = tool(
      async ({ query }) => {
        const resultCount = 2;
        const dbTable: lancedb.Table = await db.openTable("travel_reports");
        const vectorStore = new LanceDB(embeddings, {
          table: dbTable,
        });
        const retrievedResults = await vectorStore.similaritySearchWithScore(
          query,
          resultCount
        );
        const serialized = retrievedResults
          .map(
            (result) =>
              `Source: ${result[0].metadata.source}\nContent: ${result[0].pageContent}\nScore: ${result[1]}`
          )
          .join("\n");
        return [serialized, retrievedResults];
      },
      {
        name: "retrieve",
        description: "Retrieve information related to a query.",
        schema: retrieveSchema,
        responseFormat: "content_and_artifact",
      }
    );
    const agent = createAgent({
      model,
      tools: [retrieve],
      systemPrompt: systemMessage,
    });
    
    const agentInputs = { messages: [{ role: "user", content: question }] };
    const stream = await agent.stream(agentInputs, {
      streamMode: "values",
    });

    // ストリーミング結果を収集
    let finalAnswer = "";
    let retrievedSources: string[] = [];
    const conversationLog: Array<{ role: string; content: string }> = [];

    for await (const chunk of stream) {
      const lastMessage = chunk.messages[chunk.messages.length - 1];
      console.log(`[${lastMessage.role}]: ${lastMessage.content}`);
      
      // 会話ログに追加
      conversationLog.push({
        role: lastMessage.role,
        content: lastMessage.content
      });
      
      // 最終的なアシスタントの回答を保存
      if (lastMessage.role === "assistant" && lastMessage.content) {
        finalAnswer = lastMessage.content;
      }
      
      // ツール呼び出しの結果からソース情報を抽出
      for (const message of chunk.messages) {
        if (message.role === "tool" && message.content) {
          // ソース情報を抽出
          const sourceMatches = message.content.match(/Source: ([^\n]+)/g);
          if (sourceMatches) {
            sourceMatches.forEach((match: string) => {
              const source = match.replace("Source: ", "").trim();
              if (!retrievedSources.includes(source)) {
                retrievedSources.push(source);
              }
            });
          }
          
          // Content情報も保持（デバッグ用）
          console.log("Retrieved tool content:", message.content.substring(0, 200) + "...");
        }
      }
    }

    // 回答をJSONフォーマットでパースしようと試みる
    let structuredAnswer;
    let parsedSuccessfully = false;
    
    try {
      // まず、完全なJSONかチェック
      if (finalAnswer.trim().startsWith("{") && finalAnswer.trim().endsWith("}")) {
        structuredAnswer = JSON.parse(finalAnswer.trim());
        parsedSuccessfully = true;
      } else {
        // JSONが他のテキストに埋め込まれている場合を処理
        const jsonMatch = finalAnswer.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          structuredAnswer = JSON.parse(jsonMatch[0]);
          parsedSuccessfully = true;
        }
      }
      
      // パースしたJSONの構造を検証
      if (structuredAnswer && (!structuredAnswer.answer || !structuredAnswer.sources)) {
        console.log("JSONパースは成功したが、必要なフィールドが不足:", structuredAnswer);
        parsedSuccessfully = false;
      }
    } catch (parseError) {
      console.log("JSON parse error:", parseError);
      console.log("Original answer:", finalAnswer);
      parsedSuccessfully = false;
    }

    // パースに失敗した場合やフィールドが不足している場合のフォールバック
    if (!parsedSuccessfully) {
      structuredAnswer = {
        question: question,
        answer: finalAnswer || "回答を生成できませんでした。",
        sources: retrievedSources.length > 0 ? retrievedSources : ["PDFファイルから取得"]
      };
    }

    res.json({
      question: question,
      answer: structuredAnswer.answer,
      sources: structuredAnswer.sources,
      conversationLog: conversationLog,
      retrievedContext: retrievedSources.length,
      parsedSuccessfully: parsedSuccessfully
    });
  } catch (error) {
    console.error("Error in output-test endpoint:", error);
    res.status(500).json({
      error: "出力テスト処理中にエラーが発生しました",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Start server
const server = app.listen(port, () => {
  console.log(`\n🚀 サーバーが起動しました: http://localhost:${port}`);
  console.log(`📝 環境: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔑 Google API Key設定済み: ${!!process.env.GOOGLE_API_KEY}`);
  console.log(`🔄 ホットリロード有効 - ファイルを保存すると自動的に再起動します\n`);
  
  // Log available endpoints
  console.log('📋 利用可能なエンドポイント:');
  console.log('  GET  / - API ヘルプ');
  console.log('  GET  /health - ヘルスチェック'); 
  console.log('  POST /chat - 基本的なチャット');
  console.log('  POST /initialize-vector-store - ベクトルストア初期化');
  console.log('  POST /input-test - PDFデータ追加');
  console.log('  POST /output-test - RAG検索・回答');
  console.log(`  🌐 Lance Data Viewer: http://localhost:8090\n`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} signal received: closing HTTP server gracefully`);
  server.close((err) => {
    if (err) {
      console.error('Error closing server:', err);
      process.exit(1);
    }
    console.log('HTTP server closed');
    process.exit(0);
  });
};

// Handle different termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart signal

// Handle uncaught exceptions and rejections for development
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;
