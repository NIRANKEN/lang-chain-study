import { Router, IRouter } from "express";
import { ChatController } from "../controllers/chatController";
import { VectorController } from "../controllers/vectorController";
import { RagController } from "../controllers/ragController";

const router: IRouter = Router();

// コントローラーインスタンスを作成
const chatController = new ChatController();
const vectorController = new VectorController();
const ragController = new RagController();

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

export default router;
