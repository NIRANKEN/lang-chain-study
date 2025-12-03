import express, { Application } from "express";
import dotenv from "dotenv";
import { initializeRoutes } from "./routes/index.js";
import { initializeDatabase } from "./config/database.js";

// Load environment variables
dotenv.config();

export async function createApp(): Promise<Application> {
  const app: Application = express();

  // Middleware
  app.use(express.json());

  // Initialize database
  await initializeDatabase();

  // Initialize routes
  const routes = await initializeRoutes();
  app.use("/", routes);

  return app;
}

export function startServer(app: Application): void {
  const port = process.env.PORT || 8080;

  const server = app.listen(port, () => {
    console.log(`\n🚀 サーバーが起動しました: http://localhost:${port}`);
    console.log(`📝 環境: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔑 Google API Key設定済み: ${!!process.env.GOOGLE_API_KEY}`);
    console.log(
      `🔄 ホットリロード有効 - ファイルを保存すると自動的に再起動します\n`
    );

    // Log available endpoints
    console.log("📋 利用可能なエンドポイント:");
    console.log("  GET  / - API ヘルプ");
    console.log("  GET  /health - ヘルスチェック");
    console.log("  POST /chat - 基本的なチャット");
    console.log("  POST /initialize-vector-store - ベクトルストア初期化");
    console.log("  POST /input-test - PDFデータ追加");
    console.log("  POST /input-youtube-test - YouTube動画データ追加");
    console.log("  POST /output-test - RAG検索・回答（PDF）");
    console.log("  POST /output-youtube-test - RAG検索・回答（YouTube）");
    console.log(`  🌐 Lance Data Viewer: http://localhost:8090\n`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} signal received: closing HTTP server gracefully`);
    server.close((err) => {
      if (err) {
        console.error("Error closing server:", err);
        process.exit(1);
      }
      console.log("HTTP server closed");
      process.exit(0);
    });
  };

  // Handle different termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart signal

  // Handle uncaught exceptions and rejections for development
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("UNHANDLED_REJECTION");
  });
}