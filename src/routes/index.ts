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

// ベクトルストア関連ルート
router.post("/initialize-vector-store", vectorController.initializeVectorStore.bind(vectorController));
router.post("/input-test", vectorController.inputPdfTest.bind(vectorController));
router.post("/input-youtube-test", vectorController.inputYoutubeTest.bind(vectorController));

// RAG検索・回答ルート
router.post("/output-test", ragController.outputTest.bind(ragController));
router.post("/output-youtube-test", ragController.outputYoutubeTest.bind(ragController));

export default router;