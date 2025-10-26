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

import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import * as z from "zod";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

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

// Routes
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "LangChain Tutorial API へようこそ！",
    endpoints: {
      "/": "このヘルプメッセージ",
      "/health": "ヘルスチェック",
      "POST /chat": '質問を送信 (body: { question: "your question" })',
      "POST /translate":
        'テキストを翻訳 (body: { text: "text", targetLang: "ja" })',
    },
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

// const loader = new JSONLoader("example_data/example.json");
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
const vectorStore = new MemoryVectorStore(embeddings);
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
    // initialize vector store
    const data = await pdfLoader.load();
    const allSplits = await textSplitter.splitDocuments(data);
    console.log(`Split into ${allSplits.length} chunks.`);
    await vectorStore.addDocuments(allSplits);

    const result = {
      message: "PDFファイルの処理が完了しました",
      totalChunks: allSplits.length,
    };

    res.json(result);
  } catch (error) {
    console.error("Error in json-test endpoint:", error);
    res.status(500).json({
      error: "JSONテスト処理中にエラーが発生しました",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const retrieveSchema = z.object({ query: z.string() });

const systemMessage = `
  あなたはプロの旅行プランナーです。顧客の質問に対して、関連する情報を提供して質問に回答してください。レスポンスは下記のフォーマットに従ってください。
  フォーマット:
  {
    "question": "ここに質問を書く",
    "answer": "ここに回答を書く",
    "sources": ["ソースファイル１", "ソースファイル２"]
  }
`;
app.post("/output-test", async (req: Request, res: Response) => {
  const { question } = req.body;
  try {
    const retrieve = tool(
      async ({ query }) => {
        const resultCount = 2;
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
    // TODO: roleってなに？
    const agentInputs = { messages: [{ role: "user", content: question }] };
    const stream = await agent.stream(agentInputs, {
      streamMode: "values",
    });

    for await (const chunk of stream) {
      const lastMessage = chunk.messages[chunk.messages.length - 1];
      console.log(`[${lastMessage.role}]: ${lastMessage.content}`);
      console.log("-----\n");
      // if (chunk.name === "final_response") {
      //   res.json({
      //     question,
      //     answer: chunk.value,
      //   });
      // }
    }
    res.json({
      message: "Output test completed. Check server logs for details.",
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
  console.log(`🚀 サーバーが起動しました: http://localhost:${port}`);
  console.log(`環境: ${process.env.NODE_ENV || "development"}`);
  console.log(`Google API Key設定済み: ${!!process.env.GOOGLE_API_KEY}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

export default app;
