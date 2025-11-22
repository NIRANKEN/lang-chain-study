import { Router, IRouter } from "express";
import { ChatController } from "../controllers/chatController.js";
import { VectorController } from "../controllers/vectorController.js";
import { RagController } from "../controllers/ragController.js";
import { YoutubeController } from "../controllers/youtubeController.js";

const router: IRouter = Router();

// 非同期でコントローラーインスタンスを作成してルートを設定
const initializeRoutes = async () => {
  const chatController = new ChatController();
  const vectorController = new VectorController();
  const ragController = new RagController();
  const youtubeController = await YoutubeController.create();

  // 基本的なルート
  router.get("/", chatController.getApiInfo.bind(chatController));
router.get("/health", chatController.healthCheck.bind(chatController));

// チャットルート
router.post("/chat", chatController.chat.bind(chatController));

// RESTful API エンドポイント
router.post(
  "/api/v1/vector-store/init",
  vectorController.initializeVectorStore.bind(vectorController)
);
router.post(
  "/api/v1/documents",
  vectorController.addDocuments.bind(vectorController)
);
router.post(
  "/api/v1/youtube-videos",
  vectorController.addYoutubeVideos.bind(vectorController)
);
router.post(
  "/api/v1/youtube-playlist",
  vectorController.addYoutubePlaylist.bind(vectorController)
);
router.post("/api/v1/search", ragController.search.bind(ragController));

// YouTube検索ルート
router.post(
  "/api/v1/youtube/search",
  youtubeController.searchVideos.bind(youtubeController)
);
};

initializeRoutes();

export default router;
